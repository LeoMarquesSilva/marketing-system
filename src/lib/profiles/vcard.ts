/**
 * Geração de vCard 3.0 a partir dos contatos já liberados na projeção pública.
 * Nunca recebe telefone/e-mail privados — a rota só passa o que a projeção expôs.
 */

export interface VCardContact {
  displayName: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  websiteUrl?: string | null;
  organization?: string | null;
}

const FIRM_ORG = "Bismarchi | Pires";

/** Escapa `,`, `;`, `\` e quebras de linha conforme vCard 3.0. */
export function escapeVCardValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function splitDisplayName(displayName: string): { family: string; given: string } {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { family: "", given: "" };
  if (parts.length === 1) return { family: parts[0], given: "" };
  return {
    given: parts.slice(0, -1).join(" "),
    family: parts[parts.length - 1] ?? "",
  };
}

/**
 * Monta um vCard 3.0 com finais de linha CRLF.
 * EMAIL/TEL/URL só entram quando o valor está presente (já filtrado pela projeção).
 */
export function buildVCard(contact: VCardContact): string {
  const displayName = (contact.displayName ?? "").trim() || "Contato";
  const { family, given } = splitDisplayName(displayName);
  const org = (contact.organization ?? FIRM_ORG).trim() || FIRM_ORG;
  const role = (contact.role ?? "").trim();

  const lines: string[] = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN;CHARSET=UTF-8:${escapeVCardValue(displayName)}`,
    `N;CHARSET=UTF-8:${escapeVCardValue(family)};${escapeVCardValue(given)};;;`,
    `ORG;CHARSET=UTF-8:${escapeVCardValue(org)}`,
  ];

  if (role) {
    lines.push(`TITLE;CHARSET=UTF-8:${escapeVCardValue(role)}`);
  }

  const email = (contact.email ?? "").trim();
  if (email) {
    lines.push(`EMAIL;CHARSET=UTF-8:${escapeVCardValue(email)}`);
  }

  const phone = (contact.phone ?? "").trim();
  if (phone) {
    lines.push(`TEL;TYPE=CELL:${escapeVCardValue(phone)}`);
  }

  const linkedinUrl = (contact.linkedinUrl ?? "").trim();
  if (linkedinUrl) {
    lines.push(`URL;TYPE=LinkedIn:${escapeVCardValue(linkedinUrl)}`);
  }

  const websiteUrl = (contact.websiteUrl ?? "").trim();
  if (websiteUrl) {
    lines.push(`URL:${escapeVCardValue(websiteUrl)}`);
  }

  lines.push("END:VCARD");
  return `${lines.join("\r\n")}\r\n`;
}

/** Nome de arquivo .vcf determinístico e seguro a partir do nome público. */
export function makeVCardFilename(displayName: string): string {
  const base = displayName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "contato"}.vcf`;
}
