import { chaveNome, ETIQUETA_VIOS, montarObservacaoVios, paraDataVios, referenciaDaPublicacao, revisorFicaNaTarefa, type EtiquetaAgendamento } from "./agendamento";
import { ehPastaDeAtendimento, type TipoPastaInformada } from "./triagem";
import type { DataDoFluxo } from "./types";

/**
 * Onde o robô do SAMA agenda: na publicação (Intimações › Lançamento, ligada à
 * intimação pelo ID de comunicação do DJEN) ou dentro da pasta (como o SAMA/ECOA).
 */
export type ModoAgendamento = "intimacao" | "pasta";

/**
 * Onde agendar esta publicação. A colada à mão ("Colar publicações": e-mail, Teams) não passa pela captura de
 * Intimações do VIOS, então o lançamento pela intimação nunca a acharia (0101059-16, 06/11/2026): vai direto na
 * pasta, como antes da intimação. As da Kurier seguem o modo do servidor (VISTAGEM_AGENDAMENTO).
 */
export function modoDaPublicacao(
  arquivo: { origem?: string | null } | { origem?: string | null }[] | null | undefined,
  padrao: ModoAgendamento
): ModoAgendamento {
  const lote = Array.isArray(arquivo) ? arquivo[0] : arquivo;
  return lote?.origem === "colado" ? "pasta" : padrao;
}

export function ehCienciaNf(nomeDaTarefa: string | null | undefined): boolean {
  return chaveNome(nomeDaTarefa) === "CIENCIA NF";
}

/**
 * Quem vistou, na descrição da CIÊNCIA NF no VIOS (pedido de 24/11/2026): o robô cria a tarefa com o usuário dele, e
 * a descrição só tinha o texto da intimação. Null sem o nome.
 */
export function linhaDeQuemVistou(nome: string | null | undefined): string | null {
  const limpo = nome?.replace(/\s+/g, " ").trim();
  return limpo ? `Vistada por: ${limpo}` : null;
}

/** Uma tarefa do lançamento pela intimação (coluna `lancamento` da fila do SAMA). */
export interface TarefaDoLancamento {
  /** Id do agendamento no Orquestra; o robô devolve o CI de cada uma por esta chave. */
  chave: string;
  tarefa_id: string | null;
  tarefa: string;
  etiqueta_id: string;
  /** DD/MM/AAAA */
  data: string;
  /** HH:MM (Hora tarefa no VIOS); só no Compromisso. */
  hora: string | null;
  /** HH:MM (Hora final no VIOS); só no Compromisso. */
  hora_fim: string | null;
  /** DD/MM/AAAA (Data limite no VIOS); só na SESSÃO DE JULGAMENTO, quando difere da data. Sem ela, a própria data. */
  data_limite: string | null;
  responsavel: string;
  revisor: string | null;
  /**
   * O revisor fica na própria tarefa, junto com o responsável (`revisorFicaNaTarefa`: Sessão de Julgamento e
   * audiências do Trabalhista). O robô junta os dois na tarefa lançada.
   */
  revisor_na_tarefa: boolean;
  observacao: string;
  /** Resposta da JUSTIFICATIVA NF (questionário que o VIOS pede depois de lançar a CIÊNCIA NF). */
  justificativa: string | null;
  /**
   * Tarefas do fluxo com outra data (DD/MM/AAAA) e/ou com os responsáveis escolhidos pelo jurídico, achadas pelo
   * caminho de tipos a partir desta.
   */
  fluxo_datas: { caminho: string[]; data?: string; responsaveis?: string[] }[];
}

export interface LancamentoFila {
  comunicacao_id: string | null;
  /**
   * IDs de comunicação das duplicadas da mesma publicação (uma por parte intimada). Se o VIOS
   * não capturou a comunicação exata, o robô usa a intimação de uma destas.
   */
  comunicacoes_equivalentes: string[];
  /** DD/MM/AAAA; usada pelo robô quando não há ID de comunicação. */
  data_publicacao: string | null;
  /**
   * Texto da publicação. O VIOS insere o da intimação sozinho; o robô só usa este se a publicação não chegar a
   * Intimações do VIOS até as 17h do dia dela e ele tiver de agendar direto na pasta (vai na descrição da tarefa).
   */
  texto_publicacao: string | null;
  /**
   * Agendar direto na pasta, sem procurar a intimação: a publicação colada à mão não está em Intimações do VIOS. O robô
   * cria as tarefas no processo (CI da pasta), com o texto da publicação na descrição, e faz o resto como no lançamento
   * (fluxo, responsáveis, Ciência repetida e a JUSTIFICATIVA NF). É o mesmo caminho do plano B das 17h.
   */
  agendar_na_pasta?: boolean;
  /** A publicação foi colada à mão: o robô avisa isso (e não "não chegou ao VIOS até as 17h", do plano B). */
  publicacao_colada?: boolean;
  /**
   * A pasta é de atendimento (ou nenhuma base a conhece), informada pela CI na Triagem Manual (18/11/2026): vai direto
   * nela, que a intimação do VIOS não se liga a atendimento. O robô abre a tela de atendimento pela CI (e a de processo,
   * se a de atendimento não abrir) e avisa o motivo.
   */
  pasta_informada?: { tipo: TipoPastaInformada };
  tarefas: TarefaDoLancamento[];
}

