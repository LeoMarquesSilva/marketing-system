/** Regras de "apagar para todos". Sem dependência de servidor: a bolha também usa. */

export const WHATSAPP_DELETED_TEXT = "Mensagem apagada";
/** Tipo próprio para áudio e imagem apagados não serem lidos como mídia pela tela e pela IA. */
export const WHATSAPP_DELETED_TYPE = "deletedMessage";

/**
 * O limite mais prudente entre as fontes sobre o WhatsApp (2 dias). Depois dele o
 * celular de quem recebeu pode ignorar o pedido, e o painel diria "apagada" com a
 * mensagem ainda lá.
 */
export const WHATSAPP_DELETE_WINDOW_MS = 48 * 60 * 60 * 1000;

export interface DeletableWhatsappMessage {
  from_me: boolean;
  wa_message_id?: string | null;
  message_timestamp: string;
  deleted_at?: string | null;
}

/** Motivo de não poder apagar, ou null quando pode. */
export function whatsappMessageDeleteBlock(
  message: DeletableWhatsappMessage,
  now = Date.now()
): string | null {
  if (message.deleted_at) return "Esta mensagem já foi apagada.";
  if (!message.from_me) return "Só dá para apagar mensagens enviadas pelo escritório.";
  if (!message.wa_message_id) return "O WhatsApp ainda não confirmou o envio desta mensagem.";
  if (now - new Date(message.message_timestamp).getTime() > WHATSAPP_DELETE_WINDOW_MS) {
    return "O WhatsApp só permite apagar para todos até 2 dias depois do envio.";
  }
  return null;
}

export interface ConversationBeforeDelete {
  last_message_at?: string | null;
  last_inbound_at?: string | null;
  last_outbound_at?: string | null;
  attendance_status?: string | null;
}

export interface ConversationDeletePatch {
  last_message_preview?: string;
  last_outbound_at?: string | null;
  attendance_status?: string;
}

const toMs = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : 0);

/**
 * O que muda na conversa ao apagar uma mensagem nossa. Se era a resposta mais
 * recente e o cliente tinha escrito antes dela, ele volta a esperar por nós:
 * senão a conversa ficaria em "aguardando cliente" sem ter tido resposta.
 */
export function conversationPatchAfterDelete(
  conversation: ConversationBeforeDelete,
  deletedMessageAt: string,
  remainingLastOutboundAt: string | null
): ConversationDeletePatch {
  const deletedAt = toMs(deletedMessageAt);
  const patch: ConversationDeletePatch = {};

  if (toMs(conversation.last_message_at) <= deletedAt) {
    patch.last_message_preview = WHATSAPP_DELETED_TEXT;
  }

  if (toMs(conversation.last_outbound_at) <= deletedAt) {
    patch.last_outbound_at = remainingLastOutboundAt;
    const clientWaiting =
      Boolean(conversation.last_inbound_at) &&
      toMs(conversation.last_inbound_at) > toMs(remainingLastOutboundAt);
    if (conversation.attendance_status === "aguardando_cliente" && clientWaiting) {
      patch.attendance_status = "nao_respondido";
    }
  }

  return patch;
}
