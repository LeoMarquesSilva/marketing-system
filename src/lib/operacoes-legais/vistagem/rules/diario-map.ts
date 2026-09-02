/** Fallback estático (seed também vai para a tabela diario_map). */
export const DIARIO_MAP: Record<string, string> = {
  "DJSP_Caderno 2": "DJSP",
  "DJSP_Caderno 4": "DJSP",
  "DJSP_Caderno 3": "DJSP",
  DJES_TRT_Trabalhista: "TRT17 - ES",
  "DJMG_Judiciário": "DJMG",
  DJSP_TRT15_Trabalhista: "TRT15 - SP",
  DJPR_Trabalhista: "TRT9 - PR",
  DJMG_FED_TRT_Trabalhista: "TRT3 - MG",
  DJMT_TRT_Trabalhista: "TRT23 - MT",
  "DJSP_Caderno 5": "DJSP",
  "TRT - 2 REGIAO _TRT2": "TRT2 - SP",
  "DJMS_Judiciário": "DJMS",
  DJPA_AP_TRT_Trabalhista: "TRT8 - PA",
  "TRT - 1 REGIAO_TRT1": "TRT1 - RJ",
  "TRT - 10 REGIAO_TRT 10": "TRT10 - TO",
  "DJRJ_Judiciário": "DJRJ",
  DJPE_TRT_Trabalhista: "DJPE",
  DJRS_Estadual: "DJRS",
  "TRF 3_DJEN_FEDERAL": "TRF3",
  DJMS_TRT_Trabalhista: "TRT24 - MS",
  DJBA_TRT_Trabalhista: "TRT5 - BA",
  TJDF_Tribunal: "TJDF",
  DJGO_TRT_Trabalhista: "TRT18 - GO",
  DJRS_TRT: "TRT4 - RS",
  TJMT_DJEN_ESTADUAL: "TJMT",
  TJDFT_DJEN_DISTRITAL: "TJDF",
  STJ_STJ: "STJ",
  TST_TST: "TST",
  "DJAM_Justiça": "DJAM",
  DJGO_Suplemento: "DJGO",
  TJPR_DJEN_ESTADUAL: "TJPR",
  "DJSC_Judiciário": "DJSC",
  TJPA_DJEN_ESTADUAL: "TJPA",
  DJPE_PJE_INTIMACOES: "DJPE",
  DJAL_TRT_Trabalhista: "TRT19 - AL",
  "DJBA_Judiciário": "TJBA",
  "DJAL_Judiciário": "TJAL",
  "DJCE_Judiciário": "TJCE",
  DJRN_TRT_Trabalhista: "TRT21 - RN",
  TJSP_DJEN_ESTADUAL: "TJSP",
};

export function normalizeDiario(
  value: string | null | undefined,
  dbMap?: Record<string, string>,
): string | null {
  if (!value) return null;
  const map = dbMap ?? DIARIO_MAP;
  return map[value] ?? value;
}