/** Linha da fila vios_agendamentos do SAMA. */
export interface LinhaFilaSama {
  tipo: string;
  tarefa: string;
  tarefa_id: string | null;
  etiqueta_id: string;
  observacao: string;
  passo_texto: string;
  data: string;
  pasta: string;
  pasta_tipo: "Processo" | "Atendimento";
  ci_pasta: string | null;
  responsavel: string;
  revisor: string | null;
  simular: boolean;
  lancamento?: LancamentoFila;
}

export interface PublicacaoParaFila {
  data_publicacao: string | null;
  tribunal: string | null;
  numero_processo: string | null;
  djen_id_comunicacao: number | null;
  teor: string | null;
  pasta_ci: string | null;
  /** Área da publicação: nas audiências do Trabalhista o revisor vai na tarefa (`revisor_na_tarefa`). */
  escritorio_responsavel?: string | null;
  /** IDs de comunicação das outras publicações do mesmo grupo de duplicidade. */
  comunicacoes_equivalentes?: (number | string)[];
  /** Nome de quem vistou por último (revistado_por ?? vistado_por): vai na descrição da CIÊNCIA NF. */
  vistada_por?: string | null;
}

export interface AgendamentoParaFila {
  id: string;
  etiqueta: EtiquetaAgendamento;
  tarefa: string;
  tarefa_id: string | null;
  /** AAAA-MM-DD */
  data: string;
  /** HH:MM; só no Compromisso. */
  hora: string | null;
  /** HH:MM em que o Compromisso termina; null nos antigos (o robô usa 1 hora depois). */
  hora_fim?: string | null;
  /** AAAA-MM-DD; só na SESSÃO DE JULGAMENTO. */
  data_limite?: string | null;
  responsavel: string;
  revisor: string | null;
  observacao: string | null;
  /** Datas do fluxo diferentes das do VIOS (AAAA-MM-DD) e responsáveis escolhidos, que o robô grava depois de lançar. */
  fluxoDatas?: DataDoFluxo[];
}

const etiquetaVios = (item: AgendamentoParaFila) => String(ETIQUETA_VIOS[item.etiqueta]);

/** Tipo da linha na fila do SAMA (o robô usa a etiqueta_id; o tipo é só o rótulo). */
const TIPO_NA_FILA: Record<EtiquetaAgendamento, string> = { PRAZO: "Prazo", PROVIDENCIA: "Providências", COMPROMISSO: "Compromisso" };

/**
 * Linhas da fila do robô para as tarefas de uma publicação, com os agendamentos de cada uma.
 * - intimação: uma linha com todas as tarefas (depois de lançada, a intimação sai da lista do
 *   VIOS); a descrição leva só o cabeçalho e a observação, porque o VIOS insere o texto da intimação.
 *   Na CIÊNCIA NF a observação vai na JUSTIFICATIVA NF e a descrição fica com quem vistou e o texto
 *   da intimação (modelo da Maria: CI 934338, 03/11/2026; quem vistou, pedido de 24/11/2026).
 * - pasta (publicação colada à mão): a mesma linha, marcada para agendar direto na pasta. O robô põe o texto da
 *   publicação na descrição e a observação da CIÊNCIA NF na JUSTIFICATIVA NF, como na intimação (pedido de 11/11/2026:
 *   a linha antiga, uma por tarefa, ia sem o texto e com a justificativa na descrição).
 * - pasta sem o CI da pasta (não acontece na vistagem: sem pasta, a publicação vai para a abertura): a linha antiga.
 */
