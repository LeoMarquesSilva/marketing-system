import "server-only";

import { AUDIENCIAS_VIOS, SITE_CONTROLADORIA, TAREFAS_VIOS } from "@/lib/vistagem/pastas-vios";
import { sama } from "@/lib/vistagem/sama";
import { baixarArquivoComDataPorCaminho } from "@/lib/vistagem/sharepoint";
import { estadoNoVios, hojeEmBrasilia, local, somarDias } from "./agenda";
import { completarCnj, conferirPautaComVios, datasNoTribunal, JANELA_DIAS, juntarFontesDoVios, mudancaResolvidaNoVios, tribunalDoCnj, type TarefaDaFonte } from "./conferencia-vios";
import { audienciaNasIntimacoes, type ComunicacaoDjen } from "./djen";
import { chaveDoLink, horaLocalParaIso } from "./pje";
import { AudienciasError, carregarAudiencias, COLUNAS_AUDIENCIA, db, falhou, paraAudiencia, registrarHistorico } from "./server";
import { substituirJusbrPeloPje } from "./jusbr-server";
import { sincronizarReservas, type ResumoReservas } from "./reserva-server";
import { deTarefaDoSama, lerCsvDoVios, type AudienciaNoVios, type TarefaDoSama } from "./vios-csv";

/**
 * Conferências da pauta com o DJEN (intimações: hora, modalidade, link) e com o VIOS (relatório de tarefas:
 * data e situação). O DJEN é público e sem login; uma consulta por processo, com pausa entre elas.
 */

const PAUSA_MS = 1200;
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function intimacoes(cnj: string): Promise<ComunicacaoDjen[]> {
  const digitos = cnj.replace(/\D/g, "");
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), 20_000);
  try {
    const resposta = await fetch(`https://comunicaapi.pje.jus.br/api/v1/comunicacao?numeroProcesso=${digitos}&itensPorPagina=100`, { signal: controle.signal, cache: "no-store" });
    if (!resposta.ok) throw new Error(`DJEN respondeu ${resposta.status}`);
    return ((await resposta.json()) as { items?: ComunicacaoDjen[] }).items ?? [];
  } finally {
    clearTimeout(relogio);
  }
}

export interface ResumoDjen {
  conferidas: number;
  linksNovos: number;
  linksMudaram: number;
  semIntimacao: number;
  erros: number;
}

/**
 * Confere no DJEN as audiências dos próximos 45 dias que não foram conferidas hoje (as mais próximas primeiro),
 * até `limite` por rodada. Link que o PJe não tem entra pela intimação; link da intimação que mudou vira mudança.
 */
