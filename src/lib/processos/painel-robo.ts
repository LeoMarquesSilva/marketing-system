/**
 * Painel de gestão do robô de autos: a fila, o que já foi baixado, o que a IA leu e o que nunca rodou.
 * Aqui só a conta, sem banco, para dar para testar; quem lê as tabelas é painel-robo-server.ts.
 * O painel não leva nome de parte nem de cliente: só CI, número do processo, tribunal e estado.
 */

import { inicioDoDiaBr } from "./fila-resumo";

/* ------------------------------------------------------------- entradas */

export interface ProcessoDoPainel {
  id: string;
  ci: string | null;
  cnj: string | null;
  situacao: string | null;
  dataEncerramento: string | null;
  tribunal: string | null;
  sistema: string | null;
  /** Há robô para este tribunal e sistema (ou o Jus.br atende). */
  temRobo: boolean;
  grupoCliente?: string | null;
}

export interface PedidoDoPainel {
  id: string;
  processo_id: string;
  cnj: string;
  sistema: string;
  tribunal: string;
  status: string;
  motivo_espera: string | null;
  erro: string | null;
  tentativas: number | null;
  robo: string | null;
  criado_em: string;
  atualizado_em: string;
  iniciado_em: string | null;
  concluido_em: string | null;
}

export interface DocumentoDoPainel {
  processo_id: string;
  origem: string;
  leitura_status: string;
  paginas: number | null;
  paginas_lidas: number | null;
  paginas_sem_texto: number | null;
  leitura_custo_us: number | null;
  criado_em: string;
}

export interface SugestoesDoPainel {
  pendentes: number;
  aprovadas: number;
  recusadas: number;
  /** processo_id de cada sugestão pendente (um por sugestão). */
  pendentesPorProcesso: string[];
}

/* --------------------------------------------------------------- saídas */

/** Onde os autos de um processo estão, do pedido ao robô até a leitura pela IA. Um estado por processo. */
export const ESTADOS_DOS_AUTOS = ["lido", "a_ler", "leitura_falhou", "na_fila", "aguardando_pessoa", "falhou", "nunca_pedido", "sem_robo"] as const;
export type EstadoDosAutos = (typeof ESTADOS_DOS_AUTOS)[number];

export interface ProcessoNoPainel {
  id: string;
  ci: string | null;
  cnj: string | null;
  tribunal: string | null;
  sistema: string | null;
  ativo: boolean;
  estado: EstadoDosAutos;
  documentos: number;
  paginas: number;
  sugestoesPendentes: number;
  /** O pedido mais recente ao robô (qualquer status). */
  ultimoPedido: { status: string; em: string; erro: string | null; robo: string | null; tentativas: number } | null;
}

export interface PedidoAberto {
  id: string;
  processoId: string;
  cnj: string;
  /** Grupo do cliente do processo (para saber de quem é cada pedido na fila). */
  grupoCliente: string | null;
  tribunal: string;
  sistema: string;
  status: string;
  motivoEspera: string | null;
  robo: string | null;
  tentativas: number;
  criadoEm: string;
  atualizadoEm: string;
  /** Quando o robô começou a baixar (só para quem está em andamento). */
  iniciadoEm: string | null;
  /** Lugar na fila (1 = o próximo); null para quem já está baixando ou espera uma pessoa. */
  posicao: number | null;
  /** Quando o download deste pedido deve terminar, pelo ritmo recente; null sem base para estimar. */
  previsaoEm: string | null;
}

