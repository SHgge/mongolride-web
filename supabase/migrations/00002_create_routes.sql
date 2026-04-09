-- PostGIS extension (geo query-д шаардлагатай)
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE surface_type AS ENUM ('asphalt', 'dirt', 'gravel', 'ice', 'mixed');
CREATE TYPE route_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  distance_km DECIMAL(8,2) NOT NULL,
  elevation_gain INTEGER DEFAULT 0,
  difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 5),
  surface surface_type[] NOT NULL DEFAULT '{asphalt}',
  start_point GEOGRAPHY(POINT, 4326),
  end_point GEOGRAPHY(POINT, 4326),
  route_line GEOGRAPHY(LINESTRING, 4326),
  gpx_url TEXT,
  images TEXT[] DEFAULT '{}',
  status route_status DEFAULT 'pending',
  avg_rating DECIMAL(3,2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE route_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(route_id, user_id)
);

-- Ойролцоох маршрут хайх (PostGIS spatial index)
CREATE INDEX idx_routes_start_point ON routes USING GIST(start_point);
CREATE INDEX idx_routes_end_point ON routes USING GIST(end_point);
CREATE INDEX idx_routes_status ON routes(status);
CREATE INDEX idx_routes_difficulty ON routes(difficulty);
CREATE INDEX idx_routes_distance ON routes(distance_km);

CREATE TRIGGER routes_updated_at
  BEFORE UPDATE ON routes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
