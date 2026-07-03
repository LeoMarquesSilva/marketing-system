-- Links de contato para prestadores (site, instagram, portfólio, whatsapp)

ALTER TABLE event_suppliers
  ADD COLUMN IF NOT EXISTS website_link text,
  ADD COLUMN IF NOT EXISTS instagram_link text,
  ADD COLUMN IF NOT EXISTS portfolio_link text,
  ADD COLUMN IF NOT EXISTS whatsapp_link text;