export interface PainelDoRobo {
  geradoEm: string;
  fila: { pendentes: number; baixando: number; aguardandoPessoa: number; motivos: Record<string, number>; maisAntigoEm: string | null };
  /**
   * Projeção do fim da fila: o tempo médio dos últimos downloads vezes o que falta, dividido pelos robôs que
   * estão baixando. `parada` = há pedido esperando e nenhum robô deu sinal no prazo (aí não há previsão).
   */
  projecao: { minutosPorPedido: number | null; amostra: number; emParalelo: number; fimEm: string | null; parada: boolean };
  hoje: { concluidos: number; erros: number };
  robos: { nome: string; ultimoSinalEm: string; baixando: number; concluidos: number; erros: number }[];
  /** Um ponto por dia (Brasília), do mais antigo ao de hoje. */
  porDia: { dia: string; concluidos: number; erros: number }[];
  porTribunal: { tribunal: string; sistema: string; concluidos: number; erros: number; abertos: number }[];
  abertos: PedidoAberto[];
  leitura: { documentos: number; lidos: number; aLer: number; lendo: number; comErro: number; paginas: number; paginasLidas: number; paginasSemTexto: number; custoUs: number };
  sugestoes: { pendentes: number; aprovadas: number; recusadas: number; processosComPendentes: number };
  processos: ProcessoNoPainel[];
}

/* ----------------------------------------------------------------- conta */

const ABERTOS = new Set(["pendente", "em_andamento", "aguardando_pessoa"]);
const CNJ = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;
export const DIAS_DO_GRAFICO = 14;
/** Quantos downloads recentes entram no ritmo, e o tempo sem sinal que faz a fila contar como parada. */
const AMOSTRA_DO_RITMO = 30;
const MINUTOS_SEM_SINAL = 20;

function mediana(valores: number[]): number | null {
  if (!valores.length) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2;
}

/**
 * Ritmo do robô, em minutos por pedido. Vale o ciclo de verdade: o tempo entre o fim de um pedido e o fim do
 * seguinte do mesmo robô, quando o seguinte já estava esperando (inclui a pausa entre um e outro, não só o
 * download). Sem pelo menos três ciclos assim, cai no tempo de cada download. É a média, com cada tempo limitado
 * a 3x a mediana (o pedido que ficou horas esperando alguém digitar o código do tribunal não distorce). Contam
 * os que deram certo e os que falharam, porque os dois ocupam o robô.
 */
export function ritmoDoRobo(finais: PedidoDoPainel[]): { minutosPorPedido: number | null; amostra: number } {
  const medidos = finais
    .filter((pedido) => pedido.iniciado_em && pedido.concluido_em)
    .sort((a, b) => (b.concluido_em as string).localeCompare(a.concluido_em as string))
    .slice(0, AMOSTRA_DO_RITMO);
  const ciclos: number[] = [];
  const porRobo = new Map<string, PedidoDoPainel[]>();
  for (const pedido of medidos) porRobo.set(pedido.robo ?? "", [...(porRobo.get(pedido.robo ?? "") ?? []), pedido]);
  for (const lista of porRobo.values()) {
    // `lista` está do mais recente para o mais antigo: [seguinte, anterior].
    for (let i = 0; i + 1 < lista.length; i += 1) {
      const seguinte = lista[i];
      const anterior = lista[i + 1];
      if (seguinte.criado_em > (anterior.concluido_em as string)) continue;
      const minutos = (Date.parse(seguinte.concluido_em as string) - Date.parse(anterior.concluido_em as string)) / 60_000;
      if (minutos > 0) ciclos.push(minutos);
    }
  }
  const duracoes = medidos.map((pedido) => (Date.parse(pedido.concluido_em as string) - Date.parse(pedido.iniciado_em as string)) / 60_000).filter((minutos) => minutos > 0);
  const base = ciclos.length >= 3 ? ciclos : duracoes;
  // Para somar a fila inteira vale a média; cada tempo conta no máximo 3x a mediana, para o pedido que ficou
  // horas esperando alguém não puxar a conta.
  const meio = mediana(base);
  const valor = meio === null ? null : base.reduce((soma, minutos) => soma + Math.min(minutos, meio * 3), 0) / base.length;
  return { minutosPorPedido: valor === null ? null : Math.max(0.5, Math.round(valor * 10) / 10), amostra: base.length };
}

/**
 * O erro do robô sem o que muda de um processo para outro (número, caminho do diagnóstico, registro do
 * Playwright), para agrupar: "0001234-…: a sessão do Jus.br venceu." vira "A sessão do Jus.br venceu."
 */
