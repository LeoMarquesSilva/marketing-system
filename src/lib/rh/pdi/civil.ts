/**
 * Valores CIVIL e critérios da Avaliação de Competências (fonte: ciclo "Avaliação de
 * Competências_2026" no Feedz, 16/11/2026 — 12 critérios para todos + 2 de liderança).
 *
 * As frentes do PDI nasceram desses critérios, mas cada gestor escreveu o nome do seu
 * jeito ("PLANEJAMENTO E ORGANIZAÇÃO", "Empatia e Escuta Ativa (Nota 2)",
 * "BLOCO 1 – INTELIGÊNCIA EMOCIONAL"). Só ligamos a frente a um valor quando o nome
 * contém o valor ou um critério oficial por inteiro; o resto fica sem valor (nada de chute).
 */

export type CivilKey = "cliente" | "inovacao" | "valorizacao" | "inteligencia" | "liberdade" | "lideranca";

export const CIVIL_LABELS: Record<CivilKey, string> = {
  cliente: "Cliente no centro",
  inovacao: "Inovação constante",
  valorizacao: "Valorização das pessoas",
  inteligencia: "Inteligência em resultados",
  liberdade: "Liberdade para criar",
  lideranca: "Liderança",
};

/** Critério da avaliação → valor CIVIL (classe do critério no Feedz). */
export const COMPETENCY_CRITERIA: Array<{ name: string; value: CivilKey }> = [
  { name: "Empatia e escuta ativa", value: "cliente" },
  { name: "Personalização de soluções", value: "cliente" },
  { name: "Curiosidade e aprendizado contínuo", value: "inovacao" },
  { name: "Experimentação e adaptação", value: "inovacao" },
  { name: "Acolhimento e respeito interpessoal", value: "valorizacao" },
  { name: "Inteligência emocional", value: "valorizacao" },
  { name: "Colaboração e desenvolvimento", value: "valorizacao" },
  { name: "Planejamento e organização", value: "inteligencia" },
  { name: "Foco e execução estratégica", value: "inteligencia" },
  { name: "Responsabilidade e ownership", value: "inteligencia" },
  { name: "Protagonismo e iniciativa", value: "liberdade" },
  { name: "Autonomia responsável", value: "liberdade" },
  { name: "Gestão de pessoas e desenvolvimento de talentos", value: "lideranca" },
  { name: "Tomada de decisão estratégica orientada a resultados", value: "lideranca" },
];

/** Nomes do valor como aparecem escritos (com e sem o complemento). */
const VALUE_NAMES: Array<{ text: string; value: CivilKey }> = [
  { text: "cliente no centro", value: "cliente" },
  { text: "inovacao constante", value: "inovacao" },
  { text: "inovacao", value: "inovacao" },
  { text: "valorizacao das pessoas", value: "valorizacao" },
  { text: "inteligencia em resultados", value: "inteligencia" },
  { text: "liberdade para criar", value: "liberdade" },
];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function containsWords(haystack: string, needle: string): boolean {
  return ` ${haystack} `.includes(` ${needle} `);
}

/** Valor CIVIL de uma frente pelo nome; `null` quando o nome não traz valor nem critério oficial. */
export function civilValueOf(title: string | null | undefined): CivilKey | null {
  if (!title) return null;
  const text = normalize(title);
  // O valor escrito pela pessoa vale mais que o critério ("Cliente no Centro - Responsabilidade e Ownership").
  const byValue = VALUE_NAMES.find((item) => containsWords(text, item.text));
  if (byValue) return byValue.value;
  const byCriterion = COMPETENCY_CRITERIA.find((item) => containsWords(text, normalize(item.name)));
  return byCriterion?.value ?? null;
}

export function civilKeyFromLabel(label: string | null | undefined): CivilKey | null {
  if (!label) return null;
  const entry = (Object.entries(CIVIL_LABELS) as Array<[CivilKey, string]>).find(
    ([, value]) => normalize(value) === normalize(label)
  );
  return entry?.[0] ?? null;
}

/** Selo oficial do valor (mesmo do BP Awards); liderança não tem selo. */
export function civilSealSrc(key: CivilKey): string | null {
  return key === "lideranca" ? null : `/bp-awards/selo-${key}.webp`;
}
