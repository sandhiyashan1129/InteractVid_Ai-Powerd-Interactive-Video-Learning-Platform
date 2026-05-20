import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getGamification, getBadges, xpForLevel, type Gamification } from "@/lib/gamification";
import { supabase } from "@/integrations/supabase/client";
import { Award, Flame, Star, Trophy, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const Achievements = () => {
  const { user } = useAuth();
  const [gam, setGam] = useState<Gamification | null>(null);
  const [badges, setBadges] = useState<any[]>([]);
  const [stats, setStats] = useState({ exams: 0, quizzes: 0, accuracy: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      setGam(await getGamification(user.id));
      setBadges(await getBadges(user.id));
      const { data: ex } = await supabase.from("exam_attempts").select("score,total").eq("user_id", user.id);
      const { data: qz } = await supabase.from("popup_quiz_attempts").select("is_correct").eq("user_id", user.id);
      const totalQ = (qz || []).length;
      const correctQ = (qz || []).filter(q => q.is_correct).length;
      setStats({
        exams: (ex || []).length,
        quizzes: totalQ,
        accuracy: totalQ ? Math.round((correctQ / totalQ) * 100) : 0,
      });
    })();
  }, [user]);

  if (!gam) return <div className="p-12 text-center text-muted-foreground">Loading…</div>;

  const nextLvlXp = xpForLevel(gam.level + 1);
  const curLvlXp = xpForLevel(gam.level);
  const pctToNext = Math.round(((gam.xp - curLvlXp) / (nextLvlXp - curLvlXp)) * 100);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold neon-text">Achievements</h1>
        <p className="text-muted-foreground text-sm">Your XP, level, badges & streaks</p>
      </div>

      <div className="glass-card neon-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-neon grid place-items-center glow-cyan">
              <Star className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Level</div>
              <div className="font-display text-4xl font-bold neon-text">{gam.level}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Total XP</div>
            <div className="font-display text-4xl font-bold text-primary">{gam.xp.toLocaleString()}</div>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">Progress to Level {gam.level + 1}</span>
            <span className="font-mono text-primary">{gam.xp - curLvlXp} / {nextLvlXp - curLvlXp} XP</span>
          </div>
          <Progress value={pctToNext} className="h-2" />
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard icon={<Flame className="h-5 w-5 text-destructive" />} label="Current Streak" value={`${gam.current_streak} days`} sub={`Longest: ${gam.longest_streak}`} />
        <StatCard icon={<Zap className="h-5 w-5 text-secondary" />} label="Pop Quiz Accuracy" value={`${stats.accuracy}%`} sub={`${stats.quizzes} answered`} />
        <StatCard icon={<Trophy className="h-5 w-5 text-primary" />} label="Exams Taken" value={`${stats.exams}`} sub="Full assessments" />
      </div>

      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Award className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-bold">Badges</h2>
          <span className="text-xs text-muted-foreground">({badges.length})</span>
        </div>
        {badges.length === 0 ? (
          <p className="text-sm text-muted-foreground">No badges yet — answer pop quizzes correctly, build streaks, and complete exams to unlock them.</p>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {badges.map(b => (
              <div key={b.id} className="glass rounded-xl p-4 border border-primary/20 hover:border-primary/60 transition-smooth">
                <div className="text-2xl mb-1">{b.label.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)?.[0] || "🏅"}</div>
                <div className="font-semibold text-sm">{b.label.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim()}</div>
                <div className="text-[10px] text-muted-foreground mt-1">{new Date(b.earned_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) => (
  <div className="glass-card rounded-xl p-4">
    <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span></div>
    <div className="font-display text-2xl font-bold">{value}</div>
    {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
  </div>
);

export default Achievements;
