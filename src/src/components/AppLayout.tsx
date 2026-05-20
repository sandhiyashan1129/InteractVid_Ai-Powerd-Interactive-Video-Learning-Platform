import { ReactNode, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { Moon, Sun, LogOut, Sparkles, Flame } from "lucide-react";
import { touchStreak, getStreak, dueReminders, dismissReminder } from "@/lib/engagement";
import { toast } from "sonner";

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { user, loading, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const streak = getStreak();

  useEffect(() => {
    if (!user) return;
    touchStreak();
    // Smart revision reminders
    const due = dueReminders();
    due.forEach(r => {
      toast(`📚 Time to revise: ${r.videoTitle}`, {
        description: r.topic ? `Topic: ${r.topic}` : "Spaced repetition keeps it sticky.",
        action: { label: "Open", onClick: () => { window.location.href = `/video/${r.videoId}`; } },
        duration: 8000,
      });
      dismissReminder(r.videoId);
    });
  }, [user]);

  if (loading) {
    return <div className="min-h-screen grid place-items-center"><div className="animate-pulse text-primary">Loading…</div></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-40 h-14 flex items-center justify-between gap-3 px-4 border-b border-border/60 glass">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs text-primary font-medium">AI Online</span>
              </div>
              {streak.current > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/10 border border-secondary/30" title={`Best streak: ${streak.best} days`}>
                  <Flame className="h-3.5 w-3.5 text-orange-400" />
                  <span className="text-xs text-secondary font-semibold">{streak.current}d</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <span className="hidden sm:block text-xs text-muted-foreground max-w-[160px] truncate">{user.email}</span>
              <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out"><LogOut className="h-4 w-4" /></Button>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 lg:p-8 animate-fade-in">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
};
