import { ehCienciaDosAgendamentos, ehCienciaNf } from "./ciencia-agendamentos";
import { MOTIVO_EX_CLIENTE_SEM_ESCRITORIO, PREFIXO_DESCARTE_CONTROLADORIA } from "./triagem";

/**
 * BKP de publicações (SIOE sp_publicacoes, a base do painel "Eficiência Operacional"). Até o go-live ela vinha da lista
 * BKP do SharePoint (sync-sharepoint.mjs do SIOE); com a esteira do SharePoint desligada, o Orquestra passa a ser a
 * fonte, com as MESMAS colunas e os mesmos valores: as opções da lista do SharePoint e as regras calculadas pelo sync
 * (área pelo De-Para, vistado D+1 até 12h do próximo dia útil, eficiência pelo erro do check).
 *
 * Quando: como na lista antiga, o registro entra no fim da esteira (publicação checada, duplicidade confirmada,
 * ex-cliente descartado na triagem, publicação descartada pela controladoria ou enviada à Central como abertura de
 * pasta), com "STATUS DA PUBLICAÇÃO" = CHECKADO.
 *
 * Ex-cliente, como a lista fazia: o que a controladoria tratou (vistado em Operações Legais) é RENÚNCIA, com quem
 * agendou; o descartado automático (sem advogado do escritório na publicação) entra em Operações Legais sem tipo e
 * sem "agendado por" (o descarte da controladoria também, em Operações Legais quando não tem área). A duplicidade
 * leva pasta, cliente e área da publicação original, como na lista.
 */

/**
 * Primeiro lote da Kurier que o Orquestra grava por inteiro no BKP. Nos lotes do piloto (03 a 06/11) as duplicidades e o que
 * não era Trabalhista seguiram na lista do SharePoint; deles só entram as Trabalhistas checadas (ver entraNoBkp).
 */
export const INICIO_DO_BKP = "2026-11-09";

/** Na lista o campo "Pasta" fica com este texto quando o processo não tem pasta no VIOS. */
export const PASTA_POSSIVEL_ABERTURA = "POSSÍVEL ABERTURA DE PASTA";

/** Grafia dos nomes na lista quando difere do cadastro do Orquestra: o ranking do painel agrupa pelo nome. */
const NOME_NA_LISTA: Record<string, string> = {
  "Renato Rossetti Vallim de Castro": "Renato Rossetti Vallim De Castro",
};

function nomeNaLista(nome: string | null): string | null {
  return nome ? NOME_NA_LISTA[nome] ?? nome : null;
}

/** A coluna "Status" da lista é Ativo, Suspenso ou Encerrado: "Encerrado - Ex-Cliente" e "Arquivado definitivamente" entram como Encerrado. */
export function statusNaLista(situacao: string | null): string | null {
  return situacao && /^(encerrado|arquivado definitivamente)/i.test(situacao.trim()) ? "Encerrado" : situacao;
}

/** Opções de "Escritório responsável" na lista do SharePoint. */
const ESCRITORIO_NO_BKP: Record<string, string> = {
  "CIVEL": "CÍVEL",
  "CIVEL | INSOLVENCIA": "CÍVEL | INSOLVÊNCIA",
  "INSOLVENCIA": "INSOLVÊNCIA",
  "TRABALHISTA": "TRABALHISTA",
  "TRIBUTARIO": "TRIBUTÁRIO",
  "RECUPERACAO DE CREDITO": "RECUPERAÇÃO DE CRÉDITO",
  "DISTRESSED DEALS": "SPECIAL SITUATIONS",
  "SPECIAL SITUATIONS": "SPECIAL SITUATIONS",
  "CONTRATOS": "CONTRATOS",
  "OPERACOES LEGAIS": "OPERAÇÕES LEGAIS",
};

/** De-Para "Escritório responsável" → área do painel (transforms.mjs do SIOE: AREA_DEPARA, com a grafia de lá). */
const AREA_DEPARA: Record<string, string> = {
  "CÍVEL": "Cível",
  "CÍVEL | INSOLVÊNCIA": "Reestruturação",
  "CONTRATOS": "Contratos",
  "INSOLVÊNCIA": "Reestruturação",
  "OPERAÇÕES LEGAIS": "Operações Legais",
  "RECUPERAÇÃO DE CRÉDITO": "Recuperação de Crédito",
  "SPECIAL SITUATIONS": "Distressd Deals",
  "TRABALHISTA": "Trabalhista",
  "TRIBUTÁRIO": "Tributário",
};

