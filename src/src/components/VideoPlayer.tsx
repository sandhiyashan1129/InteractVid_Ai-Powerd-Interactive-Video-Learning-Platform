import { useEffect, useRef, useState, useMemo } from "react";
import { ytId, callAI } from "@/lib/ai";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Mic, MicOff, Brain, Bookmark, Subtitles, Languages, Loader2, Search } from "lucide-react";
import { fmtTime } from "@/lib/ai";
import { toast } from "sonner";
import { InteractiveQuizPopup } from "@/components/InteractiveQuizPopup";
import { QuizConfigDialog } from "@/components/QuizConfigDialog";
import { loadPopupQuizzes, loadAttempts, recordAttempt, nextDifficulty, type PopupQuiz, type Difficulty } from "@/lib/popupQuizzes";
import { addBookmark, getBookmarks, removeBookmark, bumpEngagement, cacheSubtitles, loadSubtitles, type Cue } from "@/lib/engagement";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { awardXp } from "@/lib/gamification";
import { Input } from "@/components/ui/input";

type Chapter = { title: string; time_seconds: number; description: string };

interface Props {
  videoId: string;
  videoTitle?: string;
  videoTopic?: string;
  videoDescription?: string;
  source_url: string;
  source_type: string;
  videoOwnerId: string;
  chapters?: Chapter[];
  onTimeUpdate?: (t: number, dur: number) => void;
  onReady?: (dur: number) => void;
  initialTime?: number;
  examMode?: boolean;
}

const LANGS = ["English", "Spanish", "French", "German", "Hindi", "Japanese", "Arabic"];

