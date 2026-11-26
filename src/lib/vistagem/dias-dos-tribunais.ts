/**
 * Expediente de cada tribunal nos dias em que um fecha e outro funciona. Exemplo: o Dia da Justiça de 2026. O VIOS só
 * restringe um feriado por estado e por grau, e o SIOE não tem local. Esta lista diz, por tribunal, se o dia tem
 * expediente.
 *
 * Fonte: levantamento do Samuel, de 25/11/2026 (planilha "Dia da Justiça 2026 – expediente 7 e 8/12 por tribunal").
 * Decisão do usuário (26/11/2026): na seleção das datas da vistagem, vale o tribunal da publicação.
 * - Sem expediente: o dia fica travado, mesmo sem feriado no VIOS ou no SIOE.
 * - Com expediente: o dia fica livre, mesmo que o VIOS tenha feriado para o estado. Exemplos: o TRF-3 funciona em 7/12
 *   e o TRT-2 em 8/12, embora o feriado do VIOS valha para todo SP.
 * - Tribunal sem linha para o dia (o STM, que não foi confirmado): seguem o VIOS e o SIOE.
 * A contagem da data fatal não muda: segue SIOE + nacionais, sem o local (lado seguro).
 */

export interface DiaDoTribunal {
  /** AAAA-MM-DD */
  dia: string;
  /** Como na publicação: TJSP, TRT2, TRF3, STJ... */
  tribunais: readonly string[];
  expediente: boolean;
  /** O que o calendário mostra no dia sem expediente. */
  motivo: string;
  /**
   * Só nos órgãos (vara, foro) de uma destas cidades, pelo nome do órgão na publicação. A linha do mesmo dia e
   * tribunal sem cidades vale para o resto. Exemplo: o TRT-2 funciona em 8/12, menos em Guarulhos (feriado municipal).
   */
  cidades?: readonly string[];
}

const DIA_DA_JUSTICA = "Dia da Justiça";

export const DIAS_DOS_TRIBUNAIS: readonly DiaDoTribunal[] = [
  {
    dia: "2026-12-07",
    expediente: false,
    motivo: DIA_DA_JUSTICA,
    tribunais: [
      "STF", "STJ", "TST", "TSE", "CNJ",
      "TRF1", "TRF2", "TRF6",
      "TJAL", "TJAM", "TJAP", "TJBA", "TJDFT", "TJES", "TJMG", "TJMS", "TJMT", "TJPA", "TJPB", "TJRN", "TJRO", "TJRR", "TJSP",
      "TRT2", "TRT4", "TRT5", "TRT7", "TRT8", "TRT12", "TRT15", "TRT16", "TRT18", "TRT19", "TRT20", "TRT21", "TRT24",
    ],
  },
  {
    dia: "2026-12-07",
    expediente: true,
    motivo: DIA_DA_JUSTICA,
    // TJGO e TJRJ: "acompanhar" (podem decretar ponto facultativo).
    tribunais: [
      "TRF3", "TRF4", "TRF5",
      "TJAC", "TJCE", "TJGO", "TJMA", "TJPE", "TJPI", "TJPR", "TJRJ", "TJRS", "TJSC", "TJSE", "TJTO",
      "TRT1", "TRT3", "TRT6", "TRT9", "TRT10", "TRT11", "TRT13", "TRT14", "TRT17", "TRT22", "TRT23",
    ],
  },
  {
    dia: "2026-12-08",
    expediente: false,
    motivo: DIA_DA_JUSTICA,
    tribunais: [
      "STF", "STJ", "TST", "TSE", "CNJ",
      "TRF1", "TRF2", "TRF3", "TRF4", "TRF5", "TRF6",
      "TJAC", "TJAL", "TJAM", "TJAP", "TJBA", "TJCE", "TJDFT", "TJES", "TJGO", "TJMA", "TJMG", "TJMS", "TJMT", "TJPA", "TJPB",
      "TJPE", "TJPI", "TJRJ", "TJRR", "TJRS", "TJSC", "TJSE", "TJSP",
      "TRT1", "TRT3", "TRT4", "TRT5", "TRT6", "TRT7", "TRT8", "TRT10", "TRT11", "TRT13", "TRT14", "TRT15", "TRT16", "TRT17",
      "TRT18", "TRT19", "TRT20", "TRT21", "TRT22", "TRT23", "TRT24",
    ],
  },
  {
    dia: "2026-12-08",
    expediente: true,
    motivo: DIA_DA_JUSTICA,
    tribunais: ["TJPR", "TJRN", "TJRO", "TJTO", "TRT2", "TRT9", "TRT12"],
  },
  {
    dia: "2026-12-08",
    expediente: false,
    motivo: `${DIA_DA_JUSTICA} (feriado municipal)`,
    tribunais: ["TRT2"],
    cidades: ["Guarulhos", "Diadema", "Mauá", "Jandira", "Franco da Rocha"],
  },
  {
    dia: "2026-12-08",
    expediente: false,
    motivo: `${DIA_DA_JUSTICA} (feriado municipal)`,
    tribunais: ["TJRO"],
    cidades: ["Guajará-Mirim", "Candeias do Jamari"],
  },
  {
    dia: "2026-12-18",
    expediente: false,
    motivo: `${DIA_DA_JUSTICA} (transferido de 8/12)`,
    tribunais: ["TJPR", "TJTO", "TRT9"],
  },
];

