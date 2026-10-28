/**
 * Tipos de inconsistência já usados na BKP (SIOE sp_publicacoes), para manter
 * os indicadores de eficiência comparáveis.
 */
export const TIPOS_INCONSISTENCIA_JURIDICO = ["FORA DO WORKFLOW", "INTERPRETAÇÃO DA PUBLI", "CONTAGEM DE PRAZO"] as const;

export const TIPOS_INCONSISTENCIA_AGENDAMENTO = ["AGENDAMENTO", "ANÁLISE"] as const;

export const SUBTIPOS_INCONSISTENCIA_AGENDAMENTO = [
  "DATA / HORÁRIO - (P/A)",
  "DATA",
  "FORA DO FLUXO - (P/A)",
  "FORA DO FLUXO",
  "INTERPRETAÇÃO DA PUBLI - (P)",
  "INTERPRETAÇÃO DA PUBLI",
  "RESPONSÁVEL - (P/A)",
  "RESPONSÁVEL",
  "DESCRIÇÃO - (P/A)",
  "DESCRIÇÃO",
  "CONTAGEM DE PRAZO",
  "VÍNCULO",
  "TIPIFICAÇÃO",
  "DUPLICIDADE",
] as const;

/** Subtipos que o Check usa: só os de processo e atendimento (P/A). Os outros ficam só na BKP antiga. */
export const SUBTIPOS_AGENDAMENTO_EM_USO = SUBTIPOS_INCONSISTENCIA_AGENDAMENTO.filter((subtipo) => subtipo.endsWith("(P/A)"));

export const MAX_TEXTO_INCONSISTENCIA = 2000;

export interface InconsistenciaEntrada {
  tipo: string;
  subtipo?: string | null;
  descricao: string;
}

/** Confere tipo/subtipo contra as listas da BKP e exige a descrição. */
export function validarInconsistencia(
  origem: "juridico" | "agendamento",
  entrada: InconsistenciaEntrada
): { ok: true; valor: { tipo: string; subtipo: string | null; descricao: string } } | { ok: false; erro: string } {
  const descricao = entrada.descricao?.trim() ?? "";
  if (!descricao) return { ok: false, erro: "Descreva o que está errado." };
  if (descricao.length > MAX_TEXTO_INCONSISTENCIA) return { ok: false, erro: `Descrição com mais de ${MAX_TEXTO_INCONSISTENCIA} caracteres.` };
  const tipos: readonly string[] = origem === "juridico" ? TIPOS_INCONSISTENCIA_JURIDICO : TIPOS_INCONSISTENCIA_AGENDAMENTO;
  if (!tipos.includes(entrada.tipo)) return { ok: false, erro: "Escolha o tipo da inconsistência." };
  const subtipo = entrada.subtipo?.trim() || null;
  if (origem === "agendamento") {
    if (!subtipo || !(SUBTIPOS_AGENDAMENTO_EM_USO as readonly string[]).includes(subtipo)) {
      return { ok: false, erro: "Escolha o subtipo da inconsistência." };
    }
  }
  return { ok: true, valor: { tipo: entrada.tipo, subtipo: origem === "agendamento" ? subtipo : null, descricao } };
}
