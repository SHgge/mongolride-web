CREATE TYPE event_status AS ENUM ('upcoming', 'ongoing', 'completed', 'cancelled');

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  meeting_point GEOGRAPHY(POINT, 4326),
  meeting_address TEXT,
  route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
  max_participants INTEGER,
  current_participants INTEGER DEFAULT 0,
  status event_status DEFAULT 'upcoming',
  images TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'registered' CHECK (status IN ('registered', 'waitlist', 'attended', 'cancelled')),
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Бүртгүүлэхэд current_participants автоматаар нэмэгдэх
CREATE OR REPLACE FUNCTION update_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'registered' THEN
    UPDATE events SET current_participants = current_participants + 1 WHERE id = NEW.event_id;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'registered' THEN
    UPDATE events SET current_participants = current_participants - 1 WHERE id = OLD.event_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != 'registered' AND NEW.status = 'registered' THEN
      UPDATE events SET current_participants = current_participants + 1 WHERE id = NEW.event_id;
    ELSIF OLD.status = 'registered' AND NEW.status != 'registered' THEN
      UPDATE events SET current_participants = current_participants - 1 WHERE id = NEW.event_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER event_participants_count
  AFTER INSERT OR UPDATE OR DELETE ON event_participants
  FOR EACH ROW EXECUTE FUNCTION update_participant_count();

CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_events_status ON events(status);

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
