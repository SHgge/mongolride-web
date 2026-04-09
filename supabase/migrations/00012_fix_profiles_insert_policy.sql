-- Profiles INSERT policy нэмэх (trigger SECURITY DEFINER-ээс гадна service_role-д зориулсан)
-- Мөн хэрэглэгч өөрийн profile-г insert хийж чадахаар тохируулах
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Trigger function-г service_role-оор ажиллуулахаар шинэчлэх
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
