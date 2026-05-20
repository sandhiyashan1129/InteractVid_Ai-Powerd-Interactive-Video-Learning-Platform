import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Upload as UploadIcon, Link as LinkIcon, FileVideo } from "lucide-react";
import { ytId } from "@/lib/ai";
import { toast } from "sonner";

const Upload = () => {
  const { user } = useAuth();
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [desc, setDesc] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const submitUrl = async (e: FormEvent) => {
    e.preventDefault(); if (!user) return; setBusy(true);
    const yid = ytId(url);
    const { data, error } = await supabase.from("videos").insert({
      user_id: user.id, title, topic, description: desc, source_url: url,
      source_type: yid ? "youtube" : "url",
      thumbnail_url: yid ? `https://img.youtube.com/vi/${yid}/hqdefault.jpg` : null,
    }).select().single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Video added!"); nav(`/video/${data.id}`);
  };

  const submitFile = async (e: FormEvent) => {
    e.preventDefault();
    const file = (document.getElementById("file") as HTMLInputElement)?.files?.[0];
    if (!file || !user) return;
    setBusy(true);
    // Use object URL (no storage bucket): great for demo. For production, upload to storage.
    const objectUrl = URL.createObjectURL(file);
    const { data, error } = await supabase.from("videos").insert({
      user_id: user.id, title: title || file.name, topic, description: desc,
      source_url: objectUrl, source_type: "local",
    }).select().single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Video added (local session). Note: local files are session-only.");
    nav(`/video/${data.id}`);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Upload a Video</h1>
        <p className="text-muted-foreground">Paste a YouTube link or upload a local file. AI tools unlock once added.</p>
      </div>

      <div className="glass-card rounded-2xl p-6">
        <Tabs defaultValue="url">
          <TabsList className="grid grid-cols-2 w-full mb-6">
            <TabsTrigger value="url"><LinkIcon className="h-3.5 w-3.5 mr-1.5" /> YouTube / URL</TabsTrigger>
            <TabsTrigger value="file"><FileVideo className="h-3.5 w-3.5 mr-1.5" /> Local File</TabsTrigger>
          </TabsList>

          <TabsContent value="url">
            <form onSubmit={submitUrl} className="space-y-4">
              <div><Label>Video URL</Label><Input required placeholder="https://youtube.com/watch?v=..." value={url} onChange={e => setUrl(e.target.value)} /></div>
              <div><Label>Title</Label><Input required value={title} onChange={e => setTitle(e.target.value)} /></div>
              <div><Label>Topic / Subject</Label><Input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Data Structures, Calculus" /></div>
              <div><Label>Description (helps AI)</Label><Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} /></div>
              <Button type="submit" disabled={busy} className="bg-gradient-neon text-primary-foreground glow-cyan w-full"><UploadIcon className="h-4 w-4 mr-2" /> Add Video</Button>
            </form>
          </TabsContent>

          <TabsContent value="file">
            <form onSubmit={submitFile} className="space-y-4">
              <div><Label>Video file</Label><Input id="file" type="file" accept="video/*" required /></div>
              <div><Label>Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
              <div><Label>Topic</Label><Input value={topic} onChange={e => setTopic(e.target.value)} /></div>
              <div><Label>Description</Label><Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} /></div>
              <Button type="submit" disabled={busy} className="bg-gradient-neon text-primary-foreground glow-cyan w-full"><UploadIcon className="h-4 w-4 mr-2" /> Add Video</Button>
              <p className="text-xs text-muted-foreground">Note: local files are stored in browser memory for the session. For permanent storage, hook up Cloud storage.</p>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Upload;
