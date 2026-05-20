import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Medal, Award } from "lucide-react";

type Row = { user_id: string; display_name: string; avatar_url: string | null; total_score: number; attempts: number; accuracy: number };

const Leaderboard = () => {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      const { data: attempts } = await supabase.from("quiz_attempts").select("user_id, score, total");
      const { data: profiles } = await supabase.from("profiles").select("id, display_name, avatar_url");
      const profMap = new Map((profiles || []).map(p => [p.id, p]));
      const agg = new Map<string, { score: number; total: number; attempts: number }>();
      (attempts || []).forEach(a => {
        const prev = agg.get(a.user_id) || { score: 0, total: 0, attempts: 0 };
        agg.set(a.user_id, { score: prev.score + a.score, total: prev.total + a.total, attempts: prev.attempts + 1 });
      });
      const arr: Row[] = Array.from(agg.entries()).map(([uid, v]) => {
        const p = profMap.get(uid);
        return {
          user_id: uid,
          display_name: p?.display_name || "Anonymous",
          avatar_url: p?.avatar_url || null,
          total_score: v.score,
          attempts: v.attempts,
          accuracy: v.total ? Math.round((v.score / v.total) * 100) : 0,
        };
      }).sort((a, b) => b.total_score - a.total_score);
      setRows(arr);
    })();
  }, []);

  const icon = (rank: number) =>
    rank === 0 ? <Trophy className="h-5 w-5 text-yellow-400" /> :
    rank === 1 ? <Medal className="h-5 w-5 text-slate-300" /> :
    rank === 2 ? <Award className="h-5 w-5 text-amber-600" /> :
    <span className="font-mono text-muted-foreground w-5 text-center">{rank + 1}</span>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-3"><Trophy className="h-7 w-7 text-primary" /> Leaderboard</h1>
        <p className="text-muted-foreground">Top learners ranked by total quiz score across all videos.</p>
      </div>
      {rows.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center text-muted-foreground">No quiz attempts yet. Be the first!</div>
      ) : (
        <div className="glass-card rounded-xl overflow-hidden">
          {rows.map((r, i) => (
            <div key={r.user_id}
              className={`flex items-center gap-4 p-4 border-b border-border/40 last:border-b-0 transition-smooth hover:bg-primary/5 ${i < 3 ? "bg-primary/5" : ""}`}>
              <div className="w-8 grid place-items-center">{icon(i)}</div>
              <div className="h-10 w-10 rounded-full bg-gradient-neon grid place-items-center text-primary-foreground font-bold">
                {r.display_name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{r.display_name}</div>
                <div className="text-xs text-muted-foreground">{r.attempts} attempts • {r.accuracy}% accuracy</div>
              </div>
              <div className="text-right">
                <div className="font-display text-2xl font-bold neon-text">{r.total_score}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">points</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
