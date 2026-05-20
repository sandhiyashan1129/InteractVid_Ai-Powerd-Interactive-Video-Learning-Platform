import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LineChart, Line, BarChart, Bar, RadialBarChart, RadialBar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend } from "recharts";
import { BarChart3, Clock, Target, TrendingUp } from "lucide-react";
import { fmtTime } from "@/lib/ai";

const Progress = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>({ stats: {}, scoreSeries: [], topicData: [], weekly: [] });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: vids }, { data: wp }, { data: qa }] = await Promise.all([
        supabase.from("videos").select("*").eq("user_id", user.id),
        supabase.from("watch_progress").select("*").eq("user_id", user.id),
        supabase.from("quiz_attempts").select("*").eq("user_id", user.id).order("created_at"),
      ]);
      const watch = (wp || []).reduce((a, w) => a + (w.total_watch_seconds || 0), 0);
      const completed = (wp || []).filter(w => w.completed).length;
      const avg = qa && qa.length ? Math.round(qa.reduce((a, q) => a + (q.score / q.total) * 100, 0) / qa.length) : 0;

      const scoreSeries = (qa || []).map((a, i) => ({
        attempt: `#${i + 1}`,
        score: Math.round((a.score / a.total) * 100),
      }));

      // Topic performance
      const topicMap: Record<string, { sum: number; n: number }> = {};
      (qa || []).forEach(a => {
        const v = vids?.find(v => v.id === a.video_id);
        const t = v?.topic || "General";
        topicMap[t] = topicMap[t] || { sum: 0, n: 0 };
        topicMap[t].sum += (a.score / a.total) * 100; topicMap[t].n++;
      });
      const topicData = Object.entries(topicMap).map(([topic, s]) => ({ topic, score: Math.round(s.sum / s.n) }));

      // Weekly watch
      const weekly: Record<string, number> = {};
      (wp || []).forEach(w => {
        const d = new Date(w.updated_at).toLocaleDateString(undefined, { weekday: "short" });
        weekly[d] = (weekly[d] || 0) + (w.total_watch_seconds || 0);
      });
      const weeklyData = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => ({ day: d, minutes: Math.round((weekly[d] || 0) / 60) }));

      setData({
        stats: { videos: vids?.length || 0, watch, completed, avg, attempts: qa?.length || 0 },
        scoreSeries, topicData, weekly: weeklyData,
      });
    })();
  }, [user]);

  const tipStyle = { backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px" };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-3"><BarChart3 className="h-7 w-7 text-primary" /> Progress Analytics</h1>
        <p className="text-muted-foreground">Track your learning journey.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Watch", value: fmtTime(data.stats.watch || 0), icon: Clock, color: "text-primary" },
          { label: "Videos Completed", value: data.stats.completed || 0, icon: TrendingUp, color: "text-success" },
          { label: "Quiz Attempts", value: data.stats.attempts || 0, icon: Target, color: "text-secondary" },
          { label: "Avg Score", value: `${data.stats.avg || 0}%`, icon: BarChart3, color: "text-accent" },
        ].map(s => (
          <div key={s.label} className="glass-card rounded-xl p-5">
            <s.icon className={`h-5 w-5 mb-2 ${s.color}`} />
            <div className="text-xs uppercase tracking-widest text-muted-foreground">{s.label}</div>
            <div className={`font-display text-2xl font-bold mt-1 ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-xl p-5">
          <h3 className="font-display font-semibold mb-4">Score Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.scoreSeries}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="attempt" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={tipStyle} />
              <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 5, fill: "hsl(var(--primary))" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card rounded-xl p-5">
          <h3 className="font-display font-semibold mb-4">Performance by Topic</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.topicData}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="topic" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={tipStyle} />
              <Bar dataKey="score" fill="hsl(var(--secondary))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card rounded-xl p-5 lg:col-span-2">
          <h3 className="font-display font-semibold mb-4">Weekly Watch Time (minutes)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.weekly}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={tipStyle} />
              <Bar dataKey="minutes" fill="hsl(var(--accent))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Progress;
