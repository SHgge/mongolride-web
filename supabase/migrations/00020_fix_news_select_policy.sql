-- news SELECT policy-уудыг нэгтгэх
-- Хуучин policy-уудыг устгах
DROP POLICY IF EXISTS "news_select_published" ON news;
DROP POLICY IF EXISTS "news_select_admin" ON news;

-- Нэгдсэн policy: нийтлэгдсэн бүгдэд, бусад зөвхөн admin-д
CREATE POLICY "news_select" ON news FOR SELECT USING (
  is_published = true
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- site_stats INSERT/UPDATE policy нэмэх (edge function-д хэрэгтэй)
DROP POLICY IF EXISTS "site_stats_insert" ON site_stats;
DROP POLICY IF EXISTS "site_stats_update" ON site_stats;
DROP POLICY IF EXISTS "site_stats_delete" ON site_stats;

CREATE POLICY "site_stats_manage" ON site_stats FOR ALL USING (true) WITH CHECK (true);