/** Opções de "TIPO DO AGENDAMENTO" na lista do SharePoint, na ordem dela. */
export const TIPOS_DO_BKP = ["PRAZO", "PROVIDÊNCIAS", "CIÊNCIA NF", "RENÚNCIA", "ABERT. DE PASTA", "DUPLICIDADE"] as const;
export type TipoDoBkp = (typeof TIPOS_DO_BKP)[number];

/**
 * A lista não tem "Compromisso" (audiência, sessão de julgamento, perícia…): vai como este tipo. Ajustável sem mexer
 * no resto se a controladoria preferir outro.
 */
export const TIPO_DO_COMPROMISSO: TipoDoBkp = "PRAZO";

const STATUS_NO_BKP: Record<string, string> = {
  triagem_pendente: "PENDENTE",
  captada: "PENDENTE",
  juridico_vistar: "JURÍDICO VISTAR",
  controladoria_vistar: "CONTROLADORIA VISTAR",
  pronto_para_agendar: "CONTROLADORIA VISTAR",
  agendado: "AGENDADO",
  revisar: "REVISAR",
  checado: "CHECKADO",
  abertura_pasta: "CHECKADO",
  duplicidade: "CHECKADO",
  descartada: "CHECKADO",
};

function semAcento(texto: string | null | undefined): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function escritorioNoBkp(escritorio: string | null | undefined): string | null {
  return ESCRITORIO_NO_BKP[semAcento(escritorio)] ?? null;
}

export function areaNoBkp(escritorioBkp: string | null): string | null {
  return escritorioBkp ? AREA_DEPARA[escritorioBkp] ?? null : null;
}

/** Tipos das tarefas da publicação, como as caixas da lista ('["PRAZO","PROVIDÊNCIAS"]'); a Ciência dos Agendamentos não conta. */
export function tiposDoAgendamento(agendamentos: { etiqueta: string; tarefa: string }[]): TipoDoBkp[] {
  const tipos = new Set<TipoDoBkp>();
  for (const agendamento of agendamentos) {
    if (ehCienciaDosAgendamentos(agendamento.tarefa)) continue;
    if (ehCienciaNf(agendamento.tarefa)) tipos.add("CIÊNCIA NF");
    else if (agendamento.etiqueta === "PRAZO") tipos.add("PRAZO");
    else if (agendamento.etiqueta === "COMPROMISSO") tipos.add(TIPO_DO_COMPROMISSO);
    else tipos.add("PROVIDÊNCIAS");
  }
  return TIPOS_DO_BKP.filter((tipo) => tipos.has(tipo));
}

/** "EFICIÊNCIA" do BI Ops Legais (computeEficienciaPublicacao do SIOE): erro do check = DESVIO. */
export function eficienciaNoBkp(tipo: string | null, subtipo: string | null): string {
  return (tipo ?? "").trim() || (subtipo ?? "").trim() ? "DESVIO" : "EFICIÊNCIA DE PUBLICAÇÃO";
}

/** AAAA-MM-DD do instante em São Paulo. */
function diaEmSaoPaulo(instante: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(instante));
}

/**
 * "Vistado em D+1" (computeVistadoD1 do SIOE): vistado até 12h (São Paulo) do próximo dia útil depois do dia da
 * disponibilização, sem sábado, domingo e feriados de sp_feriados. Não vistado: null.
 */
export function vistadoD1(disponibilizado: string | null, vistadoEm: string | null, feriados: Set<string>): "Sim" | "Não" | null {
  if (!disponibilizado || !vistadoEm) return null;
  const [ano, mes, dia] = diaEmSaoPaulo(disponibilizado).split("-").map(Number);
  for (let i = 1; i <= 15; i++) {
    const data = new Date(Date.UTC(ano, mes - 1, dia + i, 12));
    const iso = data.toISOString().slice(0, 10);
    const semana = data.getUTCDay();
    if (semana === 0 || semana === 6 || feriados.has(iso)) continue;
    // São Paulo não tem horário de verão desde 2019: 12h de lá = 15h UTC.
    return new Date(vistadoEm).getTime() <= new Date(`${iso}T12:00:00-03:00`).getTime() ? "Sim" : "Não";
  }
  return null;
}

