CREATE TABLE km_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  distance_km DECIMAL(8,2) NOT NULL,
  elevation_gain INTEGER DEFAULT 0,
  route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
  ride_date DATE NOT NULL DEFAULT CURRENT_DATE,
  strava_activity_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                 -- "Хустайн аварга"
  description TEXT,
  icon_url TEXT,
  requirement_type TEXT CHECK (requirement_type IN ('km', 'rides', 'route', 'event', 'special')),
  requirement_value INTEGER,
  requirement_route_id UUID REFERENCES routes(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id UUID REFERENCES badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

-- km_log нэмэгдэхэд profiles.total_km автоматаар шинэчлэх
CREATE OR REPLACE FUNCTION update_user_km()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET total_km = total_km + NEW.distance_km,
      total_rides = total_rides + 1,
      total_elevation = total_elevation + COALESCE(NEW.elevation_gain, 0),
      rank = CASE
        WHEN total_km + NEW.distance_km >= 3000 THEN 'avarga'
        WHEN total_km + NEW.distance_km >= 1000 THEN 'khuleg'
        WHEN total_km + NEW.distance_km >= 500 THEN 'shudlen'
        WHEN total_km + NEW.distance_km >= 100 THEN 'daagan'
        ELSE 'unaga'
      END
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER km_log_update_total
  AFTER INSERT ON km_logs
  FOR EACH ROW EXECUTE FUNCTION update_user_km();

CREATE INDEX idx_km_logs_user ON km_logs(user_id, ride_date DESC);
CREATE INDEX idx_km_logs_date ON km_logs(ride_date);

-- Leaderboard view (сарын шилдэг)
CREATE OR REPLACE VIEW monthly_leaderboard AS
SELECT
  p.id,
  p.full_name,
  p.avatar_url,
  p.rank,
  SUM(k.distance_km) AS monthly_km,
  COUNT(k.id) AS monthly_rides,
  SUM(k.elevation_gain) AS monthly_elevation
FROM profiles p
JOIN km_logs k ON k.user_id = p.id
WHERE k.ride_date >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY p.id, p.full_name, p.avatar_url, p.rank
ORDER BY monthly_km DESC;
