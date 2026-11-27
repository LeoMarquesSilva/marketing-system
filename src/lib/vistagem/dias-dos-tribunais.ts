/**
 * Expediente de cada tribunal nos dias em que um fecha e outro funciona. Exemplo: o Dia da Justiça de 2026. O VIOS só
 * restringe um feriado por estado e por grau, e o SIOE não tem local. Esta lista diz, por tribunal, se o dia tem
 * expediente.
 *
 * Fonte: levantamento do Samuel, de 25/11/2026 (planilha "Dia da Justiça 2026 – expediente 7 e 8/12 por tribunal").
 *
 * Regra (decisão do usuário, 27/11/2026): só a data fatal muda.
 * - A fatal num dia sem expediente do tribunal passa para o próximo dia com expediente: 07 ou 08/12 no TJSP → 09/12.
 *   No TRT-2, que fecha só em 07/12, vai para 08/12. No TRF-3, que funciona em 07/12, a fatal de 07/12 fica.
 * - As outras datas (Enviar, 2. REVISAR, 3. PROTOCOLAR antes da fatal, Providência, Compromisso) podem cair nesses
 *   dias. A trava delas é a de antes: fim de semana, SIOE e os feriados do VIOS.
 * - A contagem dos dias do prazo não muda: os dias sem expediente no meio continuam contando (lado seguro, a fatal
 *   fica mais cedo). Só o vencimento passa para frente.
 * - Tribunal sem linha para o dia (o STM, que não foi confirmado) não muda nada.
 * A regra de 26/11 (travar todas as tarefas nos dias sem expediente) foi substituída por esta.
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

function diaSeguinte(iso: string): string {
  const data = new Date(`${iso}T12:00:00Z`);
  data.setUTCDate(data.getUTCDate() + 1);
  return data.toISOString().slice(0, 10);
}

function dataBr(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/**
 * A data fatal que vale para o tribunal. Num dia sem expediente (`semExpediente`, de `expedienteDoTribunal`), passa
 * para o próximo dia que tem expediente e é dia de prazo (`ehDiaDePrazo`: dia útil fora do recesso). Exemplo: 07/12/2026
 * no TJSP → 09/12/2026. Fora desses dias, a fatal fica como está. Data vazia ou inválida volta como veio.
 */
export function fatalComExpediente(fatal: string, semExpediente: Record<string, string>, ehDiaDePrazo: (iso: string) => boolean): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fatal) || !semExpediente[fatal]) return fatal;
  let dia = fatal;
  for (let i = 0; i < 400; i += 1) {
    dia = diaSeguinte(dia);
    if (!semExpediente[dia] && ehDiaDePrazo(dia)) return dia;
  }
  return fatal;
}

/**
 * O que a tela diz da data fatal perto de um dia sem expediente do tribunal.
 * - Fatal num dia sem expediente: `bloqueia`, com a data que vale. Acontece numa vistagem gravada antes da regra; na
 *   tela, a contagem e o calendário já levam a fatal para o dia certo.
 * - Fatal no dia para onde esses dias vão (09/12 no TJSP): aviso de que ela já é a data certa.
 */
export function avisoDaFatal(
  fatal: string | null | undefined,
  semExpediente: Record<string, string>,
  ehDiaDePrazo: (iso: string) => boolean
): { texto: string; bloqueia: boolean } | null {
  if (!fatal || !/^\d{4}-\d{2}-\d{2}$/.test(fatal)) return null;
  if (semExpediente[fatal]) {
    return {
      bloqueia: true,
      texto: `A data fatal ${dataBr(fatal)} não pode ficar nesse dia (${semExpediente[fatal]}). Use ${dataBr(fatalComExpediente(fatal, semExpediente, ehDiaDePrazo))}.`,
    };
  }
  const levados = Object.keys(semExpediente)
    .filter((dia) => dia < fatal && fatalComExpediente(dia, semExpediente, ehDiaDePrazo) === fatal)
    .sort();
  if (!levados.length) return null;
  const motivos = [...new Set(levados.map((dia) => semExpediente[dia]))].join("; ");
  return {
    bloqueia: false,
    texto: `Em ${levados.map(dataBr).join(" e ")}, ${motivos}. A fatal desses dias passa para ${dataBr(fatal)}.`,
  };
}