export interface PublicacaoParaBkp {
  status: string;
  numeroProcesso: string | null;
  numeroProcessoOriginal: string;
  dataPublicacao: string | null;
  dataDivulgacao: string | null;
  /** Dia do lote da Kurier (ou da colagem) em que a publicação entrou. */
  dataImportacao: string | null;
  pastaCi: string | null;
  pastaVinculo: string | null;
  cliente: string | null;
  grupoCliente: string | null;
  advogadoResponsavel: string | null;
  escritorioResponsavel: string | null;
  situacaoProcesso: string | null;
  acaoProcesso: string | null;
  demandaRisco: boolean | null;
  publicacaoEsocial: string | null;
  checkNota: string | null;
  /** Quando ficou disponível para o jurídico vistar (triagem, pendência resolvida ou transferência de área). */
  disponibilizadoEm: string | null;
  /** Quem vistou primeiro (nome) e quando. */
  vistadoPor: string | null;
  vistadoEm: string | null;
  /** Quem mandou agendar: na publicação vistada, quem validou na Conferência; na duplicidade, quem confirmou. */
  agendadoPor: string | null;
  /** Quando o registro fecha (check, confirmação da duplicidade ou descarte). */
  registradoEm: string;
  /** Ex-cliente tratado pela controladoria (Operações Legais): RENÚNCIA na lista. */
  exCliente?: boolean;
}

export interface InconsistenciaParaBkp {
  origem: "juridico" | "agendamento";
  tipo: string;
  subtipo: string | null;
  descricao: string;
  criadoEm: string;
}

/** Colunas de sp_publicacoes (sem sp_id, que o SIOE dá na primeira gravação). */
export interface LinhaBkp {
  criado: string;
  data_publicacao: string | null;
  data_divulgacao: string | null;
  data_recebimento_kurier: string | null;
  numero_processo: string | null;
  pasta: string | null;
  cliente_principal: string | null;
  grupo: string | null;
  responsavel_principal: string | null;
  escritorio_responsavel: string | null;
  area: string | null;
  tipo_agendamento: string | null;
  prioridade_agendamento: string | null;
  agendado_por: string | null;
  vistado_por: string | null;
  area_vistador: null;
  disponibilizado_vistagem: string | null;
  vistado_em: string | null;
  vistado_d1: string | null;
  demanda_risco: string | null;
  status_publicacao: string | null;
  natureza: null;
  status: string | null;
  acao: string | null;
  eficiencia: string;
  inconsistencias_tipo: string | null;
  inconsistencia_subtipo: string | null;
  inconsistencias_juridico: string | null;
  inconsistencia_juridico_descricao: string | null;
  check_pub: string | null;
  publicacao_esocial: string | null;
}

/** A mais recente de cada origem (a lista guarda uma de cada). */
function ultima(inconsistencias: InconsistenciaParaBkp[], origem: InconsistenciaParaBkp["origem"]): InconsistenciaParaBkp | null {
  return [...inconsistencias].filter((item) => item.origem === origem).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))[0] ?? null;
}

