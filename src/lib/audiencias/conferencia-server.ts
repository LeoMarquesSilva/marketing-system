import "server-only";

import { local } from "./agenda";
import { audienciaNasIntimacoes, type ComunicacaoDjen } from "./djen";
import { chaveDoLink, horaLocalParaIso } from "./pje";
import { carregarAudiencias, COLUNAS_AUDIENCIA, db, falhou, paraAudiencia, registrarHistorico } from "./server";
import { lerCsvDoVios } from "./vios-csv";

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
  const lidas = lerCsvDoVios(texto);
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
