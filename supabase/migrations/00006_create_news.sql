CREATE TABLE news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,              -- TipTap JSON эсвэл HTML
  excerpt TEXT,
  cover_image TEXT,
  category TEXT DEFAULT 'general' CHECK (category IN ('general', 'tips', 'gear_review', 'race', 'announcement')),
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE news_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id UUID REFERENCES news(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_news_published ON news(is_published, published_at DESC);
CREATE INDEX idx_news_slug ON news(slug);

CREATE TRIGGER news_updated_at
  BEFORE UPDATE ON news
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
