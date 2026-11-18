/**
 * Variáveis de personalização para assunto e corpo do e-mail.
 * Sintaxe: {{nome}}, {{email}}, {{rd_cargo_e_book}}, etc.
 * {{unsubscribe_url}} é reservada e aplicada no envio (descadastro).
 */

import { formatRdFieldValue } from "@/lib/email-marketing-rd-fields";

export interface EmailMergeContext {
  nome: string;
  primeiro_nome: string;
  email: string;
  empresa: string;
  telefone: string;
  /** Campos extras (custom_fields rd_* e outros) */
  [key: string]: string;
}

export interface MergeTagDefinition {
  tag: string;
  label: string;
  example: string;
}

export const STANDARD_MERGE_TAGS: MergeTagDefinition[] = [
  { tag: "nome", label: "Nome completo", example: "Maria Silva" },
  { tag: "primeiro_nome", label: "Primeiro nome", example: "Maria" },
  { tag: "email", label: "E-mail", example: "maria@empresa.com.br" },
  { tag: "empresa", label: "Empresa", example: "Empresa Exemplo Ltda." },
  { tag: "telefone", label: "Telefone", example: "(19) 99999-9999" },
];

export const SAMPLE_MERGE_CONTEXT: EmailMergeContext = {
  nome: "Maria Silva",
  primeiro_nome: "Maria",
  email: "maria@empresa.com.br",
  empresa: "Empresa Exemplo Ltda.",
  telefone: "(19) 99999-9999",
  rd_cargo_e_book: "Gerente de RH",
  rd_cidade_empresa: "Campinas",
  rd_estado_empresa: "SP",
};

const MERGE_TAG_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function buildMergeContext(contact: {
  email: string;
  name?: string | null;
  phone?: string | null;
  company?: string | null;
  companyName?: string | null;
  customFields?: Record<string, unknown> | null;
}): EmailMergeContext {
  const nome = contact.name?.trim() || "";
  const primeiro_nome = nome.split(/\s+/).filter(Boolean)[0] || nome || "";
  const empresa =
    contact.companyName?.trim() || contact.company?.trim() || "";

  const ctx: EmailMergeContext = {
    nome: nome || contact.email,
    primeiro_nome: primeiro_nome || nome || "Olá",
    email: contact.email,
    empresa,
    telefone: contact.phone?.trim() || "",
  };

  for (const [key, raw] of Object.entries(contact.customFields ?? {})) {
    if (raw == null || raw === "") continue;
    if (typeof raw === "object") {
      const formatted = formatRdFieldValue(raw);
      if (formatted !== "—") ctx[key] = formatted;
    } else {
      const text = String(raw).trim();
      if (text) ctx[key] = text;
    }
  }

  return ctx;
}

/** Substitui variáveis no texto. Preserva {{unsubscribe_url}} para etapa posterior. */
export function applyMergeTags(text: string, ctx: EmailMergeContext): string {
  return text.replace(MERGE_TAG_RE, (match, key: string) => {
    if (key === "unsubscribe_url") return match;
    const normalized = key.toLowerCase();
    const value = ctx[normalized] ?? ctx[key];
    if (value != null && value !== "") return value;
    return match;
  });
}

/**
 * No envio por Broadcasts o Resend monta cada e-mail com os dados do contato que guardamos lá
 * (nome, sobrenome, e-mail e a propriedade `empresa`). Variáveis sem equivalente saem em branco.
 */
const BROADCAST_PLACEHOLDERS: Record<string, string> = {
  primeiro_nome: "{{{contact.first_name}}}",
  nome: "{{{contact.first_name}}} {{{contact.last_name}}}",
  email: "{{{contact.email}}}",
  empresa: "{{{contact.empresa}}}",
  unsubscribe_url: "{{{RESEND_UNSUBSCRIBE_URL}}}",
};

export function toBroadcastPlaceholders(text: string): { text: string; unsupported: string[] } {
  const unsupported = new Set<string>();
  const converted = text.replace(MERGE_TAG_RE, (_match, key: string) => {
    const placeholder = BROADCAST_PLACEHOLDERS[key.toLowerCase()];
    if (placeholder) return placeholder;
    unsupported.add(key);
    return "";
  });
  return { text: converted, unsupported: [...unsupported] };
}

/** Variáveis usadas no texto que o envio por Broadcasts não preenche (avisadas na revisão). */
export function unsupportedBroadcastTags(...texts: string[]): string[] {
  return [...new Set(texts.flatMap((t) => toBroadcastPlaceholders(t).unsupported))];
}

export function hasMergeTags(text: string): boolean {
  MERGE_TAG_RE.lastIndex = 0;
  return MERGE_TAG_RE.test(text);
}

export function insertMergeTag(current: string, tag: string, cursorPos?: number): string {
  const token = `{{${tag}}}`;
  if (cursorPos == null || cursorPos < 0 || cursorPos > current.length) {
    return current + (current && !current.endsWith(" ") ? " " : "") + token;
  }
  return current.slice(0, cursorPos) + token + current.slice(cursorPos);
}
