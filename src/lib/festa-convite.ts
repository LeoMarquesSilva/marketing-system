/**
 * Convite pessoal dos clientes para a festa de 10 anos: link próprio (/convite/<token>),
 * sem login, enviado por um remetente do escritório pelo próprio WhatsApp.
 * Este arquivo é usado no navegador e no servidor.
 */
import { formatRsvpDeadline } from "@/lib/event-rsvp";
import { DIETARY_NEEDS_DETAIL, DIETARY_NONE, hasDietaryRestriction } from "@/lib/rh/registration/types";

export const CONVITE_PATH_PREFIX = "/convite";
/** Página de demonstração: mostra o convite sem cliente e sem gravar nada. */
export const CONVITE_SAMPLE_TOKEN = "exemplo";
/** Tela de envio dos remetentes (com login). */
export const CONVITES_FESTA_PATH = "/convites-festa";
/** Os links enviados aos clientes apontam sempre para o site publicado. */
export const CONVITE_PUBLIC_ORIGIN = "https://www.orqestrai.com.br";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16}$/;

export function isInviteToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

export function invitePath(token: string): string {
  return `${CONVITE_PATH_PREFIX}/${token}`;
}

export function inviteUrl(token: string): string {
  return `${CONVITE_PUBLIC_ORIGIN}${invitePath(token)}`;
}

/** Restrição alimentar de uma pessoa: as mesmas opções da ficha cadastral (Eventos lê do mesmo jeito). */
export interface DietaryChoice {
  restrictions: string[];
  notes: string | null;
}

export const DIETARY_NO_RESTRICTION: DietaryChoice = { restrictions: [DIETARY_NONE], notes: null };

/** Opções do convite, com rótulos curtos para caber em botões. */
export const GUEST_DIETARY_OPTIONS: { value: string; label: string }[] = [
  { value: DIETARY_NONE, label: "Nenhuma" },
  { value: "vegetariano", label: "Vegetariano" },
  { value: "vegano", label: "Vegano" },
  { value: "lactose", label: "Sem lactose" },
  { value: "gluten", label: "Sem glúten" },
  { value: "alergia", label: "Alergia alimentar" },
  { value: "religiosa", label: "Restrição religiosa" },
  { value: "outra", label: "Outra" },
];

export function dietaryNeedsDetail(choice: DietaryChoice): boolean {
  return choice.restrictions.some((item) => DIETARY_NEEDS_DETAIL.has(item));
}

/** Marca ou desmarca uma opção: "Nenhuma" e as demais se excluem; sem nada marcado, volta para "Nenhuma". */
export function toggleDietary(choice: DietaryChoice, value: string): DietaryChoice {
  if (value === DIETARY_NONE) return DIETARY_NO_RESTRICTION;
  const others = choice.restrictions.filter((item) => item !== DIETARY_NONE);
  const next = others.includes(value) ? others.filter((item) => item !== value) : [...others, value];
  if (next.length === 0) return DIETARY_NO_RESTRICTION;
  const choiceNext = { restrictions: next, notes: choice.notes };
  return dietaryNeedsDetail(choiceNext) ? choiceNext : { ...choiceNext, notes: null };
}

/** "Vegetariano, Alergia alimentar (camarão)", com os mesmos nomes dos botões; vazio quando não há restrição. */
export function dietaryText(choice: DietaryChoice | null | undefined): string {
  if (!choice || !hasDietaryRestriction(choice)) return "";
  const labels = choice.restrictions
    .filter((item) => item !== DIETARY_NONE)
    .map((item) => GUEST_DIETARY_OPTIONS.find((option) => option.value === item)?.label ?? item)
    .join(", ");
  return choice.notes ? `${labels} (${choice.notes})` : labels;
}

