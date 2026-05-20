// Local-storage backed engagement, bookmarks, streaks, reminders, subtitles cache
export type Bookmark = { id: string; videoId: string; videoTitle?: string; time: number; label: string; createdAt: number };
export type EngagementStat = { videoId: string; pauses: number; replays: number; seeks: number; lastUpdate: number };
export type Reminder = { videoId: string; videoTitle: string; topic?: string; remindAt: number };

const K = {
  bookmarks: "iv:bookmarks",
  engagement: (id: string) => `iv:engagement:${id}`,
  streak: "iv:streak",
  reminders: "iv:reminders",
  subtitles: (id: string, lang: string) => `iv:subs:${id}:${lang}`,
  topics: "iv:topicsCompleted",
};

const safeParse = <T,>(raw: string | null, fb: T): T => { try { return raw ? JSON.parse(raw) : fb; } catch { return fb; } };

// ---- Bookmarks ----
export const getBookmarks = (videoId?: string): Bookmark[] => {
  const all = safeParse<Bookmark[]>(localStorage.getItem(K.bookmarks), []);
  return videoId ? all.filter(b => b.videoId === videoId) : all;
};
export const addBookmark = (b: Omit<Bookmark, "id" | "createdAt">): Bookmark => {
  const all = safeParse<Bookmark[]>(localStorage.getItem(K.bookmarks), []);
  const item: Bookmark = { ...b, id: crypto.randomUUID(), createdAt: Date.now() };
  all.push(item);
  localStorage.setItem(K.bookmarks, JSON.stringify(all));
  return item;
};
export const removeBookmark = (id: string) => {
  const all = safeParse<Bookmark[]>(localStorage.getItem(K.bookmarks), []);
  localStorage.setItem(K.bookmarks, JSON.stringify(all.filter(b => b.id !== id)));
};

// ---- Engagement (emotion proxy) ----
export const getEngagement = (videoId: string): EngagementStat => {
  return safeParse<EngagementStat>(localStorage.getItem(K.engagement(videoId)),
    { videoId, pauses: 0, replays: 0, seeks: 0, lastUpdate: Date.now() });
};
export const bumpEngagement = (videoId: string, kind: "pauses" | "replays" | "seeks") => {
  const s = getEngagement(videoId);
  s[kind] = (s[kind] || 0) + 1;
  s.lastUpdate = Date.now();
  localStorage.setItem(K.engagement(videoId), JSON.stringify(s));
};
export const engagementLabel = (s: EngagementStat): { label: string; color: string } => {
  const score = s.pauses + s.replays * 2 + s.seeks * 0.5;
  if (score < 3) return { label: "🚀 Focused", color: "text-success" };
  if (score < 8) return { label: "🤔 Curious", color: "text-primary" };
  if (score < 15) return { label: "😕 Confused", color: "text-secondary" };
  return { label: "🥵 Struggling", color: "text-destructive" };
};

// ---- Streak ----
export const getStreak = (): { current: number; best: number; lastDay: string | null } => {
  return safeParse(localStorage.getItem(K.streak), { current: 0, best: 0, lastDay: null });
};
export const touchStreak = () => {
  const today = new Date().toISOString().slice(0, 10);
  const s = getStreak();
  if (s.lastDay === today) return s;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const current = s.lastDay === yesterday ? s.current + 1 : 1;
  const next = { current, best: Math.max(s.best, current), lastDay: today };
  localStorage.setItem(K.streak, JSON.stringify(next));
  return next;
};

// ---- Reminders ----
export const getReminders = (): Reminder[] => safeParse(localStorage.getItem(K.reminders), []);
export const setReminder = (r: Reminder) => {
  const all = getReminders().filter(x => x.videoId !== r.videoId);
  all.push(r);
  localStorage.setItem(K.reminders, JSON.stringify(all));
};
export const dismissReminder = (videoId: string) => {
  const all = getReminders().filter(x => x.videoId !== videoId);
  localStorage.setItem(K.reminders, JSON.stringify(all));
};
export const dueReminders = (): Reminder[] => getReminders().filter(r => r.remindAt <= Date.now());

// ---- Subtitles cache ----
export type Cue = { start: number; end: number; text: string };
export const cacheSubtitles = (videoId: string, lang: string, cues: Cue[]) => {
  localStorage.setItem(K.subtitles(videoId, lang), JSON.stringify(cues));
};
export const loadSubtitles = (videoId: string, lang: string): Cue[] | null => {
  const raw = localStorage.getItem(K.subtitles(videoId, lang));
  return raw ? safeParse<Cue[]>(raw, []) : null;
};

// ---- Topic completion ----
export const markTopic = (topic: string, pct: number) => {
  const all = safeParse<Record<string, number>>(localStorage.getItem(K.topics), {});
  all[topic] = Math.max(all[topic] || 0, pct);
  localStorage.setItem(K.topics, JSON.stringify(all));
};
export const getTopicProgress = (): Record<string, number> => safeParse(localStorage.getItem(K.topics), {});