/** Linha da publicação no BKP, com as mesmas colunas e valores da lista do SharePoint. */
export function linhaDoBkp(
  publicacao: PublicacaoParaBkp,
  agendamentos: { etiqueta: string; tarefa: string }[],
  inconsistencias: InconsistenciaParaBkp[],
  feriados: Set<string>
): LinhaBkp {
  const escritorio = escritorioNoBkp(publicacao.escritorioResponsavel);
  // Descartada (ex-cliente sem o escritório na publicação): sem tipo, como o registro automático da lista.
  const tipos: TipoDoBkp[] =
    publicacao.status === "duplicidade"
      ? ["DUPLICIDADE"]
      : publicacao.status === "descartada"
        ? []
        : publicacao.exCliente
          ? ["RENÚNCIA"]
          : tiposDoAgendamento(agendamentos);
  const doCheck = ultima(inconsistencias, "agendamento");
  const doJuridico = ultima(inconsistencias, "juridico");
  const risco = publicacao.demandaRisco === null ? null : publicacao.demandaRisco ? "Sim" : "Não";
  const vistado = publicacao.status !== "duplicidade" && Boolean(publicacao.vistadoPor && publicacao.vistadoEm);
  return {
    criado: publicacao.registradoEm,
    data_publicacao: publicacao.dataPublicacao,
    data_divulgacao: publicacao.dataDivulgacao,
    data_recebimento_kurier: publicacao.dataImportacao,
    numero_processo: publicacao.numeroProcesso ?? (publicacao.numeroProcessoOriginal || null),
    pasta: publicacao.pastaCi ? `${publicacao.pastaVinculo?.trim().toUpperCase() || "PROCESSO PRINCIPAL"} - CI ${publicacao.pastaCi}` : PASTA_POSSIVEL_ABERTURA,
    cliente_principal: publicacao.cliente,
    grupo: publicacao.grupoCliente,
    responsavel_principal: publicacao.advogadoResponsavel,
    escritorio_responsavel: escritorio,
    area: areaNoBkp(escritorio),
    tipo_agendamento: tipos.length ? JSON.stringify(tipos) : null,
    // Na lista, a prioridade acompanha a demanda de risco (97% dos registros desde 09/2026).
    prioridade_agendamento: risco,
    agendado_por: nomeNaLista(publicacao.agendadoPor),
    vistado_por: vistado ? nomeNaLista(publicacao.vistadoPor) : null,
    area_vistador: null,
    disponibilizado_vistagem: publicacao.disponibilizadoEm,
    vistado_em: vistado ? publicacao.vistadoEm : null,
    vistado_d1: vistado ? vistadoD1(publicacao.disponibilizadoEm, publicacao.vistadoEm, feriados) : null,
    demanda_risco: risco,
    status_publicacao: STATUS_NO_BKP[publicacao.status] ?? null,
    natureza: null,
    status: statusNaLista(publicacao.situacaoProcesso),
    acao: publicacao.acaoProcesso,
    eficiencia: eficienciaNoBkp(doCheck?.tipo ?? null, doCheck?.subtipo ?? null),
    inconsistencias_tipo: doCheck?.tipo ?? null,
    inconsistencia_subtipo: doCheck?.subtipo ?? null,
    inconsistencias_juridico: doJuridico?.tipo ?? null,
    inconsistencia_juridico_descricao: doJuridico?.descricao ?? null,
    check_pub: publicacao.checkNota?.trim() || null,
    publicacao_esocial: publicacao.publicacaoEsocial,
  };
}

/** Colunas de vistagem_publicacoes que o BKP usa (as mesmas no servidor e no script de preenchimento). */
export const COLUNAS_DO_BKP =
  "id, status, numero_processo, processo_sufixo, numero_processo_original, data_publicacao, data_divulgacao, pasta_ci, pasta_vinculo, cliente, grupo_cliente, advogado_responsavel, escritorio_responsavel, situacao_processo, acao_processo, demanda_risco, publicacao_esocial, check_nota, motivo_descarte, pendencia, duplicidade_de, triada_em, triagem_resolvida_em, transferido_em, vistado_por, vistado_em, conferido_por, checado_em, duplicidade_resultado, duplicidade_revisada_por, duplicidade_revisada_em, created_at, arquivo:vistagem_kurier_arquivos(data_arquivo)";

export type LinhaDaVistagem = {
  id: string; status: string; numero_processo: string | null; processo_sufixo: string | null; numero_processo_original: string;
  data_publicacao: string | null; data_divulgacao: string | null; pasta_ci: string | null; pasta_vinculo: string | null;
  cliente: string | null; grupo_cliente: string | null; advogado_responsavel: string | null; escritorio_responsavel: string | null;
  situacao_processo: string | null; acao_processo: string | null; demanda_risco: boolean | null; publicacao_esocial: string | null;
  check_nota: string | null; motivo_descarte: string | null; pendencia: string | null; duplicidade_de: string | null; triada_em: string | null; triagem_resolvida_em: string | null;
  transferido_em: string | null; vistado_por: string | null; vistado_em: string | null; conferido_por: string | null;
  checado_em: string | null; duplicidade_resultado: string | null; duplicidade_revisada_por: string | null;
  duplicidade_revisada_em: string | null; created_at: string;
  arquivo: { data_arquivo: string | null } | { data_arquivo: string | null }[] | null;
};

/** Dia do lote da Kurier (ou da colagem); sem lote, o dia em que entrou. */
export function diaDaImportacao(row: Pick<LinhaDaVistagem, "arquivo" | "created_at">): string {
  const arquivo = Array.isArray(row.arquivo) ? row.arquivo[0] : row.arquivo;
  return arquivo?.data_arquivo ?? row.created_at.slice(0, 10);
}

