/**
 * Atualização de débitos cíveis pelo método do TJSP (planilha oficial "Atualização Monetária e Juros
 * Moratórios", com a Lei nº 14.905/2024), sem banco: os índices entram como parâmetro.
 *
 * - Correção monetária: Tabela Prática do TJSP. Valor × índice do mês final ÷ índice do mês inicial.
 * - Juros de mora, simples, sobre o valor corrigido, desde o vencimento:
 *   - 1% ao mês (12% a.a., CC art. 406) até 27/08/2024, pro rata pelos dias do mês;
 *   - depois, a taxa legal do mês ("Selic menos correção", Res. CMN 5.171/2024), também pro rata pelos dias.
 *
 * Datas no formato AAAA-MM-DD. Mês sem índice publicado (futuro ou fora da tabela) é erro: a conta não
 * inventa índice.
 */

export interface IndiceMensal {
  /** Primeiro dia do mês, AAAA-MM-01. */
  mes: string;
  tabelaPratica: number;
  /** Taxa legal do mês em % ("Selic menos correção" do TJSP); nula quando o tribunal ainda não publicou. */
  taxaLegal: number | null;
}

/** Último dia dos juros fixos de 1% ao mês, conforme o roteiro do TJSP. */
export const FIM_JUROS_FIXOS = "2024-08-27";
export const JUROS_FIXOS_AO_MES = 1;

export class IndiceAusente extends Error {
  constructor(readonly mes: string) {
    super(`Índice do TJSP de ${mes.slice(5, 7)}/${mes.slice(0, 4)} ainda não está na tabela. Importe os índices de novo ou use uma data anterior.`);
  }
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

function dia(data: string): Date {
  if (!DATA.test(data)) throw new Error(`Data inválida: ${data}`);
  return new Date(`${data}T00:00:00Z`);
}

function texto(data: Date): string {
  return data.toISOString().slice(0, 10);
}

function somarDias(data: string, dias: number): string {
  const d = dia(data);
  d.setUTCDate(d.getUTCDate() + dias);
  return texto(d);
}

function mesDe(data: string): string {
  return `${data.slice(0, 7)}-01`;
}

function diasNoMes(mes: string): number {
  const d = dia(mes);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

function proximoMes(mes: string): string {
  const d = dia(mes);
  return texto(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)));
}

/** Dias entre duas datas, contando o primeiro e excluindo o último (como a contagem de juros). */
function diasEntre(inicio: string, fim: string): number {
  return Math.round((dia(fim).getTime() - dia(inicio).getTime()) / 86_400_000);
}

function arredondar(valor: number, casas = 2): number {
  const fator = 10 ** casas;
  return Math.round((valor + Number.EPSILON) * fator) / fator;
}

export class TabelaTjsp {
  private readonly porMes: Map<string, IndiceMensal>;

  constructor(indices: IndiceMensal[]) {
    this.porMes = new Map(indices.map((indice) => [indice.mes, indice]));
  }

  get vazia(): boolean {
    return this.porMes.size === 0;
  }

  /** Último mês com Tabela Prática publicada. */
  get ultimoMes(): string | null {
    return [...this.porMes.keys()].sort().at(-1) ?? null;
  }

  private indice(mes: string): IndiceMensal {
    const achado = this.porMes.get(mes);
    if (!achado) throw new IndiceAusente(mes);
    return achado;
  }

  /** Fator de correção da Tabela Prática entre duas datas (1 quando a final não passa da inicial). */
  fatorCorrecao(inicio: string, fim: string): number {
    if (fim <= inicio) return 1;
    return this.indice(mesDe(fim)).tabelaPratica / this.indice(mesDe(inicio)).tabelaPratica;
  }

