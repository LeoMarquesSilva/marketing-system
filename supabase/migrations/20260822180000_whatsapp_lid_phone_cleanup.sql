-- @lid é o JID de privacidade do WhatsApp (Linked ID) — a parte numérica não
-- é um telefone discável, é um ID interno opaco. Antes desta correção, o
-- código extraía esses dígitos e guardava como se fosse phone, mostrando
-- números falsos na tela e sem nome (contato ficava irreconhecível).
UPDATE whatsapp_conversations
SET phone = NULL, updated_at = now()
WHERE remote_jid LIKE '%@lid' AND phone IS NOT NULL;
