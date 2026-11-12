/**
 * Confirmação de presença dos colaboradores em um evento (1º uso: festa de 10 anos).
 * A resposta fica no próprio convite (`event_invites`): confirmação + transporte.
 * Este arquivo é usado no navegador e no servidor.
 */
import { parseDietaryChoice, type DietaryChoice } from "@/lib/festa-convite";

export type RsvpTransport = "ida_volta" | "so_ida" | "so_volta" | "nao";

export const RSVP_TRANSPORTS: RsvpTransport[] = ["ida_volta", "so_ida", "so_volta", "nao"];

export const RSVP_TRANSPORT_LABEL: Record<RsvpTransport, string> = {
  ida_volta: "Ida e volta",
  so_ida: "Só ida",
  so_volta: "Só volta",
  nao: "Vou por conta própria",
};

export function isRsvpTransport(value: unknown): value is RsvpTransport {
  return typeof value === "string" && (RSVP_TRANSPORTS as string[]).includes(value);
}

/** Vai no micro-ônibus do escritório até a festa. */
export function usesOutbound(transport: RsvpTransport | null | undefined): boolean {
  return transport === "ida_volta" || transport === "so_ida";
}

/** Volta no micro-ônibus ao final da festa. */
export function usesReturn(transport: RsvpTransport | null | undefined): boolean {
  return transport === "ida_volta" || transport === "so_volta";
}

/** Festa de 10 anos (evento "Aniversário Escritório 10 anos" em Eventos). */
export const FESTA_10_ANOS_EVENT_ID = "a4c3bb58-49c6-4d45-a161-38bdafcf1a6c";
export const FESTA_10_ANOS_PATH = "/festa-10-anos";

/** Página de confirmação de cada evento que usa o formulário (para o link no painel). */
export const RSVP_PAGE_BY_EVENT: Record<string, string> = {
  [FESTA_10_ANOS_EVENT_ID]: FESTA_10_ANOS_PATH,
};

export function isRsvpOpen(closesAt: string | null, now: Date = new Date()): boolean {
  if (!closesAt) return false;
  const deadline = new Date(closesAt);
  return !Number.isNaN(deadline.getTime()) && now.getTime() <= deadline.getTime();
}

/** "13/11" (ou "13/11 às 23h59" com a hora), sempre no horário de Brasília. */
export function formatRsvpDeadline(closesAt: string, withTime = false): string {
  const date = new Date(closesAt);
  const day = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  if (!withTime) return day;
  const [hour, minute] = date
    .toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })
    .split(":");
  return `${day} às ${hour}h${minute}`;
}

export interface RsvpAnswer {
  attending: boolean;
  transport: RsvpTransport | null;
  /** Leva 1 acompanhante (só quem tem o acompanhante previsto no convite). */
  plusOne: boolean;
  plusOneName: string | null;
  plusOneDietary: DietaryChoice | null;
  /** Restrição alimentar da própria pessoa, só para quem não tem ficha cadastral (ex.: consultores). */
  dietary: DietaryChoice | null;
}

const NOT_GOING: RsvpAnswer = { attending: false, transport: null, plusOne: false, plusOneName: null, plusOneDietary: null, dietary: null };
const MAX_COMPANION_NAME = 80;

/**
 * Valida o que vem do formulário: quem vai escolhe o transporte; quem não vai, não.
 * Acompanhante é opcional; se vier, o nome é obrigatório. O servidor confere se ele está previsto.
 */
