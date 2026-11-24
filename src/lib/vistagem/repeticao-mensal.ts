/**
 * COMPROVAR PAGAMENTO todo mês (pedido de 24/11/2026: "com fatal dia 30/11 e ela poder indicar se quer mais
 * agendamentos para os próximos meses considerando esse fatal"). A pessoa marca a fatal da primeira e quantas vezes a
 * tarefa vai ao VIOS; as outras vão nos meses seguintes, cada uma como um Prazo comum (o Enviar sai da fatal pelo fluxo
 * do VIOS, como na primeira).
 *
 * A data de cada mês segue o que a Trabalhista já fazia à mão nas parcelas de acordo (0011096-59 e 0011072-34, 11/2026):
 * o mesmo dia do mês da primeira fatal; em mês sem esse dia, o último dia do mês; em dia sem expediente (fim de semana
 * ou feriado), o dia útil anterior. O recesso forense não conta: a parcela vence nele do mesmo jeito.
 */

/**
 * Quantas vezes a tarefa vai ao VIOS, a primeira inclusive: "4x" = a da fatal escolhida e mais 3, nos meses seguintes.
 * Fora de um número inteiro de 1 em diante, 1 (só a da fatal escolhida).
 */
export function vezesDaRepeticao(valor: unknown): number {
  const numero = typeof valor === "string" && valor.trim() ? Number(valor.trim()) : valor;
  return typeof numero === "number" && Number.isInteger(numero) && numero >= 1 ? numero : 1;
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
 * A fatal `meses` meses depois da primeira: o mesmo dia do mês (sem ele, o último dia do mês) e, se não for dia útil,
 * o dia útil anterior. Conta sempre a partir da primeira, não da anterior: 31/01 → 28/02 → 31/03.
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

/** As fatais de todas as vezes, a primeira inclusive: 30/11 em 4x → 30/11, 30/12, 29/01 (30/01 é sábado), 26/02. */
export function fataisDaRepeticao(primeira: string, vezes: number, ehDiaUtil: (iso: string) => boolean): string[] {
  if (!partes(primeira)) return [];
  return Array.from({ length: vezesDaRepeticao(vezes) }, (_, meses) => fatalNoMes(primeira, meses, ehDiaUtil));
}

/** O que vai na observação de cada vez, abaixo da do jurídico: "Repetição mensal: 2 de 4." */
export function textoDaRepeticao(vez: number, vezes: number): string {
  return `Repetição mensal: ${vez} de ${vezes}.`;
}
