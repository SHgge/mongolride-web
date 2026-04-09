-- get_my_role() null буцаахад алдаа гаргахгүй болгох
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT COALESCE(
    (SELECT role FROM profiles WHERE id = auth.uid()),
    'guest'::user_role
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Routes SELECT policy-г нэг policy болгож хялбарчлах
-- Хуучин policy-уудыг устгах
DROP POLICY IF EXISTS "routes_select_approved" ON routes;
DROP POLICY IF EXISTS "routes_select_pending" ON routes;

-- Шинэ нэгдсэн policy: approved бүгдэд харагдана, pending зөвхөн зохиогч/admin-д
CREATE POLICY "routes_select" ON routes FOR SELECT USING (
  status = 'approved'
  OR (
    status = 'pending' AND (
      created_by = auth.uid()
      OR get_my_role() = 'admin'
    )
  )
  OR (
    status = 'rejected' AND (
      created_by = auth.uid()
      OR get_my_role() = 'admin'
    )
  )
);
