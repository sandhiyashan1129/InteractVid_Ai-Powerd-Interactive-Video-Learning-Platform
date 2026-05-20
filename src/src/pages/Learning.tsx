import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Trash2, Play, Plus } from "lucide-react";
import { toast } from "sonner";
import { fmtTime } from "@/lib/ai";

const Learning = () => {
  const { user } = useAuth();
  const [videos, setVideos] = useState<any[]>([]);
  const [progress, setProgress] = useState<Record<string, any>>({});

  const load = async () => {
    if (!user) return;
    const [{ data: vids }, { data: wp }] = await Promise.all([
      supabase.from("videos").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("watch_progress").select("*").eq("user_id", user.id),
    ]);
    setVideos(vids || []);
    const m: Record<string, any> = {};
    (wp || []).forEach(w => { m[w.video_id] = w; });
    setProgress(m);
  };

  useEffect(() => { load(); }, [user]);

  const del = async (id: string) => {
    await supabase.from("videos").delete().eq("id", id);
    toast.success("Removed"); load();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">My Learning</h1>
          <p className="text-muted-foreground">{videos.length} video{videos.length !== 1 && "s"} in your library</p>
        </div>
        <Button asChild className="bg-gradient-neon text-primary-foreground glow-cyan"><Link to="/upload"><Plus className="h-4 w-4 mr-2" /> Add Video</Link></Button>
      </div>

      {videos.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <p className="text-muted-foreground mb-4">No videos yet — start by uploading one.</p>
          <Button asChild><Link to="/upload">Upload</Link></Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {videos.map(v => {
            const p = progress[v.id];
            const pct = p && v.duration_seconds ? Math.min(100, Math.round((p.last_position_seconds / v.duration_seconds) * 100)) : 0;
            return (
              <div key={v.id} className="glass-card rounded-xl overflow-hidden group transition-smooth hover:border-primary/50 hover:scale-[1.02]">
                <Link to={`/video/${v.id}`} className="block aspect-video bg-black relative">
                  {v.thumbnail_url ? (
                    <img src={v.thumbnail_url} alt={v.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-cyber grid place-items-center"><Play className="h-12 w-12 text-primary/60" /></div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-smooth grid place-items-center">
                    <Play className="h-12 w-12 text-primary glow-cyan" />
                  </div>
                  {pct > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/60">
                      <div className="h-full bg-gradient-neon" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </Link>
                <div className="p-4">
                  <div className="font-semibold truncate">{v.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{v.topic || "General"} {p && `• Resume @ ${fmtTime(p.last_position_seconds)}`}</div>
                  <div className="flex justify-between items-center mt-3">
                    <Button asChild size="sm" variant="outline" className="border-primary/40"><Link to={`/video/${v.id}`}>Open</Link></Button>
                    <Button size="icon" variant="ghost" onClick={() => del(v.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Learning;
