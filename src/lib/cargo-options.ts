/**
 * Opções pré-definidas de cargo/função para contatos e pessoas de clientes,
 * usadas no preenchimento em "Meus Clientes".
 */

export const CARGO_OPTIONS = [
  "Sócio(a) / Proprietário(a)",
  "Diretor(a)",
  "Gerente",
  "Coordenador(a)",
  "Financeiro",
  "Jurídico / Compliance",
  "Recursos Humanos",
  "Contabilidade",
  "Assistente / Secretário(a)",
  "Outro",
] as const;

export type CargoOption = (typeof CARGO_OPTIONS)[number];

export const CARGO_OUTRO = "Outro";

/** Regras para encaixar cargos do RD (e variações) nas opções do select. */
const CARGO_MATCH_RULES: { option: CargoOption; keywords: string[] }[] = [
  {
    option: "Sócio(a) / Proprietário(a)",
    keywords: [
      "socio",
      "socia",
      "proprietario",
      "proprietaria",
      "empresario",
      "empresaria",
      "owner",
      "founder",
      "filho do socio",
    ],
  },
  {
    option: "Diretor(a)",
    keywords: ["diretor", "diretora", "ceo", "presidente", "superintendente", "executiv"],
  },
  {
    option: "Gerente",
    keywords: ["gerente", "gestor", "gestora", "supervisor", "supervisora", "supervisao"],
  },
  {
    option: "Coordenador(a)",
    keywords: ["coordenador", "coordenadora", "coordenacao"],
  },
  {
    option: "Financeiro",
    keywords: [
      "financeiro",
      "financeira",
      "financas",
      "tesouraria",
      "cobranca",
      "credito",
      "analista financeiro",
      "controladoria",
    ],
  },
  {
    option: "Assistente / Secretário(a)",
    keywords: [
      "assistente",
      "secretario",
      "secretaria",
      "recepcionista",
      "auxiliar administrativo",
      "auxiliar de limpeza",
    ],
  },
  {
    option: "Jurídico / Compliance",
    keywords: [
      "juridico",
      "juridica",
      "advogad",
      "compliance",
      "legal",
      "contrato",
      "insolvencia",
      "trabalhista",
      "tributari",
      "corporativ",
      "consultor juridic",
      "consultora juridic",
      "parceiro",
    ],
  },
  {
    option: "Recursos Humanos",
    keywords: ["recursos humanos", " rh", "rh ", "departamento pessoal", " dp ", "people"],
  },
  {
    option: "Contabilidade",
    keywords: ["contabil", "contador", "contadora", "fiscal"],
  },
];

/** Valores do RD que não representam cargo útil. */
const IGNORED_CARGO_VALUES = new Set(["n/a", "na", "-", "—", "null", "undefined"]);

export function normalizeCargoKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cargoMatchesKeyword(normalizedCargo: string, keyword: string): boolean {
  const kw = normalizeCargoKey(keyword);
  if (!kw) return false;
  const haystack = ` ${normalizedCargo} `;
  return haystack.includes(` ${kw} `) || normalizedCargo.startsWith(kw) || normalizedCargo.includes(kw);
}

function matchCargoOption(normalizedCargo: string): CargoOption | null {
  for (const rule of CARGO_MATCH_RULES) {
    if (rule.keywords.some((kw) => cargoMatchesKeyword(normalizedCargo, kw))) {
      return rule.option;
    }
  }
  return null;
}

/**
 * Resolve o valor salvo de cargo para a opção do select: opção exata, alias do RD
 * ou "Outro" (mantendo o texto original no campo de detalhe).
 */
export function resolveCargoOption(cargo: string | null | undefined): string {
  if (!cargo) return "";
  const trimmed = cargo.trim();
  if (!trimmed) return "";
  if ((CARGO_OPTIONS as readonly string[]).includes(trimmed)) return trimmed;

  const normalized = normalizeCargoKey(trimmed);
  if (IGNORED_CARGO_VALUES.has(normalized)) return "";

  const matched = matchCargoOption(normalized);
  return matched ?? CARGO_OUTRO;
}

/**
 * Valor a persistir em `cargo`: opção canônica quando mapeada;
 * texto original quando cai em "Outro".
 */
export function resolveCargoStoredValue(cargo: string | null | undefined): string | null {
  if (!cargo) return null;
  const trimmed = cargo.trim();
  if (!trimmed) return null;

  const normalized = normalizeCargoKey(trimmed);
  if (IGNORED_CARGO_VALUES.has(normalized)) return null;

  const option = resolveCargoOption(trimmed);
  return option === CARGO_OUTRO ? trimmed : option;
}

/** Texto para exibir na listagem (opção canônica ou detalhe em Outro). */
export function formatCargoDisplay(cargo: string | null | undefined): string | null {
  if (!cargo?.trim()) return null;
  const trimmed = cargo.trim();
  const option = resolveCargoOption(trimmed);
  if (option === CARGO_OUTRO) return trimmed;
  if ((CARGO_OPTIONS as readonly string[]).includes(trimmed)) return trimmed;
  return option;
}

/** Cargo preenchido no campo principal ou reconhecível a partir do RD. */
export function isRecognizedCargo(cargo: string | null | undefined): boolean {
  if (!cargo?.trim()) return false;
  const normalized = normalizeCargoKey(cargo.trim());
  if (IGNORED_CARGO_VALUES.has(normalized)) return false;
  return true;
}
