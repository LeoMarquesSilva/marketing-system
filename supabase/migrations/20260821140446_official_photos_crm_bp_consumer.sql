INSERT INTO public.official_photo_api_consumers (slug, name)
VALUES ('crm-bp', 'CRM BP')
ON CONFLICT (slug) DO UPDATE
SET
  name = excluded.name,
  updated_at = now();
