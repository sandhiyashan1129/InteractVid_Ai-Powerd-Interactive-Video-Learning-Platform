import { supabase } from "@/integrations/supabase/client";

export type Difficulty = "easy" | "medium" | "hard";

export type PopupQuiz = {
  id: string;
  video_id?: string;
  user_id?: string;
  time_seconds: number;
  question: string;
  options: string[];
  correct_index: number;
  explanation?: string;
  difficulty?: Difficulty;
};

export type StoredAnswer = {
  quizId: string;
  selectedIndex: number;
  correct: boolean;
  answeredAt: number;
};

const defaultQuizzes = (): Omit<PopupQuiz, "id">[] => [
  {
    time_seconds: 30,
    question: "What is the main idea introduced so far in this video?",
    options: ["A core concept overview", "An unrelated story", "A product ad", "Closing credits"],
    correct_index: 0,
    explanation: "The opening of an educational video typically establishes the core concept.",
    difficulty: "easy",
  },
  {
    time_seconds: 60,
    question: "Why is active recall (like quizzes) effective for learning?",
    options: ["It strengthens memory retrieval pathways", "It is faster than watching", "It replaces the need to study", "It only helps short-term memory"],
    correct_index: 0,
    explanation: "Retrieval practice strengthens long-term retention.",
    difficulty: "medium",
  },
  {
    time_seconds: 120,
    question: "What should you do if you get a quiz answer wrong?",
    options: ["Skip the topic", "Rewatch the segment and reflect", "Ignore the explanation", "Stop the course"],
    correct_index: 1,
    explanation: "Revisiting the segment closes the knowledge gap.",
    difficulty: "medium",
  },
];

export const loadPopupQuizzes = async (videoId: string, ownerUserId?: string): Promise<PopupQuiz[]> => {
  const { data } = await supabase
    .from("popup_quizzes")
    .select("*")
    .eq("video_id", videoId)
    .order("time_seconds");
  if (data && data.length) return data.map(d => ({ ...d, options: d.options as string[], difficulty: d.difficulty as Difficulty }));
  // Seed defaults for the owner if none exist
  if (ownerUserId) {
    const seeds = defaultQuizzes().map(q => ({ ...q, video_id: videoId, user_id: ownerUserId }));
    const { data: inserted } = await supabase.from("popup_quizzes").insert(seeds).select("*");
    return (inserted || []).map(d => ({ ...d, options: d.options as string[], difficulty: d.difficulty as Difficulty }));
  }
  return [];
};

export const savePopupQuiz = async (q: PopupQuiz, videoId: string, userId: string): Promise<PopupQuiz> => {
  if (q.id && !q.id.startsWith("tmp-")) {
    const { data } = await supabase.from("popup_quizzes").update({
      time_seconds: q.time_seconds, question: q.question, options: q.options,
      correct_index: q.correct_index, explanation: q.explanation, difficulty: q.difficulty || "medium",
    }).eq("id", q.id).select().single();
    return { ...data, options: data.options as string[], difficulty: data.difficulty as Difficulty };
  }
  const { data } = await supabase.from("popup_quizzes").insert({
    video_id: videoId, user_id: userId, time_seconds: q.time_seconds, question: q.question,
    options: q.options, correct_index: q.correct_index, explanation: q.explanation, difficulty: q.difficulty || "medium",
  }).select().single();
  return { ...data, options: data.options as string[], difficulty: data.difficulty as Difficulty };
};

export const deletePopupQuiz = async (id: string) => {
  await supabase.from("popup_quizzes").delete().eq("id", id);
};

export const recordAttempt = async (params: {
  userId: string; quizId: string; videoId: string; selectedIndex: number;
  isCorrect: boolean; difficulty: Difficulty; timeTakenSeconds?: number;
}) => {
  await supabase.from("popup_quiz_attempts").insert({
    user_id: params.userId, quiz_id: params.quizId, video_id: params.videoId,
    selected_index: params.selectedIndex, is_correct: params.isCorrect,
    difficulty: params.difficulty, time_taken_seconds: params.timeTakenSeconds,
  });
};

export const loadAttempts = async (userId: string, videoId: string) => {
  const { data } = await supabase.from("popup_quiz_attempts").select("*")
    .eq("user_id", userId).eq("video_id", videoId).order("created_at");
  return data || [];
};

// Adaptive: returns next difficulty based on rolling accuracy
export const nextDifficulty = (recent: { is_correct: boolean }[]): Difficulty => {
  const last = recent.slice(-5);
  if (last.length < 2) return "medium";
  const acc = last.filter(a => a.is_correct).length / last.length;
  if (acc >= 0.8) return "hard";
  if (acc <= 0.4) return "easy";
  return "medium";
};
