-- Row Level Security бүх хүснэгтэд идэвхжүүлэх
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_buys ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_buy_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE sos_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sos_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE news ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE km_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- Helper: Одоогийн хэрэглэгчийн role авах
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ========== PROFILES ==========
-- Хүн бүр профайл харж чадна
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
-- Өөрийн профайлыг засна
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
-- Admin бүх профайл засна
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE USING (get_my_role() = 'admin');

-- ========== ROUTES ==========
-- Approved маршрутыг хүн бүр харна
CREATE POLICY "routes_select_approved" ON routes FOR SELECT USING (status = 'approved');
-- Pending маршрутыг зөвхөн зохиогч болон admin харна
CREATE POLICY "routes_select_pending" ON routes FOR SELECT USING (
  status = 'pending' AND (created_by = auth.uid() OR get_my_role() = 'admin')
);
-- Member маршрут нэмнэ
CREATE POLICY "routes_insert" ON routes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- Өөрийнхөө маршрутыг засна
CREATE POLICY "routes_update_own" ON routes FOR UPDATE USING (created_by = auth.uid());
-- Admin бүх маршрут засна (approve/reject)
CREATE POLICY "routes_update_admin" ON routes FOR UPDATE USING (get_my_role() = 'admin');

-- ========== EVENTS ==========
CREATE POLICY "events_select" ON events FOR SELECT USING (true);
CREATE POLICY "events_insert_admin" ON events FOR INSERT WITH CHECK (get_my_role() = 'admin');
CREATE POLICY "events_update_admin" ON events FOR UPDATE USING (get_my_role() = 'admin');

-- ========== EVENT PARTICIPANTS ==========
CREATE POLICY "ep_select" ON event_participants FOR SELECT USING (true);
CREATE POLICY "ep_insert" ON event_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ep_delete_own" ON event_participants FOR DELETE USING (auth.uid() = user_id);

-- ========== LISTINGS ==========
CREATE POLICY "listings_select" ON listings FOR SELECT USING (true);
CREATE POLICY "listings_insert" ON listings FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "listings_update_own" ON listings FOR UPDATE USING (seller_id = auth.uid());
CREATE POLICY "listings_update_admin" ON listings FOR UPDATE USING (get_my_role() = 'admin');
CREATE POLICY "listings_delete_own" ON listings FOR DELETE USING (seller_id = auth.uid());
CREATE POLICY "listings_delete_admin" ON listings FOR DELETE USING (get_my_role() = 'admin');

-- ========== SOS ==========
CREATE POLICY "sos_select" ON sos_alerts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "sos_insert" ON sos_alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sos_update_admin" ON sos_alerts FOR UPDATE USING (get_my_role() = 'admin');

CREATE POLICY "sos_resp_select" ON sos_responses FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "sos_resp_insert" ON sos_responses FOR INSERT WITH CHECK (auth.uid() = responder_id);

-- ========== NEWS ==========
CREATE POLICY "news_select_published" ON news FOR SELECT USING (is_published = true);
CREATE POLICY "news_select_admin" ON news FOR SELECT USING (get_my_role() = 'admin');
CREATE POLICY "news_insert_admin" ON news FOR INSERT WITH CHECK (get_my_role() = 'admin');
CREATE POLICY "news_update_admin" ON news FOR UPDATE USING (get_my_role() = 'admin');

CREATE POLICY "news_comments_select" ON news_comments FOR SELECT USING (true);
CREATE POLICY "news_comments_insert" ON news_comments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ========== NOTIFICATIONS ==========
CREATE POLICY "notif_select_own" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notif_update_own" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- ========== KM LOGS ==========
CREATE POLICY "km_select" ON km_logs FOR SELECT USING (true);
CREATE POLICY "km_insert" ON km_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "km_delete_own" ON km_logs FOR DELETE USING (auth.uid() = user_id);

-- ========== BADGES ==========
CREATE POLICY "badges_select" ON badges FOR SELECT USING (true);
CREATE POLICY "badges_insert_admin" ON badges FOR INSERT WITH CHECK (get_my_role() = 'admin');
CREATE POLICY "user_badges_select" ON user_badges FOR SELECT USING (true);
