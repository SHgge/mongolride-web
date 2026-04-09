CREATE TYPE listing_category AS ENUM ('bike', 'parts', 'clothing', 'accessories', 'other');
CREATE TYPE listing_condition AS ENUM ('new', 'like_new', 'used', 'for_parts');
CREATE TYPE listing_status AS ENUM ('active', 'sold', 'reserved', 'removed');

CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,                -- ₮ төгрөгөөр
  category listing_category NOT NULL,
  condition listing_condition NOT NULL,
  images TEXT[] DEFAULT '{}',
  status listing_status DEFAULT 'active',
  view_count INTEGER DEFAULT 0,
  seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE group_buys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  product_url TEXT,
  target_quantity INTEGER NOT NULL,
  current_quantity INTEGER DEFAULT 0,
  price_per_unit INTEGER NOT NULL,
  deadline TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'reached', 'closed', 'cancelled')),
  organizer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE group_buy_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_buy_id UUID REFERENCES group_buys(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_buy_id, user_id)
);

CREATE INDEX idx_listings_category ON listings(category);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_price ON listings(price);
-- Full-text search Монгол хэл дэмжих
CREATE INDEX idx_listings_search ON listings USING GIN(to_tsvector('simple', title || ' ' || COALESCE(description, '')));

CREATE TRIGGER listings_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
