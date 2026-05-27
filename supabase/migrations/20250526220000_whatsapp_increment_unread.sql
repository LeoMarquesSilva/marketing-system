-- Incremento atômico de unread_count (evita race no webhook)

CREATE OR REPLACE FUNCTION increment_whatsapp_unread(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE whatsapp_conversations
  SET unread_count = unread_count + 1,
      updated_at = now()
  WHERE id = p_conversation_id;
END;
$$;

COMMENT ON FUNCTION increment_whatsapp_unread(uuid) IS
  'Incrementa unread_count de forma atômica ao receber mensagem inbound';
