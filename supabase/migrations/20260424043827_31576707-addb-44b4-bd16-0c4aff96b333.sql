
-- Popup quizzes attached to videos at specific timestamps
CREATE TABLE public.popup_quizzes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  time_seconds INTEGER NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_index INTEGER NOT NULL,
  explanation TEXT,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_popup_quizzes_video ON public.popup_quizzes(video_id, time_seconds);
ALTER TABLE public.popup_quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Quizzes viewable by everyone" ON public.popup_quizzes FOR SELECT USING (true);
CREATE POLICY "Owners insert quizzes" ON public.popup_quizzes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update quizzes" ON public.popup_quizzes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Owners delete quizzes" ON public.popup_quizzes FOR DELETE USING (auth.uid() = user_id);

-- Per-question attempts for adaptive engine
CREATE TABLE public.popup_quiz_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  quiz_id UUID NOT NULL REFERENCES public.popup_quizzes(id) ON DELETE CASCADE,
  video_id UUID NOT NULL,
  selected_index INTEGER NOT NULL,
  is_correct BOOLEAN NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  time_taken_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pqa_user_video ON public.popup_quiz_attempts(user_id, video_id);
ALTER TABLE public.popup_quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own attempts select" ON public.popup_quiz_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Own attempts insert" ON public.popup_quiz_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Gamification
CREATE TABLE public.gamification (
  user_id UUID NOT NULL PRIMARY KEY,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gamification ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gamification public read" ON public.gamification FOR SELECT USING (true);
CREATE POLICY "Own gamification insert" ON public.gamification FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own gamification update" ON public.gamification FOR UPDATE USING (auth.uid() = user_id);

-- Badges
CREATE TABLE public.badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Badges public read" ON public.badges FOR SELECT USING (true);
CREATE POLICY "Own badges insert" ON public.badges FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Exam mode attempts
CREATE TABLE public.exam_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  video_id UUID NOT NULL,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL,
  answers JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own exam select" ON public.exam_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Own exam insert" ON public.exam_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