export function motivoDoErro(erro: string | null | undefined): string {
  const linha = (erro ?? "")
    .split("\n")[0]
    .replace(/\s*Diagnóstico guardado em \S+/i, "")
    .replace(CNJ, "")
    .replace(/\[\d+\]/g, "")
    .replace(/\s+\((?:1º|2º|1o|2o)\s*grau:.*$/i, "")
    .replace(/\bprocesso\s+(?=[(:.,]|$)/i, "processo ")
    .replace(/^[\s:–-]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!linha) return "Erro sem descrição";
  return (linha.charAt(0).toUpperCase() + linha.slice(1)).slice(0, 160);
}

/** Dia (AAAA-MM-DD) em Brasília de um instante. */
export function diaBr(ms: number): string {
  return new Date(inicioDoDiaBr(ms) - 3 * 3600_000).toISOString().slice(0, 10);
}

function ativo(processo: ProcessoDoPainel): boolean {
  if (processo.dataEncerramento) return false;
  return !processo.situacao || /^ativo/i.test(processo.situacao);
}

/** O estado dos autos de um processo. Quem já tem autos conta pelo que a IA fez deles, mesmo com atualização na fila. */
export function estadoDosAutos(pedidos: PedidoDoPainel[], documentos: DocumentoDoPainel[], temRobo: boolean): EstadoDosAutos {
  if (documentos.length) {
    if (documentos.some((documento) => documento.leitura_status === "pendente" || documento.leitura_status === "lendo")) return "a_ler";
    if (documentos.every((documento) => documento.leitura_status === "erro")) return "leitura_falhou";
    return "lido";
  }
  if (pedidos.some((pedido) => pedido.status === "pendente" || pedido.status === "em_andamento")) return "na_fila";
  if (pedidos.some((pedido) => pedido.status === "aguardando_pessoa")) return "aguardando_pessoa";
  // Só o pedido mais recente decide: um erro antigo seguido de cancelamento não é "falhou".
  const ultimo = [...pedidos].sort((a, b) => b.criado_em.localeCompare(a.criado_em))[0];
  if (ultimo?.status === "erro") return "falhou";
  return temRobo ? "nunca_pedido" : "sem_robo";
}

export function montarPainelDoRobo(entrada: {
  processos: ProcessoDoPainel[];
  pedidos: PedidoDoPainel[];
  documentos: DocumentoDoPainel[];
  sugestoes: SugestoesDoPainel;
  agoraMs: number;
}): PainelDoRobo {
  const { processos, pedidos, documentos, sugestoes, agoraMs } = entrada;
  const inicioHoje = inicioDoDiaBr(agoraMs);
  const fim = (pedido: PedidoDoPainel) => pedido.concluido_em ?? pedido.atualizado_em;

  const pedidosPorProcesso = new Map<string, PedidoDoPainel[]>();
  for (const pedido of pedidos) pedidosPorProcesso.set(pedido.processo_id, [...(pedidosPorProcesso.get(pedido.processo_id) ?? []), pedido]);
  const documentosPorProcesso = new Map<string, DocumentoDoPainel[]>();
  for (const documento of documentos) documentosPorProcesso.set(documento.processo_id, [...(documentosPorProcesso.get(documento.processo_id) ?? []), documento]);
  const grupoPorProcesso = new Map(processos.map((processo) => [processo.id, processo.grupoCliente ?? null]));
  const pendentesPorProcesso = new Map<string, number>();
  for (const id of sugestoes.pendentesPorProcesso) pendentesPorProcesso.set(id, (pendentesPorProcesso.get(id) ?? 0) + 1);

  const abertos = pedidos.filter((pedido) => ABERTOS.has(pedido.status)).sort((a, b) => a.criado_em.localeCompare(b.criado_em));
  const finais = pedidos.filter((pedido) => pedido.status === "concluido" || pedido.status === "erro");
  const naFila = abertos.filter((pedido) => pedido.status === "pendente");
  const motivos: Record<string, number> = {};
  for (const pedido of abertos) if (pedido.status === "aguardando_pessoa" && pedido.motivo_espera) motivos[pedido.motivo_espera] = (motivos[pedido.motivo_espera] ?? 0) + 1;

  const robos = new Map<string, PainelDoRobo["robos"][number]>();
  for (const pedido of pedidos) {
    if (!pedido.robo) continue;
    const atual = robos.get(pedido.robo) ?? { nome: pedido.robo, ultimoSinalEm: pedido.atualizado_em, baixando: 0, concluidos: 0, erros: 0 };
    if (pedido.atualizado_em > atual.ultimoSinalEm) atual.ultimoSinalEm = pedido.atualizado_em;
    if (pedido.status === "em_andamento") atual.baixando += 1;
    if (pedido.status === "concluido") atual.concluidos += 1;
    if (pedido.status === "erro") atual.erros += 1;
    robos.set(pedido.robo, atual);
  }

  // Projeção: quem está baixando termina no que falta do ritmo (nada, se já passou dele); a fila anda de `emParalelo` em `emParalelo`.
  const ritmo = ritmoDoRobo(finais);
  const baixando = abertos.filter((pedido) => pedido.status === "em_andamento");
  const emParalelo = Math.max(1, new Set(baixando.map((pedido) => pedido.robo ?? pedido.id)).size);
  const ultimoSinalMs = Math.max(0, ...pedidos.filter((pedido) => pedido.robo).map((pedido) => Date.parse(pedido.atualizado_em)));
  const parada = naFila.length > 0 && baixando.length === 0 && agoraMs - Math.max(ultimoSinalMs, Date.parse(naFila[0].criado_em)) > MINUTOS_SEM_SINAL * 60_000;
  const passo = ritmo.minutosPorPedido === null || parada ? null : ritmo.minutosPorPedido * 60_000;
  const faltaDe = (pedido: PedidoDoPainel) => (passo === null ? 0 : Math.max(0, passo - (agoraMs - Date.parse(pedido.iniciado_em ?? pedido.atualizado_em))));
  const emCurso = baixando.length ? Math.max(...baixando.map(faltaDe)) : 0;
  const previsaoDe = (pedido: PedidoDoPainel): { posicao: number | null; previsaoEm: string | null } => {
    // Quem já passou do ritmo não tem hora: termina a qualquer momento.
    if (pedido.status === "em_andamento") return { posicao: null, previsaoEm: passo === null || !faltaDe(pedido) ? null : new Date(agoraMs + faltaDe(pedido)).toISOString() };
    const posicao = naFila.indexOf(pedido) + 1;
    if (!posicao) return { posicao: null, previsaoEm: null };
    return { posicao, previsaoEm: passo === null ? null : new Date(agoraMs + emCurso + Math.ceil(posicao / emParalelo) * passo).toISOString() };
  };
  const fimEm = passo === null || (!naFila.length && !baixando.length) ? null : new Date(agoraMs + emCurso + Math.ceil(naFila.length / emParalelo) * passo).toISOString();

  const dias = new Map<string, { dia: string; concluidos: number; erros: number }>();
  for (let i = DIAS_DO_GRAFICO - 1; i >= 0; i -= 1) {
    const dia = diaBr(agoraMs - i * 86_400_000);
    dias.set(dia, { dia, concluidos: 0, erros: 0 });
  }
  for (const pedido of finais) {
    const ponto = dias.get(diaBr(Date.parse(fim(pedido))));
    if (!ponto) continue;
    if (pedido.status === "concluido") ponto.concluidos += 1;
    else ponto.erros += 1;
  }

  const tribunais = new Map<string, PainelDoRobo["porTribunal"][number]>();
  for (const pedido of pedidos) {
    if (pedido.status === "cancelado") continue;
    const chave = `${pedido.tribunal}|${pedido.sistema}`;
    const atual = tribunais.get(chave) ?? { tribunal: pedido.tribunal, sistema: pedido.sistema, concluidos: 0, erros: 0, abertos: 0 };
    if (pedido.status === "concluido") atual.concluidos += 1;
    else if (pedido.status === "erro") atual.erros += 1;
    else atual.abertos += 1;
    tribunais.set(chave, atual);
  }

  const soma = (lista: DocumentoDoPainel[], campo: "paginas" | "paginas_lidas" | "paginas_sem_texto" | "leitura_custo_us") =>
    lista.reduce((total, documento) => total + (Number(documento[campo]) || 0), 0);

  return {
    geradoEm: new Date(agoraMs).toISOString(),
    fila: {
      pendentes: naFila.length,
      baixando: baixando.length,
      aguardandoPessoa: abertos.filter((pedido) => pedido.status === "aguardando_pessoa").length,
      motivos,
      maisAntigoEm: naFila[0]?.criado_em ?? null,
    },
    projecao: { ...ritmo, emParalelo, fimEm, parada },
    hoje: {
      concluidos: finais.filter((pedido) => pedido.status === "concluido" && Date.parse(fim(pedido)) >= inicioHoje).length,
      erros: finais.filter((pedido) => pedido.status === "erro" && Date.parse(fim(pedido)) >= inicioHoje).length,
    },
    robos: [...robos.values()].sort((a, b) => b.ultimoSinalEm.localeCompare(a.ultimoSinalEm)),
    porDia: [...dias.values()],
    porTribunal: [...tribunais.values()].sort((a, b) => b.concluidos + b.erros + b.abertos - (a.concluidos + a.erros + a.abertos)),
    abertos: abertos.map((pedido) => ({
      id: pedido.id,
      processoId: pedido.processo_id,
      cnj: pedido.cnj,
      grupoCliente: grupoPorProcesso.get(pedido.processo_id) ?? null,
      tribunal: pedido.tribunal,
      sistema: pedido.sistema,
      status: pedido.status,
      motivoEspera: pedido.motivo_espera,
      robo: pedido.robo,
      tentativas: pedido.tentativas ?? 0,
      criadoEm: pedido.criado_em,
      atualizadoEm: pedido.atualizado_em,
      iniciadoEm: pedido.status === "em_andamento" ? pedido.iniciado_em : null,
      ...previsaoDe(pedido),
    })),
    leitura: {
      documentos: documentos.length,
      lidos: documentos.filter((documento) => documento.leitura_status === "lida" || documento.leitura_status === "sem_texto").length,
      aLer: documentos.filter((documento) => documento.leitura_status === "pendente").length,
      lendo: documentos.filter((documento) => documento.leitura_status === "lendo").length,
      comErro: documentos.filter((documento) => documento.leitura_status === "erro").length,
      paginas: soma(documentos, "paginas"),
      paginasLidas: soma(documentos, "paginas_lidas"),
      paginasSemTexto: soma(documentos, "paginas_sem_texto"),
      custoUs: Math.round(soma(documentos, "leitura_custo_us") * 100) / 100,
    },
    sugestoes: {
      pendentes: sugestoes.pendentes,
      aprovadas: sugestoes.aprovadas,
      recusadas: sugestoes.recusadas,
      processosComPendentes: pendentesPorProcesso.size,
    },
    processos: processos.map((processo) => {
      const doProcesso = pedidosPorProcesso.get(processo.id) ?? [];
      const documentosDele = documentosPorProcesso.get(processo.id) ?? [];
      const ultimo = [...doProcesso].sort((a, b) => b.criado_em.localeCompare(a.criado_em))[0];
      return {
        id: processo.id,
        ci: processo.ci,
        cnj: processo.cnj,
        tribunal: processo.tribunal,
        sistema: processo.sistema,
        ativo: ativo(processo),
        estado: estadoDosAutos(doProcesso, documentosDele, processo.temRobo),
        documentos: documentosDele.length,
        paginas: soma(documentosDele, "paginas"),
        sugestoesPendentes: pendentesPorProcesso.get(processo.id) ?? 0,
        ultimoPedido: ultimo
          ? { status: ultimo.status, em: fim(ultimo), erro: ultimo.status === "erro" ? motivoDoErro(ultimo.erro) : null, robo: ultimo.robo, tentativas: ultimo.tentativas ?? 0 }
          : null,
      };
    }),
  };
}
