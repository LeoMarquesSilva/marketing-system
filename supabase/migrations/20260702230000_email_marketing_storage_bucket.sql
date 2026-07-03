-- Bucket de imagens do módulo de E-mail Marketing (newsletters, campanhas)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'MARKETING-SYSTEM-EMAILS',
  'MARKETING-SYSTEM-EMAILS',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read MARKETING-SYSTEM-EMAILS" ON storage.objects;
DROP POLICY IF EXISTS "Auth insert MARKETING-SYSTEM-EMAILS" ON storage.objects;
DROP POLICY IF EXISTS "Auth update MARKETING-SYSTEM-EMAILS" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete MARKETING-SYSTEM-EMAILS" ON storage.objects;

CREATE POLICY "Public read MARKETING-SYSTEM-EMAILS"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'MARKETING-SYSTEM-EMAILS');

CREATE POLICY "Auth insert MARKETING-SYSTEM-EMAILS"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'MARKETING-SYSTEM-EMAILS');

CREATE POLICY "Auth update MARKETING-SYSTEM-EMAILS"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'MARKETING-SYSTEM-EMAILS');

CREATE POLICY "Auth delete MARKETING-SYSTEM-EMAILS"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'MARKETING-SYSTEM-EMAILS');
