-- Mídias do WhatsApp guardadas no Storage. A Evolution só sabe baixar o arquivo
-- pelo link do WhatsApp (mmg.whatsapp.net), que vence em ~2 semanas; depois disso
-- a mídia some. A Edge Function evolution-webhook baixa assim que a mensagem
-- chega e grava aqui; a rota /api/evolution/messages/media serve por URL assinada.

alter table public.whatsapp_messages
  add column if not exists media_storage_path text,
  add column if not exists media_mimetype text,
  -- Link já vencido quando tentamos guardar: a rota responde 410 sem chamar a Evolution.
  add column if not exists media_expired_at timestamptz;

comment on column public.whatsapp_messages.media_storage_path is
  'Caminho no bucket MARKETING-SYSTEM-WHATSAPP. Nulo = ainda não guardada (cai na Evolution).';

-- Bucket privado, sem policies para authenticated: só o service role grava e
-- assina URLs (a rota confere o login antes).
insert into storage.buckets (id, name, public, file_size_limit)
values ('MARKETING-SYSTEM-WHATSAPP', 'MARKETING-SYSTEM-WHATSAPP', false, 52428800)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;
