-- A escolha oficial deve apontar para uma foto do próprio colaborador.
ALTER TABLE public.collaborator_photos
  ADD CONSTRAINT collaborator_photos_id_user_id_key UNIQUE (id, user_id);

ALTER TABLE public.collaborator_photo_usages
  DROP CONSTRAINT collaborator_photo_usages_photo_id_fkey,
  ADD CONSTRAINT collaborator_photo_usages_photo_owner_fkey
    FOREIGN KEY (photo_id, user_id)
    REFERENCES public.collaborator_photos (id, user_id)
    ON DELETE CASCADE;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.refresh_official_photo_projection(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  selected_photo_url text;
BEGIN
  SELECT cp.public_url
    INTO selected_photo_url
  FROM public.collaborator_photo_usages cpu
  JOIN public.photo_usage_types put ON put.id = cpu.usage_type_id
  JOIN public.collaborator_photos cp
    ON cp.id = cpu.photo_id
   AND cp.user_id = cpu.user_id
  WHERE cpu.user_id = p_user_id
    AND put.is_official = true
  LIMIT 1;

  UPDATE public.users
  SET avatar_url = selected_photo_url
  WHERE id = p_user_id
    AND avatar_url IS DISTINCT FROM selected_photo_url;

  UPDATE public.professional_profiles
  SET photo_url = selected_photo_url
  WHERE user_id = p_user_id
    AND photo_url IS DISTINCT FROM selected_photo_url;
END;
$$;

CREATE OR REPLACE FUNCTION private.sync_official_photo_projection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  old_is_official boolean := false;
  new_is_official boolean := false;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT put.is_official
      INTO old_is_official
    FROM public.photo_usage_types put
    WHERE put.id = OLD.usage_type_id;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT put.is_official
      INTO new_is_official
    FROM public.photo_usage_types put
    WHERE put.id = NEW.usage_type_id;
  END IF;

  IF old_is_official THEN
    PERFORM private.refresh_official_photo_projection(OLD.user_id);
  END IF;

  IF new_is_official
     AND (
       TG_OP = 'INSERT'
       OR NOT old_is_official
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
     ) THEN
    PERFORM private.refresh_official_photo_projection(NEW.user_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION private.refresh_official_photo_projection(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.sync_official_photo_projection() FROM PUBLIC;

DROP TRIGGER IF EXISTS collaborator_photo_usages_sync_official
  ON public.collaborator_photo_usages;
CREATE TRIGGER collaborator_photo_usages_sync_official
AFTER INSERT OR UPDATE OR DELETE ON public.collaborator_photo_usages
FOR EACH ROW
EXECUTE FUNCTION private.sync_official_photo_projection();

-- Garante que o estado atual também passe pela nova fonte transacional.
DO $$
DECLARE
  selected_user record;
BEGIN
  FOR selected_user IN
    SELECT DISTINCT cpu.user_id
    FROM public.collaborator_photo_usages cpu
    JOIN public.photo_usage_types put ON put.id = cpu.usage_type_id
    WHERE put.is_official = true
  LOOP
    PERFORM private.refresh_official_photo_projection(selected_user.user_id);
  END LOOP;
END;
$$;