export function linhasParaFila(
  publicacao: PublicacaoParaFila,
  itens: AgendamentoParaFila[],
  opcoes: { simular: boolean; modo: ModoAgendamento; tipoPasta?: TipoPastaInformada }
): { linha: LinhaFilaSama; agendamentos: string[] }[] {
  // Pasta de atendimento informada na Triagem Manual: o tipo vai na linha e no lançamento (sempre direto na pasta).
  const atendimento = ehPastaDeAtendimento(opcoes.tipoPasta) && Boolean(publicacao.pasta_ci);
  const modo: ModoAgendamento = atendimento ? "pasta" : opcoes.modo;
  const referencia = {
    dataPublicacao: publicacao.data_publicacao,
    tribunal: publicacao.tribunal,
    numeroProcesso: publicacao.numero_processo,
    djenIdComunicacao: publicacao.djen_id_comunicacao,
  };
  const base = (item: AgendamentoParaFila, observacao: string): LinhaFilaSama => ({
    tipo: TIPO_NA_FILA[item.etiqueta],
    tarefa: item.tarefa,
    tarefa_id: item.tarefa_id,
    etiqueta_id: etiquetaVios(item),
    observacao,
    passo_texto: observacao,
    data: paraDataVios(item.data),
    pasta: publicacao.numero_processo as string,
    pasta_tipo: atendimento ? "Atendimento" : "Processo",
    ci_pasta: publicacao.pasta_ci,
    responsavel: item.responsavel,
    revisor: item.revisor,
    simular: opcoes.simular,
  });

  if (modo === "pasta" && !publicacao.pasta_ci) {
    // A fila da pasta não tem coluna de hora: o horário do Compromisso vai na descrição.
    return itens.map((item) => ({
      linha: base(
        item,
        montarObservacaoVios(
          publicacao.data_publicacao,
          [
            item.hora ? `Horário: ${item.hora}${item.hora_fim ? ` às ${item.hora_fim}` : ""}` : null,
            // Na pasta o robô põe a data limite igual à data: a outra, pedida na Sessão de Julgamento, vai escrita.
            item.data_limite && item.data_limite !== item.data ? `Data limite: ${paraDataVios(item.data_limite)}` : null,
            ehCienciaNf(item.tarefa) ? linhaDeQuemVistou(publicacao.vistada_por) : null,
            item.observacao,
          ]
            .filter(Boolean)
            .join("\n") || null
        )
      ),
      agendamentos: [item.id],
    }));
  }

  if (!itens.length) return [];
  // Linha da fila do robô (não vai para a tarefa): só identifica a publicação.
  const cabecalho = referenciaDaPublicacao(referencia);
  const comunicacao = publicacao.djen_id_comunicacao ? String(publicacao.djen_id_comunicacao) : null;
  // CIÊNCIA NF: a descrição leva quem vistou. Na intimação, o VIOS junta o texto dela abaixo; direto na pasta, o robô
  // usa a descrição no lugar do cabeçalho "Publicação de…" e põe o texto da publicação embaixo, então o cabeçalho vai junto.
  const vistadaPor = linhaDeQuemVistou(publicacao.vistada_por);
  const descricaoDaCienciaNf = !vistadaPor ? "" : modo === "pasta" ? montarObservacaoVios(publicacao.data_publicacao, vistadaPor) : vistadaPor;
  return [
    {
      linha: {
        ...base(itens[0], cabecalho),
        lancamento: {
          comunicacao_id: comunicacao,
          comunicacoes_equivalentes: [...new Set((publicacao.comunicacoes_equivalentes ?? []).map(String))].filter((id) => id && id !== comunicacao),
          data_publicacao: publicacao.data_publicacao ? paraDataVios(publicacao.data_publicacao) : null,
          texto_publicacao: publicacao.teor?.trim() || null,
          ...(modo === "pasta" ? { agendar_na_pasta: true } : {}),
          ...(opcoes.modo === "pasta" ? { publicacao_colada: true } : {}),
          ...(atendimento && opcoes.tipoPasta ? { pasta_informada: { tipo: opcoes.tipoPasta } } : {}),
          tarefas: itens.map((item) => {
            const cienciaNf = ehCienciaNf(item.tarefa);
            return {
              chave: item.id,
              tarefa_id: item.tarefa_id,
              tarefa: item.tarefa,
              etiqueta_id: etiquetaVios(item),
              data: paraDataVios(item.data),
              hora: item.hora ?? null,
              hora_fim: item.hora ? item.hora_fim ?? null : null,
              data_limite: item.data_limite && item.data_limite !== item.data ? paraDataVios(item.data_limite) : null,
              responsavel: item.responsavel,
              revisor: item.revisor,
              revisor_na_tarefa: Boolean(item.revisor) && revisorFicaNaTarefa(item.tarefa, publicacao.escritorio_responsavel),
              observacao: cienciaNf ? descricaoDaCienciaNf : montarObservacaoVios(publicacao.data_publicacao, item.observacao),
              justificativa: cienciaNf ? item.observacao?.trim() || null : null,
              fluxo_datas: (item.fluxoDatas ?? []).map((datada) => ({
                caminho: datada.caminho,
                ...(datada.data ? { data: paraDataVios(datada.data) } : {}),
                ...(datada.responsaveis?.length ? { responsaveis: datada.responsaveis } : {}),
              })),
            };
          }),
        },
      },
      agendamentos: itens.map((item) => item.id),
    },
  ];
}

