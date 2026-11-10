import "server-only";

import { chaveNome, usuarioPorSigla } from "./agendamento";
import {
  aliasDoDataJud,
  capaDoDjen,
  lerCapaDoEsaj,
  lerCnj,
  urlDoEsaj,
  type CapaDoDataJud,
  type CapaDoDjen,
  type CapaDoEsaj,
  type CapaParaAbertura,
  type ComunicacaoDjen,
  type ParDaPasta,
  type StatusDaFonte,
} from "./capa-abertura";
import { VistagemError } from "./errors";
import { buscarPastasVios } from "./pastas-vios";
import { carregarCatalogoProcessos } from "./sama";
import { admin, falhou } from "./server";
import { carregarTodasAsPastas } from "./sioe";
import { escritorioDaAreaDoProcesso, pastaAtiva } from "./triagem";
import type { SugestaoTriagem } from "./sugestao-triagem";

/** Chave pública do DataJud, publicada pelo CNJ em datajud-wiki.cnj.jus.br/api-publica/acesso (pode mudar: DATAJUD_API_KEY). */
const CHAVE_PUBLICA_DATAJUD = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

async function comPrazo<T>(ms: number, tarefa: (sinal: AbortSignal) => Promise<T>): Promise<T> {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), ms);
  try {
    return await tarefa(controle.signal);
  } finally {
    clearTimeout(relogio);
  }
}

const mensagem = (erro: unknown) => (erro instanceof Error ? (erro.name === "AbortError" ? "sem resposta a tempo" : erro.message) : String(erro));

/** Comunicações do processo na API pública do DJEN (até 100, as mais recentes primeiro). */
async function buscarNoDjen(digitos: string): Promise<{ capa: CapaDoDjen | null; status: StatusDaFonte }> {
  const inicio = Date.now();
  try {
    const itens = await comPrazo(15_000, async (signal) => {
      const resposta = await fetch(`https://comunicaapi.pje.jus.br/api/v1/comunicacao?numeroProcesso=${digitos}&itensPorPagina=100`, { signal, cache: "no-store" });
      if (!resposta.ok) throw new Error(`DJEN respondeu ${resposta.status}`);
      return ((await resposta.json()) as { items?: ComunicacaoDjen[] }).items ?? [];
    });
    return { capa: itens.length ? capaDoDjen(itens) : null, status: { ok: itens.length > 0, ms: Date.now() - inicio, erro: itens.length ? null : "nenhuma comunicação" } };
  } catch (erro) {
    return { capa: null, status: { ok: false, ms: Date.now() - inicio, erro: mensagem(erro) } };
  }
}

