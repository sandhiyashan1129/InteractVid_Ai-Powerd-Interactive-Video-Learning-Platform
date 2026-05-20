import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings as SettingsIcon, Moon, Sun, LogOut } from "lucide-react";
import { toast } from "sonner";

const Settings = () => {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => setName(data?.display_name || ""));
  }, [user]);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", user!.id);
    setBusy(false);
    if (error) toast.error(error.message); else toast.success("Saved");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-3"><SettingsIcon className="h-7 w-7 text-primary" /> Settings</h1>
        <p className="text-muted-foreground">Customize your experience.</p>
      </div>

      <div className="glass-card rounded-xl p-6 space-y-5">
        <div>
          <Label>Display name</Label>
          <Input value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <Label>Email</Label>
          <Input value={user?.email || ""} disabled />
        </div>
        <Button onClick={save} disabled={busy} className="bg-gradient-neon text-primary-foreground glow-cyan">Save Profile</Button>
      </div>

      <div className="glass-card rounded-xl p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {theme === "dark" ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-warning" />}
          <div>
            <div className="font-semibold">Dark mode</div>
            <div className="text-xs text-muted-foreground">Toggle between cyberpunk dark and light themes</div>
          </div>
        </div>
        <Switch checked={theme === "dark"} onCheckedChange={toggle} />
      </div>

      <div className="glass-card rounded-xl p-6">
        <Button variant="destructive" onClick={signOut}><LogOut className="h-4 w-4 mr-2" /> Sign out</Button>
      </div>
    </div>
  );
};

export default Settings;
