import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { User, Flame, Bookmark as BkIcon, Brain, BarChart3 } from "lucide-react";
import { getStreak, getBookmarks, getTopicProgress } from "@/lib/engagement";
import { Progress as ProgressBar } from "@/components/ui/progress";
import { Link } from "react-router-dom";

const Profile = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ videos: 0, watched: 0, score: 0, total: 0, attempts: 0 });
  const [profile, setProfile] = useState<any>(null);
  const streak = getStreak();
  const bookmarks = getBookmarks();
  const topics = getTopicProgress();

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: prof }, { data: vids }, { data: wp }, { data: qa }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("videos").select("id", { count: "exact" }).eq("user_id", user.id),
        supabase.from("watch_progress").select("completed").eq("user_id", user.id),
        supabase.from("quiz_attempts").select("score, total").eq("user_id", user.id),
      ]);
      setProfile(prof);
      const score = (qa || []).reduce((s, a) => s + a.score, 0);
      const total = (qa || []).reduce((s, a) => s + a.total, 0);
      setStats({
        videos: vids?.length || 0,
        watched: (wp || []).filter(w => w.completed).length,
        score, total,
        attempts: qa?.length || 0,
      });
    })();
  }, [user]);

  const accuracy = stats.total ? Math.round((stats.score / stats.total) * 100) : 0;
  const topicEntries = Object.entries(topics);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 rounded-full bg-gradient-neon grid place-items-center text-primary-foreground text-3xl font-bold glow-cyan">
          {(profile?.display_name || user?.email || "?")[0].toUpperCase()}
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold">{profile?.display_name || user?.email}</h1>
          <p className="text-muted-foreground capitalize">{profile?.role || "student"}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-widest"><Flame className="h-3.5 w-3.5 text-orange-400" /> Streak</div>
          <div className="font-display text-3xl font-bold mt-2">{streak.current}<span className="text-sm text-muted-foreground"> days</span></div>
          <div className="text-xs text-muted-foreground">Best: {streak.best}</div>
        </div>
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-widest"><BarChart3 className="h-3.5 w-3.5 text-primary" /> Accuracy</div>
          <div className="font-display text-3xl font-bold mt-2 neon-text">{accuracy}%</div>
          <div className="text-xs text-muted-foreground">{stats.score}/{stats.total} correct</div>
        </div>
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-widest"><Brain className="h-3.5 w-3.5 text-secondary" /> Quizzes</div>
          <div className="font-display text-3xl font-bold mt-2">{stats.attempts}</div>
          <div className="text-xs text-muted-foreground">attempts</div>
        </div>
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-widest"><BkIcon className="h-3.5 w-3.5 text-secondary" /> Bookmarks</div>
          <div className="font-display text-3xl font-bold mt-2">{bookmarks.length}</div>
          <div className="text-xs text-muted-foreground">{stats.watched}/{stats.videos} videos done</div>
        </div>
      </div>

      <div className="glass-card rounded-xl p-6">
        <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /> Topic Completion</h2>
        {topicEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Watch videos to track topic progress.</p>
        ) : (
          <div className="space-y-3">
            {topicEntries.map(([topic, pct]) => (
              <div key={topic}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{topic}</span>
                  <span className="font-mono text-primary">{Math.round(pct)}%</span>
                </div>
                <ProgressBar value={pct} className="h-2" />
              </div>
            ))}
          </div>
        )}
      </div>

      {bookmarks.length > 0 && (
        <div className="glass-card rounded-xl p-6">
          <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2"><BkIcon className="h-5 w-5 text-secondary" /> Recent Bookmarks</h2>
          <div className="space-y-2">
            {bookmarks.slice(-10).reverse().map(b => (
              <Link key={b.id} to={`/video/${b.videoId}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-primary/5 transition-smooth">
                <span className="font-mono text-xs text-secondary w-12">{Math.floor(b.time / 60)}:{String(Math.floor(b.time % 60)).padStart(2, "0")}</span>
                <span className="text-sm flex-1 truncate">{b.label}</span>
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">{b.videoTitle}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