/**
 * Erro em que o robô pode já ter gravado no VIOS: rodar de novo sem conferir duplica a tarefa.
 * - "ATENÇÃO…": o próprio robô avisa que falhou depois de clicar em Gravar ou de lançar.
 * - "Execução interrompida…": a fila do SAMA desiste do caso parado em "processando" (o robô reiniciou no
 *   meio); ninguém sabe até onde ele foi. Ex.: 0922156-75 em 10/11/2026, com as 3 tarefas criadas no VIOS.
 */
export function podeTerGravadoNoVios(erro: string | null | undefined): boolean {
  return /^\s*(ATENÇÃO|Execução interrompida)/i.test(erro ?? "");
}

/** Tarefa como ficou no VIOS depois do lançamento: a pedida (principal) ou uma que o fluxo criou junto. */
export interface TarefaNoVios {
  ci: string;
  tipo: string | null;
  principal: boolean;
  /** AAAA-MM-DD (data para conclusão). */
  data: string | null;
  dataLimite: string | null;
  hora: string | null;
  responsaveis: string | null;
}

/**
 * Responsável que o VIOS pôs na tarefa pedida sem ninguém (VERIFICAR RENÚNCIA da Operações Legais, pedido de
 * 18/11/2026), lido da tarefa principal que o robô devolveu: a Orquestra grava para mostrar para quem foi agendada.
 * Null quando foi pedida para alguém ou quando o robô não devolveu quem ficou.
 */
export function responsavelQueOViosPos(pedido: string | null | undefined, tarefas: TarefaNoVios[] | null | undefined): string | null {
  if (String(pedido ?? "").trim()) return null;
  const principal = (tarefas ?? []).find((tarefa) => tarefa.principal);
  return principal?.responsaveis?.trim() || null;
}

/** DD/MM/AAAA → AAAA-MM-DD; outro formato → null. */
function dataIso(valor: unknown): string | null {
  const m = String(valor ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** Tarefas do VIOS (resultado.tarefas_vios[] do robô) agrupadas pela chave do agendamento de origem. */
export function tarefasViosDoResultado(resultado: unknown): Map<string, TarefaNoVios[]> {
  const mapa = new Map<string, TarefaNoVios[]>();
  const lista = (resultado as { tarefas_vios?: Record<string, unknown>[] } | null)?.tarefas_vios;
  if (!Array.isArray(lista)) return mapa;
  for (const item of lista) {
    if (typeof item?.chave !== "string" || item.ci == null) continue;
    const texto = (valor: unknown) => (typeof valor === "string" && valor.trim() ? valor.trim() : null);
    const tarefa: TarefaNoVios = {
      ci: String(item.ci),
      tipo: texto(item.tipo),
      principal: item.principal === true,
      data: dataIso(item.data),
      dataLimite: dataIso(item.data_limite),
      hora: texto(item.hora),
      responsaveis: texto(item.responsaveis),
    };
    mapa.set(item.chave, [...(mapa.get(item.chave) ?? []), tarefa]);
  }
  // a pedida primeiro; as do fluxo pela data
  for (const tarefas of mapa.values()) {
    tarefas.sort((a, b) => Number(b.principal) - Number(a.principal) || (a.data ?? "").localeCompare(b.data ?? ""));
  }
  return mapa;
}

/** CI de cada tarefa lançada (resultado.tarefas[] do robô), por chave do agendamento. */
export function cisDoResultado(resultado: unknown): Map<string, string> {
  const mapa = new Map<string, string>();
  const tarefas = (resultado as { tarefas?: { chave?: unknown; ci_vios?: unknown }[] } | null)?.tarefas;
  if (!Array.isArray(tarefas)) return mapa;
  for (const tarefa of tarefas) {
    if (typeof tarefa?.chave === "string" && tarefa.ci_vios != null && String(tarefa.ci_vios) !== "") {
      mapa.set(tarefa.chave, String(tarefa.ci_vios));
    }
  }
  return mapa;
}