/** Capa do processo na consulta pública do e-SAJ (só TJSP). */
async function buscarNoEsaj(url: string): Promise<{ capa: CapaDoEsaj | null; status: StatusDaFonte }> {
  const inicio = Date.now();
  try {
    const html = await comPrazo(15_000, async (signal) => {
      const resposta = await fetch(url, { signal, cache: "no-store", headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" } });
      if (!resposta.ok) throw new Error(`e-SAJ respondeu ${resposta.status}`);
      return resposta.text();
    });
    const capa = lerCapaDoEsaj(html);
    return { capa, status: { ok: Boolean(capa), ms: Date.now() - inicio, erro: capa ? null : "processo não encontrado (eproc ou segredo de justiça?)" } };
  } catch (erro) {
    return { capa: null, status: { ok: false, ms: Date.now() - inicio, erro: mensagem(erro) } };
  }
}

/**
 * Par responsável + auxiliar mais comum nas pastas vivas do grupo, na mesma área (regra da skill vios-novas-demandas).
 * O responsável vem do SIOE; o auxiliar, da sigla do "Processos Lista", trocada pelo nome do VIOS.
 */
async function parDasPastasDoGrupo(grupo: string | null, area: string | null): Promise<ParDaPasta | null> {
  if (!grupo || !area) return null;
  const pastas = (await carregarTodasAsPastas()).filter(
    (pasta) => chaveNome(pasta.grupoCliente) === chaveNome(grupo) && escritorioDaAreaDoProcesso(pasta.area) === area && pastaAtiva(pasta)
  );
  if (!pastas.length) return null;
  const [vios, catalogo] = await Promise.all([
    buscarPastasVios(pastas.map((pasta) => pasta.ci)),
    carregarCatalogoProcessos().catch(() => []),
  ]);
  // A mesma pessoa aparece em várias áreas do catálogo: sem repetir, a sigla acha um só usuário.
  const usuarios = [...new Map(catalogo.flatMap((item) => item.usuarios).map((usuario) => [chaveNome(usuario.nome), usuario])).values()];
  const contagem = new Map<string, ParDaPasta>();
  for (const pasta of pastas) {
    const responsavel = pasta.advogadoResponsavel?.trim() || null;
    const sigla = vios.get(pasta.ci)?.auxiliarSigla ?? null;
    const auxiliar = sigla ? usuarioPorSigla(sigla, usuarios)?.nome ?? sigla : null;
    if (!responsavel && !auxiliar) continue;
    const chave = `${chaveNome(responsavel)}|${chaveNome(auxiliar)}`;
    const atual = contagem.get(chave) ?? { responsavel, auxiliar, pastas: 0 };
    atual.pastas++;
    contagem.set(chave, atual);
  }
  return [...contagem.values()].sort((a, b) => b.pastas - a.pastas)[0] ?? null;
}

/** Capa para a abertura de uma publicação (prévia, só leitura): DJEN, e-SAJ, triagem e pastas do grupo. */
export async function capaParaAbertura(id: string): Promise<CapaParaAbertura> {
  const { data, error } = await admin()
    .from("vistagem_publicacoes")
    .select("numero_processo, numero_processo_original, escritorio_responsavel, grupo_cliente, sugestao_triagem")
    .eq("id", id)
    .maybeSingle();
  if (error) falhou("carregar a publicação", error);
  if (!data) throw new VistagemError("Publicação não encontrada.", 404);
  const numero = (data.numero_processo ?? data.numero_processo_original) as string;
  const cnj = lerCnj(numero);
  if (!cnj) throw new VistagemError("Número de processo inválido para buscar a capa.", 422);
  const sugestao = data.sugestao_triagem as SugestaoTriagem | null;
  const area = (data.escritorio_responsavel as string | null) ?? sugestao?.escritorio ?? null;
  const grupo = (data.grupo_cliente as string | null) ?? sugestao?.grupo ?? null;
  const url = urlDoEsaj(cnj);
  const [djen, esaj, par] = await Promise.all([
    buscarNoDjen(cnj.digitos),
    url ? buscarNoEsaj(url) : Promise.resolve(null),
    parDasPastasDoGrupo(grupo, area).catch((erro: unknown) => {
      console.error("[vistagem] par das pastas do grupo", mensagem(erro));
      return null;
    }),
  ]);
  return {
    dados: {
      numero,
      djen: djen.capa,
      esaj: esaj?.capa ?? null,
      datajud: null,
      area,
      grupo,
      cliente: sugestao?.cliente ?? sugestao?.referencia?.cliente ?? null,
      par,
    },
    fontes: { djen: djen.status, esaj: esaj?.status ?? null },
    geradaEm: new Date().toISOString(),
  };
}

type FonteDataJud = {
  sistema?: { nome?: string } | null;
  dataAjuizamento?: string | null;
  classe?: { nome?: string } | null;
  grau?: string | null;
  assuntos?: ({ nome?: string } | { nome?: string }[])[] | null;
};

/** O processo no DataJud (complemento: sistema, ajuizamento e assuntos). Falha e demora não travam nada. */
export async function capaNoDataJud(numero: string): Promise<CapaDoDataJud & { ms: number }> {
  const cnj = lerCnj(numero);
  const alias = aliasDoDataJud(cnj);
  const inicio = Date.now();
  const vazio = { achou: false, sistema: null, ajuizamento: null, assuntos: [], classe: null };
  if (!cnj || !alias) return { ...vazio, erro: "tribunal fora do DataJud", ms: 0 };
  try {
    const graus = await comPrazo(75_000, async (signal) => {
      const resposta = await fetch(`https://api-publica.datajud.cnj.jus.br/api_publica_${alias}/_search`, {
        method: "POST",
        signal,
        cache: "no-store",
        headers: { Authorization: `APIKey ${process.env.DATAJUD_API_KEY?.trim() || CHAVE_PUBLICA_DATAJUD}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: { match: { numeroProcesso: cnj.digitos } }, size: 5, _source: { excludes: ["movimentos"] } }),
      });
      if (resposta.status === 429) throw new Error("DataJud sobrecarregado (429)");
      if (!resposta.ok) throw new Error(`DataJud respondeu ${resposta.status}`);
      const corpo = (await resposta.json()) as { hits?: { hits?: { _source: FonteDataJud }[] } };
      return (corpo.hits?.hits ?? []).map((hit) => hit._source);
    });
    const g = graus.find((item) => item.grau === "G1") ?? graus[0];
    if (!g) return { ...vazio, erro: "processo ainda não está no DataJud", ms: Date.now() - inicio };
    return {
      achou: true,
      erro: null,
      sistema: g.sistema?.nome ?? null,
      ajuizamento: g.dataAjuizamento ?? null,
      classe: g.classe?.nome ?? null,
      assuntos: (g.assuntos ?? []).flat().map((assunto) => assunto?.nome?.trim()).filter((nome): nome is string => Boolean(nome)),
      ms: Date.now() - inicio,
    };
  } catch (erro) {
    return { ...vazio, erro: mensagem(erro), ms: Date.now() - inicio };
  }
}

/** Número do processo da publicação (para a rota do DataJud). */
export async function numeroDaPublicacao(id: string): Promise<string> {
  const { data, error } = await admin().from("vistagem_publicacoes").select("numero_processo, numero_processo_original").eq("id", id).maybeSingle();
  if (error) falhou("carregar a publicação", error);
  if (!data) throw new VistagemError("Publicação não encontrada.", 404);
  return (data.numero_processo ?? data.numero_processo_original) as string;
}