  /**
   * Juros de mora em % (simples) do dia `inicio` ao dia `fim`, pro rata pelos dias de cada mês: 1% ao mês até
   * 27/08/2024 e a taxa legal do mês depois.
   */
  percentualJuros(inicio: string, fim: string): number {
    if (fim <= inicio) return 0;
    let total = 0;
    let cursor = inicio;
    while (cursor < fim) {
      const mes = mesDe(cursor);
      const fimDoMes = proximoMes(mes);
      const ate = fim < fimDoMes ? fim : fimDoMes;
      const fracao = diasEntre(cursor, ate) / diasNoMes(mes);
      // Até 27/08/2024 (inclusive) 1% a.m.; daí em diante a taxa legal. O mês da virada se divide.
      const virada = somarDias(FIM_JUROS_FIXOS, 1);
      if (ate <= virada) {
        total += JUROS_FIXOS_AO_MES * fracao;
      } else if (cursor >= virada) {
        const taxa = this.indice(mes).taxaLegal;
        if (taxa === null) throw new IndiceAusente(mes);
        total += Math.max(0, taxa) * fracao;
      } else {
        const antes = diasEntre(cursor, virada) / diasNoMes(mes);
        const depois = diasEntre(virada, ate) / diasNoMes(mes);
        const taxa = this.indice(mes).taxaLegal;
        if (taxa === null) throw new IndiceAusente(mes);
        total += JUROS_FIXOS_AO_MES * antes + Math.max(0, taxa) * depois;
      }
      cursor = ate;
    }
    return total;
  }
}

export interface TituloParaCalculo {
  valor: number;
  vencimento: string;
}

export interface TituloAtualizado {
  valor: number;
  vencimento: string;
  fatorCorrecao: number;
  corrigido: number;
  jurosPercentual: number;
  juros: number;
  total: number;
}

/** Atualiza um título até `dataFinal`: correção da Tabela Prática e juros desde o vencimento, sobre o corrigido. */
export function atualizarTitulo(tabela: TabelaTjsp, titulo: TituloParaCalculo, dataFinal: string): TituloAtualizado {
  const fatorCorrecao = tabela.fatorCorrecao(titulo.vencimento, dataFinal);
  const corrigido = titulo.valor * fatorCorrecao;
  const jurosPercentual = tabela.percentualJuros(titulo.vencimento, dataFinal);
  const juros = (corrigido * jurosPercentual) / 100;
  return {
    valor: titulo.valor,
    vencimento: titulo.vencimento,
    fatorCorrecao,
    corrigido: arredondar(corrigido),
    jurosPercentual: arredondar(jurosPercentual, 4),
    juros: arredondar(juros),
    total: arredondar(corrigido + juros),
  };
}

export interface CreditoAtualizado {
  dataFinal: string;
  original: number;
  corrigido: number;
  juros: number;
  total: number;
  titulos: TituloAtualizado[];
}

/** Soma dos títulos atualizados até `dataFinal` (por exemplo, a data do ajuizamento, ou hoje). */
export function atualizarCredito(tabela: TabelaTjsp, titulos: TituloParaCalculo[], dataFinal: string): CreditoAtualizado {
  const atualizados = titulos.map((titulo) => atualizarTitulo(tabela, titulo, dataFinal));
  const somar = (campo: "valor" | "corrigido" | "juros" | "total") => arredondar(atualizados.reduce((soma, titulo) => soma + titulo[campo], 0));
  return { dataFinal, original: somar("valor"), corrigido: somar("corrigido"), juros: somar("juros"), total: somar("total"), titulos: atualizados };
}

/** Só a correção (sem juros): para trazer valores já levantados à mesma data do crédito. */
export function corrigirValor(tabela: TabelaTjsp, valor: number, data: string, dataFinal: string): number {
  return arredondar(valor * tabela.fatorCorrecao(data, dataFinal));
}

/** Saving: quanto do crédito atualizado já foi recuperado, em %. Nulo sem crédito para comparar. */
export function percentualRecuperado(recuperado: number, credito: number): number | null {
  if (!(credito > 0)) return null;
  return arredondar((recuperado / credito) * 100, 1);
}

/** Duração do processo, da distribuição até o encerramento (ou até hoje), em meses e por extenso. */
export function duracaoDoProcesso(inicio: string | null, fim: string): { meses: number; rotulo: string } | null {
  if (!inicio || !DATA.test(inicio) || fim < inicio) return null;
  const a = dia(inicio);
  const b = dia(fim);
  let meses = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) meses -= 1;
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const partes = [anos ? `${anos} ano${anos === 1 ? "" : "s"}` : "", resto ? `${resto} ${resto === 1 ? "mês" : "meses"}` : ""].filter(Boolean);
  return { meses, rotulo: partes.join(" e ") || "menos de 1 mês" };
}
