-- Limpa push_name incorreto (nome da instância/celular em vez do lead)
-- Causa: Evolution envia pushName da instância em mensagens fromMe

UPDATE whatsapp_conversations
SET
  push_name = NULL,
  updated_at = NOW()
WHERE push_name IS NOT NULL
  AND (
    LOWER(TRIM(push_name)) = LOWER('Bismarchi Pires Sociedade de Advogados')
    OR LOWER(push_name) LIKE '%bismarchi pires%'
    OR LOWER(push_name) LIKE '%sociedade de advogados%'
  );
