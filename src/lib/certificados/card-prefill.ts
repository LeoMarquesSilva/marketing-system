// Dados do card "Certificados" do Planner (nota do Responsum) no formato do gerador.
// Puro: a tela busca o card e o cadastro de usuários e entrega aqui.

import {
  buildPersonLookup,
  resolveAttendee,
  resolvePerson,
  splitNames,
  type CertificadoWorkshopInfo,
  type PersonDirectoryEntry,
} from "@/lib/certificado-workshop";
import { EVENT_TYPES, foldText } from "./model";
import { dedupeParticipants, newParticipantId, type CertificateParticipant } from "./participants";

export type EventTypeValue = (typeof EVENT_TYPES)[number]["value"];

/** "workshop", "SEMINARIO" → o tipo da lista; null quando não é um tipo conhecido. */
export function matchEventType(raw: string | null | undefined): EventTypeValue | null {
  const folded = foldText(raw ?? "");
  if (!folded) return null;
  return EVENT_TYPES.find((type) => foldText(type.value) === folded)?.value ?? null;
}

/** "17/09/2026" → "2026-09-17"; null quando não é uma data válida. */
export function parseDataRealizacao(raw: string | null | undefined): string | null {
  const match = /(?<!\d)(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?!\d)/.exec(raw ?? "");
  if (!match) return null;
  const [dia, mes, ano] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(ano, mes - 1, dia));
  if (date.getUTCFullYear() !== ano || date.getUTCMonth() !== mes - 1 || date.getUTCDate() !== dia) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${ano}-${pad(mes)}-${pad(dia)}`;
}

/** "60 minutos", "2 horas", "1h30", "1 hora e 30 minutos", "1:30" → minutos; null quando não entende. */
export function parseDuracaoMinutos(raw: string | null | undefined): number | null {
  const text = foldText(raw ?? "").replace(/(\d),(\d)/g, "$1.$2");
  if (!text) return null;
  const clock = /^(\d{1,2}):([0-5]\d)\s*(?:h|hs|horas?)?$/.exec(text);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]) || null;

  const hours = /(\d+(?:\.\d+)?)\s*(?:h|hs|hrs?|horas?)(?![a-z])/.exec(text);
  const minutes = /(\d+)\s*(?:m|min|mins|minutos?)(?![a-z])/.exec(text);
  let total = minutes ? Number(minutes[1]) : 0;
  if (hours) {
    total += Number(hours[1]) * 60;
    // "1h30" ou "2 horas e 30": minutos sem unidade logo depois das horas.
    const trailing = /^\s*(?:e\s*)?(\d{1,2})\s*$/.exec(text.slice(hours.index + hours[0].length));
    if (!minutes && trailing) total += Number(trailing[1]);
  }
  total = Math.round(total);
  return total > 0 ? total : null;
}

/** 90 → { horas: "1", minutos: "30" }, como nos campos da tela. */
export function splitCargaHoraria(totalMinutos: number): { horas: string; minutos: string } {
  const total = Math.max(0, Math.round(totalMinutos));
  return { horas: String(Math.floor(total / 60)), minutos: String(total % 60) };
}

export interface CardPrefill {
  tipo: EventTypeValue;
  curso: string;
  /** yyyy-mm-dd, ou null quando o card não traz uma data que dê para ler. */
  dataInicio: string | null;
  cargaHorariaMinutos: number | null;
  facilitadores: string[];
  participantes: CertificateParticipant[];
  /** Entradas da presença que não estão no cadastro e entraram como vieram. */
  semCadastro: string[];
  presenca: "preenchida" | "nao_preenchida" | "nao_buscada";
}

/**
 * Monta os dados do gerador a partir da nota do card. Nomes e e-mails da
 * presença são casados com o cadastro de usuários (nome certo e e-mail atual);
 * o que não casa entra como veio, para a pessoa conferir na tela.
 */
export function buildCardPrefill<T extends PersonDirectoryEntry>(
  info: CertificadoWorkshopInfo,
  users: T[]
): CardPrefill {
  const lookup = buildPersonLookup(users);

  const participantes: CertificateParticipant[] = [];
  const semCadastro: string[] = [];
  for (const raw of info.presenca?.nomes ?? []) {
    const entry = raw.trim();
    if (!entry) continue;
    const isEmail = entry.includes("@");
    const { user, label } = resolveAttendee(entry, lookup);
    if (!user && !semCadastro.includes(entry)) semCadastro.push(entry);
    participantes.push({
      id: newParticipantId(),
      nome: user ? label : entry,
      email: user?.email?.trim().toLowerCase() || (isEmail ? entry.toLowerCase() : null),
    });
  }

  return {
    tipo: matchEventType(info.tipo) ?? "Workshop",
    curso: (info.tema ?? "").replace(/\s+/g, " ").trim(),
    dataInicio: parseDataRealizacao(info.dataRealizacao),
    cargaHorariaMinutos: parseDuracaoMinutos(info.duracao),
    facilitadores: splitNames(info.facilitadores ?? "").map((name) => resolvePerson({ name }, lookup).label),
    participantes: dedupeParticipants(participantes),
    semCadastro,
    presenca: info.presenca?.status ?? "nao_buscada",
  };
}
