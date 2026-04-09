-- Storage bucket-ууд үүсгэх
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('routes', 'routes', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('listings', 'listings', true);

-- Avatars bucket policies
CREATE POLICY "avatars_select" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
CREATE POLICY "avatars_update" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars_delete" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Routes bucket policies
CREATE POLICY "routes_img_select" ON storage.objects FOR SELECT USING (bucket_id = 'routes');
CREATE POLICY "routes_img_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'routes' AND auth.uid() IS NOT NULL);
CREATE POLICY "routes_img_delete" ON storage.objects FOR DELETE USING (bucket_id = 'routes' AND auth.uid() IS NOT NULL);

-- Listings bucket policies
CREATE POLICY "listings_img_select" ON storage.objects FOR SELECT USING (bucket_id = 'listings');
CREATE POLICY "listings_img_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'listings' AND auth.uid() IS NOT NULL);
CREATE POLICY "listings_img_delete" ON storage.objects FOR DELETE USING (bucket_id = 'listings' AND auth.uid() IS NOT NULL);