/** Sem acento, maiúsculas, só letras e números. "TRT-02" e "TRT2" viram "TRT2"; "TJDF" vira "TJDFT". */
function chaveDoTribunal(texto: string | null | undefined): string {
  const chave = semAcento(String(texto ?? ""))
    .replace(/[^A-Z0-9]/g, "")
    .replace(/^(TRT|TRF)0+(?=\d)/, "$1");
  return chave === "TJDF" ? "TJDFT" : chave;
}

function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
}

/** O nome do órgão tem a cidade? Compara sem acento e sem hífen ("Guajará-Mirim" = "GUAJARA MIRIM"). */
function orgaoNaCidade(orgao: string, cidade: string): boolean {
  const limpar = (texto: string) => semAcento(texto).replace(/[^A-Z0-9]+/g, " ").trim();
  return ` ${limpar(orgao)} `.includes(` ${limpar(cidade)} `);
}

/**
 * O que a lista diz deste processo: dias sem expediente (com o nome para o calendário) e dias com expediente. Em cada
 * dia, a linha da cidade do órgão ganha da linha do tribunal inteiro.
 */
export function expedienteDoTribunal(
  publicacao: { tribunal?: string | null; djen_orgao?: string | null },
  dias: readonly DiaDoTribunal[] = DIAS_DOS_TRIBUNAIS
): { semExpediente: Record<string, string>; comExpediente: string[] } {
  const tribunal = chaveDoTribunal(publicacao.tribunal);
  const orgao = String(publicacao.djen_orgao ?? "");
  const porDia = new Map<string, { geral?: DiaDoTribunal; daCidade?: DiaDoTribunal }>();
  if (tribunal) {
    for (const linha of dias) {
      if (!linha.tribunais.some((nome) => chaveDoTribunal(nome) === tribunal)) continue;
      const doDia = porDia.get(linha.dia) ?? {};
      if (!linha.cidades?.length) doDia.geral = linha;
      else if (orgao && linha.cidades.some((cidade) => orgaoNaCidade(orgao, cidade))) doDia.daCidade = linha;
      porDia.set(linha.dia, doDia);
    }
  }
  const semExpediente: Record<string, string> = {};
  const comExpediente: string[] = [];
  for (const [dia, { geral, daCidade }] of porDia) {
    const vale = daCidade ?? geral;
    if (!vale) continue;
    if (vale.expediente) comExpediente.push(dia);
    else semExpediente[dia] = `${vale.motivo}: sem expediente no ${tribunal}`;
  }
  return { semExpediente, comExpediente: comExpediente.sort() };
}

/**
 * Os dias em que o VIOS não deixa a tarefa (`nomesDosDiasSemTarefaNoVios`), acertados pelo expediente do tribunal da
 * publicação. O dia com expediente sai, e o dia sem expediente entra, com o nome.
 */
export function comOExpedienteDoTribunal(
  nomesDoVios: Record<string, string>,
  publicacao: { tribunal?: string | null; djen_orgao?: string | null },
  dias: readonly DiaDoTribunal[] = DIAS_DOS_TRIBUNAIS
): Record<string, string> {
  const { semExpediente, comExpediente } = expedienteDoTribunal(publicacao, dias);
  const nomes = { ...nomesDoVios };
  for (const dia of comExpediente) delete nomes[dia];
  return { ...nomes, ...semExpediente };
}
