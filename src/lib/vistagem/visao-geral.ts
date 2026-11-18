import type { PublicacaoStatus } from "./types";
import {
  TIPOS_DE_DEMANDA,
  TODAS_AS_AREAS_VISTAGEM,
  VISTADORES_POR_AREA,
  areasComVistador,
  temVistador,
  vistadoresDa,
  type MapaDeVistadores,
  type TipoDeDemanda,
} from "./vistadores";

/**
 * Visão geral da Vistagem: o que chegou no período (arquivo da Kurier × o que entrou na vistagem), onde estão as
 * publicações agora (uma etapa por aba) e, por área e por vistador (demandas normais e de risco), quanto está para
 * vistar. Só contas; quem lê o banco é `visao-geral-server.ts`.
 */

export const PERIODOS_VISAO = [1, 7, 30] as const;
export type PeriodoVisao = (typeof PERIODOS_VISAO)[number];

/** Uma etapa por aba, na ordem das abas do cabeçalho. */
export const ETAPAS_VISAO = ["triagem", "duplicidades", "vistagem", "conferencia", "envio", "check"] as const;
export type EtapaVisao = (typeof ETAPAS_VISAO)[number];

/** Rótulo de quem ainda não tem área (a triagem não achou a pasta). */
export const SEM_AREA_VISAO = "Sem área";

/**
 * O que a pessoa enxerga: as áreas (null = todas, a controladoria). Ver não separa risco de normal: a marca "não vista
 * risco" só tira as de risco da fila A vistar da pessoa, e a Visão geral mostra a área inteira.
 */
export interface EscopoDaVisao {
  areas: string[] | null;
}

export const ESCOPO_COMPLETO: EscopoDaVisao = { areas: null };

/** A publicação é das áreas da pessoa? */
export function estaNoEscopo(escopo: EscopoDaVisao, publicacao: { area: string | null }): boolean {
  return !escopo.areas || escopo.areas.includes(publicacao.area ?? "");
}

export interface DiaDeChegada {
  /** Data do arquivo (AAAA-MM-DD). */
  data: string;
  /** Linhas dos arquivos do dia (Kurier e colados): tudo o que estava disponível para entrar. */
  disponiveis: number;
  /** Publicações que valem (nem duplicidade nem descarte). */
  naVistagem: number;
  duplicidades: number;
  descartadas: number;
  /** Linhas do arquivo que não estão no sistema. */
  soNoArquivo: number;
}

export interface AreaDaVisao {
  area: string;
  /** Publicações que valem e chegaram no período. */
  chegaram: number;
  /** Agora, por etapa (só as etapas com área: Vistagem em diante). */
  vistagem: number;
  conferencia: number;
  envio: number;
  check: number;
  /** Checadas no período. */
  checadas: number;
  /** Data de publicação mais antiga entre as que estão para vistar. */
  maisAntigaParaVistar: string | null;
}

/**
 * Uma linha do painel "Publicações para vistar": o vistador de um tipo de demanda numa área. Área sem vistador
 * cadastrado vira uma linha só (`tipo` e `nome` nulos) com o total da área.
 */
export interface PessoaDaVisao {
  nome: string;
  foto: string | null;
}

export interface VistadorDaVisao {
  area: string;
  /** Demandas normais ou de risco; null = área sem vistador cadastrado (as duas juntas). */
  tipo: TipoDeDemanda | null;
  /** O primeiro de quem vista (vistadores.ts); null = "Vistador a definir". */
  nome: string | null;
  /** Todas as pessoas que vistam esse tipo na área (com foto quando tem). */
  pessoas: PessoaDaVisao[];
  /** Publicações para vistar agora (juridico_vistar). */
  total: number;
  /** Das `total`, quantas são demanda de risco. */
  risco: number;
  maisAntiga: string | null;
  foto: string | null;
}