/** Resumo gravado no convite (o que a aba Convidados e o buffet leem). */
export function dietarySummary(guest: DietaryChoice | null, plusOne: DietaryChoice | null): string | null {
  const parts = [dietaryText(guest), dietaryText(plusOne) ? `Convidado: ${dietaryText(plusOne)}` : ""].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** O que a página do convite mostra ao cliente. */
export interface GuestInviteView {
  firstName: string;
  /** Nome completo, para a plaquinha do convite. */
  name: string;
  /** Logo da empresa do convidado, quando temos uma. */
  logoUrl: string | null;
  closesAt: string | null;
  /** Ainda dá para responder ou mudar a resposta. */
  open: boolean;
  /** null = ainda não respondeu. */
  attending: boolean | null;
  plusOne: boolean | null;
  plusOneName: string | null;
  dietary: DietaryChoice | null;
  plusOneDietary: DietaryChoice | null;
  respondedAt: string | null;
  /** Demonstração (ou prévia de alguém do escritório): nada é gravado. */
  sample: boolean;
}

export interface GuestAnswer {
  attending: boolean;
  plusOne: boolean;
  plusOneName: string | null;
  dietary: DietaryChoice | null;
  plusOneDietary: DietaryChoice | null;
}

const MAX_NAME = 80;
const MAX_DIETARY_NOTES = 120;
const DIETARY_VALUES = new Set(GUEST_DIETARY_OPTIONS.map((option) => option.value));

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
}

/** Restrição válida; ausente vale "Nenhuma". `undefined` = inválida (opção desconhecida ou sem o "qual"). */
export function parseDietaryChoice(value: unknown): DietaryChoice | undefined {
  if (value === null || value === undefined) return DIETARY_NO_RESTRICTION;
  if (typeof value !== "object") return undefined;
  const { restrictions, notes } = value as Record<string, unknown>;
  if (!Array.isArray(restrictions) || restrictions.some((item) => typeof item !== "string" || !DIETARY_VALUES.has(item))) {
    return undefined;
  }
  const picked = [...new Set(restrictions as string[])].filter((item) => item !== DIETARY_NONE);
  if (picked.length === 0) return DIETARY_NO_RESTRICTION;
  const choice: DietaryChoice = { restrictions: picked, notes: null };
  if (!dietaryNeedsDetail(choice)) return choice;
  const detail = cleanText(notes, MAX_DIETARY_NOTES);
  return detail && detail.length >= 2 ? { ...choice, notes: detail } : undefined;
}

/** Valida a resposta: quem vai diz se leva 1 convidado; se levar, o nome é obrigatório. */
export function parseGuestAnswer(body: unknown): GuestAnswer | null {
  if (!body || typeof body !== "object") return null;
  const { attending, plusOne, plusOneName, dietary, plusOneDietary } = body as Record<string, unknown>;
  if (typeof attending !== "boolean") return null;
  if (!attending) return { attending: false, plusOne: false, plusOneName: null, dietary: null, plusOneDietary: null };
  if (typeof plusOne !== "boolean") return null;
  const name = plusOne ? cleanText(plusOneName, MAX_NAME) : null;
  if (plusOne && (!name || name.length < 2)) return null;
  const own = parseDietaryChoice(dietary);
  const companion = plusOne ? parseDietaryChoice(plusOneDietary) : null;
  if (own === undefined || companion === undefined) return null;
  return { attending: true, plusOne, plusOneName: name, dietary: own, plusOneDietary: companion };
}

export type PhoneKind = "celular" | "fixo" | "revisar" | "sem";

export interface PhoneInfo {
  kind: PhoneKind;
  /** Número com DDI para o WhatsApp (só celular). */
  waNumber: string | null;
  display: string | null;
}

/** Classifica o telefone do cadastro: só celular (11 dígitos, começando em 9) abre conversa no WhatsApp. */
export function classifyPhone(raw: string | null | undefined): PhoneInfo {
  const text = (raw ?? "").trim();
  if (!text) return { kind: "sem", waNumber: null, display: null };
  let digits = text.replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length === 11 && digits[2] === "9") {
    return {
      kind: "celular",
      waNumber: `55${digits}`,
      display: `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`,
    };
  }
  if (digits.length === 10 && /[2-5]/.test(digits[2])) {
    return { kind: "fixo", waNumber: null, display: `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}` };
  }
  return { kind: "revisar", waNumber: null, display: text };
}

