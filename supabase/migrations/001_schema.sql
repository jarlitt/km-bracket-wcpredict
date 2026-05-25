CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.group_predictions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  match_id INTEGER NOT NULL,
  predicted_score_a INTEGER NOT NULL,
  predicted_score_b INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, match_id)
);

ALTER TABLE public.group_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own group predictions"
  ON public.group_predictions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own group predictions"
  ON public.group_predictions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own group predictions"
  ON public.group_predictions FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE public.knockout_predictions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  match_id TEXT NOT NULL,
  predicted_winner_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, match_id)
);

ALTER TABLE public.knockout_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own knockout predictions"
  ON public.knockout_predictions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own knockout predictions"
  ON public.knockout_predictions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own knockout predictions"
  ON public.knockout_predictions FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE public.actual_group_results (
  match_id INTEGER PRIMARY KEY,
  score_a INTEGER NOT NULL,
  score_b INTEGER NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.actual_group_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view results"
  ON public.actual_group_results FOR SELECT USING (true);

CREATE POLICY "Only admins can manage results"
  ON public.actual_group_results FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE TABLE public.actual_knockout_results (
  match_id TEXT PRIMARY KEY,
  winner_id INTEGER NOT NULL,
  score_a INTEGER,
  score_b INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.actual_knockout_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view knockout results"
  ON public.actual_knockout_results FOR SELECT USING (true);

CREATE POLICY "Only admins can manage knockout results"
  ON public.actual_knockout_results FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE TABLE public.user_scores (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  total_score INTEGER DEFAULT 0,
  group_match_points INTEGER DEFAULT 0,
  exact_score_bonus INTEGER DEFAULT 0,
  group_position_points INTEGER DEFAULT 0,
  knockout_points INTEGER DEFAULT 0,
  score_breakdown JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view scores"
  ON public.user_scores FOR SELECT USING (true);

CREATE TABLE public.submissions (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  is_locked BOOLEAN DEFAULT TRUE
);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own submission"
  ON public.submissions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can submit"
  ON public.submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
