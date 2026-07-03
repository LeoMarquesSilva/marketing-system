-- Storage Pro (ORQESTRAI): buckets públicos + políticas

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'MARKETING-SYSTEM-FOTOS',
  'MARKETING-SYSTEM-FOTOS',
  true,
  1073741824,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'MARKETING-SYSTEM-PROJETOS',
  'MARKETING-SYSTEM-PROJETOS',
  true,
  1073741824,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read MARKETING-SYSTEM-FOTOS" ON storage.objects;
DROP POLICY IF EXISTS "Auth insert MARKETING-SYSTEM-FOTOS" ON storage.objects;
DROP POLICY IF EXISTS "Auth update MARKETING-SYSTEM-FOTOS" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete MARKETING-SYSTEM-FOTOS" ON storage.objects;
DROP POLICY IF EXISTS "Public read MARKETING-SYSTEM-PROJETOS" ON storage.objects;
DROP POLICY IF EXISTS "Auth insert MARKETING-SYSTEM-PROJETOS" ON storage.objects;
DROP POLICY IF EXISTS "Auth update MARKETING-SYSTEM-PROJETOS" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete MARKETING-SYSTEM-PROJETOS" ON storage.objects;
DROP POLICY IF EXISTS "Service role full storage" ON storage.objects;

CREATE POLICY "Public read MARKETING-SYSTEM-FOTOS"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'MARKETING-SYSTEM-FOTOS');

CREATE POLICY "Auth insert MARKETING-SYSTEM-FOTOS"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'MARKETING-SYSTEM-FOTOS');

CREATE POLICY "Auth update MARKETING-SYSTEM-FOTOS"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'MARKETING-SYSTEM-FOTOS');

CREATE POLICY "Auth delete MARKETING-SYSTEM-FOTOS"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'MARKETING-SYSTEM-FOTOS');

CREATE POLICY "Public read MARKETING-SYSTEM-PROJETOS"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'MARKETING-SYSTEM-PROJETOS');

CREATE POLICY "Auth insert MARKETING-SYSTEM-PROJETOS"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'MARKETING-SYSTEM-PROJETOS');

CREATE POLICY "Auth update MARKETING-SYSTEM-PROJETOS"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'MARKETING-SYSTEM-PROJETOS');

CREATE POLICY "Auth delete MARKETING-SYSTEM-PROJETOS"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'MARKETING-SYSTEM-PROJETOS');

CREATE POLICY "Service role full storage"
  ON storage.objects FOR ALL TO service_role
  USING (true) WITH CHECK (true);
