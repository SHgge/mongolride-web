-- ============================================================
-- get_my_role() функц нь authenticated user-ийн query-г
-- блоклодог байсан. Бүх policy-г get_my_role() ашиглахгүйгээр
-- шууд EXISTS subquery ашиглахаар шинэчилнэ.
-- ============================================================

-- Хуучин routes policy устгах (аль нь байгааг нь)
DROP POLICY IF EXISTS "routes_select_all" ON routes;
DROP POLICY IF EXISTS "routes_select" ON routes;
DROP POLICY IF EXISTS "routes_select_approved" ON routes;
DROP POLICY IF EXISTS "routes_select_pending" ON routes;

-- Шинэ routes SELECT: approved бүгдэд, бусад нь зохиогч/admin-д
CREATE POLICY "routes_select" ON routes FOR SELECT USING (
  status = 'approved'
  OR created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ========== PROFILES: update admin policy засах ==========
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- ========== ROUTES: update admin ==========
DROP POLICY IF EXISTS "routes_update_admin" ON routes;
CREATE POLICY "routes_update_admin" ON routes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ========== EVENTS: insert/update admin ==========
DROP POLICY IF EXISTS "events_insert_admin" ON events;
CREATE POLICY "events_insert_admin" ON events FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "events_update_admin" ON events;
CREATE POLICY "events_update_admin" ON events FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ========== LISTINGS: update/delete admin ==========
DROP POLICY IF EXISTS "listings_update_admin" ON listings;
CREATE POLICY "listings_update_admin" ON listings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "listings_delete_admin" ON listings;
CREATE POLICY "listings_delete_admin" ON listings FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ========== SOS: update admin ==========
DROP POLICY IF EXISTS "sos_update_admin" ON sos_alerts;
CREATE POLICY "sos_update_admin" ON sos_alerts FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ========== NEWS: select/insert/update admin ==========
DROP POLICY IF EXISTS "news_select_admin" ON news;
CREATE POLICY "news_select_admin" ON news FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "news_insert_admin" ON news;
CREATE POLICY "news_insert_admin" ON news FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "news_update_admin" ON news;
CREATE POLICY "news_update_admin" ON news FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ========== BADGES: insert admin ==========
DROP POLICY IF EXISTS "badges_insert_admin" ON badges;
CREATE POLICY "badges_insert_admin" ON badges FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
