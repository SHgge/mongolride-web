-- Хэрэглэгчийн профайл (auth.users-тэй холбоотой)
CREATE TYPE user_role AS ENUM ('guest', 'member', 'admin');
CREATE TYPE user_rank AS ENUM ('unaga', 'daagan', 'shudlen', 'khuleg', 'avarga');

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'member',
  rank user_rank NOT NULL DEFAULT 'unaga',
  total_km DECIMAL(10,2) DEFAULT 0,
  total_rides INTEGER DEFAULT 0,
  total_elevation INTEGER DEFAULT 0,
  bio TEXT,
  strava_id TEXT,
  last_known_lat DOUBLE PRECISION,
  last_known_lng DOUBLE PRECISION,
  last_location_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Шинэ хэрэглэгч бүртгүүлэхэд автоматаар profile үүсгэх trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- updated_at автоматаар шинэчлэх trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_rank ON profiles(rank);
CREATE INDEX idx_profiles_total_km ON profiles(total_km DESC);
