-- Add policy to allow users to insert their own profile during signup
CREATE POLICY "Users can insert their own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);
