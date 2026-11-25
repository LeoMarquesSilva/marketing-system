/**
 * Feriados do VIOS (Agenda › Feriados, copiados pelo robô para vios_feriados no SAMA).
 *
 * O VIOS não deixa uma tarefa num dia que, pela tabela dele, posterga prazos: passa para o dia útil seguinte. Exemplo:
 * 0056354-65, 25/11/2026, o 3. PROTOCOLAR pedido para 08/02/2027 (segunda de Carnaval) ficou em 10/02. Nas tarefas
 * processuais, o feriado pode valer só para alguns processos, pela Jurisdição atual e pelo Estado do processo no VIOS.
 * Exemplo: o Dia da Justiça de 2026 vale só para 1º e 2º grau de São Paulo.
 *
 * O processo não tem jurisdição nem estado em nenhuma base nossa. Vêm da publicação: a UF e o tribunal. Quando não se
 * sabe (UF "BR" ou vazia, tribunal vazio), o feriado vale. Assim a trava fica do lado seguro: barra um dia a mais, em vez
 * de deixar passar um dia que o VIOS mudaria.
 */

export interface FeriadoDoVios {
  id: number;
  /** AAAA-MM-DD */
  dataInicio: string;
  /** AAAA-MM-DD; antes do início (erro de cadastro no VIOS), vale só o início. */
  dataFim: string;
  nome: string | null;
  postergaProcessuais: boolean;
  /** Jurisdições do VIOS (PRIMEIRO GRAU, SEGUNDO GRAU, STF, STJ, TST, CNJ); null = todas. */
  jurisdicoes: string[] | null;
  /** Estados por extenso, como no VIOS ("São Paulo"); null = todos. */
  estados: string[] | null;
}

/** Onde o processo está, para casar com a restrição do feriado. null = não se sabe (o feriado vale). */
export interface OndeEstaOProcesso {
  estados: string[] | null;
  jurisdicoes: string[] | null;
}

const ESTADOS: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
};

/** Tribunais que são, eles mesmos, a Jurisdição atual no VIOS. */
const JURISDICOES_PROPRIAS = new Set(["STF", "STJ", "TST", "CNJ"]);

/** Sem acento, maiúsculas, espaços juntados: o VIOS escreve "Rorâima". */
function chave(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/**
 * Onde o processo da publicação está. Estado: a UF da publicação (TRT14 vem "AC/RO": os dois). Jurisdição: STF, STJ,
 * TST e CNJ são a própria; os outros tribunais ficam como 1º ou 2º grau, porque a publicação não diz qual.
 */
export function ondeEstaOProcesso(publicacao: { estado?: string | null; tribunal?: string | null }): OndeEstaOProcesso {
  const estados = String(publicacao.estado ?? "")
    .split(/[\/,;\s]+/)
    .map((uf) => ESTADOS[uf.trim().toUpperCase()])
    .filter((nome): nome is string => Boolean(nome));
  const tribunal = chave(String(publicacao.tribunal ?? ""));
  return {
    estados: estados.length ? estados : null,
    jurisdicoes: !tribunal ? null : JURISDICOES_PROPRIAS.has(tribunal) ? [tribunal] : ["PRIMEIRO GRAU", "SEGUNDO GRAU"],
  };
}

/** A restrição do feriado alcança o processo? Sem restrição, ou sem saber onde o processo está: alcança. */
function alcanca(restricao: string[] | null, doProcesso: string[] | null): boolean {
  if (!restricao || !doProcesso) return true;
  const lista = new Set(restricao.map(chave));
  return doProcesso.some((valor) => lista.has(chave(valor)));
}

function proximoDia(iso: string): string {
  const data = new Date(`${iso}T12:00:00Z`);
  data.setUTCDate(data.getUTCDate() + 1);
  return data.toISOString().slice(0, 10);
}

/**
 * Dias (AAAA-MM-DD) em que o VIOS não deixa uma tarefa processual deste processo: passa para o dia útil seguinte.
 * Feriado que não posterga tarefa processual ("Posterga prazos? Não." no VIOS) não entra.
 */
export function diasSemTarefaNoVios(feriados: readonly FeriadoDoVios[], onde: OndeEstaOProcesso): string[] {
  const dias = new Set<string>();
  for (const feriado of feriados) {
    if (!feriado.postergaProcessuais) continue;
    if (!alcanca(feriado.jurisdicoes, onde.jurisdicoes) || !alcanca(feriado.estados, onde.estados)) continue;
    const fim = feriado.dataFim >= feriado.dataInicio ? feriado.dataFim : feriado.dataInicio;
    let dia = feriado.dataInicio;
    for (let i = 0; dia <= fim && i < 60; i += 1, dia = proximoDia(dia)) dias.add(dia);
  }
  return [...dias].sort();
}