export async function conferirNoDjen(limite = 25): Promise<ResumoDjen> {
  const agora = new Date();
  const hoje = local(agora.toISOString()).dia;
  const ate = new Date(agora.getTime() + 45 * 24 * 60 * 60 * 1000);
  const auds = (await carregarAudiencias(agora.toISOString(), ate.toISOString())).filter(
    (a) => a.situacao === "designada" && (!a.djenConferidoEm || local(a.djenConferidoEm).dia !== hoje)
  );
  const resumo: ResumoDjen = { conferidas: 0, linksNovos: 0, linksMudaram: 0, semIntimacao: 0, erros: 0 };
  const { data: leitura } = await db().from("aud_leituras").insert({ fonte: "djen", origem: "rotina" }).select("id").single();
  for (const aud of auds.slice(0, limite)) {
    try {
      const achado = audienciaNasIntimacoes(await intimacoes(aud.cnj), local(aud.inicio).dia);
      const campos: Record<string, unknown> = { djen_conferido_em: new Date().toISOString() };
      if (!achado) resumo.semIntimacao += 1;
      else {
        campos.djen_data = achado.dataDisponibilizacao;
        campos.djen_inicio = achado.hora ? horaLocalParaIso(`${local(aud.inicio).dia}T${achado.hora}:00`) : null;
        campos.djen_modalidade = achado.modalidade;
        if (achado.link && !aud.linkSala) {
          Object.assign(campos, { link_sala: achado.link, link_fonte: "djen", link_fonte_data: achado.dataDisponibilizacao });
          resumo.linksNovos += 1;
        } else if (achado.link && aud.linkFonte === "djen" && chaveDoLink(achado.link) !== chaveDoLink(aud.linkSala)) {
          Object.assign(campos, {
            link_sala: achado.link,
            link_anterior: aud.linkSala,
            link_fonte_data: achado.dataDisponibilizacao,
            mudancas: [...new Set([...aud.mudancas, "link"])],
            mudanca_conferida_em: null,
          });
          resumo.linksMudaram += 1;
          await registrarHistorico(aud.id, "link mudou na intimação", { de: aud.linkSala, para: achado.link, feitoPor: "leitura do DJEN" });
        }
      }
      const { error } = await db().from("aud_audiencias").update(campos).eq("id", aud.id);
      if (error) falhou("gravar a conferência do DJEN", error);
      resumo.conferidas += 1;
    } catch (erro) {
      resumo.erros += 1;
      console.error("[pauta] DJEN:", aud.cnj, erro instanceof Error ? erro.message : erro);
    }
    await espera(PAUSA_MS);
  }
  if (leitura)
    await db()
      .from("aud_leituras")
      .update({ terminada_em: new Date().toISOString(), total: resumo.conferidas, novas: resumo.linksNovos, alteradas: resumo.linksMudaram, detalhe: resumo })
      .eq("id", leitura.id);
  return resumo;
}

export interface ResumoVios {
  lidas: number;
  conferidas: number;
  divergentes: number;
  soNoVios: number;
}

/** Relatório de tarefas do VIOS (CSV): grava em cada audiência do PJe a data e a situação que o VIOS tem. */
export async function importarRelatorioDoVios(texto: string, quem: string | null): Promise<ResumoVios> {
  const lidas = lerCsvDoVios(texto).filter((l) => l.cnj);
  const resumo: ResumoVios = { lidas: lidas.length, conferidas: 0, divergentes: 0, soNoVios: 0 };
  const { data: leitura } = await db().from("aud_leituras").insert({ fonte: "vios", origem: quem ?? "upload" }).select("id").single();
  const cnjs = [...new Set(lidas.map((l) => l.cnj))];
  for (let i = 0; i < cnjs.length; i += 200) {
    const { data, error } = await db().from("aud_audiencias").select(COLUNAS_AUDIENCIA).in("cnj", cnjs.slice(i, i + 200)).eq("situacao", "designada");
    if (error) falhou("ler a pauta para conferir com o VIOS", error);
    const porCnj = new Map<string, ReturnType<typeof paraAudiencia>[]>();
    for (const l of (data ?? []) as Record<string, unknown>[]) {
      const a = paraAudiencia(l);
      porCnj.set(a.cnj, [...(porCnj.get(a.cnj) ?? []), a]);
    }
    for (const v of lidas.filter((l) => porCnj.has(l.cnj))) {
      const candidatas = porCnj.get(v.cnj)!;
      const alvo = candidatas.sort((a, b) => Math.abs(new Date(a.inicio).getTime() - new Date(v.inicio).getTime()) - Math.abs(new Date(b.inicio).getTime() - new Date(v.inicio).getTime()))[0]!;
      if (Math.abs(new Date(alvo.inicio).getTime() - new Date(v.inicio).getTime()) > 120 * 24 * 60 * 60 * 1000) continue;
      await db().from("aud_audiencias").update({ vios_tarefa_ci: v.tarefaCi, vios_inicio: v.inicio, vios_situacao: v.status }).eq("id", alvo.id);
      resumo.conferidas += 1;
      if (new Date(alvo.inicio).getTime() !== new Date(v.inicio).getTime()) resumo.divergentes += 1;
    }
  }
  const comPauta = new Set<string>();
  const { data: daPauta } = await db().from("aud_audiencias").select("cnj").in("cnj", cnjs.slice(0, 1000));
  for (const l of (daPauta ?? []) as { cnj: string }[]) comPauta.add(l.cnj);
  resumo.soNoVios = lidas.filter((l) => l.status === "aberta" && new Date(l.inicio).getTime() > Date.now() && !comPauta.has(l.cnj)).length;
  if (leitura) await db().from("aud_leituras").update({ terminada_em: new Date().toISOString(), total: resumo.lidas, alteradas: resumo.divergentes, detalhe: resumo }).eq("id", leitura.id);
  return resumo;
}

