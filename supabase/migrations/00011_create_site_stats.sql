-- Нүүр хуудасны counter-д ашиглах сайтын ерөнхий статистик
CREATE TABLE site_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_members INTEGER DEFAULT 0,
  total_km DECIMAL(12,2) DEFAULT 0,
  total_rides INTEGER DEFAULT 0,
  total_routes INTEGER DEFAULT 0,
  monthly_km DECIMAL(12,2) DEFAULT 0,
  monthly_rides INTEGER DEFAULT 0,
  green_co2_saved_kg DECIMAL(10,2) DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Хүн бүр уншиж болно
ALTER TABLE site_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_stats_select" ON site_stats FOR SELECT USING (true);