export interface VisaoGeral {
  hoje: string;
  desde: string;
  dias: PeriodoVisao;
  /** Recorte de quem pediu: a controladoria vê tudo; o jurídico, só as suas áreas (normais e de risco). */
  escopo: EscopoDaVisao;
  /** Somas do período (as mesmas do gráfico). No jurídico, zeradas: as linhas do arquivo da Kurier não têm área. */
  chegada: Omit<DiaDeChegada, "data">;
  /** Um dia por data do período, com ou sem arquivo (sem arquivo, tudo zero e `semArquivo`). No jurídico, vazio. */
  porDia: (DiaDeChegada & { semArquivo: boolean })[];
  /** Agora, em cada aba. No jurídico, Triagem Manual e Duplicidades ficam zeradas (são abas da controladoria). */
  etapas: Record<EtapaVisao, number>;
  /** Publicações que ainda não passaram pela triagem automática (nem área nem pendência). */
  aguardandoTriagem: number;
  areas: AreaDaVisao[];
  /** Linhas por área e vistador, na ordem de `areas` (dentro da área: normais, depois risco). */
  vistadores: VistadorDaVisao[];
  /** Quem vista qualquer área (lista USUARIOS, "TODAS"), por tipo de demanda. */
  vistadoresDeTodas: { tipo: TipoDeDemanda; pessoas: PessoaDaVisao[] }[];
  /** O que chegou no período por grupo de clientes (os maiores primeiro; o resto somado em "Outros grupos"). */
  grupos: GrupoDaVisao[];
}

/** Publicações que chegaram no período de um grupo de clientes, por onde estão agora. */
export interface GrupoDaVisao {
  grupo: string;
  total: number;
  /** Ainda sem área (Triagem Manual ou aguardando a triagem automática). */
  naTriagem: number;
  /** Com o advogado (juridico_vistar). */
  paraVistar: number;
  /** Já vistadas: conferência, envio, check ou checadas. */
  vistadas: number;
  /** Soma de grupos menores (só na linha "Outros grupos"). */
  outros?: number;
}

/** Rótulos de quem não tem grupo e da soma dos menores. */
export const SEM_GRUPO_VISAO = "Sem grupo";
export const OUTROS_GRUPOS_VISAO = "Outros grupos";
/** Quantos grupos aparecem antes de somar o resto em "Outros grupos". */
export const GRUPOS_NO_GRAFICO = 10;

/** Arquivo do período: id, data e quantas linhas tinha. */
export interface ArquivoDaVisao {
  id: string;
  data: string;
  linhas: number;
}

/** Publicação dos arquivos do período, só o que a conta usa. */
export interface ChegadaDaVisao {
  arquivoId: string | null;
  status: PublicacaoStatus;
  area: string | null;
  grupo?: string | null;
  /** Demanda de risco. */
  risco?: boolean;
}

/** Publicação aberta agora (ainda em alguma aba). */
export interface AbertaDaVisao {
  status: PublicacaoStatus;
  area: string | null;
  /** Demanda de risco (vai para o vistador das de risco da área). */
  risco: boolean;
  dataPublicacao: string | null;
  /** Duplicidade já revisada não está mais na aba Duplicidades. */
  duplicidadePendente: boolean;
}

/** Status das publicações que ainda estão em alguma aba (as que a Visão geral lê como "agora"). */
export const STATUS_ABERTOS: PublicacaoStatus[] = [
  "duplicidade",
  "captada",
  "triagem_pendente",
  "juridico_vistar",
  "controladoria_vistar",
  "pronto_para_agendar",
  "agendado",
  "revisar",
];

/** Em que aba está a publicação; null quando já saiu da esteira (checada, descartada, duplicidade revisada). */
export function etapaDoStatus(status: PublicacaoStatus, duplicidadePendente = true): EtapaVisao | null {
  switch (status) {
    case "duplicidade":
      return duplicidadePendente ? "duplicidades" : null;
    case "triagem_pendente":
      return "triagem";
    case "juridico_vistar":
      return "vistagem";
    case "controladoria_vistar":
      return "conferencia";
    case "pronto_para_agendar":
      return "envio";
    case "agendado":
    case "revisar":
      return "check";
    default:
      return null;
  }
}

/** AAAA-MM-DD somado de `dias` (negativo volta). */
export function somarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

/** Primeiro dia do período que termina hoje (1 = só hoje). */
export function inicioDoPeriodo(hoje: string, dias: PeriodoVisao): string {
  return somarDias(hoje, -(dias - 1));
}

