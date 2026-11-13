/**
 * De qual tribunal é o processo e que robô de autos o atende. O tribunal sai do próprio CNJ (J.TR: 8.26 é o
 * TJSP); o sistema vem do cadastro ("Sistema do tribunal", preenchido no VIOS) e, na falta dele, do sistema
 * mais comum daquele tribunal. Um conector por sistema; cada conector diz em quais tribunais já funciona.
 */

export type SistemaTribunal = "esaj" | "pje" | "eproc" | "projudi" | "outro";

export const ROTULO_SISTEMA: Record<SistemaTribunal, string> = {
  esaj: "e-SAJ",
  pje: "PJe",
  eproc: "eproc",
  projudi: "Projudi",
  outro: "sistema próprio",
};

const UF_DO_TR: Record<string, string> = {
  "01": "AC", "02": "AL", "03": "AP", "04": "AM", "05": "BA", "06": "CE", "07": "DFT", "08": "ES", "09": "GO",
  "10": "MA", "11": "MT", "12": "MS", "13": "MG", "14": "PA", "15": "PB", "16": "PR", "17": "PE", "18": "PI",
  "19": "RJ", "20": "RN", "21": "RS", "22": "RO", "23": "RR", "24": "SC", "25": "SE", "26": "SP", "27": "TO",
};

/** Sistema mais comum de cada tribunal estadual, para quando o cadastro não diz. */
const SISTEMA_PADRAO: Record<string, SistemaTribunal> = {
  TJSP: "esaj", TJCE: "esaj", TJAL: "esaj", TJMS: "esaj", TJAC: "esaj", TJAM: "esaj",
  TJRS: "eproc", TJSC: "eproc", TJTO: "eproc",
  TJPR: "projudi", TJGO: "projudi",
  TJMG: "pje", TJMT: "pje", TJMA: "pje", TJBA: "pje", TJES: "pje", TJPE: "pje", TJPA: "pje", TJPI: "pje",
  TJRN: "pje", TJDFT: "pje", TJPB: "pje", TJRO: "pje", TJRR: "pje", TJAP: "pje", TJRJ: "pje",
};

/** Conectores do robô que já existem: sistema → tribunais atendidos (robos/autos/src/conectores). */
export const CONECTORES_DISPONIVEIS: Partial<Record<SistemaTribunal, string[]>> = {
  esaj: ["TJSP", "TJCE", "TJAL", "TJMS"],
  eproc: ["TJSP"],
};

export function digitosDoCnj(cnj: string | null | undefined): string | null {
  const digitos = (cnj ?? "").replace(/\D/g, "");
  return digitos.length === 20 ? digitos : null;
}

/** 0000000-00.0000.0.00.0000 */
export function mascararCnj(digitos: string): string {
  return `${digitos.slice(0, 7)}-${digitos.slice(7, 9)}.${digitos.slice(9, 13)}.${digitos.slice(13, 14)}.${digitos.slice(14, 16)}.${digitos.slice(16, 20)}`;
}

/** Sigla do tribunal pelo J.TR do CNJ. Só a justiça estadual (J = 8) tem robô previsto por enquanto. */
export function tribunalDoCnj(cnj: string | null | undefined): string | null {
  const digitos = digitosDoCnj(cnj);
  if (!digitos) return null;
  const justica = digitos[13];
  const regiao = digitos.slice(14, 16);
  if (justica === "8") return UF_DO_TR[regiao] ? `TJ${UF_DO_TR[regiao]}` : null;
  if (justica === "5" && regiao !== "00") return `TRT${Number(regiao)}`;
  if (justica === "4" && regiao !== "00") return `TRF${Number(regiao)}`;
  return null;
}

/** "E-saj", "E-PROC", "pje", "projudi", "Próprio"… como vêm do cadastro. */
export function lerSistema(texto: string | null | undefined): SistemaTribunal | null {
  const limpo = (texto ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (!limpo) return null;
  if (limpo.includes("esaj") || limpo === "saj") return "esaj";
  if (limpo.includes("eproc")) return "eproc";
  if (limpo.includes("pje")) return "pje";
  if (limpo.includes("projudi")) return "projudi";
  return "outro";
}

export interface RoboDoProcesso {
  /** CNJ com máscara, como o robô consulta no tribunal. */
  cnj: string | null;
  tribunal: string | null;
  sistema: SistemaTribunal | null;
  /** Há conector para este sistema neste tribunal. */
  disponivel: boolean;
  /** Por que não dá para pedir ao robô (quando `disponivel` é false). */
  motivo: string | null;
}

/** Que robô baixa os autos deste processo, pelo CNJ e pelo sistema do cadastro. */
export function roboDoProcesso(cnj: string | null | undefined, sistemaDoCadastro: string | null | undefined): RoboDoProcesso {
  const digitos = digitosDoCnj(cnj);
  if (!digitos) return { cnj: null, tribunal: null, sistema: null, disponivel: false, motivo: "O processo está sem número CNJ completo: anexe o PDF dos autos." };
  const mascarado = mascararCnj(digitos);
  const tribunal = tribunalDoCnj(digitos);
  if (!tribunal) return { cnj: mascarado, tribunal: null, sistema: null, disponivel: false, motivo: "Não reconheci o tribunal pelo número: anexe o PDF dos autos." };
  const sistema = lerSistema(sistemaDoCadastro) ?? SISTEMA_PADRAO[tribunal] ?? null;
  if (!sistema) return { cnj: mascarado, tribunal, sistema: null, disponivel: false, motivo: `Ainda não há robô para o ${tribunal}: anexe o PDF dos autos.` };
  const disponivel = CONECTORES_DISPONIVEIS[sistema]?.includes(tribunal) ?? false;
  return {
    cnj: mascarado,
    tribunal,
    sistema,
    disponivel,
    motivo: disponivel ? null : `Ainda não há robô para o ${ROTULO_SISTEMA[sistema]} do ${tribunal}: anexe o PDF dos autos.`,
  };
}
