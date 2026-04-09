-- ============================================================
-- Бүх хүснэгтийн SELECT policy-г шалгаж засах
-- Authenticated user-д бүх public data харагдах ёстой
-- ============================================================

-- PROFILES: SELECT - бүгдэд нээлттэй (аль хэдийн байгаа, давхардал шалгах)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_select' AND tablename = 'profiles') THEN
    CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
  END IF;
END $$;

-- EVENTS: SELECT - бүгдэд нээлттэй (давхардал шалгах)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'events_select' AND tablename = 'events') THEN
    CREATE POLICY "events_select" ON events FOR SELECT USING (true);
  END IF;
END $$;

-- EVENT_PARTICIPANTS: SELECT
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ep_select' AND tablename = 'event_participants') THEN
    CREATE POLICY "ep_select" ON event_participants FOR SELECT USING (true);
  END IF;
END $$;

-- LISTINGS: SELECT
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'listings_select' AND tablename = 'listings') THEN
    CREATE POLICY "listings_select" ON listings FOR SELECT USING (true);
  END IF;
END $$;

-- KM_LOGS: SELECT - бүгдэд нээлттэй (leaderboard-д хэрэгтэй)
DROP POLICY IF EXISTS "km_select" ON km_logs;
CREATE POLICY "km_select" ON km_logs FOR SELECT USING (true);

-- BADGES: SELECT
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'badges_select' AND tablename = 'badges') THEN
    CREATE POLICY "badges_select" ON badges FOR SELECT USING (true);
  END IF;
END $$;

-- USER_BADGES: SELECT
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'user_badges_select' AND tablename = 'user_badges') THEN
    CREATE POLICY "user_badges_select" ON user_badges FOR SELECT USING (true);
  END IF;
END $$;

-- ROUTE_RATINGS: SELECT
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'route_ratings_select' AND tablename = 'route_ratings') THEN
    CREATE POLICY "route_ratings_select" ON route_ratings FOR SELECT USING (true);
  END IF;
END $$;

-- GROUP_BUYS: SELECT
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'group_buys_select' AND tablename = 'group_buys') THEN
    CREATE POLICY "group_buys_select" ON group_buys FOR SELECT USING (true);
  END IF;
END $$;

-- GROUP_BUY_PARTICIPANTS: SELECT
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'group_buy_participants_select' AND tablename = 'group_buy_participants') THEN
    CREATE POLICY "group_buy_participants_select" ON group_buy_participants FOR SELECT USING (true);
  END IF;
END $$;

-- NEWS_COMMENTS: SELECT
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'news_comments_select' AND tablename = 'news_comments') THEN
    CREATE POLICY "news_comments_select" ON news_comments FOR SELECT USING (true);
  END IF;
END $$;

-- SOS_RESPONSES: SELECT (authenticated only)
DROP POLICY IF EXISTS "sos_resp_select" ON sos_responses;
CREATE POLICY "sos_resp_select" ON sos_responses FOR SELECT USING (auth.uid() IS NOT NULL);

-- NOTIFICATIONS: own only (аль хэдийн байгаа)
-- notifications_select_own already exists
