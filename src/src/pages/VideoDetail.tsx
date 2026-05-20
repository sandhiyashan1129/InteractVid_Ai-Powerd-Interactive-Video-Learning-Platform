import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { VideoPlayer } from "@/components/VideoPlayer";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, Brain, FileText, MessageCircle, Loader2, ArrowLeft, CheckCircle2, XCircle, Send, Activity, GraduationCap } from "lucide-react";
import { callAI } from "@/lib/ai";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { getEngagement, engagementLabel, setReminder, markTopic } from "@/lib/engagement";
import { awardXp } from "@/lib/gamification";

const VideoDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [video, setVideo] = useState<any>(null);
  const [artifacts, setArtifacts] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [duration, setDuration] = useState(0);
  const [resumeAt, setResumeAt] = useState(0);
  const lastSave = useRef(0);

  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Chat
  const [chat, setChat] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const { data: v } = await supabase.from("videos").select("*").eq("id", id).single();
      setVideo(v);
      const { data: arts } = await supabase.from("video_artifacts").select("*").eq("video_id", id).eq("user_id", user.id);
      const m: Record<string, any> = {};
      (arts || []).forEach(a => { m[a.kind] = a.content; });
      setArtifacts(m);
      const { data: wp } = await supabase.from("watch_progress").select("*").eq("video_id", id).eq("user_id", user.id).maybeSingle();
      if (wp) setResumeAt(wp.last_position_seconds);
      const { data: msgs } = await supabase.from("chat_messages").select("*").eq("video_id", id).eq("user_id", user.id).order("created_at");
      setChat((msgs || []).map(m => ({ role: m.role as any, content: m.content })));
    })();
  }, [id, user]);

  const saveProgress = async (t: number, dur: number) => {
    if (!user || !id) return;
    if (Date.now() - lastSave.current < 5000) return; // throttle
    lastSave.current = Date.now();
    const completed = dur > 0 && t / dur > 0.95;
    await supabase.from("watch_progress").upsert({
      user_id: user.id, video_id: id,
      last_position_seconds: Math.floor(t),
      total_watch_seconds: Math.floor(t),
      completed,
    }, { onConflict: "user_id,video_id" });
    if (dur > 0 && video?.topic) markTopic(video.topic, Math.min(100, (t / dur) * 100));
    if (completed && video) {
      // Schedule revision reminder in 2 days
      setReminder({ videoId: id, videoTitle: video.title, topic: video.topic, remindAt: Date.now() + 1000 * 60 * 60 * 48 });
    }
  };

  const generate = async (kind: "summary" | "quiz" | "notes" | "timeline") => {
    if (!video || !user) return;
    setLoading(l => ({ ...l, [kind]: true }));
    try {
      const data = await callAI({
        task: kind, title: video.title, topic: video.topic,
        description: video.description, duration: duration || video.duration_seconds,
      });
      await supabase.from("video_artifacts").delete().eq("video_id", id).eq("kind", kind);
      await supabase.from("video_artifacts").insert({ user_id: user.id, video_id: id, kind, content: data });
      setArtifacts(a => ({ ...a, [kind]: data }));
      if (kind === "quiz") { setQuizAnswers({}); setQuizSubmitted(false); }
      toast.success(`${kind} generated`);
    } catch {} finally { setLoading(l => ({ ...l, [kind]: false })); }
  };

  const submitQuiz = async () => {
    const qz = artifacts.quiz?.questions || [];
    let score = 0;
    qz.forEach((q: any, i: number) => { if (quizAnswers[i] === q.correct_index) score++; });
    setQuizSubmitted(true);
    await supabase.from("quiz_attempts").insert({
      user_id: user!.id, video_id: id!, score, total: qz.length, answers: quizAnswers,
    });
    await awardXp(user!.id, score * 5, "Tab quiz completed");
    toast.success(`You scored ${score}/${qz.length}`);
  };

  const sendChat = async () => {
    if (!chatInput.trim() || !user || !video) return;
    const q = chatInput.trim(); setChatInput(""); setChatBusy(true);
    const newChat = [...chat, { role: "user" as const, content: q }];
    setChat(newChat);
    await supabase.from("chat_messages").insert({ user_id: user.id, video_id: id, role: "user", content: q });
    try {
      const data = await callAI({ task: "chat", title: video.title, topic: video.topic, question: q, history: chat });
      const reply = data.reply;
      setChat([...newChat, { role: "assistant", content: reply }]);
      await supabase.from("chat_messages").insert({ user_id: user.id, video_id: id, role: "assistant", content: reply });
    } catch {} finally { setChatBusy(false); }
  };

  if (!video) return <div className="p-12 text-center text-muted-foreground">Loading…</div>;

  const chapters = artifacts.timeline?.chapters || [];
  const engagement = getEngagement(video.id);
  const eng = engagementLabel(engagement);

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button asChild variant="ghost" size="icon"><Link to="/learning"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold truncate">{video.title}</h1>
            <p className="text-sm text-muted-foreground truncate">{video.topic || "General"} {resumeAt > 0 && `• Resuming from ${Math.floor(resumeAt)}s`}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button asChild size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10">
            <Link to={`/exam/${video.id}`}><GraduationCap className="h-3.5 w-3.5 mr-1.5" /> Exam Mode</Link>
          </Button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-border/60" title={`Pauses: ${engagement.pauses} • Replays: ${engagement.replays} • Seeks: ${engagement.seeks}`}>
            <Activity className={`h-3.5 w-3.5 ${eng.color}`} />
            <span className={`text-xs font-medium ${eng.color}`}>{eng.label}</span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <VideoPlayer
            videoId={video.id} videoTitle={video.title} videoTopic={video.topic} videoDescription={video.description}
            source_url={video.source_url} source_type={video.source_type} videoOwnerId={video.user_id}
            chapters={chapters} initialTime={resumeAt}
            onReady={(d) => { setDuration(d); if (!video.duration_seconds) supabase.from("videos").update({ duration_seconds: Math.floor(d) }).eq("id", video.id); }}
            onTimeUpdate={(t, d) => saveProgress(t, d)}
          />
        </div>

        <div className="lg:col-span-1">
          <Tabs defaultValue="summary" className="glass-card rounded-xl p-4">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="summary"><Sparkles className="h-3.5 w-3.5" /></TabsTrigger>
              <TabsTrigger value="quiz"><Brain className="h-3.5 w-3.5" /></TabsTrigger>
              <TabsTrigger value="notes"><FileText className="h-3.5 w-3.5" /></TabsTrigger>
              <TabsTrigger value="chat"><MessageCircle className="h-3.5 w-3.5" /></TabsTrigger>
            </TabsList>

            {/* Summary */}
            <TabsContent value="summary" className="mt-4 space-y-3 max-h-[600px] overflow-y-auto">
              <div className="flex gap-2">
                <Button onClick={() => generate("summary")} disabled={loading.summary} size="sm" className="bg-gradient-neon text-primary-foreground glow-cyan">
                  {loading.summary ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />} Generate Summary
                </Button>
                <Button onClick={() => generate("timeline")} disabled={loading.timeline} size="sm" variant="outline">
                  {loading.timeline ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Timeline"}
                </Button>
              </div>
              {artifacts.summary && (
                <div className="space-y-3 animate-fade-in">
                  <p className="text-sm leading-relaxed">{artifacts.summary.summary}</p>
                  <div>
                    <div className="text-xs uppercase tracking-widest text-primary mb-2">Key Points</div>
                    <ul className="space-y-1.5">
                      {artifacts.summary.key_points?.map((k: string, i: number) => (
                        <li key={i} className="text-sm flex gap-2"><span className="text-primary">▸</span><span>{k}</span></li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Quiz */}
            <TabsContent value="quiz" className="mt-4 space-y-3 max-h-[600px] overflow-y-auto">
              <Button onClick={() => generate("quiz")} disabled={loading.quiz} size="sm" className="bg-gradient-neon text-primary-foreground glow-cyan w-full">
                {loading.quiz ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Brain className="h-3.5 w-3.5 mr-1.5" />} Generate Quiz
              </Button>
              {artifacts.quiz?.questions?.map((q: any, i: number) => (
                <div key={i} className="glass rounded-lg p-3 animate-fade-in">
                  <div className="text-sm font-semibold mb-2">{i + 1}. {q.question}</div>
                  <div className="space-y-1.5">
                    {q.options.map((o: string, oi: number) => {
                      const sel = quizAnswers[i] === oi;
                      const correct = quizSubmitted && oi === q.correct_index;
                      const wrong = quizSubmitted && sel && oi !== q.correct_index;
                      return (
                        <button key={oi} onClick={() => !quizSubmitted && setQuizAnswers(a => ({ ...a, [i]: oi }))}
                          className={`w-full text-left text-xs p-2 rounded-md border transition-smooth ${
                            correct ? "bg-success/15 border-success text-success-foreground" :
                            wrong ? "bg-destructive/15 border-destructive" :
                            sel ? "bg-primary/15 border-primary" : "border-border hover:border-primary/40"
                          }`}>
                          <span className="flex items-center gap-2">
                            {correct && <CheckCircle2 className="h-3 w-3 text-success" />}
                            {wrong && <XCircle className="h-3 w-3 text-destructive" />}
                            {o}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {quizSubmitted && <p className="text-xs text-muted-foreground mt-2 italic">{q.explanation}</p>}
                </div>
              ))}
              {artifacts.quiz?.questions?.length > 0 && !quizSubmitted && (
                <Button onClick={submitQuiz} className="w-full bg-secondary text-secondary-foreground glow-magenta">Submit Quiz</Button>
              )}
            </TabsContent>

            {/* Notes */}
            <TabsContent value="notes" className="mt-4 space-y-3 max-h-[600px] overflow-y-auto">
              <Button onClick={() => generate("notes")} disabled={loading.notes} size="sm" className="bg-gradient-neon text-primary-foreground glow-cyan w-full">
                {loading.notes ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileText className="h-3.5 w-3.5 mr-1.5" />} Generate Notes
              </Button>
              {artifacts.notes?.notes && (
                <div className="prose prose-sm prose-invert max-w-none text-sm animate-fade-in
                  prose-headings:text-primary prose-strong:text-foreground prose-a:text-primary">
                  <ReactMarkdown>{artifacts.notes.notes}</ReactMarkdown>
                </div>
              )}
            </TabsContent>

            {/* Chat */}
            <TabsContent value="chat" className="mt-4 flex flex-col h-[560px]">
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {chat.length === 0 && <p className="text-xs text-muted-foreground text-center pt-8">Ask anything about this video.</p>}
                {chat.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-lg p-2.5 text-xs ${
                      m.role === "user" ? "bg-primary/20 border border-primary/40" : "glass"
                    }`}>
                      <div className="prose prose-xs prose-invert max-w-none prose-p:my-1 prose-headings:my-1">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))}
                {chatBusy && <div className="text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin inline mr-1" /> thinking…</div>}
              </div>
              <div className="flex gap-2 pt-3 border-t border-border/40">
                <input
                  className="flex-1 bg-input rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Ask a doubt…" value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendChat()}
                />
                <Button size="icon" onClick={sendChat} disabled={chatBusy} className="bg-gradient-neon text-primary-foreground"><Send className="h-3.5 w-3.5" /></Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default VideoDetail;