/* ------------------------------------------------------------------ conferência automática com o VIOS (Tarefas.csv + SAMA) */

/** Uma tarefa aberta do VIOS sem audiência no PJe, como fica guardada na leitura. */
export interface TarefaSoNoVios {
  tarefaCi: string;
  ciProcesso: string | null;
  cnj: string;
  inicio: string;
  tarefa: string;
  responsaveis: string[];
  /** Audiências designadas do mesmo processo que o tribunal tem em outra data (ISO), quando há. */
  noTribunal?: string[];
}

export interface ResumoConferenciaVios {
  /** A fonte mais nova usada (Tarefas.csv ou cópia do SAMA): a conferência vale para o VIOS desse momento. */
  copiaEm: string | null;
  /** Quando o arquivo mais novo do SharePoint (Tarefas.csv ou Audiencias.csv) foi gravado (null = nenhum lido). */
  relatorioEm?: string | null;
  /** Tarefas de audiência nos arquivos do SharePoint (null = nenhum lido). */
  relatorioTarefas?: number | null;
  /** Cada arquivo do SharePoint lido: quantas tarefas de audiência, quantas sem número de processo e o período. */
  arquivos?: { nome: string; em: string | null; linhas: number; semCnj: number; de: string | null; ate: string | null }[];
  /** Tarefas sem número de processo que nem a CI do processo completou (ficaram de fora). */
  semCnj?: number;
  /** Quando o SAMA copiou o VIOS pela última vez (null = não lido). */
  samaEm?: string | null;
  /** Fonte que falhou (a conferência seguiu com a outra). */
  avisos?: string[];
  tarefas: number;
  conferidas: number;
  confere: number;
  horario: number;
  falta: number;
  concluida: number;
  aberta: number;
  /** Mudanças do PJe que o VIOS já mostra feitas (marcadas como conferidas sozinhas). */
  resolvidas: number;
  soNoVios: number;
  /** Rede de segurança: o que só o VIOS ou a Vistagem têm entrou na pauta "a confirmar" (null = não rodou). */
  reservas?: ResumoReservas | null;
}

/** Origem das conferências automáticas (após a leitura do PJe, rotina e "Rodar a rotina agora"); o upload do CSV grava o nome de quem subiu. */
export const ORIGEM_AUTOMATICA = "automática";

const COLUNAS_SAMA = "ci, ci_do_processo, nro_cnj, tarefa, data_limite, data_para_conclusao, horario, vios_status, area_do_processo, responsaveis, auxiliares, sincronizado_em";
const PAGINA_SAMA = 1000;
const MAX_LINHAS_SAMA = 30_000;
const DIAS_A_FRENTE = 400;
/** Sem leitura nova do PJe, a conferência roda de novo depois disto (o SAMA relê o VIOS às 2h e às 12h). */
const INTERVALO_MAXIMO_MS = 6 * 60 * 60 * 1000;

/** O Tarefas.csv tem dezenas de megabytes; acima disto a conferência fica só com o SAMA, para não estourar a memória. */
const TAMANHO_MAXIMO_RELATORIO = 200 * 1024 * 1024;

