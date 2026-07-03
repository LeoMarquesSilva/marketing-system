-- Texto de pré-visualização (preheader) exibido ao lado do assunto na caixa de entrada.
alter table public.email_campaigns add column if not exists preview_text text;
comment on column public.email_campaigns.preview_text is 'Texto de pré-visualização (preheader) exibido ao lado do assunto na caixa de entrada.';
