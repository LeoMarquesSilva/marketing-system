import type { Justica, TribunalNormalizado } from "./types";

/** TRT de cada UF, para diários antigos que não trazem o número do regional. */
const TRT_POR_UF: Record<string, number> = {
  AC: 14, AL: 19, AM: 11, AP: 8, BA: 5, CE: 7, DF: 10, ES: 17, GO: 18, MA: 16,
  MG: 3, MS: 24, MT: 23, PA: 8, PB: 13, PE: 6, PI: 22, PR: 9, RJ: 1, RN: 21,
  RO: 14, RR: 11, RS: 4, SC: 12, SE: 20, TO: 10,
};

export function justicaDaSigla(sigla: string): Justica | null {
  if (/^(TRT\d+|TST)$/.test(sigla)) return "trabalhista";
  if (/^TRF\d+$/.test(sigla)) return "federal";
  if (/^(STJ|STF|TSE|STM)$/.test(sigla)) return "superior";
  if (/^TJ[A-Z]{2,3}$/.test(sigla)) return "estadual";
  return null;
}

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Converte o "DIÁRIO - DIVISÃO" da Kurier na sigla do tribunal.
 * Ex.: "TJSP_DJEN_ESTADUAL" → TJSP, "TRT 15_DJEN_TRABALHISTA" → TRT15,
 * "DJES_TRT_Trabalhista" → TRT17, "DJMG_Judiciário" → TJMG.
 */
export function normalizarTribunal(diario: string): TribunalNormalizado {
  const bruto = semAcento(diario.trim()).toUpperCase();
  const pronto = (sigla: string): TribunalNormalizado => ({ sigla, justica: justicaDaSigla(sigla) });

  const djen = bruto.match(/^([A-Z]+)\s*(\d+)?\s*_DJEN/);
  if (djen) return pronto(`${djen[1]}${djen[2] ?? ""}`);

  const regiao = bruto.match(/TRT\s*-\s*(\d+)\s*REGIAO/);
  if (regiao) return pronto(`TRT${regiao[1]}`);

  const repetido = bruto.match(/^([A-Z]+)_\1$/);
  if (repetido) return pronto(repetido[1]);

  const trtNumerado = bruto.match(/_TRT\s*(\d+)/);
  if (trtNumerado) return pronto(`TRT${trtNumerado[1]}`);

  const estadual = bruto.match(/^DJ([A-Z]{2})(?:_|$)/);
  if (estadual) {
    const uf = estadual[1];
    if (/TRT|TRABALHISTA/.test(bruto) && TRT_POR_UF[uf]) return pronto(`TRT${TRT_POR_UF[uf]}`);
    if (/TRT|TRABALHISTA/.test(bruto)) return { sigla: diario.trim(), justica: "trabalhista" };
    return pronto(uf === "DF" ? "TJDFT" : `TJ${uf}`);
  }

  const tribunalDireto = bruto.match(/^(TJ[A-Z]{2,3})_/);
  if (tribunalDireto) return pronto(tribunalDireto[1] === "TJDF" ? "TJDFT" : tribunalDireto[1]);

  return { sigla: diario.trim(), justica: null };
}
