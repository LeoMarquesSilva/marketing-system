INSERT INTO public.official_photo_api_consumers (slug, name)
VALUES ('forjai', 'FORJAI')
ON CONFLICT (slug) DO UPDATE
SET
  name = excluded.name,
  updated_at = now();
