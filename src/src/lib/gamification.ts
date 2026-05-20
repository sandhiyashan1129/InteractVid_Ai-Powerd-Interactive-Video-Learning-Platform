import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const xpForLevel = (level: number) => 100 * level * level; // 100, 400, 900, 1600...
export const levelFromXp = (xp: number) => {
  let lv = 1;
  while (xp >= xpForLevel(lv + 1)) lv++;
  return lv;
};

export type Gamification = {
  user_id: string;
  xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
};

export const getGamification = async (userId: string): Promise<Gamification> => {
  const { data } = await supabase.from("gamification").select("*").eq("user_id", userId).maybeSingle();
  if (data) return data as Gamification;
  const fresh: Gamification = { user_id: userId, xp: 0, level: 1, current_streak: 0, longest_streak: 0, last_activity_date: null };
  await supabase.from("gamification").insert(fresh);
  return fresh;
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

export const awardXp = async (userId: string, amount: number, reason?: string) => {
  if (!userId || amount <= 0) return;
  const g = await getGamification(userId);
  const today = todayStr();
  let streak = g.current_streak;
  if (g.last_activity_date) {
    const diff = daysBetween(g.last_activity_date, today);
    if (diff === 0) {/* same day */}
    else if (diff === 1) streak += 1;
    else streak = 1;
  } else streak = 1;
  const longest = Math.max(g.longest_streak, streak);
  const newXp = g.xp + amount;
  const newLevel = levelFromXp(newXp);
  const leveledUp = newLevel > g.level;
  await supabase.from("gamification").update({
    xp: newXp, level: newLevel, current_streak: streak, longest_streak: longest, last_activity_date: today, updated_at: new Date().toISOString(),
  }).eq("user_id", userId);
  toast.success(`+${amount} XP${reason ? ` · ${reason}` : ""}`);
  if (leveledUp) toast(`🎉 Level Up! You're now Level ${newLevel}`);
  // Auto badges
  if (streak >= 3) tryAwardBadge(userId, "streak_3", "3-Day Streak 🔥");
  if (streak >= 7) tryAwardBadge(userId, "streak_7", "Week Warrior 🗓️");
  if (newLevel >= 5) tryAwardBadge(userId, "level_5", "Rising Star ⭐");
  if (newLevel >= 10) tryAwardBadge(userId, "level_10", "Scholar 🎓");
};

export const tryAwardBadge = async (userId: string, code: string, label: string) => {
  const { error } = await supabase.from("badges").insert({ user_id: userId, code, label });
  if (!error) toast(`🏅 Badge unlocked: ${label}`);
};

export const getBadges = async (userId: string) => {
  const { data } = await supabase.from("badges").select("*").eq("user_id", userId).order("earned_at", { ascending: false });
  return data || [];
};