export function periodoValido(valor: unknown): PeriodoVisao {
  const numero = Number(valor);
  return (PERIODOS_VISAO as readonly number[]).includes(numero) ? (numero as PeriodoVisao) : 7;
}

const nomeDaArea = (area: string | null) => area?.trim() || SEM_AREA_VISAO;

/** Menor data (AAAA-MM-DD), ignorando vazias. */
function menor(atual: string | null, nova: string | null): string | null {
  if (!nova) return atual;
  return !atual || nova < atual ? nova : atual;
}

export function montarVisaoGeral(entrada: {
  hoje: string;
  dias: PeriodoVisao;
  arquivos: ArquivoDaVisao[];
  chegadas: ChegadaDaVisao[];
  abertas: AbertaDaVisao[];
  /** Checadas no período, uma entrada por publicação (a área dela). */
  checadas: (string | null)[];
  fotos?: Record<string, string>;
  /** Chave do nome usada nas fotos (a mesma de `pessoasPorNome`). */
  chaveNome?: (nome: string) => string;
  /** Quem vista cada área (padrão: o mapa de `vistadores.ts`). */
  vistadores?: MapaDeVistadores;
  /** Recorte de quem pediu (padrão: tudo, a controladoria). O servidor já filtra na consulta; aqui vale de novo. */
  escopo?: EscopoDaVisao;
}): VisaoGeral {
  const { hoje, dias } = entrada;
  const desde = inicioDoPeriodo(hoje, dias);
  const escopo = entrada.escopo ?? ESCOPO_COMPLETO;
  // Jurídico: só as publicações das áreas dele, normais e de risco.
  const restrita = escopo.areas !== null;
  const chegadas = entrada.chegadas.filter((publicacao) => estaNoEscopo(escopo, publicacao));
  const abertas = entrada.abertas.filter((publicacao) => estaNoEscopo(escopo, publicacao));
  const checadas = entrada.checadas.filter((area) => estaNoEscopo(escopo, { area }));

  // Chegada por dia: as linhas dos arquivos e o que delas está no sistema.
  const dataDoArquivo = new Map(entrada.arquivos.map((arquivo) => [arquivo.id, arquivo.data]));
  const vazio = (): DiaDeChegada => ({ data: "", disponiveis: 0, naVistagem: 0, duplicidades: 0, descartadas: 0, soNoArquivo: 0 });
  const porData = new Map<string, DiaDeChegada>();
  const dia = (data: string) => {
    let atual = porData.get(data);
    if (!atual) porData.set(data, (atual = { ...vazio(), data }));
    return atual;
  };
  for (const arquivo of entrada.arquivos) dia(arquivo.data).disponiveis += arquivo.linhas;

  const chegaramPorArea = new Map<string, number>();
  const porGrupo = new Map<string, GrupoDaVisao>();
  for (const publicacao of chegadas) {
    const data = publicacao.arquivoId ? dataDoArquivo.get(publicacao.arquivoId) : undefined;
    if (!data) continue;
    const doDia = dia(data);
    if (publicacao.status === "duplicidade") doDia.duplicidades += 1;
    else if (publicacao.status === "descartada") doDia.descartadas += 1;
    else {
      doDia.naVistagem += 1;
      const area = nomeDaArea(publicacao.area);
      chegaramPorArea.set(area, (chegaramPorArea.get(area) ?? 0) + 1);
      const nomeDoGrupo = publicacao.grupo?.trim() || SEM_GRUPO_VISAO;
      const grupo = porGrupo.get(nomeDoGrupo) ?? { grupo: nomeDoGrupo, total: 0, naTriagem: 0, paraVistar: 0, vistadas: 0 };
      grupo.total += 1;
      if (publicacao.status === "captada" || publicacao.status === "triagem_pendente") grupo.naTriagem += 1;
      else if (publicacao.status === "juridico_vistar") grupo.paraVistar += 1;
      else grupo.vistadas += 1;
      porGrupo.set(nomeDoGrupo, grupo);
    }
  }
  for (const doDia of porData.values()) {
    doDia.soNoArquivo = Math.max(0, doDia.disponiveis - doDia.naVistagem - doDia.duplicidades - doDia.descartadas);
    // Colado sem linha registrada (ou arquivo antigo): o disponível é, no mínimo, o que entrou.
    doDia.disponiveis = Math.max(doDia.disponiveis, doDia.naVistagem + doDia.duplicidades + doDia.descartadas);
  }

  const porDia: VisaoGeral["porDia"] = [];
  for (let passo = 0; passo < dias; passo += 1) {
    const data = somarDias(desde, passo);
    const doDia = porData.get(data);
    porDia.push(doDia ? { ...doDia, semArquivo: false } : { ...vazio(), data, semArquivo: true });
  }
  const chegada = porDia.reduce(
    (soma, doDia) => ({
      disponiveis: soma.disponiveis + doDia.disponiveis,
      naVistagem: soma.naVistagem + doDia.naVistagem,
      duplicidades: soma.duplicidades + doDia.duplicidades,
      descartadas: soma.descartadas + doDia.descartadas,
      soNoArquivo: soma.soNoArquivo + doDia.soNoArquivo,
    }),
    { disponiveis: 0, naVistagem: 0, duplicidades: 0, descartadas: 0, soNoArquivo: 0 }
  );

  // Agora: cada aba, cada área e, na Vistagem, cada tipo de demanda da área.
  const etapas = Object.fromEntries(ETAPAS_VISAO.map((etapa) => [etapa, 0])) as Record<EtapaVisao, number>;
  let aguardandoTriagem = 0;
  const areas = new Map<string, AreaDaVisao>();
  const area = (nome: string) => {
    let atual = areas.get(nome);
    if (!atual) {
      atual = { area: nome, chegaram: 0, vistagem: 0, conferencia: 0, envio: 0, check: 0, checadas: 0, maisAntigaParaVistar: null };
      areas.set(nome, atual);
    }
    return atual;
  };
  type Fila = { total: number; maisAntiga: string | null };
  const filas = new Map<string, Record<TipoDeDemanda, Fila>>();
  const filaDa = (nome: string) => {
    let atual = filas.get(nome);
    if (!atual) filas.set(nome, (atual = { normal: { total: 0, maisAntiga: null }, risco: { total: 0, maisAntiga: null } }));
    return atual;
  };

  for (const publicacao of abertas) {
    // Triagem e Duplicidades são da controladoria: na visão do jurídico ficam zeradas.
    if (publicacao.status === "captada") {
      if (!restrita) aguardandoTriagem += 1;
      continue;
    }
    const etapa = etapaDoStatus(publicacao.status, publicacao.duplicidadePendente);
    if (!etapa) continue;
    if (etapa === "duplicidades" || etapa === "triagem") {
      if (!restrita) etapas[etapa] += 1;
      continue;
    }
    etapas[etapa] += 1;

    const daArea = area(nomeDaArea(publicacao.area));
    daArea[etapa] += 1;
    if (etapa !== "vistagem") continue;
    daArea.maisAntigaParaVistar = menor(daArea.maisAntigaParaVistar, publicacao.dataPublicacao);

    const fila = filaDa(daArea.area)[publicacao.risco ? "risco" : "normal"];
    fila.total += 1;
    fila.maisAntiga = menor(fila.maisAntiga, publicacao.dataPublicacao);
  }

  for (const [nome, total] of chegaramPorArea) area(nome).chegaram = total;
  for (const nome of checadas) area(nomeDaArea(nome)).checadas += 1;

  // Área com vistador cadastrado sempre aparece no painel, mesmo em dia (mostra quem vista e o zero); no jurídico,
  // só as áreas dele, e todas elas (mesmo sem vistador cadastrado).
  const mapa = entrada.vistadores ?? VISTADORES_POR_AREA;
  for (const nome of areasComVistador(mapa)) if (estaNoEscopo(escopo, { area: nome })) area(nome);
  for (const nome of escopo.areas ?? []) area(nome);
  const tipos = TIPOS_DE_DEMANDA;

  // Áreas com mais publicações abertas primeiro; "Sem área" por último.
  const areasOrdenadas = [...areas.values()].sort((a, b) => {
    if (a.area === SEM_AREA_VISAO) return 1;
    if (b.area === SEM_AREA_VISAO) return -1;
    const abertasA = a.vistagem + a.conferencia + a.envio + a.check;
    const abertasB = b.vistagem + b.conferencia + b.envio + b.check;
    return abertasB - abertasA || b.chegaram - a.chegaram || a.area.localeCompare(b.area, "pt-BR");
  });

  const chave = entrada.chaveNome ?? ((nome: string) => nome);
  const fotos = entrada.fotos ?? {};
  const vistadores: VistadorDaVisao[] = [];
  for (const daArea of areasOrdenadas) {
    const fila = filaDa(daArea.area);
    if (!temVistador(daArea.area, mapa)) {
      // Sem vistador cadastrado: uma linha com o total da área (normais e de risco juntas), sem deduzir nomes.
      if (!daArea.vistagem) continue;
      vistadores.push({
        area: daArea.area,
        tipo: null,
        nome: null,
        pessoas: [],
        total: daArea.vistagem,
        risco: fila.risco.total,
        maisAntiga: daArea.maisAntigaParaVistar,
        foto: null,
      });
      continue;
    }
    for (const tipo of tipos) {
      const nomes = vistadoresDa(daArea.area, tipo, mapa);
      const { total, maisAntiga } = fila[tipo];
      // O tipo sem vistador só aparece se tiver publicação (aí, como "Vistador a definir").
      if (!nomes.length && !total) continue;
      const pessoas = nomes.map((nome) => ({ nome, foto: fotos[chave(nome)] ?? null }));
      vistadores.push({
        area: daArea.area,
        tipo,
        nome: nomes[0] ?? null,
        pessoas,
        total,
        risco: tipo === "risco" ? total : 0,
        maisAntiga,
        foto: pessoas[0]?.foto ?? null,
      });
    }
  }

  return {
    hoje,
    desde,
    dias,
    escopo,
    // O arquivo da Kurier é da casa toda (as linhas não têm área): o jurídico não recebe esses números.
    chegada: restrita ? { disponiveis: 0, naVistagem: 0, duplicidades: 0, descartadas: 0, soNoArquivo: 0 } : chegada,
    porDia: restrita ? [] : porDia,
    etapas,
    aguardandoTriagem,
    areas: areasOrdenadas,
    vistadores,
    vistadoresDeTodas: tipos.map((tipo) => ({
      tipo,
      pessoas: vistadoresDa(TODAS_AS_AREAS_VISTAGEM, tipo, mapa).map((nome) => ({ nome, foto: fotos[chave(nome)] ?? null })),
    })).filter((grupo) => grupo.pessoas.length > 0),
    grupos: rankearGrupos([...porGrupo.values()]),
  };
}

