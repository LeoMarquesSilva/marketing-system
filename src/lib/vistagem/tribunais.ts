/** Ramo do tribunal, para a cor do ícone nos filtros. */
export type RamoTribunal = "trabalho" | "superior" | "estadual" | "federal" | "outro";

/** Onde fica cada TRT (sede e estados que atende). */
const SEDE_DO_TRT: Record<number, string> = {
  1: "Rio de Janeiro",
  2: "São Paulo",
  3: "Minas Gerais",
  4: "Rio Grande do Sul",
  5: "Bahia",
  6: "Pernambuco",
  7: "Ceará",
  8: "Pará e Amapá",
  9: "Paraná",
  10: "Distrito Federal e Tocantins",
  11: "Amazonas e Roraima",
  12: "Santa Catarina",
  13: "Paraíba",
  14: "Rondônia e Acre",
  15: "Campinas",
  16: "Maranhão",
  17: "Espírito Santo",
  18: "Goiás",
  19: "Alagoas",
  20: "Sergipe",
  21: "Rio Grande do Norte",
  22: "Piauí",
  23: "Mato Grosso",
  24: "Mato Grosso do Sul",
};

const SUPERIORES: Record<string, string> = {
  TST: "Tribunal Superior do Trabalho",
  STJ: "Superior Tribunal de Justiça",
  STF: "Supremo Tribunal Federal",
};

const NOME_DO_TJ: Record<string, string> = { TJSP: "Tribunal de Justiça de São Paulo" };

/** "TRT2", "TRT-02", "trt 2" → "TRT2"; o resto em caixa alta, sem espaços. */
function normalizar(sigla: string): string {
  return sigla.toUpperCase().replace(/[\s-]+/g, "").replace(/^(TRT|TRF)0+(\d)/, "$1$2");
}

/** Ramo da sigla do diário (TRT2 → trabalho, TST → superior, TJSP → estadual, TRF3 → federal). */
export function ramoDoTribunal(sigla: string | null | undefined): RamoTribunal {
  const chave = normalizar(sigla ?? "");
  if (chave in SUPERIORES) return "superior";
  if (/^TRT\d{1,2}$/.test(chave)) return "trabalho";
  if (/^TJ[A-Z]{2}$/.test(chave)) return "estadual";
  if (/^TRF\d$/.test(chave)) return "federal";
  return "outro";
}

/**
 * Linha de apoio do tribunal nos filtros: a região e a sede do TRT ("2ª Região · São Paulo"), o nome dos
 * superiores e dos TJs, a região do TRF. Sigla desconhecida: null (o filtro mostra só a sigla).
 */
export function descricaoDoTribunal(sigla: string | null | undefined): string | null {
  const chave = normalizar(sigla ?? "");
  if (SUPERIORES[chave]) return SUPERIORES[chave];
  const trt = chave.match(/^TRT(\d{1,2})$/);
  if (trt) {
    const regiao = Number(trt[1]);
    return SEDE_DO_TRT[regiao] ? `${regiao}ª Região · ${SEDE_DO_TRT[regiao]}` : `${regiao}ª Região`;
  }
  if (NOME_DO_TJ[chave]) return NOME_DO_TJ[chave];
  if (/^TJ[A-Z]{2}$/.test(chave)) return `Tribunal de Justiça · ${chave.slice(2)}`;
  const trf = chave.match(/^TRF(\d)$/);
  if (trf) return `Tribunal Regional Federal · ${trf[1]}ª Região`;
  return null;
}
