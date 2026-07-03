-- O índice único parcial (WHERE sioe_pessoa_id IS NOT NULL) não é reconhecido
-- pelo PostgREST/Supabase como alvo de ON CONFLICT (sioe_pessoa_id), o que
-- fazia o upsert de email_people cair sempre no fallback de INSERT e falhar
-- com "duplicate key" a cada nova sincronização do SIOE.
-- Uma UNIQUE constraint "normal" já trata múltiplos NULLs como distintos,
-- então não perdemos nada ao trocar o índice parcial por ela.
DROP INDEX IF EXISTS idx_email_people_sioe_pessoa_id;

ALTER TABLE email_people
  ADD CONSTRAINT email_people_sioe_pessoa_id_key UNIQUE (sioe_pessoa_id);