export const VideoPlayer = ({ videoId, videoTitle = "", videoTopic, videoDescription, source_url, source_type, videoOwnerId, chapters = [], onTimeUpdate, onReady, initialTime = 0, examMode = false }: Props) => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const ytRef = useRef<any>(null);
  const ytContainer = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [muted, setMuted] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const recogRef = useRef<any>(null);
  const isYT = source_type === "youtube" || !!ytId(source_url);
  const yid = ytId(source_url);

  // Pop-quiz state (now backend-driven)
  const [popupQuizzes, setPopupQuizzes] = useState<PopupQuiz[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<PopupQuiz | null>(null);
  const [activeAttemptNumber, setActiveAttemptNumber] = useState(1);
  const [answeredMap, setAnsweredMap] = useState<Record<string, boolean>>({});
  const [recentAttempts, setRecentAttempts] = useState<{ is_correct: boolean }[]>([]);
  const triggeredRef = useRef<Set<string>>(new Set());
  const quizStartedAtRef = useRef<number>(0);
  const completionPct = useMemo(() => {
    if (!popupQuizzes.length) return 0;
    return Math.round((Object.keys(answeredMap).length / popupQuizzes.length) * 100);
  }, [answeredMap, popupQuizzes]);

  // Load quizzes + past attempts from backend
  useEffect(() => {
    if (!user) return;
    (async () => {
      const qs = await loadPopupQuizzes(videoId, videoOwnerId === user.id ? user.id : undefined);
      setPopupQuizzes(qs);
      const atts = await loadAttempts(user.id, videoId);
      const map: Record<string, boolean> = {};
      const trig = new Set<string>();
      atts.forEach(a => {
        if (a.is_correct) { map[a.quiz_id] = true; trig.add(a.quiz_id); }
      });
      setAnsweredMap(map);
      triggeredRef.current = trig;
      setRecentAttempts(atts.map(a => ({ is_correct: a.is_correct })));
    })();
  }, [videoId, user, videoOwnerId]);

  // Bookmarks
  const [bookmarks, setBookmarks] = useState(() => getBookmarks(videoId));

  // Subtitles
  const [subsLang, setSubsLang] = useState<string>("English");
  const [subsCues, setSubsCues] = useState<Cue[]>(() => loadSubtitles(videoId, "English") || []);
  const [subsLoading, setSubsLoading] = useState(false);
  const [subsOn, setSubsOn] = useState(true);

  const currentCue = useMemo(() => subsCues.find(c => time >= c.start && time <= c.end), [time, subsCues]);

  // Semantic search
  const [searchQ, setSearchQ] = useState("");
  const [searchRes, setSearchRes] = useState<{ time_seconds: number; snippet: string; relevance: number }[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);

  const runSearch = async () => {
    if (!searchQ.trim()) return;
    setSearchBusy(true);
    try {
      const data = await callAI({ task: "search", title: videoTitle, topic: videoTopic, duration: dur, query: searchQ });
      setSearchRes(data.results || []);
    } catch {} finally { setSearchBusy(false); }
  };

  // Engagement: track replay (seek back) and pauses
  const prevTimeRef = useRef(0);
  useEffect(() => {
    if (time + 3 < prevTimeRef.current) bumpEngagement(videoId, "replays");
    prevTimeRef.current = time;
  }, [time, videoId]);

  // Auto-trigger quiz at timestamps (skip in exam mode)
  useEffect(() => {
    if (examMode || activeQuiz) return;
    const due = popupQuizzes.find(q =>
      !triggeredRef.current.has(q.id) &&
      time >= q.time_seconds &&
      time < q.time_seconds + 2
    );
    if (due) {
      triggeredRef.current.add(due.id);
      // Adaptive: pick a difficulty-matching quiz if multiple at similar timestamps exist
      const target = nextDifficulty(recentAttempts);
      const matching = popupQuizzes.find(q =>
        !triggeredRef.current.has(q.id) === false &&
        q.id === due.id &&
        Math.abs(q.time_seconds - due.time_seconds) < 5 &&
        q.difficulty === target
      ) || due;
      if (isYT) ytRef.current?.pauseVideo?.();
      else videoRef.current?.pause();
      setPlaying(false);
      quizStartedAtRef.current = Date.now();
      setActiveAttemptNumber(1);
      setActiveQuiz(target ? matching : due);
    }
  }, [time, popupQuizzes, activeQuiz, isYT, examMode, recentAttempts]);

  const handleQuizAnswered = async (selectedIndex: number, correct: boolean) => {
    if (!activeQuiz || !user) return;
    const tt = Math.round((Date.now() - quizStartedAtRef.current) / 1000);
    await recordAttempt({
      userId: user.id, quizId: activeQuiz.id, videoId, selectedIndex, isCorrect: correct,
      difficulty: (activeQuiz.difficulty as Difficulty) || "medium", timeTakenSeconds: tt,
    });
    setRecentAttempts(prev => [...prev, { is_correct: correct }]);
    if (correct) {
      setAnsweredMap(m => ({ ...m, [activeQuiz.id]: true }));
      const xp = activeQuiz.difficulty === "hard" ? 25 : activeQuiz.difficulty === "easy" ? 5 : 10;
      await awardXp(user.id, xp, `Correct quiz answer (${activeQuiz.difficulty || "medium"})`);
    } else {
      // Allow retrigger: remove from triggered so they can replay+retry
      triggeredRef.current.delete(activeQuiz.id);
    }
  };

  const closeQuiz = () => {
    setActiveQuiz(null);
    if (isYT) ytRef.current?.playVideo?.();
    else videoRef.current?.play();
    setPlaying(true);
  };

  const replaySegment = () => {
    if (!activeQuiz) return;
    const back = Math.max(0, activeQuiz.time_seconds - 30);
    if (isYT) ytRef.current?.seekTo(back, true);
    else if (videoRef.current) videoRef.current.currentTime = back;
    setTime(back);
    setActiveAttemptNumber(n => n + 1);
    closeQuiz();
    toast("⏪ Replaying segment — quiz will retrigger");
  };

  // YouTube embed
  useEffect(() => {
    if (!isYT || !yid) return;
    const setup = () => {
      // @ts-ignore
      ytRef.current = new window.YT.Player(ytContainer.current, {
        videoId: yid, playerVars: { controls: 0, modestbranding: 1, rel: 0, start: Math.floor(initialTime) },
        events: {
          onReady: (e: any) => {
            const d = e.target.getDuration(); setDur(d); onReady?.(d);
            if (initialTime > 0) e.target.seekTo(initialTime, true);
          },
          onStateChange: (e: any) => {
            const wasPlaying = playing;
            setPlaying(e.data === 1);
            if (e.data === 2 && wasPlaying) bumpEngagement(videoId, "pauses");
          },
        },
      });
    };
    // @ts-ignore
    if (window.YT && window.YT.Player) setup();
    else {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
      // @ts-ignore
      window.onYouTubeIframeAPIReady = setup;
    }
    const i = setInterval(() => {
      try {
        const p = ytRef.current?.getCurrentTime?.() ?? 0;
        setTime(p); onTimeUpdate?.(p, ytRef.current?.getDuration?.() ?? 0);
      } catch {}
    }, 1000);
    return () => clearInterval(i);
  }, [yid, isYT]);

  // HTML5 video
  useEffect(() => {
    if (isYT) return;
    const v = videoRef.current; if (!v) return;
    const md = () => { setDur(v.duration); onReady?.(v.duration); if (initialTime) v.currentTime = initialTime; };
    const tu = () => { setTime(v.currentTime); onTimeUpdate?.(v.currentTime, v.duration); };
    const onPause = () => bumpEngagement(videoId, "pauses");
    v.addEventListener("loadedmetadata", md); v.addEventListener("timeupdate", tu); v.addEventListener("pause", onPause);
    return () => { v.removeEventListener("loadedmetadata", md); v.removeEventListener("timeupdate", tu); v.removeEventListener("pause", onPause); };
  }, [isYT, videoId]);

  const togglePlay = () => {
    if (examMode && playing) { toast.error("Pause is disabled in Exam Mode"); return; }
    if (isYT) { playing ? ytRef.current?.pauseVideo() : ytRef.current?.playVideo(); }
    else {
      const v = videoRef.current; if (!v) return;
      v.paused ? v.play() : v.pause();
      setPlaying(!v.paused);
    }
  };
  const seek = (s: number) => {
    if (examMode) { toast.error("Seeking disabled in Exam Mode"); return; }
    if (activeQuiz) { toast.error("Answer the quiz to continue"); return; }
    const nextUnanswered = popupQuizzes.find(q =>
      !triggeredRef.current.has(q.id) && q.time_seconds <= s && q.time_seconds >= time
    );
    if (nextUnanswered && s > nextUnanswered.time_seconds) {
      toast("Pop quiz ahead — answer first to skip past it");
      s = nextUnanswered.time_seconds;
    }
    bumpEngagement(videoId, "seeks");
    if (isYT) ytRef.current?.seekTo(s, true);
    else if (videoRef.current) videoRef.current.currentTime = s;
    setTime(s);
  };
  const skip = (delta: number) => {
    if (examMode) { toast.error("Skipping disabled in Exam Mode"); return; }
    if (activeQuiz) { toast.error("Answer the quiz to continue"); return; }
    seek(Math.max(0, Math.min(dur, time + delta)));
  };
  const toggleMute = () => {
    if (isYT) { muted ? ytRef.current?.unMute() : ytRef.current?.mute(); }
    else if (videoRef.current) videoRef.current.muted = !muted;
    setMuted(!muted);
  };

  const onAddBookmark = () => {
    const label = prompt("Bookmark label", `Marker @ ${fmtTime(time)}`);
    if (!label) return;
    addBookmark({ videoId, videoTitle, time, label });
    setBookmarks(getBookmarks(videoId));
    toast.success(`📌 Bookmarked at ${fmtTime(time)}`);
  };
  const onRemoveBookmark = (id: string) => {
    removeBookmark(id);
    setBookmarks(getBookmarks(videoId));
  };

  // Subtitles
  const generateSubtitles = async () => {
    setSubsLoading(true);
    try {
      const data = await callAI({ task: "subtitles", title: videoTitle, topic: videoTopic, description: videoDescription, duration: dur });
      const cues: Cue[] = data.cues || [];
      cacheSubtitles(videoId, "English", cues);
      setSubsLang("English");
      setSubsCues(cues);
      toast.success("Subtitles generated");
    } catch {} finally { setSubsLoading(false); }
  };
  const switchLanguage = async (lang: string) => {
    setSubsLang(lang);
    const cached = loadSubtitles(videoId, lang);
    if (cached) { setSubsCues(cached); return; }
    const base = loadSubtitles(videoId, "English");
    if (!base) { toast("Generate English subtitles first"); return; }
    if (lang === "English") { setSubsCues(base); return; }
    setSubsLoading(true);
    try {
      const data = await callAI({ task: "translate", title: videoTitle, target_lang: lang, cues: base });
      cacheSubtitles(videoId, lang, data.cues);
      setSubsCues(data.cues);
      toast.success(`Switched to ${lang}`);
    } catch {} finally { setSubsLoading(false); }
  };

  // Voice commands
  const toggleVoice = () => {
    // @ts-ignore
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast.error("Voice not supported in this browser"); return; }
    if (voiceOn) { recogRef.current?.stop(); setVoiceOn(false); return; }
    const r = new SR(); r.continuous = true; r.interimResults = false; r.lang = "en-US";
    r.onresult = (e: any) => {
      const cmd = e.results[e.results.length - 1][0].transcript.toLowerCase().trim();
      toast(`🎙 "${cmd}"`);
      if (/(play|resume|start)/.test(cmd)) { isYT ? ytRef.current?.playVideo() : videoRef.current?.play(); setPlaying(true); }
      else if (/(pause|stop)/.test(cmd)) { isYT ? ytRef.current?.pauseVideo() : videoRef.current?.pause(); setPlaying(false); }
      else if (/(forward|skip|next)/.test(cmd)) skip(15);
      else if (/(back|rewind|replay|repeat)/.test(cmd)) skip(-15);
      else if (/(mute)/.test(cmd)) toggleMute();
      else if (/bookmark/.test(cmd)) onAddBookmark();
      else if (/explain/.test(cmd)) toast("Explanation will appear when you answer a quiz");
      else if (/next topic|next chapter/.test(cmd)) {
        const next = chapters.find(c => c.time_seconds > time + 1);
        if (next) seek(next.time_seconds);
      }
    };
    r.onerror = () => setVoiceOn(false);
    r.onend = () => setVoiceOn(false);
    r.start(); recogRef.current = r; setVoiceOn(true);
    toast.success("Voice control on. Try: play, pause, repeat, explain, bookmark, next topic.");
  };

  return (
    <div className="space-y-3">
      <div className="relative aspect-video rounded-xl overflow-hidden bg-black neon-border scanline">
        <div className={activeQuiz ? "w-full h-full pointer-events-none blur-md scale-[1.02] transition-all duration-300" : "w-full h-full transition-all duration-300"}>
          {isYT ? (
            <div ref={ytContainer} className="w-full h-full" />
          ) : (
            <video ref={videoRef} src={source_url} className="w-full h-full" onClick={togglePlay} />
          )}
        </div>

        {subsOn && currentCue && !activeQuiz && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 max-w-[85%] px-4 py-2 rounded-lg bg-background/80 backdrop-blur text-foreground text-center text-sm md:text-base font-medium border border-primary/30 pointer-events-none animate-fade-in">
            {currentCue.text}
          </div>
        )}

        {activeQuiz && (
          <InteractiveQuizPopup
            quiz={activeQuiz}
            videoTitle={videoTitle}
            videoTopic={videoTopic}
            attemptNumber={activeAttemptNumber}
            onAnswered={handleQuizAnswered}
            onClose={closeQuiz}
            onReplaySegment={replaySegment}
          />
        )}

        {examMode && (
          <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-destructive/90 text-destructive-foreground text-xs font-bold uppercase tracking-widest animate-pulse-glow">
            🔒 Exam Mode
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="glass-card rounded-xl p-3 space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-primary w-12">{fmtTime(time)}</span>
          <div className="flex-1 relative">
            <Slider value={[time]} max={dur || 100} step={1} onValueChange={(v) => seek(v[0])} disabled={examMode} />
            {dur > 0 && popupQuizzes.map(q => (
              <div key={q.id}
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full pointer-events-none border border-background ${
                  answeredMap[q.id] === true ? "bg-success" : "bg-primary animate-pulse-glow"
                }`}
                style={{ left: `${Math.min(100, (q.time_seconds / dur) * 100)}%` }}
                title={`Pop quiz @ ${fmtTime(q.time_seconds)} (${q.difficulty || "medium"})`}
              />
            ))}
            {dur > 0 && bookmarks.map(b => (
              <div key={b.id}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-secondary cursor-pointer"
                style={{ left: `${Math.min(100, (b.time / dur) * 100)}%` }}
                title={b.label}
                onClick={() => seek(b.time)}
              >
                <Bookmark className="h-3 w-3 fill-secondary" />
              </div>
            ))}
          </div>
          <span className="text-xs font-mono text-muted-foreground w-12">{fmtTime(dur)}</span>
        </div>

        {popupQuizzes.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <Brain className="h-3.5 w-3.5 text-secondary" />
            <span className="text-muted-foreground whitespace-nowrap">Pop Quiz</span>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-gradient-neon transition-all duration-500" style={{ width: `${completionPct}%` }} />
            </div>
            <span className="font-mono text-primary w-10 text-right">{completionPct}%</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => skip(-10)} disabled={examMode}><SkipBack className="h-4 w-4" /></Button>
            <Button onClick={togglePlay} size="icon" className="bg-gradient-neon text-primary-foreground hover:opacity-90 glow-cyan h-10 w-10 rounded-full">
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => skip(10)} disabled={examMode}><SkipForward className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={toggleMute}>{muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</Button>
            <Button variant="ghost" size="icon" onClick={onAddBookmark} title="Bookmark current time" disabled={examMode}><Bookmark className="h-4 w-4 text-secondary" /></Button>
            <Button variant="ghost" size="icon" onClick={() => setSearchOpen(o => !o)} title="Semantic search" disabled={examMode}><Search className="h-4 w-4" /></Button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {subsCues.length === 0 ? (
              <Button variant="outline" size="sm" onClick={generateSubtitles} disabled={subsLoading}>
                {subsLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Subtitles className="h-3.5 w-3.5 mr-1.5" />}
                Subtitles
              </Button>
            ) : (
              <>
                <Button variant={subsOn ? "default" : "outline"} size="sm" onClick={() => setSubsOn(o => !o)}
                  className={subsOn ? "bg-primary text-primary-foreground" : ""}>
                  <Subtitles className="h-3.5 w-3.5 mr-1.5" /> CC
                </Button>
                <Select value={subsLang} onValueChange={switchLanguage}>
                  <SelectTrigger className="h-8 w-[120px] text-xs">
                    <Languages className="h-3 w-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGS.map(l => <SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </>
            )}
            {user?.id === videoOwnerId && !examMode && (
              <QuizConfigDialog videoId={videoId} quizzes={popupQuizzes} onChange={setPopupQuizzes} />
            )}
            <Button variant={voiceOn ? "default" : "outline"} size="sm" onClick={toggleVoice}
              className={voiceOn ? "bg-secondary text-secondary-foreground glow-magenta animate-pulse-glow" : ""}>
              {voiceOn ? <Mic className="h-3.5 w-3.5 mr-1.5" /> : <MicOff className="h-3.5 w-3.5 mr-1.5" />}
              Voice {voiceOn ? "On" : "Off"}
            </Button>
          </div>
        </div>
      </div>

      {/* Semantic Search */}
      {searchOpen && (
        <div className="glass-card rounded-xl p-4 space-y-3 animate-fade-in">
          <div className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-primary" /> Semantic Video Search
          </div>
          <div className="flex gap-2">
            <Input placeholder="e.g. 'when is recursion explained?'" value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              onKeyDown={e => e.key === "Enter" && runSearch()} className="flex-1" />
            <Button onClick={runSearch} disabled={searchBusy} className="bg-gradient-neon text-primary-foreground">
              {searchBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {searchRes.map((r, i) => (
            <button key={i} onClick={() => seek(r.time_seconds)}
              className="w-full text-left flex items-start gap-3 p-2 rounded-lg hover:bg-muted/40 transition-smooth">
              <span className="font-mono text-xs text-primary mt-0.5 w-12 shrink-0">{fmtTime(r.time_seconds)}</span>
              <div className="min-w-0">
                <div className="text-sm">{r.snippet}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Relevance: {(r.relevance * 100).toFixed(0)}%</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Bookmarks list */}
      {bookmarks.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
            <Bookmark className="h-3.5 w-3.5 text-secondary" /> Bookmarks ({bookmarks.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {bookmarks.sort((a, b) => a.time - b.time).map(b => (
              <div key={b.id} className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/15 border border-secondary/30 hover:border-secondary transition-smooth">
                <button onClick={() => seek(b.time)} className="text-xs flex items-center gap-2">
                  <span className="font-mono text-secondary">{fmtTime(b.time)}</span>
                  <span className="text-foreground">{b.label}</span>
                </button>
                <button onClick={() => onRemoveBookmark(b.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-smooth text-xs">×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline chapters */}
      {chapters.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Interactive Timeline</div>
          <div className="space-y-2">
            {chapters.map((c, i) => {
              const active = time >= c.time_seconds && (i === chapters.length - 1 || time < chapters[i + 1].time_seconds);
              return (
                <button key={i} onClick={() => seek(c.time_seconds)}
                  className={`w-full text-left flex items-start gap-3 p-2 rounded-lg transition-smooth ${active ? "bg-primary/15 border border-primary/40" : "hover:bg-muted/40"}`}>
                  <span className="font-mono text-xs text-primary mt-0.5 w-12 shrink-0">{fmtTime(c.time_seconds)}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{c.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{c.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
