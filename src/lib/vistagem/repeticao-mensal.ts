/**
 * COMPROVAR PAGAMENTO recorrente, todo mês (pedido de 24/11/2026: "com fatal dia 30/11 e ela poder indicar se quer mais
 * agendamentos para os próximos meses considerando esse fatal"; depois: "como se fosse recorrente", com a possibilidade
 * de adicionar e editar). A pessoa liga "Recorrente todo mês" no Prazo, escolhe quantas vezes, e cada mês seguinte
 * aparece com a data sugerida, que ela pode mudar ou tirar. Ao gravar, cada mês vai como um Prazo comum (o Enviar sai da
 * fatal pelo fluxo do VIOS, como na primeira).
 *
 * A data sugerida segue o que a Trabalhista já fazia à mão nas parcelas de acordo (0011096-59 e 0011072-34, 11/2026):
 * o mesmo dia do mês da primeira fatal; em mês sem esse dia, o último dia do mês; em dia sem expediente (fim de semana
 * ou feriado), o dia útil anterior. O recesso forense não conta: a parcela vence nele do mesmo jeito.
 */

/** Um mês da recorrência no formulário: quantos meses depois da primeira fatal, a data e se a pessoa mudou a data. */
export interface MesDaRecorrencia {
  meses: number;
  /** AAAA-MM-DD; vazia enquanto a primeira fatal não foi escolhida. */
  fatal: string;
  /** A pessoa escolheu a data: ela fica quando a primeira fatal muda. */
  editada: boolean;
}

function partes(iso: string): { ano: number; mes: number; dia: number } | null {
  const achado = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!achado) return null;
  return { ano: Number(achado[1]), mes: Number(achado[2]), dia: Number(achado[3]) };
}

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** Último dia do mês (mes de 1 a 12). */
function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

function diaAnterior(iso: string): string {
  const data = new Date(`${iso}T12:00:00Z`);
  data.setUTCDate(data.getUTCDate() - 1);
  return data.toISOString().slice(0, 10);
}

/**
 * A fatal sugerida `meses` meses depois da primeira: o mesmo dia do mês (sem ele, o último dia do mês) e, se não for dia
 * útil, o dia útil anterior. Conta sempre a partir da primeira, não da anterior: 31/01 → 26/02 → 31/03.
 */
export function fatalNoMes(primeira: string, meses: number, ehDiaUtil: (iso: string) => boolean): string {
  const data = partes(primeira);
  if (!data || !Number.isInteger(meses) || meses <= 0) return primeira;
  const indice = data.mes - 1 + meses;
  const ano = data.ano + Math.floor(indice / 12);
  const mes = (indice % 12) + 1;
  let iso = `${ano}-${doisDigitos(mes)}-${doisDigitos(Math.min(data.dia, ultimoDiaDoMes(ano, mes)))}`;
  // Um mês não tem mais de uns 10 dias seguidos sem expediente; o limite só evita laço sem fim com calendário quebrado.
  for (let volta = 0; volta < 31 && !ehDiaUtil(iso); volta++) iso = diaAnterior(iso);
  return iso;
}

/** As fatais sugeridas de `vezes` meses, a primeira inclusive: 30/11 em 4 → 30/11, 30/12, 29/01 (30/01 é sábado), 26/02. */
export function fataisDaRepeticao(primeira: string, vezes: number, ehDiaUtil: (iso: string) => boolean): string[] {
  if (!partes(primeira) || !Number.isInteger(vezes) || vezes < 1) return [];
  return Array.from({ length: vezes }, (_, meses) => fatalNoMes(primeira, meses, ehDiaUtil));
}

/** Mais um mês no fim da recorrência, com a data sugerida (vazia sem a primeira fatal). */
export function comMaisUmMes(meses: MesDaRecorrencia[], primeira: string, ehDiaUtil: (iso: string) => boolean): MesDaRecorrencia[] {
  const proximo = meses.reduce((maior, mes) => Math.max(maior, mes.meses), 0) + 1;
  return [...meses, { meses: proximo, fatal: partes(primeira) ? fatalNoMes(primeira, proximo, ehDiaUtil) : "", editada: false }];
}

/** A primeira fatal mudou: os meses com a data sugerida acompanham; os que a pessoa mudou ficam. */
export function comPrimeiraFatal(meses: MesDaRecorrencia[], primeira: string, ehDiaUtil: (iso: string) => boolean): MesDaRecorrencia[] {
  return meses.map((mes) => (mes.editada ? mes : { ...mes, fatal: partes(primeira) ? fatalNoMes(primeira, mes.meses, ehDiaUtil) : "" }));
}

/** O que vai na observação de cada vez, abaixo da do jurídico: "Repetição mensal: 2 de 4." */
export function textoDaRepeticao(vez: number, vezes: number): string {
  return `Repetição mensal: ${vez} de ${vezes}.`;
}
