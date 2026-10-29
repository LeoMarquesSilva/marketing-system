import "server-only";

import { Resend } from "resend";

/**
 * E-mail transacional do sistema (avisos internos, não campanhas). Usa a mesma
 * conta do Resend do e-mail marketing; o remetente pode ser trocado com
 * SYSTEM_EMAIL_FROM / SYSTEM_EMAIL_FROM_NAME.
 */
function fromAddress(): string | null {
  const explicit = process.env.SYSTEM_EMAIL_FROM?.trim() || process.env.EMAIL_MARKETING_FROM_EMAIL?.trim();
  if (explicit) return explicit;
  const domain = process.env.EMAIL_MARKETING_FROM_DOMAIN?.trim();
  return domain ? `orqestrai@${domain}` : null;
}

export function isSystemEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && fromAddress());
}

export async function sendSystemEmail(message: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ id: string | null }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = fromAddress();
  if (!apiKey || !from) throw new Error("E-mail do sistema não configurado (RESEND_API_KEY e remetente).");
  const name = process.env.SYSTEM_EMAIL_FROM_NAME?.trim() || "ORQESTRAI";
  const { data, error } = await new Resend(apiKey).emails.send({
    from: `${name} <${from}>`,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
  if (error) throw new Error(error.message);
  return { id: data?.id ?? null };
}
