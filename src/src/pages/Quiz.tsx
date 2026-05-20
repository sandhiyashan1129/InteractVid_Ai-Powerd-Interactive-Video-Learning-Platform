import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Brain, Award } from "lucide-react";

const Quiz = () => {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: a }, { data: v }] = await Promise.all([
        supabase.from("quiz_attempts").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("videos").select("*").eq("user_id", user.id),
      ]);
      setAttempts(a || []); setVideos(v || []);
    })();
  }, [user]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-3"><Brain className="h-7 w-7 text-primary" /> AI Quiz</h1>
        <p className="text-muted-foreground">Take quizzes and review your performance.</p>
      </div>

      <div>
        <h2 className="font-display text-lg font-bold mb-3">Start a Quiz</h2>
        {videos.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">Upload videos first.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {videos.map(v => (
              <Link key={v.id} to={`/video/${v.id}`} className="glass-card rounded-xl p-4 transition-smooth hover:border-primary/40 hover:scale-[1.02]">
                <div className="font-semibold truncate">{v.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{v.topic || "General"}</div>
                <div className="text-xs text-primary mt-3">Open & take quiz →</div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-display text-lg font-bold mb-3 flex items-center gap-2"><Award className="h-5 w-5 text-secondary" /> Recent Attempts</h2>
        {attempts.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">No attempts yet.</div>
        ) : (
          <div className="space-y-2">
            {attempts.map(a => {
              const v = videos.find(v => v.id === a.video_id);
              const pct = Math.round((a.score / a.total) * 100);
              return (
                <div key={a.id} className="glass-card rounded-lg p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{v?.title || "Video"}</div>
                    <div className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
                  </div>
                  <div className={`font-display font-bold text-2xl ${pct >= 70 ? "text-success" : pct >= 40 ? "text-warning" : "text-destructive"}`}>
                    {a.score}/{a.total}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Quiz;