/** No preenchimento: dos lotes do piloto só as Trabalhistas checadas; da troca em diante, tudo o que fechou. */
export function entraNoBkp(row: LinhaDaVistagem): boolean {
  if (diaDaImportacao(row) >= INICIO_DO_BKP) return true;
  return row.status === "checado" && escritorioNoBkp(row.escritorio_responsavel) === "TRABALHISTA";
}

/**
 * Publicação que fechou a esteira: checada, enviada à Central como abertura de pasta, duplicidade confirmada, ex-cliente
 * descartado na triagem ou descartada pela controladoria. Os outros descartes automáticos (índice de advogados do diário) não são publicação e ficam de fora.
 */
export function fechouAEsteira(row: Pick<LinhaDaVistagem, "status" | "duplicidade_resultado" | "motivo_descarte">): boolean {
  if (row.status === "checado" || row.status === "abertura_pasta") return true;
  if (row.status === "duplicidade") return row.duplicidade_resultado === "confirmada";
  if (row.status !== "descartada") return false;
  return row.motivo_descarte === MOTIVO_EX_CLIENTE_SEM_ESCRITORIO || Boolean(row.motivo_descarte?.startsWith(PREFIXO_DESCARTE_CONTROLADORIA));
}

/**
 * Dados da vistagem para a linha do BKP; null se a publicação ainda não fechou a esteira. `nome`: id do usuário → nome.
 * `original`: na duplicidade, a publicação que ela repete (de onde vêm pasta, cliente e área, que a duplicada não tem).
 */
export function publicacaoParaBkp(
  row: LinhaDaVistagem,
  nome: (id: string | null) => string | null,
  original?: LinhaDaVistagem | null
): PublicacaoParaBkp | null {
  if (!fechouAEsteira(row)) return null;
  const duplicidade = row.status === "duplicidade";
  const descartada = row.status === "descartada";
  const pasta = duplicidade && !row.pasta_ci && original ? original : row;
  const arquivo = Array.isArray(row.arquivo) ? row.arquivo[0] : row.arquivo;
  // Disponível para o jurídico: a última entrada na fila (triagem, pendência resolvida ou transferência de área).
  // A duplicidade não passa pela triagem: fica a hora em que chegou.
  const disponibilizadoEm =
    [row.triada_em, row.triagem_resolvida_em, row.transferido_em].filter(Boolean).sort().at(-1) ?? (duplicidade ? row.created_at : null);
  return {
    status: row.status,
    // A lista guarda o incidente junto ao número ("1413501-21.2026.8.12.0000/50002").
    numeroProcesso: row.numero_processo && row.processo_sufixo ? `${row.numero_processo}/${row.processo_sufixo}` : row.numero_processo,
    numeroProcessoOriginal: row.numero_processo_original,
    dataPublicacao: row.data_publicacao,
    dataDivulgacao: row.data_divulgacao,
    dataImportacao: arquivo?.data_arquivo ?? null,
    pastaCi: pasta.pasta_ci,
    pastaVinculo: pasta.pasta_vinculo,
    cliente: pasta.cliente,
    grupoCliente: pasta.grupo_cliente,
    advogadoResponsavel: pasta.advogado_responsavel,
    // Descartada sem área (pendência da controladoria): Operações Legais, como a lista registrava.
    escritorioResponsavel: pasta.escritorio_responsavel ?? (descartada ? "Operações Legais" : null),
    situacaoProcesso: pasta.situacao_processo,
    acaoProcesso: pasta.acao_processo,
    demandaRisco: pasta.demanda_risco,
    publicacaoEsocial: row.publicacao_esocial,
    checkNota: row.check_nota,
    disponibilizadoEm: disponibilizadoEm as string | null,
    vistadoPor: nome(row.vistado_por),
    vistadoEm: row.vistado_em,
    agendadoPor: duplicidade ? nome(row.duplicidade_revisada_por) : descartada ? null : nome(row.conferido_por),
    registradoEm: (duplicidade ? row.duplicidade_revisada_em : descartada ? row.triagem_resolvida_em ?? row.triada_em : row.status === "abertura_pasta" ? row.vistado_em : row.checado_em) ?? row.created_at,
    exCliente: !duplicidade && !descartada && row.pendencia === "ex_cliente" && escritorioNoBkp(row.escritorio_responsavel) === "OPERAÇÕES LEGAIS",
  };
}
