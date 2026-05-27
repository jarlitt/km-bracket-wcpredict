INSERT INTO public.profiles (id, display_name, avatar_url)
SELECT
  users.id,
  COALESCE(users.raw_user_meta_data->>'display_name', users.email, 'User'),
  users.raw_user_meta_data->>'avatar_url'
FROM auth.users
LEFT JOIN public.profiles ON profiles.id = users.id
WHERE profiles.id IS NULL;

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