function decodificarCsv(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

interface ArquivoDoVios {
  nome: string;
  tarefas: AudienciaNoVios[];
  em: string | null;
}

/**
 * Tarefas de audiência de um relatório de tarefas do VIOS que o robô do escritório (vios-app, máquina bp01) grava no
 * SharePoint da Controladoria, com a hora em que o arquivo foi gravado. Tarefas.csv é um recorte curto; Audiencias.csv
 * (vios-app --audiencias: 3 dias atrás a 1 ano à frente) só existe se esse modo estiver agendado: sem ele, null.
 */
async function arquivoDoVios(nome: string, caminho: string, opcional = false): Promise<ArquivoDoVios | null> {
  let baixado: Awaited<ReturnType<typeof baixarArquivoComDataPorCaminho>>;
  try {
    baixado = await baixarArquivoComDataPorCaminho(SITE_CONTROLADORIA, caminho);
  } catch (erro) {
    if (opcional && erro instanceof Error && erro.message.includes("(404)")) return null;
    throw erro;
  }
  if (baixado.tamanho > TAMANHO_MAXIMO_RELATORIO) throw new AudienciasError(`${nome} grande demais (${Math.round(baixado.tamanho / 1024 / 1024)} MB).`, 502);
  return { nome, tarefas: lerCsvDoVios(decodificarCsv(baixado.bytes)), em: baixado.modificadoEm };
}

/** Tarefas de audiência do VIOS entre `de` e `ate`, da cópia que o SAMA faz do relatório do VIOS (com a hora de cada uma). */
async function copiaDoSama(de: string, ate: string): Promise<{ tarefas: TarefaDaFonte[]; copiaEm: string | null }> {
  const cliente = sama();
  const tarefas: TarefaDaFonte[] = [];
  let copiaEm: number | null = null;
  for (let desde = 0; desde < MAX_LINHAS_SAMA; desde += PAGINA_SAMA) {
    const { data, error } = await cliente
      .from("vios_tarefas")
      .select(COLUNAS_SAMA)
      .gte("data_limite", de)
      .lte("data_limite", ate)
      .or("tarefa.ilike.*AUD*,tarefa.ilike.*SESS*,tarefa.ilike.*PER*CIA*")
      .order("ci")
      .range(desde, desde + PAGINA_SAMA - 1);
    if (error) throw new AudienciasError(`Não foi possível ler o VIOS no SAMA: ${error.message}`, 502);
    const linhas = (data ?? []) as unknown as (TarefaDoSama & { sincronizado_em?: string | null })[];
    for (const l of linhas) {
      const tarefa = deTarefaDoSama(l);
      const em = l.sincronizado_em ? Date.parse(l.sincronizado_em) : NaN;
      if (tarefa) tarefas.push({ tarefa, em: Number.isFinite(em) ? em : 0 });
      if (Number.isFinite(em) && (copiaEm === null || em > copiaEm)) copiaEm = em;
    }
    if (linhas.length < PAGINA_SAMA) break;
  }
  return { tarefas, copiaEm: copiaEm === null ? null : new Date(copiaEm).toISOString() };
}

function mesmoInstante(a: string | null, b: string | null): boolean {
  if (!a || !b) return a === b;
  return new Date(a).getTime() === new Date(b).getTime();
}

function maisNova(...datas: (string | null)[]): string | null {
  const validas = datas.filter((d): d is string => Boolean(d) && Number.isFinite(Date.parse(d!)));
  if (!validas.length) return null;
  return new Date(Math.max(...validas.map((d) => Date.parse(d)))).toISOString();
}

/**
 * Confere a pauta de hoje em diante com as tarefas de audiência do VIOS, somando as fontes (nenhuma é completa): os
 * relatórios do SharePoint (Tarefas.csv; Audiencias.csv, se existir) e a cópia do SAMA; por CI vale a versão mais
 * nova. Grava em cada audiência a tarefa que corresponde a ela (ou nenhuma), marca como conferida a mudança que o
 * VIOS já mostra feita e guarda na leitura as tarefas abertas que só existem no VIOS. Fonte que falha vira aviso;
 * sem nenhuma, a conferência falha.
 */
export async function conferirComVios(origem = ORIGEM_AUTOMATICA, agora = new Date()): Promise<ResumoConferenciaVios> {
  const hoje = hojeEmBrasilia(agora);
  const de = somarDias(hoje, -30);
  const ate = somarDias(hoje, DIAS_A_FRENTE + JANELA_DIAS);
  const { data: leitura } = await db().from("aud_leituras").insert({ fonte: "vios", origem }).select("id").single();
  try {
    const avisos: string[] = [];
    const semFonte = (fonte: string) => (erro: unknown) => {
      avisos.push(`${fonte} não lido: ${erro instanceof Error ? erro.message : String(erro)}`);
      return null;
    };
    const [audsLidas, tarefasCsv, audienciasCsv, copia] = await Promise.all([
      carregarAudiencias(`${hoje}T00:00:00-03:00`, `${somarDias(hoje, DIAS_A_FRENTE)}T00:00:00-03:00`),
      arquivoDoVios("Tarefas.csv", TAREFAS_VIOS).catch(semFonte("Tarefas.csv do SharePoint")),
      arquivoDoVios("Audiencias.csv", AUDIENCIAS_VIOS, true).catch(semFonte("Audiencias.csv do SharePoint")),
      copiaDoSama(de, ate).catch(semFonte("Cópia do VIOS no SAMA")),
    ]);
    // Audiência que veio do Jus.br e que o PJe agora também mostra: a do PJe vale (herda a dupla) e a do Jus.br sai.
    const substituidas = await substituirJusbrPeloPje(audsLidas).catch((erro) => {
      avisos.push(`Audiências do Jus.br não substituídas pelas do PJe: ${erro instanceof Error ? erro.message : String(erro)}`);
      return 0;
    });
    const auds = substituidas ? await carregarAudiencias(`${hoje}T00:00:00-03:00`, `${somarDias(hoje, DIAS_A_FRENTE)}T00:00:00-03:00`) : audsLidas;
    const arquivos = [tarefasCsv, audienciasCsv].filter((a): a is ArquivoDoVios => Boolean(a));
    if (!arquivos.length && !copia) throw new AudienciasError(avisos.join(" · "), 502);
    const naJanela = (t: AudienciaNoVios) => {
      const dia = local(t.inicio).dia;
      return dia >= de && dia <= ate;
    };
    const juntas = juntarFontesDoVios(
      ...arquivos.map((a) => a.tarefas.filter(naJanela).map((tarefa) => ({ tarefa, em: a.em ? Date.parse(a.em) : agora.getTime() }))),
      copia?.tarefas ?? []
    );
    const cnjPorCiProcesso = new Map<string, string>();
    for (const t of juntas) if (t.cnj && t.ciProcesso) cnjPorCiProcesso.set(t.ciProcesso, t.cnj);
    for (const a of auds) if (a.ciProcesso) cnjPorCiProcesso.set(a.ciProcesso, a.cnj);
    const { tarefas, semCnj } = completarCnj(juntas, cnjPorCiProcesso);
    // Só as do tribunal entram na conferência: as "a confirmar" (origem vios) são a própria tarefa do VIOS.
    const { tarefaDa, soNoVios } = conferirPautaComVios(
      auds.filter((a) => a.origem !== "vios"),
      tarefas,
      agora
    );
    const relatorioEm = maisNova(...arquivos.map((a) => a.em));
    const copiaEm = maisNova(relatorioEm, copia?.copiaEm ?? null) ?? agora.toISOString();
    const resumo: ResumoConferenciaVios = {
      copiaEm,
      relatorioEm,
      relatorioTarefas: arquivos.length ? arquivos.reduce((n, a) => n + a.tarefas.length, 0) : null,
      arquivos: arquivos.map((a) => {
        const dias = a.tarefas.map((t) => local(t.inicio).dia).sort();
        return { nome: a.nome, em: a.em, linhas: a.tarefas.length, semCnj: a.tarefas.filter((t) => !t.cnj).length, de: dias[0] ?? null, ate: dias[dias.length - 1] ?? null };
      }),
      semCnj,
      samaEm: copia?.copiaEm ?? null,
      avisos,
      tarefas: tarefas.length,
      conferidas: 0,
      confere: 0,
      horario: 0,
      falta: 0,
      concluida: 0,
      aberta: 0,
      resolvidas: 0,
      soNoVios: soNoVios.length,
    };

    const soData: string[] = [];
    const atualizar: { id: string; campos: Record<string, unknown> }[] = [];
    const resolvidas: { id: string; mudancas: string[] }[] = [];
    for (const aud of auds) {
      if (!tarefaDa.has(aud.id)) continue;
      const t = tarefaDa.get(aud.id) ?? null;
      const vios = { viosTarefaCi: t?.tarefaCi ?? null, viosInicio: t?.inicio ?? null, viosSituacao: t?.status ?? null };
      const resolvida = mudancaResolvidaNoVios(aud, t);
      const estado = estadoNoVios({ ...aud, ...vios, viosConferidoEm: copiaEm }, agora.getTime());
      if (estado) resumo[estado] += 1;
      resumo.conferidas += 1;
      const igual = aud.viosTarefaCi === vios.viosTarefaCi && aud.viosSituacao === vios.viosSituacao && mesmoInstante(aud.viosInicio, vios.viosInicio);
      if (igual && !resolvida) {
        soData.push(aud.id);
        continue;
      }
      const campos: Record<string, unknown> = { vios_tarefa_ci: vios.viosTarefaCi, vios_inicio: vios.viosInicio, vios_situacao: vios.viosSituacao, vios_conferido_em: copiaEm };
      if (resolvida) {
        Object.assign(campos, { mudanca_conferida_em: agora.toISOString(), mudanca_conferida_por: "sistema: conferido no VIOS" });
        resolvidas.push({ id: aud.id, mudancas: aud.mudancas });
      }
      atualizar.push({ id: aud.id, campos });
    }

    for (let i = 0; i < soData.length; i += 200) {
      const { error } = await db().from("aud_audiencias").update({ vios_conferido_em: copiaEm }).in("id", soData.slice(i, i + 200));
      if (error) falhou("gravar a conferência com o VIOS", error);
    }
    for (let i = 0; i < atualizar.length; i += 10) {
      await Promise.all(
        atualizar.slice(i, i + 10).map(async (u) => {
          const { error } = await db().from("aud_audiencias").update(u.campos).eq("id", u.id);
          if (error) falhou("gravar a conferência com o VIOS", error);
        })
      );
    }
    for (const r of resolvidas) await registrarHistorico(r.id, "conferida no VIOS", { para: r.mudancas.join(", "), feitoPor: "conferência automática com o VIOS" });
    resumo.resolvidas = resolvidas.length;

    try {
      resumo.reservas = await sincronizarReservas({ tarefas, tarefaDa, audiencias: auds, relatorioCompleto: Boolean(audienciasCsv), agora });
    } catch (erro) {
      resumo.reservas = null;
      avisos.push(`Audiências só do VIOS e da Vistagem não acertadas: ${erro instanceof Error ? erro.message : String(erro)}`);
    }

    const noTribunal = datasNoTribunal(auds);
    const lista: TarefaSoNoVios[] = soNoVios.slice(0, 300).map((t) => {
      const outras = noTribunal.get(t.cnj);
      return { tarefaCi: t.tarefaCi, ciProcesso: t.ciProcesso, cnj: t.cnj, inicio: t.inicio, tarefa: t.tarefa, responsaveis: t.responsaveis, ...(outras ? { noTribunal: outras } : {}) };
    });
    if (leitura)
      await db()
        .from("aud_leituras")
        .update({
          terminada_em: new Date().toISOString(),
          total: resumo.conferidas,
          alteradas: resumo.horario + resumo.falta + resumo.concluida,
          canceladas: resumo.aberta,
          detalhe: { ...resumo, soNoViosLista: lista },
        })
        .eq("id", leitura.id);
    return resumo;
  } catch (erro) {
    if (leitura) await db().from("aud_leituras").update({ terminada_em: new Date().toISOString(), erro: erro instanceof Error ? erro.message : String(erro) }).eq("id", leitura.id);
    throw erro;
  }
}

/**
 * Para a rotina de 10 em 10 minutos: confere com o VIOS só quando chegou leitura nova do PJe depois da última
 * conferência, ou quando a última tem mais de 6 horas (pega a cópia das 2h e das 12h do SAMA).
 */
export async function conferirComViosSeDevido(agora = new Date()): Promise<ResumoConferenciaVios | "em dia"> {
  const { data, error } = await db()
    .from("aud_leituras")
    .select("fonte, origem, iniciada_em, terminada_em, erro")
    .in("fonte", ["pje", "vios"])
    .order("iniciada_em", { ascending: false })
    .limit(20);
  if (error) falhou("ler as últimas leituras", error);
  const linhas = (data ?? []) as { fonte: string; origem: string | null; iniciada_em: string; terminada_em: string | null; erro: string | null }[];
  const ultimaVios = linhas.find((l) => l.fonte === "vios" && l.origem === ORIGEM_AUTOMATICA);
  const ultimaPje = linhas.find((l) => l.fonte === "pje" && l.terminada_em && !l.erro);
  const devida =
    !ultimaVios ||
    Boolean(ultimaPje?.terminada_em && Date.parse(ultimaPje.terminada_em) > Date.parse(ultimaVios.iniciada_em)) ||
    agora.getTime() - Date.parse(ultimaVios.iniciada_em) > INTERVALO_MAXIMO_MS;
  return devida ? conferirComVios(ORIGEM_AUTOMATICA, agora) : "em dia";
}

/**
 * As audiências "só no VIOS" da última conferência automática, para o robô procurar no Jus.br: o processo não está na
 * Minha Pauta do certificado, e a consulta do processo no PJe pede captcha. `tribunal` ("TRT15") filtra pelo CNJ.
 */
export async function soNoViosParaORobo(tribunal?: string | null): Promise<{ conferidaEm: string | null; audiencias: TarefaSoNoVios[]; acompanhar: string[] }> {
  const { data, error } = await db()
    .from("aud_leituras")
    .select("iniciada_em, detalhe")
    .eq("fonte", "vios")
    .eq("origem", ORIGEM_AUTOMATICA)
    .not("terminada_em", "is", null)
    .is("erro", null)
    .order("iniciada_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) falhou("ler a última conferência com o VIOS", error);
  const lista = ((data?.detalhe as { soNoViosLista?: TarefaSoNoVios[] } | null)?.soNoViosLista ?? []).filter((t) => !tribunal || tribunalDoCnj(t.cnj) === tribunal);
  // Audiências que vieram do Jus.br e seguem designadas: o robô relê o processo para pegar cancelamento ou remarcação.
  const { data: doJusbr, error: erroJusbr } = await db()
    .from("aud_audiencias")
    .select("cnj")
    .eq("origem", "jusbr")
    .eq("situacao", "designada")
    .gte("inicio", new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
    .limit(500);
  if (erroJusbr) falhou("ler as audiências do Jus.br", erroJusbr);
  const acompanhar = [...new Set(((doJusbr ?? []) as { cnj: string }[]).map((l) => l.cnj))].filter((cnj) => !tribunal || tribunalDoCnj(cnj) === tribunal);
  return { conferidaEm: (data?.iniciada_em as string | undefined) ?? null, audiencias: lista, acompanhar };
}
