import { useState, FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Sparkles, PlayCircle } from "lucide-react";

const Auth = () => {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const signIn = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Welcome back!"); nav("/"); }
  };

  const signUp = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/`, data: { display_name: name } }
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Account created. You're in!"); nav("/"); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 grid-bg">
      {/* Hero side */}
      <div className="hidden lg:flex relative overflow-hidden p-12 flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-neon grid place-items-center glow-cyan animate-pulse-glow">
            <PlayCircle className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl font-bold neon-text">IntractctVid</span>
        </div>
        <div className="space-y-6 max-w-lg">
          <h1 className="font-display text-5xl font-bold leading-tight">
            Learn at the speed of <span className="neon-text">thought</span>.
          </h1>
          <p className="text-lg text-muted-foreground">
            AI summaries, auto-generated quizzes, smart notes, voice control, and a doubt-solving chatbot — inside every video lecture.
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            {["AI Summaries","Auto Quiz","Smart Notes","Voice Control","Progress Analytics"].map(t => (
              <span key={t} className="px-3 py-1.5 rounded-full glass text-primary border border-primary/30">{t}</span>
            ))}
          </div>
        </div>
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl animate-float-slow" />
        <div className="absolute -top-20 -left-20 h-80 w-80 rounded-full bg-secondary/20 blur-3xl animate-float-slow" style={{ animationDelay: "2s" }} />
      </div>

      {/* Form side */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md glass-card rounded-2xl p-8 animate-scale-in">
          <div className="lg:hidden flex items-center gap-3 mb-6 justify-center">
            <div className="h-10 w-10 rounded-xl bg-gradient-neon grid place-items-center"><Sparkles className="h-5 w-5 text-primary-foreground" /></div>
            <span className="font-display text-xl font-bold neon-text">IntractctVid</span>
          </div>
          <h2 className="font-display text-2xl font-bold mb-1">Welcome aboard</h2>
          <p className="text-sm text-muted-foreground mb-6">Sign in or create an account to begin learning.</p>

          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 w-full mb-6">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={signIn} className="space-y-4">
                <div><Label>Email</Label><Input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
                <div><Label>Password</Label><Input type="password" required value={password} onChange={e => setPassword(e.target.value)} /></div>
                <Button type="submit" disabled={busy} className="w-full bg-gradient-neon text-primary-foreground hover:opacity-90 glow-cyan">{busy ? "..." : "Sign In"}</Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={signUp} className="space-y-4">
                <div><Label>Display name</Label><Input required value={name} onChange={e => setName(e.target.value)} placeholder="Ada Lovelace" /></div>
                <div><Label>Email</Label><Input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
                <div><Label>Password</Label><Input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} /></div>
                <Button type="submit" disabled={busy} className="w-full bg-gradient-neon text-primary-foreground hover:opacity-90 glow-cyan">{busy ? "..." : "Create Account"}</Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Auth;
