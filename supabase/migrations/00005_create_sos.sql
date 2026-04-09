CREATE TYPE sos_status AS ENUM ('active', 'responding', 'resolved', 'false_alarm');

CREATE TABLE sos_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  message TEXT,
  status sos_status DEFAULT 'active',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sos_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sos_id UUID REFERENCES sos_alerts(id) ON DELETE CASCADE,
  responder_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT,
  responder_location GEOGRAPHY(POINT, 4326),
  responded_at TIMESTAMPTZ DEFAULT NOW()
);

-- SOS ойролцоох гишүүд хайх spatial index
CREATE INDEX idx_sos_location ON sos_alerts USING GIST(location);
CREATE INDEX idx_sos_status ON sos_alerts(status);
