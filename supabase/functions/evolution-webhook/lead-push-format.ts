/**
 * Texto da notificação de lead (sem imports do Deno, para o vitest:
 * src/lib/whatsapp-lead-push.test.ts).
 */

export interface LeadPush {
  conversationId: string;
  title: string;
  body: string;
}

function formatPhone(digits: string | null): string | null {
  if (!digits) return null;
  const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return `+${digits}`;
}

/**
 * Conversa com gente do escritório (tag Colaborador, posta também ao encaminhar
 * um lead): resposta do gestor não é mensagem de lead.
 */
export function isTeamConversation(tags: unknown): boolean {
  return Array.isArray(tags) && tags.some((tag) => String(tag).toLowerCase() === "colaborador");
}

const SOURCE_LABELS: Record<string, string> = {
  meta_ads: "Meta Ads",
  site_whatsapp: "Site",
};

/** Título e texto da notificação: quem mandou, de onde veio o lead e a mensagem. */
export function buildLeadPush(input: {
  conversationId: string;
  name: string | null;
  phone: string | null;
  leadSource: string | null;
  isNewConversation: boolean;
  body: string;
}): LeadPush {
  const who = input.name?.trim() || formatPhone(input.phone) || "Contato no WhatsApp";
  const source = input.leadSource ? SOURCE_LABELS[input.leadSource] : null;
  const title = [input.isNewConversation ? `Novo lead: ${who}` : who, source]
    .filter(Boolean)
    .join(" · ");
  const text = input.body.trim() || "[mensagem]";
  return {
    conversationId: input.conversationId,
    title,
    body: text.length > 160 ? `${text.slice(0, 157)}…` : text,
  };
}