/** Os maiores grupos primeiro (empate: mais para vistar, depois o nome); "Sem grupo" e a soma do resto no fim. */
export function rankearGrupos(grupos: GrupoDaVisao[], limite = GRUPOS_NO_GRAFICO): GrupoDaVisao[] {
  const semGrupo = grupos.find((grupo) => grupo.grupo === SEM_GRUPO_VISAO);
  const ordenados = grupos
    .filter((grupo) => grupo.grupo !== SEM_GRUPO_VISAO)
    .sort((a, b) => b.total - a.total || b.paraVistar - a.paraVistar || a.grupo.localeCompare(b.grupo, "pt-BR"));
  const principais = ordenados.slice(0, limite);
  const resto = ordenados.slice(limite);
  const outros = resto.length
    ? [
        resto.reduce<GrupoDaVisao>(
          (soma, grupo) => ({
            ...soma,
            total: soma.total + grupo.total,
            naTriagem: soma.naTriagem + grupo.naTriagem,
            paraVistar: soma.paraVistar + grupo.paraVistar,
            vistadas: soma.vistadas + grupo.vistadas,
          }),
          { grupo: OUTROS_GRUPOS_VISAO, total: 0, naTriagem: 0, paraVistar: 0, vistadas: 0, outros: resto.length }
        ),
      ]
    : [];
  return [...principais, ...outros, ...(semGrupo ? [semGrupo] : [])];
}
