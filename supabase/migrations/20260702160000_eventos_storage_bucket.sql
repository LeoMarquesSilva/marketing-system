-- Bucket de arquivos do módulo de Eventos (contratos, orçamentos, fotos, vídeos).
-- allowed_mime_types NULL = aceita qualquer tipo (arquivos de evento variam muito).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'MARKETING-SYSTEM-EVENTOS',
  'MARKETING-SYSTEM-EVENTOS',
  true,
  1073741824,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read MARKETING-SYSTEM-EVENTOS" ON storage.objects;
DROP POLICY IF EXISTS "Auth insert MARKETING-SYSTEM-EVENTOS" ON storage.objects;
DROP POLICY IF EXISTS "Auth update MARKETING-SYSTEM-EVENTOS" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete MARKETING-SYSTEM-EVENTOS" ON storage.objects;

CREATE POLICY "Public read MARKETING-SYSTEM-EVENTOS"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'MARKETING-SYSTEM-EVENTOS');

CREATE POLICY "Auth insert MARKETING-SYSTEM-EVENTOS"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'MARKETING-SYSTEM-EVENTOS');

CREATE POLICY "Auth update MARKETING-SYSTEM-EVENTOS"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'MARKETING-SYSTEM-EVENTOS');

CREATE POLICY "Auth delete MARKETING-SYSTEM-EVENTOS"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'MARKETING-SYSTEM-EVENTOS');
