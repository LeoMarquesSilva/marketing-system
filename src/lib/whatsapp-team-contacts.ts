/**
 * Contatos que o atendimento do WhatsApp pode passar ao cliente: a recepção e
 * as pessoas da equipe (e-mail profissional; cartão do WhatsApp só de quem
 * liberou o número no perfil do site). Funções puras, usadas na tela e no
 * servidor.
 */

import { formatBrazilPhone } from "@/lib/whatsapp-lead-forward-format";

export const RECEPTION_CONTACT_ID = "recepcao";

/** WhatsApp da recepção, informado pelo Marketing em 19/11/2026. */
export const RECEPTION_CONTACT = {
  id: RECEPTION_CONTACT_ID,
  name: "Recepção Bismarchi | Pires",
  phone: "5519994002573",
} as const;

export interface TeamContact {
  /** `users.id` */
  id: string;
  name: string;
  avatarUrl: string | null;
  position: string | null;
  area: string | null;
  /** E-mail profissional do perfil (todos, por decisão de 19/11/2026). */
  email: string | null;
  /** Telefone para o cartão: só quando o perfil mostra o WhatsApp no site. */
  cardPhone: string | null;
  isLeader: boolean;
}

/** Área que dá para citar ao cliente ("Sócio" não é área). */
export function citableArea(area: string | null | undefined): string | null {
  const value = area?.trim();
  if (!value || /^s[óo]cio/i.test(value)) return null;
  return value;
}

/** "Henrique Franco Nascimento, da área de Contratos" */
export function contactLabel(contact: Pick<TeamContact, "name" | "area">): string {
  const area = citableArea(contact.area);
  return area ? `${contact.name}, da área de ${area}` : contact.name;
}

/** Texto que acompanha o contato na conversa (o atendente pode editar). */
export function contactShareText(
  contact: { kind: "reception" } | { kind: "team"; person: Pick<TeamContact, "name" | "area" | "email"> },
  options: { email: boolean; card: boolean }
): string {
  if (contact.kind === "reception") {
    return `Segue o contato da nossa recepção: ${formatBrazilPhone(RECEPTION_CONTACT.phone)} 👇`;
  }
  const { person } = contact;
  const withEmail = options.email && Boolean(person.email);
  const lines = [`Segue o contato de ${contactLabel(person)}${withEmail ? ":" : ""}`];
  if (withEmail) lines.push(`E-mail: ${person.email}`);
  if (options.card) lines[lines.length - 1] += " 👇";
  return lines.join("\n");
}

/** Cartão gravado como "[contato] Nome · +5519…" (ou só "[contato]", quando veio do celular). */
export function parseContactBody(body: string | null | undefined): { name: string | null; phone: string | null } | null {
  const text = (body ?? "").trim();
  if (!text.startsWith("[contato]")) return null;
  const [name, phone] = text.slice("[contato]".length).split("·").map((part) => part.trim());
  return { name: name || null, phone: phone ? formatBrazilPhone(phone.replace(/\D/g, "")) : null };
}
