-- Өмнөх routes SELECT policy устгах
DROP POLICY IF EXISTS "routes_select" ON routes;

-- Хамгийн энгийн routes SELECT policy
-- approved маршрутыг хүн бүр (anon + authenticated) харна
-- pending/rejected маршрутыг зөвхөн зохиогч эсвэл admin харна
CREATE POLICY "routes_select_all" ON routes FOR SELECT USING (
  status = 'approved'
  OR created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- route_ratings SELECT policy (байхгүй бол нэмэх)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'route_ratings_select' AND tablename = 'route_ratings') THEN
    CREATE POLICY "route_ratings_select" ON route_ratings FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'route_ratings_insert' AND tablename = 'route_ratings') THEN
    CREATE POLICY "route_ratings_insert" ON route_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- group_buys SELECT policy (байхгүй бол нэмэх)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'group_buys_select' AND tablename = 'group_buys') THEN
    CREATE POLICY "group_buys_select" ON group_buys FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'group_buy_participants_select' AND tablename = 'group_buy_participants') THEN
    CREATE POLICY "group_buy_participants_select" ON group_buy_participants FOR SELECT USING (true);
  END IF;
END $$;