export function parseRsvpAnswer(body: unknown): RsvpAnswer | null {
  if (!body || typeof body !== "object") return null;
  const { attending, transport, plusOne, plusOneName, plusOneDietary, dietary } = body as Record<string, unknown>;
  if (typeof attending !== "boolean") return null;
  if (!attending) return { ...NOT_GOING };
  if (!isRsvpTransport(transport)) return null;
  if (plusOne !== undefined && typeof plusOne !== "boolean") return null;
  const withCompanion = plusOne === true;
  const name = withCompanion && typeof plusOneName === "string" ? plusOneName.replace(/\s+/g, " ").trim().slice(0, MAX_COMPANION_NAME) : null;
  if (withCompanion && (!name || name.length < 2)) return null;
  const companionDietary = withCompanion ? parseDietaryChoice(plusOneDietary) : null;
  const ownDietary = dietary === undefined || dietary === null ? null : parseDietaryChoice(dietary);
  if (companionDietary === undefined || ownDietary === undefined) return null;
  return { attending: true, transport, plusOne: withCompanion, plusOneName: name, plusOneDietary: companionDietary, dietary: ownDietary };
}

/** O que a página mostra para quem está logado. */
export interface RsvpView {
  /** Pode responder (é da equipe). */
  eligible: boolean;
  firstName: string;
  closesAt: string | null;
  open: boolean;
  /** null = ainda não respondeu. */
  attending: boolean | null;
  transport: RsvpTransport | null;
  respondedAt: string | null;
  /** Restrição alimentar da ficha cadastral; null = ficha sem a informação. */
  dietary: string | null;
  /** Sem ficha cadastral (ex.: consultor): a restrição alimentar é perguntada aqui. */
  askDietary: boolean;
  /** Restrição informada nesta página por quem não tem ficha. */
  ownDietary: DietaryChoice | null;
  /** Pode levar 1 acompanhante (definido pela organização). */
  plusOneAllowed: boolean;
  plusOne: boolean | null;
  plusOneName: string | null;
  plusOneDietary: DietaryChoice | null;
}

export type RsvpStatus = "confirmado" | "recusado" | "sem_resposta";

/** Linha do painel de acompanhamento (aba Convidados do evento). */
export interface RsvpPerson {
  inviteId: string;
  name: string;
  shortName: string;
  department: string | null;
  avatarUrl: string | null;
  status: RsvpStatus;
  transport: RsvpTransport | null;
  respondedAt: string | null;
  /** Restrição alimentar da ficha (só quem vai). */
  dietary: string | null;
  /** Nome do acompanhante (só quem vai e levará alguém). */
  plusOneName: string | null;
  /** Restrição alimentar do acompanhante. */
  plusOneDietary: string | null;
}

export interface RsvpPanelData {
  enabled: boolean;
  closesAt: string | null;
  open: boolean;
  pagePath: string | null;
  people: RsvpPerson[];
}

export interface RsvpCounts {
  confirmed: number;
  declined: number;
  pending: number;
  /** Acompanhantes de quem vai. */
  companions: number;
  /** Pessoas na festa: quem confirmou + acompanhantes. */
  headcount: number;
  /** Lugares no micro-ônibus (o acompanhante segue a escolha de quem o leva). */
  outbound: number;
  returning: number;
  /** Pessoas que usam o micro-ônibus em algum trecho. */
  riders: number;
}

export function countRsvp(people: RsvpPerson[]): RsvpCounts {
  const counts: RsvpCounts = { confirmed: 0, declined: 0, pending: 0, companions: 0, headcount: 0, outbound: 0, returning: 0, riders: 0 };
  for (const person of people) {
    if (person.status === "confirmado") {
      const seats = person.plusOneName ? 2 : 1;
      counts.confirmed += 1;
      counts.companions += seats - 1;
      counts.headcount += seats;
      if (usesOutbound(person.transport)) counts.outbound += seats;
      if (usesReturn(person.transport)) counts.returning += seats;
      if (usesOutbound(person.transport) || usesReturn(person.transport)) counts.riders += seats;
    } else if (person.status === "recusado") counts.declined += 1;
    else counts.pending += 1;
  }
  return counts;
}

const NAME_PARTICLES = new Set(["da", "de", "do", "das", "dos", "e"]);

/** Primeiro nome para a saudação ("Maria Caroline da Cunha Thomé" → "Maria"). */
export function firstNameOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter((part) => !NAME_PARTICLES.has(part.toLowerCase()));
  return parts[0] ?? "";
}
