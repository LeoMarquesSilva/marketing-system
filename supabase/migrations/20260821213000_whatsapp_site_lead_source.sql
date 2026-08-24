-- WhatsApp: atribuição de leads vindos do botão do site (mesmo padrão já usado
-- para leads do Meta Ads: casa o texto pré-preenchido da primeira mensagem).
-- O widget do site já inclui "Página: <título>" + a URL na mensagem; guardamos
-- isso pra saber de qual página do site o lead realmente veio.

alter table public.whatsapp_conversations
  add column if not exists site_lead_page_title text,
  add column if not exists site_lead_page_url text;

comment on column public.whatsapp_conversations.site_lead_page_title is
  'Título da página do site de onde veio o lead (extraído da mensagem do widget de WhatsApp)';
comment on column public.whatsapp_conversations.site_lead_page_url is
  'URL da página do site de onde veio o lead (extraído da mensagem do widget de WhatsApp)';
