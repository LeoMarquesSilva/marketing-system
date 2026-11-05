/**
 * Respostas prontas do atendimento do WhatsApp (tiradas do Manual de
 * atendimento). Funções puras, usadas na tela e no servidor.
 *
 * No texto:
 * - {saudacao} vira "Bom dia", "Boa tarde" ou "Boa noite" (horário de Brasília);
 * - {nome} vira o primeiro nome do contato (some, com a vírgula, se não houver);
 * - {atendente} vira o primeiro nome de quem está atendendo;
 * - [colchetes] ficam para completar na hora: o primeiro já vem selecionado.
 */

export const QUICK_REPLY_CATEGORIES = [
  { key: "primeiro_contato", label: "Primeiro contato" },
  { key: "duvidas", label: "Dúvidas frequentes" },
  { key: "qualificacao", label: "Entender o caso" },
  { key: "encaminhamento", label: "Encaminhamento" },
  { key: "terceiros", label: "Outros escritórios e credores" },
  { key: "outros", label: "Currículo e fornecedores" },
] as const;

export type QuickReplyCategory = (typeof QUICK_REPLY_CATEGORIES)[number]["key"];

export interface QuickReply {
  id: string;
  shortcut: string;
  title: string;
  category: QuickReplyCategory;
  body: string;
  sort_order: number;
  use_count: number;
}

export const QUICK_REPLY_VARIABLES = [
  { token: "{saudacao}", label: "Bom dia / Boa tarde / Boa noite" },
  { token: "{nome}", label: "Primeiro nome do contato" },
  { token: "{atendente}", label: "Seu primeiro nome" },
] as const;

export function isQuickReplyCategory(value: unknown): value is QuickReplyCategory {
  return QUICK_REPLY_CATEGORIES.some((category) => category.key === value);
}

export function quickReplyCategoryLabel(category: string): string {
  return QUICK_REPLY_CATEGORIES.find((item) => item.key === category)?.label ?? "Outras";
}

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Atalho sem barra, acento ou espaço: "Currículo RH" → "curriculo-rh". */
export function normalizeShortcut(value: string): string {
  return stripAccents(value)
    .toLowerCase()
    .replace(/^\/+/, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
}

/** Saudação pelo horário de Brasília. */
export function greetingFor(date: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", hourCycle: "h23", timeZone: "America/Sao_Paulo" }).format(date)
  );
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

/**
 * Primeiro nome apresentável a partir do nome do WhatsApp ("sthe 💕" → "Sthe",
 * "Symyra MARA" → "Symyra"). Telefone, emoji ou vazio → "".
 */
export function contactFirstName(name: string | null | undefined): string {
  const word = (name ?? "")
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[^\p{L}'-]/gu, ""))
    .find((part) => /\p{L}{2,}/u.test(part));
  if (!word) return "";
  const lower = word.toLocaleLowerCase("pt-BR");
  return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
}

export function fillQuickReply(
  body: string,
  values: { contactName?: string | null; attendantName?: string | null; now?: Date }
): string {
  const contact = contactFirstName(values.contactName);
  const attendant = contactFirstName(values.attendantName);
  let text = body.replace(/\{saudacao\}/gi, greetingFor(values.now ?? new Date()));
  text = contact
    ? text.replace(/\{nome\}/gi, contact)
    : text.replace(/,\s*\{nome\}/gi, "").replace(/\s*\{nome\}/gi, "");
  text = text.replace(/\{atendente\}/gi, attendant || "[seu nome]");
  return text;
}

/** Primeiro trecho entre colchetes, para já vir selecionado no campo. */
export function firstPlaceholderRange(text: string): { start: number; end: number } | null {
  const match = /\[[^\]\n]{1,60}\]/.exec(text);
  return match ? { start: match.index, end: match.index + match[0].length } : null;
}

/** "/" digitada no fim do campo (no começo ou depois de espaço): o que vem depois dela. */
export function slashQuery(draft: string): { query: string; start: number } | null {
  const match = /(^|\s)\/([\p{L}\d_-]{0,30})$/u.exec(draft);
  if (!match) return null;
  return { query: match[2], start: match.index + match[1].length };
}

/** Insere a resposta no lugar do "/atalho" ou, sem atalho, no fim do texto. */
export function insertQuickReply(draft: string, text: string): string {
  const slash = slashQuery(draft);
  if (slash) return `${draft.slice(0, slash.start)}${text}`;
  const current = draft.trimEnd();
  return current ? `${current}\n\n${text}` : text;
}

/** Atalho que começa igual primeiro, depois título, depois texto; as mais usadas na frente. */
export function matchQuickReplies(replies: QuickReply[], query: string): QuickReply[] {
  const q = stripAccents(query.trim().toLowerCase());
  const rank = (reply: QuickReply): number => {
    if (!q) return 0;
    if (reply.shortcut.startsWith(q)) return 0;
    if (reply.shortcut.includes(q)) return 1;
    if (stripAccents(reply.title.toLowerCase()).includes(q)) return 2;
    if (stripAccents(reply.body.toLowerCase()).includes(q)) return 3;
    return -1;
  };
  return replies
    .map((reply) => ({ reply, score: rank(reply) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => a.score - b.score || b.reply.use_count - a.reply.use_count || a.reply.sort_order - b.reply.sort_order)
    .map((item) => item.reply);
}

/** Respostas agrupadas na ordem das categorias (para a lista sem busca). */
export function groupQuickReplies(replies: QuickReply[]): Array<{ category: QuickReplyCategory; label: string; replies: QuickReply[] }> {
  return QUICK_REPLY_CATEGORIES.map(({ key, label }) => ({
    category: key,
    label,
    replies: replies
      .filter((reply) => reply.category === key)
      .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title, "pt-BR")),
  })).filter((group) => group.replies.length > 0);
}
