UPDATE public.official_photo_api_consumers
SET
  slug = 'new-crm',
  name = 'New CRM',
  updated_at = now()
WHERE slug = 'crm-bp';
