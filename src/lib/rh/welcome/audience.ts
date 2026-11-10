/**
 * Público dos links de boas-vindas: todos, uma divisão ou uma equipe do
 * organograma. Uma pessoa da equipe Cível vê os links de "todos", da divisão
 * Jurídica e da equipe Cível.
 */

import { resolveCanonicalAreaLabel } from "@/lib/ferias/filters";
import { ORG_DIVISIONS } from "@/lib/rh/org-chart";
import type { WelcomeLink } from "./types";

export const AUDIENCE_ALL = "todos";

export interface AudienceOption {
  key: string;
  label: string;
  /** Rótulo da divisão (agrupa o seletor); vazio para "todos". */
  division: string;
  /** Divisão a que a equipe pertence (null para "todos" e para a própria divisão). */
  parentKey: string | null;
}

const DIVISION_LABEL: Record<string, string> = {
  juridica: "Jurídico (todas as áreas)",
  "operacoes-legais": "Operações Legais (todas as equipes)",
};

/** Ordem do seletor e dos grupos: todos → cada divisão → suas equipes. */
export const AUDIENCE_OPTIONS: AudienceOption[] = [
  { key: AUDIENCE_ALL, label: "Todos os colaboradores", division: "", parentKey: null },
  ...ORG_DIVISIONS.flatMap((division) => [
    {
      key: division.key,
      label: DIVISION_LABEL[division.key] ?? `${division.label} (todas)`,
      division: division.label,
      parentKey: null,
    },
    ...division.teams.map((team) => ({
      key: team.key,
      label: team.label,
      division: division.label,
      parentKey: division.key,
    })),
  ]),
];

const OPTION_BY_KEY = new Map(AUDIENCE_OPTIONS.map((option) => [option.key, option]));

export function isAudienceKey(value: string | null | undefined): value is string {
  return !!value && OPTION_BY_KEY.has(value);
}

export function audienceLabel(key: string): string {
  return OPTION_BY_KEY.get(key)?.label ?? key;
}

/** Rótulo curto do grupo no e-mail e em Meus links ("Para todos", "Jurídico", "Cível"). */
export function audienceGroupLabel(key: string): string {
  if (key === AUDIENCE_ALL) return "Para todos";
  if (key === "juridica") return "Jurídico";
  if (key === "operacoes-legais") return "Operações Legais";
  return OPTION_BY_KEY.get(key)?.label ?? key;
}

/** Públicos que alcançam quem está em `audienceKey` (equipe → divisão → todos). */
export function audienceKeysFor(audienceKey: string | null | undefined): string[] {
  const keys = [AUDIENCE_ALL];
  const option = audienceKey ? OPTION_BY_KEY.get(audienceKey) : undefined;
  if (!option || option.key === AUDIENCE_ALL) return keys;
  if (option.parentKey) keys.push(option.parentKey);
  keys.push(option.key);
  return keys;
}

/** Equipe do organograma tem prioridade; sem ela, a divisão. */
export function audienceFromPlacement(divisionKey: string | null, teamKey: string | null): string | null {
  if (isAudienceKey(teamKey)) return teamKey;
  if (isAudienceKey(divisionKey)) return divisionKey;
  return null;
}

/** Área do VIOS → equipe jurídica de mesmo nome, ou a divisão de Operações Legais. */
export function audienceFromDepartment(department: string | null | undefined): string | null {
  const label = resolveCanonicalAreaLabel(department);
  if (!label) return null;
  for (const division of ORG_DIVISIONS) {
    if (division.label === label) return division.key;
    const team = division.teams.find((item) => item.label === label);
    if (team) return team.key;
  }
  return null;
}

/** Links ativos que alcançam o público (o que a pessoa vê em Meus links). */
export function linksForAudience(links: WelcomeLink[], audienceKey: string | null): WelcomeLink[] {
  const keys = new Set(audienceKeysFor(audienceKey));
  return links.filter((link) => link.isActive && keys.has(link.audience));
}

/** Agrupa na ordem dos públicos e, dentro de cada um, pela ordem definida pelo RH. */
export function groupLinksByAudience(links: WelcomeLink[]): { key: string; label: string; links: WelcomeLink[] }[] {
  const order = new Map(AUDIENCE_OPTIONS.map((option, index) => [option.key, index]));
  const groups = new Map<string, WelcomeLink[]>();
  for (const link of links) {
    const list = groups.get(link.audience) ?? [];
    list.push(link);
    groups.set(link.audience, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (order.get(a) ?? 999) - (order.get(b) ?? 999))
    .map(([key, items]) => ({
      key,
      label: audienceGroupLabel(key),
      links: [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "pt-BR")),
    }));
}
