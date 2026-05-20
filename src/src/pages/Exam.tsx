import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Lock, CheckCircle2, XCircle, Trophy } from "lucide-react";
import { callAI } from "@/lib/ai";
import { toast } from "sonner";
import { awardXp, tryAwardBadge } from "@/lib/gamification";

type ExamQuestion = { question: string; options: string[]; correct_index: number; difficulty: string; explanation: string };

const Exam = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [video, setVideo] = useState<any>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [started, setStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const { data: v } = await supabase.from("videos").select("*").eq("id", id).single();
      setVideo(v);
    })();
  }, [id, user]);

  useEffect(() => {
    if (!started || submitted) return;
    const i = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(i);
  }, [started, submitted]);

  // Block tab switching attempts (warning only)
  useEffect(() => {
    if (!started || submitted) return;
    const onBlur = () => toast.error("⚠ Stay focused — exam in progress!");
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [started, submitted]);

  const startExam = async () => {
    if (!video) return;
    setLoading(true);
    try {
      const data = await callAI({
        task: "exam", title: video.title, topic: video.topic, description: video.description,
        duration: video.duration_seconds, num_questions: 10,
      });
      setQuestions(data.questions || []);
      setStarted(true);
      startedAt.current = Date.now();
    } catch {} finally { setLoading(false); }
  };

  const submit = async () => {
    if (!user || !id) return;
    let s = 0;
    questions.forEach((q, i) => { if (answers[i] === q.correct_index) s++; });
    setScore(s);
    setSubmitted(true);
    const dur = Math.floor((Date.now() - startedAt.current) / 1000);
    await supabase.from("exam_attempts").insert({
      user_id: user.id, video_id: id, score: s, total: questions.length, duration_seconds: dur, answers,
    });
    const pct = (s / questions.length) * 100;
    const xp = Math.round(s * 15);
    await awardXp(user.id, xp, "Exam completed");
    if (pct === 100) await tryAwardBadge(user.id, "perfect_exam", "Perfect Exam 💯");
    if (pct >= 80) await tryAwardBadge(user.id, "exam_pro", "Exam Pro 🎯");
    toast.success(`Exam complete: ${s}/${questions.length}`);
  };

  if (!video) return <div className="p-12 text-center text-muted-foreground">Loading…</div>;

  const fmtMin = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  if (!started) {
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <Button asChild variant="ghost" size="sm"><Link to={`/video/${id}`}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link></Button>
        <div className="glass-card neon-border rounded-2xl p-8 text-center space-y-4">
          <div className="inline-flex h-16 w-16 rounded-full bg-destructive/15 items-center justify-center mx-auto">
            <Lock className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="font-display text-3xl font-bold">Exam Mode</h1>
          <p className="text-muted-foreground">{video.title}</p>
          <div className="text-sm text-left bg-muted/30 rounded-lg p-4 space-y-2">
            <div>📋 10 AI-generated questions</div>
            <div>🚫 No pause, no skip, no rewind</div>
            <div>⏱️ Timed attempt</div>
            <div>🏆 +15 XP per correct answer</div>
            <div>💯 Earn the "Perfect Exam" badge for 100%</div>
          </div>
          <Button onClick={startExam} disabled={loading} size="lg" className="bg-gradient-neon text-primary-foreground glow-cyan">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trophy className="h-4 w-4 mr-2" />}
            Start Exam
          </Button>
        </div>
      </div>
    );
  }

  if (submitted) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="glass-card neon-border rounded-2xl p-8 text-center space-y-4">
          <Trophy className="h-16 w-16 text-primary mx-auto animate-pulse-glow" />
          <h1 className="font-display text-3xl font-bold neon-text">{score}/{questions.length}</h1>
          <p className="text-muted-foreground">{pct}% • {fmtMin(elapsed)} taken</p>
          <Button onClick={() => navigate(`/video/${id}`)} className="bg-gradient-neon text-primary-foreground glow-cyan">Back to Video</Button>
        </div>
        <div className="space-y-3">
          {questions.map((q, i) => {
            const correct = answers[i] === q.correct_index;
            return (
              <div key={i} className="glass-card rounded-xl p-4">
                <div className="flex items-start gap-2">
                  {correct ? <CheckCircle2 className="h-4 w-4 text-success mt-1 shrink-0" /> : <XCircle className="h-4 w-4 text-destructive mt-1 shrink-0" />}
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{i + 1}. {q.question}</p>
                    <p className="text-xs text-muted-foreground mt-1">Your answer: {answers[i] !== undefined ? q.options[answers[i]] : "—"}</p>
                    {!correct && <p className="text-xs text-success mt-1">Correct: {q.options[q.correct_index]}</p>}
                    <p className="text-xs italic text-muted-foreground mt-2">{q.explanation}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="sticky top-0 z-10 glass-card rounded-xl p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-destructive" />
          <span className="text-sm font-bold">Exam in progress</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="font-mono">{fmtMin(elapsed)}</span>
          <span className="text-muted-foreground">{Object.keys(answers).length}/{questions.length}</span>
        </div>
      </div>

      <div className="space-y-3">
        {questions.map((q, i) => (
          <div key={i} className="glass-card rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-sm flex-1">{i + 1}. {q.question}</p>
              <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-current text-muted-foreground">{q.difficulty}</span>
            </div>
            <div className="space-y-1.5">
              {q.options.map((o, oi) => {
                const sel = answers[i] === oi;
                return (
                  <button key={oi} onClick={() => setAnswers(a => ({ ...a, [i]: oi }))}
                    className={`w-full text-left text-xs p-2 rounded-md border transition-smooth ${sel ? "bg-primary/15 border-primary" : "border-border hover:border-primary/40"}`}>
                    {String.fromCharCode(65 + oi)}. {o}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Button onClick={submit} disabled={Object.keys(answers).length < questions.length} size="lg" className="w-full bg-gradient-neon text-primary-foreground glow-cyan">
        Submit Exam
      </Button>
    </div>
  );
};

export default Exam;
