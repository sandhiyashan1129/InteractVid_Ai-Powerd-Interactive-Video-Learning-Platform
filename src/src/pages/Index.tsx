import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sparkles, Upload, Brain, BookOpen, MessageCircle, BarChart3, Zap, Mic } from "lucide-react";
import { fmtTime } from "@/lib/ai";

const Index = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ videos: 0, watch: 0, quizzes: 0, avg: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [recs, setRecs] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: vids }, { data: wp }, { data: qa }] = await Promise.all([
        supabase.from("videos").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(6),
        supabase.from("watch_progress").select("*").eq("user_id", user.id),
        supabase.from("quiz_attempts").select("*").eq("user_id", user.id),
      ]);
      const watch = (wp || []).reduce((a, w) => a + (w.total_watch_seconds || 0), 0);
      const avg = qa && qa.length ? Math.round(qa.reduce((a, q) => a + (q.score / q.total) * 100, 0) / qa.length) : 0;
      setStats({ videos: vids?.length || 0, watch, quizzes: qa?.length || 0, avg });
      setRecent(vids || []);

      // Recommendations: low-score topics get recommended first
      const topicScores: Record<string, { sum: number; n: number }> = {};
      for (const a of qa || []) {
        const v = vids?.find(v => v.id === a.video_id);
        const t = v?.topic || "general";
        topicScores[t] = topicScores[t] || { sum: 0, n: 0 };
        topicScores[t].sum += (a.score / a.total) * 100; topicScores[t].n += 1;
      }
      const weak = Object.entries(topicScores).map(([t, s]) => ({ t, avg: s.sum / s.n })).sort((a, b) => a.avg - b.avg).slice(0, 3);
      const recList = (vids || []).filter(v => weak.some(w => w.t === v.topic)).slice(0, 3);
      setRecs(recList.length ? recList : (vids || []).slice(0, 3));
    })();
  }, [user]);

  const features = [
    { icon: Sparkles, title: "AI Summaries", desc: "Auto-generated key points from any lecture", color: "text-primary" },
    { icon: Brain, title: "Smart Quiz", desc: "MCQs generated from video topics", color: "text-secondary" },
    { icon: BookOpen, title: "AI Notes", desc: "Markdown notes ready to revise", color: "text-accent" },
    { icon: MessageCircle, title: "Doubt Bot", desc: "Ask anything about the video", color: "text-primary" },
    { icon: Mic, title: "Voice Control", desc: "Pause, replay, next topic — hands-free", color: "text-secondary" },
    { icon: BarChart3, title: "Analytics", desc: "Track progress & weak spots", color: "text-accent" },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl p-8 md:p-12 glass-card grid-bg">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 mb-4">
            <Zap className="h-3 w-3 text-primary" />
            <span className="text-xs font-medium text-primary">Powered by Gemini & GPT-5</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold leading-tight mb-3">
            Welcome back, <span className="neon-text">learner</span>.
          </h1>
          <p className="text-muted-foreground text-lg mb-6">Upload a lecture or pick up where you left off — your AI tutor is ready.</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-gradient-neon text-primary-foreground hover:opacity-90 glow-cyan">
              <Link to="/upload"><Upload className="h-4 w-4 mr-2" /> Upload Video</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-primary/40">
              <Link to="/learning"><BookOpen className="h-4 w-4 mr-2" /> My Learning</Link>
            </Button>
          </div>
        </div>
        <div className="absolute -right-20 -bottom-20 h-80 w-80 rounded-full bg-primary/15 blur-3xl animate-float-slow" />
        <div className="absolute right-20 top-0 h-40 w-40 rounded-full bg-secondary/15 blur-3xl animate-float-slow" style={{ animationDelay: "1.5s" }} />
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Videos", value: stats.videos, color: "text-primary" },
          { label: "Watch Time", value: fmtTime(stats.watch), color: "text-secondary" },
          { label: "Quizzes Taken", value: stats.quizzes, color: "text-accent" },
          { label: "Avg Score", value: `${stats.avg}%`, color: "text-success" },
        ].map(s => (
          <div key={s.label} className="glass-card rounded-xl p-5 transition-smooth hover:scale-[1.02] hover:border-primary/40">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">{s.label}</div>
            <div className={`font-display text-3xl font-bold mt-2 ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </section>

      {/* Features */}
      <section>
        <h2 className="font-display text-2xl font-bold mb-4">Your AI Toolkit</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(f => (
            <div key={f.title} className="glass-card rounded-xl p-5 transition-smooth hover:scale-[1.02] hover:border-primary/40 group">
              <f.icon className={`h-8 w-8 mb-3 ${f.color} group-hover:scale-110 transition-transform`} />
              <div className="font-display font-semibold text-lg">{f.title}</div>
              <div className="text-sm text-muted-foreground mt-1">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent + Recommendations */}
      <section className="grid lg:grid-cols-2 gap-6">
        <div>
          <h2 className="font-display text-xl font-bold mb-3">Continue Watching</h2>
          {recent.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
              No videos yet. <Link to="/upload" className="text-primary hover:underline">Upload your first one</Link>.
            </div>
          ) : (
            <div className="space-y-2">
              {recent.slice(0, 4).map(v => (
                <Link key={v.id} to={`/video/${v.id}`} className="flex items-center gap-3 p-3 rounded-lg glass-card hover:border-primary/40 transition-smooth">
                  <div className="h-12 w-20 rounded bg-gradient-neon shrink-0 grid place-items-center text-primary-foreground text-xs">▶</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{v.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{v.topic || "General"}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div>
          <h2 className="font-display text-xl font-bold mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-secondary" /> Recommended for You
          </h2>
          {recs.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">Take a quiz to unlock smart recommendations.</div>
          ) : (
            <div className="space-y-2">
              {recs.map(v => (
                <Link key={v.id} to={`/video/${v.id}`} className="flex items-center gap-3 p-3 rounded-lg glass-card hover:border-secondary/40 transition-smooth">
                  <div className="h-12 w-20 rounded bg-secondary/20 border border-secondary/40 shrink-0 grid place-items-center text-secondary text-xs">★</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{v.title}</div>
                    <div className="text-xs text-muted-foreground truncate">Boost: {v.topic || "General"}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Index;