/** Mensagem que o remetente envia, já com o nome do cliente e o link pessoal. */
export function buildInviteMessage(input: {
  guestFirstName: string;
  senderFirstName: string;
  closesAt: string | null;
  link: string;
}): string {
  const greeting = input.guestFirstName ? `Olá, ${input.guestFirstName}!` : "Olá!";
  const sender = input.senderFirstName ? ` Aqui é ${input.senderFirstName}, do Bismarchi | Pires.` : "";
  const deadline = input.closesAt
    ? `. Pedimos a gentileza de confirmar até ${formatRsvpDeadline(input.closesAt)}`
    : "";
  return [
    `${greeting}${sender}`,
    "Neste ano, o escritório completa 10 anos. Essa trajetória foi construída com a confiança de quem caminhou ao nosso lado, e você faz parte dela. Será uma honra ter a sua presença na nossa celebração.",
    "A festa será no dia 17 de dezembro, às 18h, na Fazenda Santa Margarida, em Campinas. O convite vale para você e mais 1 convidado.",
    `Preparamos um convite em seu nome, com o dress code e a confirmação de presença${deadline}:\n${input.link}`,
  ].join("\n\n");
}

export function whatsappUrl(waNumber: string, message: string): string {
  return `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
}

export type SentChannel = "whatsapp" | "copia" | "manual";
export type InviteStage = "sem_remetente" | "a_enviar" | "enviado" | "abriu" | "confirmado" | "recusado";

/** Linha da tela de envio. */
export interface BoardInvite {
  id: string;
  name: string;
  firstName: string;
  company: string | null;
  area: string | null;
  email: string | null;
  phone: PhoneInfo;
  senderUserId: string | null;
  token: string;
  /** Logo da empresa (ICP), quando existe, e se ela aparece no convite deste cliente. */
  logoUrl: string | null;
  showLogo: boolean;
  sentAt: string | null;
  sentChannel: SentChannel | null;
  openedAt: string | null;
  attending: boolean | null;
  plusOne: boolean;
  plusOneName: string | null;
  dietary: string | null;
  respondedAt: string | null;
}

export interface BoardPerson {
  userId: string;
  name: string;
  firstName: string;
  position: string | null;
  department: string | null;
  avatarUrl: string | null;
  /** Sócio de Área ou Sócio Patrimonial. */
  partner: boolean;
}

export interface ConvitesBoard {
  /** Vê todos os convites e define remetentes e prazo. */
  manager: boolean;
  viewer: { userId: string; firstName: string };
  closesAt: string | null;
  invites: BoardInvite[];
  /** Pessoas que podem ser remetentes (só para quem gerencia) e as que já são. */
  people: BoardPerson[];
}

export function stageOf(invite: BoardInvite): InviteStage {
  if (invite.attending === true) return "confirmado";
  if (invite.attending === false) return "recusado";
  if (invite.openedAt) return "abriu";
  if (invite.sentAt) return "enviado";
  return invite.senderUserId ? "a_enviar" : "sem_remetente";
}

export interface BoardCounts {
  total: number;
  sent: number;
  opened: number;
  confirmed: number;
  declined: number;
  /** Pessoas confirmadas contando os acompanhantes. */
  headcount: number;
  noSender: number;
}

export function countBoard(invites: BoardInvite[]): BoardCounts {
  const counts: BoardCounts = { total: invites.length, sent: 0, opened: 0, confirmed: 0, declined: 0, headcount: 0, noSender: 0 };
  for (const invite of invites) {
    if (invite.sentAt) counts.sent += 1;
    if (invite.openedAt) counts.opened += 1;
    if (invite.attending === true) {
      counts.confirmed += 1;
      counts.headcount += invite.plusOne ? 2 : 1;
    } else if (invite.attending === false) counts.declined += 1;
    if (!invite.senderUserId) counts.noSender += 1;
  }
  return counts;
}

export type BoardAction =
  | { action: "mark_sent"; inviteId: string; channel: SentChannel }
  | { action: "unmark_sent"; inviteId: string }
  | { action: "set_phone"; inviteId: string; phone: string }
  | { action: "set_logo"; inviteId: string; show: boolean }
  | { action: "set_sender"; inviteIds: string[]; senderUserId: string | null }
  | { action: "set_deadline"; closesAt: string | null };
