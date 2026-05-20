import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GraduationCap, Users, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

const Teacher = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>({ engagement: [], difficulty: [], topVideos: [] });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: vids }, { data: wp }, { data: qa }] = await Promise.all([
        supabase.from("videos").select("*").eq("user_id", user.id),
        supabase.from("watch_progress").select("*").eq("user_id", user.id),
        supabase.from("quiz_attempts").select("*").eq("user_id", user.id),
      ]);
      // Engagement per video (watch %)
      const engagement = (vids || []).map(v => {
        const w = wp?.find(x => x.video_id === v.id);
        const pct = v.duration_seconds && w ? Math.min(100, Math.round((w.last_position_seconds / v.duration_seconds) * 100)) : 0;
        return { name: (v.title || "").slice(0, 16), engagement: pct };
      }).slice(0, 8);

      // Difficulty (low avg score = hard)
      const topicMap: Record<string, { sum: number; n: number }> = {};
      (qa || []).forEach(a => {
        const v = vids?.find(v => v.id === a.video_id);
        const t = v?.topic || "General";
        topicMap[t] = topicMap[t] || { sum: 0, n: 0 };
        topicMap[t].sum += (a.score / a.total) * 100; topicMap[t].n++;
      });
      const difficulty = Object.entries(topicMap).map(([topic, s]) => ({
        topic,
        difficulty: Math.max(5, 100 - Math.round(s.sum / s.n)),
      }));

      const topVideos = (vids || []).map(v => ({
        title: v.title,
        attempts: (qa || []).filter(a => a.video_id === v.id).length,
      })).sort((a, b) => b.attempts - a.attempts).slice(0, 5);

      setData({ engagement, difficulty, topVideos });
    })();
  }, [user]);

  const tipStyle = { backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px" };
  const colors = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "hsl(var(--warning))", "hsl(var(--success))"];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-3"><GraduationCap className="h-7 w-7 text-secondary" /> Teacher Analytics</h1>
        <p className="text-muted-foreground">Engagement and topic-difficulty insights.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-xl p-5">
          <h3 className="font-display font-semibold mb-4 flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Student Engagement</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.engagement}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={tipStyle} />
              <Bar dataKey="engagement" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card rounded-xl p-5">
          <h3 className="font-display font-semibold mb-4 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" /> Topic Difficulty</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={data.difficulty} dataKey="difficulty" nameKey="topic" outerRadius={100} label>
                {data.difficulty.map((_: any, i: number) => <Cell key={i} fill={colors[i % colors.length]} />)}
              </Pie>
              <Legend />
              <Tooltip contentStyle={tipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card rounded-xl p-5 lg:col-span-2">
          <h3 className="font-display font-semibold mb-4">Most Attempted Videos</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.topVideos} layout="vertical">
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis dataKey="title" type="category" width={150} stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={tipStyle} />
              <Bar dataKey="attempts" fill="hsl(var(--secondary))" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Teacher;
