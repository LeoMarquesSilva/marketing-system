/**
 * E-mail corporativo é sempre @bismarchipires.com.br (pedido do usuário em
 * 10/11/2026: "nunca use bpplaw"). Cadastros antigos do VIOS ainda trazem
 * @bpplaw.com.br; aqui eles viram o domínio atual antes de qualquer envio.
 */

export const CORPORATE_EMAIL_DOMAIN = "bismarchipires.com.br";
const LEGACY_DOMAINS = ["bpplaw.com.br"];

function splitEmail(value: string): { local: string; domain: string } | null {
  const at = value.lastIndexOf("@");
  if (at <= 0 || at === value.length - 1) return null;
  return { local: value.slice(0, at), domain: value.slice(at + 1) };
}

/** Minúsculas, sem espaços e com o domínio antigo trocado pelo atual. */
export function corporateEmail(value: string | null | undefined): string {
  const email = (value ?? "").trim().toLowerCase();
  const parts = splitEmail(email);
  if (parts && LEGACY_DOMAINS.includes(parts.domain)) return `${parts.local}@${CORPORATE_EMAIL_DOMAIN}`;
  return email;
}

/** O mesmo endereço nos dois domínios, para achar cadastro antigo gravado com o domínio velho. */
export function emailLookupVariants(value: string): string[] {
  const email = corporateEmail(value);
  const parts = splitEmail(email);
  if (!parts || parts.domain !== CORPORATE_EMAIL_DOMAIN) return [email];
  return [email, ...LEGACY_DOMAINS.map((domain) => `${parts.local}@${domain}`)];
}
