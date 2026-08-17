-- A tabela users continua sendo um diretório para pessoas autenticadas, mas
-- deixa de aceitar escrita anônima ou mutações diretas pelo browser.
DROP POLICY IF EXISTS "Allow all for users" ON public.users;
DROP POLICY IF EXISTS "authenticated read users directory" ON public.users;
DROP POLICY IF EXISTS "authenticated signup own user" ON public.users;

REVOKE ALL ON TABLE public.users FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.users FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.users TO authenticated;

CREATE POLICY "authenticated read users directory"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated signup own user"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth_id = (SELECT auth.uid())
    AND is_active = true
    AND role IS NULL
    AND COALESCE(cardinality(permissions), 0) = 0
  );

-- As funções seguem disponíveis para policies autenticadas, mas não como RPC
-- anônima exposta pelo Data API.
REVOKE EXECUTE ON FUNCTION public.current_app_user_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_collaborator_photos_manager_access()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_app_user_id()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_collaborator_photos_manager_access()
  TO authenticated, service_role;

-- Mantém leitura pública deliberada para avatares/perfis, mas restringe toda
-- escrita à pasta própria ou a gestores de fotos.
DROP POLICY IF EXISTS "Auth insert MARKETING-SYSTEM-FOTOS" ON storage.objects;
DROP POLICY IF EXISTS "Auth update MARKETING-SYSTEM-FOTOS" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete MARKETING-SYSTEM-FOTOS" ON storage.objects;
DROP POLICY IF EXISTS "Own or manager insert MARKETING-SYSTEM-FOTOS" ON storage.objects;
DROP POLICY IF EXISTS "Own or manager update MARKETING-SYSTEM-FOTOS" ON storage.objects;
DROP POLICY IF EXISTS "Manager delete MARKETING-SYSTEM-FOTOS" ON storage.objects;

CREATE POLICY "Own or manager insert MARKETING-SYSTEM-FOTOS"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'MARKETING-SYSTEM-FOTOS'
    AND (storage.foldername(name))[1] = 'colaboradores'
    AND (
      (storage.foldername(name))[2] =
        (SELECT public.current_app_user_id())::text
      OR (SELECT public.has_collaborator_photos_manager_access())
    )
  );

CREATE POLICY "Own or manager update MARKETING-SYSTEM-FOTOS"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'MARKETING-SYSTEM-FOTOS'
    AND (storage.foldername(name))[1] = 'colaboradores'
    AND (
      (storage.foldername(name))[2] =
        (SELECT public.current_app_user_id())::text
      OR (SELECT public.has_collaborator_photos_manager_access())
    )
  )
  WITH CHECK (
    bucket_id = 'MARKETING-SYSTEM-FOTOS'
    AND (storage.foldername(name))[1] = 'colaboradores'
    AND (
      (storage.foldername(name))[2] =
        (SELECT public.current_app_user_id())::text
      OR (SELECT public.has_collaborator_photos_manager_access())
    )
  );

CREATE POLICY "Manager delete MARKETING-SYSTEM-FOTOS"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'MARKETING-SYSTEM-FOTOS'
    AND (storage.foldername(name))[1] = 'colaboradores'
    AND (SELECT public.has_collaborator_photos_manager_access())
  );
