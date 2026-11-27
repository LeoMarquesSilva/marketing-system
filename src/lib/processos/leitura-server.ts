import "server-only";

import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { openAIKey } from "@/lib/openai-keys";
import { OPENAI_DEFAULT_MODEL, isOpenAIReasoningModel } from "@/lib/openai-models";
import { custoDaChamada } from "@/lib/vistagem/sugestao-ia";
import { carregarAcordos } from "./acordos-dados";
import { sugestoesDosAcordos, type AcordoSugerido } from "./acordos-leitura";
import { carregarDocumento, descartarSeConcluido, pedirContinuacaoNoEproc } from "./autos-server";
import { BUCKET_AUTOS, type SugestaoNova } from "./autos-types";
import { ProcessosError } from "./errors";
import { extrairPaginas, type TextoDoPdf } from "./leitura-pdf";
import { avisoDasRepetidas, impressoesDasPaginas, marcasLidas, paginasParaLer } from "./paginas-repetidas";
import { migracaoParaEproc } from "./migracao-eproc";
import { detalharProcesso } from "./processos-server";
import { comoSugeridos, creditoDosTitulos, sugestoesDaRecCredito, sugestoesDoCreditoPelosTitulos, type ItemSugerido } from "./rec-credito-leitura";
import { itensDoProcesso, tiposDeTitulo } from "./rec-credito-server";
import { lerSistema } from "./tribunais";
import { campoPorChave } from "./campos";
import { ehTrabalhista } from "./trabalhista";
import { ESQUEMA_LEITURA_TRABALHISTA, instrucoesDaLeituraTrabalhista, juntarLeiturasTrabalhistas, sugestoesTrabalhistas, type LeituraDosAutosTrabalhista } from "./trabalhista-leitura";
import { itensTrabalhistasDoProcesso } from "./trabalhista-server";
import { db, falhou } from "./server";
import {
  ESQUEMA_LEITURA,
  ESQUEMA_SINTESE,
  MINIMO_TEXTO_PAGINA,
  criarConferidor,
  dividirEmBlocos,
  entradaDaLeitura,
  entradaDaSintese,
  fatosParaSintese,
  instrucoesDaLeitura,
  instrucoesDaSintese,
  juntarLeituras,
  montarSugestoes,
  separarSintese,
  sugestoesDaSintese,
  type BlocoDeTexto,
  type ContextoDaLeitura,
  type FatoDosAutos,
  type LeituraDosAutos,
  type SinteseDosAutos,
} from "./sugestoes";

/** Autos maiores que isso são lidos só até aqui (o resto fica anotado no documento). */
const MAXIMO_DE_PAGINAS = Number(process.env.PROCESSOS_LEITURA_MAX_PAGINAS) || 800;
/** Blocos lidos ao mesmo tempo. */
const EM_PARALELO = 4;
/**
 * A rota tem 300 s: depois deste tempo não começa bloco novo e fecha com o que já leu. PROCESSOS_LEITURA_PRAZO_MS
 * troca o prazo numa leitura fora da rota (um script que relê autos longos de uma vez).
 */
const PRAZO_MS = Number(process.env.PROCESSOS_LEITURA_PRAZO_MS) || 230_000;
/** A síntese é a última chamada: só começa se ainda couber no tempo da rota. */
const PRAZO_SINTESE_MS = PRAZO_MS + 25_000;
/** Leitura "lendo" há mais que isso é de uma execução que morreu: pode recomeçar. */
const LEITURA_TRAVADA_MS = 6 * 60_000;

export interface ResultadoDaLeitura {
  situacao: "lida" | "sem_texto";
  paginas: number;
  paginasLidas: number;
  sugestoes: number;
  aviso: string | null;
}

type LeituraDoBloco = { tipo: "geral"; leitura: LeituraDosAutos } | { tipo: "trabalhista"; leitura: LeituraDosAutosTrabalhista };

async function lerBloco(apiKey: string, modelo: string, contexto: ContextoDaLeitura, bloco: BlocoDeTexto, total: number, trabalhista: boolean): Promise<{ lido: LeituraDoBloco; entrada: number; cache: number; custoUS: number }> {
  const raciocinio = isOpenAIReasoningModel(modelo);
  const comum = {
    model: createOpenAI({ apiKey })(modelo),
    prompt: entradaDaLeitura(contexto, bloco, total, trabalhista),
    temperature: raciocinio ? undefined : 0,
    providerOptions: {
      // As instruções são iguais em todas as chamadas: a chave ajuda a OpenAI a usar o cache.
      openai: { ...(raciocinio ? { reasoningEffort: "low" as const } : {}), promptCacheKey: trabalhista ? "processos-autos-trabalhista" : "processos-autos", store: false },
    },
  };
  const uso = (usage: { inputTokens?: number; inputTokenDetails?: { cacheReadTokens?: number }; outputTokens?: number }) => {
    const entrada = usage.inputTokens ?? 0;
    const cache = usage.inputTokenDetails?.cacheReadTokens ?? 0;
    return { entrada, cache, custoUS: custoDaChamada({ entrada, cache, saida: usage.outputTokens ?? 0 }) };
  };
  if (trabalhista) {
    // Reclamação trabalhista: campos, afastamentos e pedidos próprios; nada de Rec. Crédito.
    const { object, usage } = await generateObject({ ...comum, schema: ESQUEMA_LEITURA_TRABALHISTA, schemaName: "leitura_dos_autos_trabalhista", system: instrucoesDaLeituraTrabalhista() });
    return { lido: { tipo: "trabalhista", leitura: object }, ...uso(usage) };
  }
  const { object, usage } = await generateObject({ ...comum, schema: ESQUEMA_LEITURA, schemaName: "leitura_dos_autos", system: instrucoesDaLeitura() });
  return { lido: { tipo: "geral", leitura: object }, ...uso(usage) };
}

/**
 * Marcas das páginas já lidas nos outros PDFs do processo. Sem a coluna (migration ainda não aplicada), volta
 * vazio: a leitura segue, só sem pular o que outro PDF já leu.
 */
async function marcasJaLidas(processoId: string, documentoId: string): Promise<Set<string>> {
  const { data, error } = await db().from("proc_documentos").select("paginas_impressoes").eq("processo_id", processoId).neq("id", documentoId);
  if (error) {
    console.warn("[processos] marcas das páginas já lidas:", error.message);
    return new Set();
  }
  return new Set((data ?? []).flatMap((linha) => (linha.paginas_impressoes as string[] | null) ?? []));
}

/** Guarda as marcas das páginas que a IA leu neste PDF. Falhar aqui só faz a próxima leitura ler de novo. */
async function guardarMarcasLidas(documentoId: string, marcas: string[]): Promise<void> {
  const { error } = await db().from("proc_documentos").update({ paginas_impressoes: marcas }).eq("id", documentoId);
  if (error) console.warn("[processos] guardar as marcas das páginas lidas:", error.message);
}

/** Segunda etapa da leitura: com os fatos de todos os pedaços, a IA redige a síntese do processo. */
export async function redigirSintese(
  apiKey: string,
  modelo: string,
  contexto: ContextoDaLeitura,
  fatos: FatoDosAutos[],
  total: number,
  anterior: string | null = null,
  trabalhista = false
): Promise<{ sintese: SinteseDosAutos; custoUS: number }> {
  const raciocinio = isOpenAIReasoningModel(modelo);
  const { object, usage } = await generateObject({
    model: createOpenAI({ apiKey })(modelo),
    schema: ESQUEMA_SINTESE,
    schemaName: "sintese_do_processo",
    system: instrucoesDaSintese(trabalhista),
    prompt: entradaDaSintese(contexto, fatos, total, anterior),
    temperature: raciocinio ? undefined : 0,
    providerOptions: { openai: { ...(raciocinio ? { reasoningEffort: "medium" as const } : {}), promptCacheKey: trabalhista ? "processos-sintese-trabalhista" : "processos-sintese", store: false } },
  });
  return {
    sintese: object,
    custoUS: custoDaChamada({ entrada: usage.inputTokens ?? 0, cache: usage.inputTokenDetails?.cacheReadTokens ?? 0, saida: usage.outputTokens ?? 0 }),
  };
}

/** A parte da síntese escrita pela IA: a do cadastro ou, sem ela, a pendente mais recente de outro documento. */
export async function sinteseAnterior(processoId: string, documentoId: string, doCadastro: unknown): Promise<string | null> {
  const noCadastro = separarSintese(typeof doCadastro === "string" ? doCadastro : null).ia;
  if (noCadastro) return noCadastro;
  const { data, error } = await db()
    .from("proc_sugestoes")
    .select("valor")
    .eq("processo_id", processoId)
    .eq("campo", "sintese")
    .eq("situacao", "pendente")
    .neq("documento_id", documentoId)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) falhou("carregar a síntese anterior", error);
  return separarSintese((data?.valor as { valor?: string } | undefined)?.valor ?? null).ia;
}

/**
 * O que a IA redige com o conjunto dos autos tem uma proposta só por processo: a leitura nova (que já
 * consolida a anterior) tira da fila as pendentes do mesmo campo vindas de outros documentos.
 */
export const CAMPOS_REDIGIDOS = ["sintese", "parecer_risco", "proximos_passos", "objeto", "fase", "ultimo_andamento_texto"] as const;

export async function removerRedigidasPendentes(processoId: string, documentoId: string, campos: string[]): Promise<void> {
  if (!campos.length) return;
  const { error } = await db()
    .from("proc_sugestoes")
    .delete()
    .eq("processo_id", processoId)
    .eq("tipo", "campo")
    .in("campo", campos)
    .eq("situacao", "pendente")
    .neq("documento_id", documentoId);
  if (error) console.error("[processos] tirar as propostas superadas:", error.message);
}

async function encerrar(documentoId: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await db().from("proc_documentos").update(patch).eq("id", documentoId);
  if (error) console.error("[processos] gravar o resultado da leitura:", error.message);
}

/** Sugestões do documento que ninguém decidiu saem (releitura); as novas entram sem repetir proposta já feita. */
async function gravarSugestoes(processoId: string, documentoId: string, sugestoes: SugestaoNova[]): Promise<number> {
  const banco = db();
  const { error: erroLimpeza } = await banco.from("proc_sugestoes").delete().eq("documento_id", documentoId).eq("situacao", "pendente");
  if (erroLimpeza) falhou("limpar as sugestões anteriores", erroLimpeza);
  if (!sugestoes.length) return 0;
  const { data, error } = await banco
    .from("proc_sugestoes")
    .upsert(
      sugestoes.map((item) => ({
        processo_id: processoId,
        documento_id: documentoId,
        tipo: item.tipo,
        campo: item.campo,
        parte_id: item.parteId,
        item: item.item,
        chave: item.chave,
        resumo: item.resumo.slice(0, 500),
        valor: item.valor,
        pagina: item.pagina,
        trecho: item.trecho,
        trecho_conferido: item.trechoConferido,
        confianca: item.confianca,
      })),
      { onConflict: "processo_id,chave", ignoreDuplicates: true }
    )
    .select("id");
  if (error) falhou("gravar as sugestões", error);
  return data?.length ?? 0;
}

/**
 * Lê um PDF dos autos: extrai o texto, pede a leitura à IA bloco a bloco e grava as sugestões como
 * pendentes. Não altera o cadastro: isso só acontece quando alguém aprova a sugestão.
 */
export async function lerDocumento(documentoId: string): Promise<ResultadoDaLeitura> {
  const documento = await carregarDocumento(documentoId);
  if (documento.arquivoRemovidoEm) throw new ProcessosError("O PDF destes autos já foi descartado. Peça de novo ao robô ou anexe o arquivo para uma nova leitura.", 409);
  const apiKey = openAIKey("processos");
  if (!apiKey) throw new ProcessosError("A chave da OpenAI não está configurada: o PDF fica guardado e pode ser lido depois.", 503);

  // Só uma leitura por vez em cada documento.
  const agora = new Date();
  const travadaAntesDe = new Date(agora.getTime() - LEITURA_TRAVADA_MS).toISOString();
  const { data: tomado, error: erroTomar } = await db()
    .from("proc_documentos")
    .update({ leitura_status: "lendo", leitura_iniciada_em: agora.toISOString(), leitura_erro: null })
    .eq("id", documentoId)
    .or(`leitura_status.neq.lendo,leitura_iniciada_em.is.null,leitura_iniciada_em.lt.${travadaAntesDe}`)
    .select("id");
  if (erroTomar) falhou("iniciar a leitura", erroTomar);
  if (!tomado?.length) throw new ProcessosError("Este documento já está sendo lido. Aguarde alguns minutos.", 409);

  const inicio = Date.now();
  try {
    const { data: arquivo, error: erroArquivo } = await db().storage.from(BUCKET_AUTOS).download(documento.caminho);
    if (erroArquivo || !arquivo) throw new ProcessosError("Não foi possível abrir o PDF guardado.", 500);
    let texto: TextoDoPdf;
    try {
      texto = await extrairPaginas(new Uint8Array(await arquivo.arrayBuffer()), MAXIMO_DE_PAGINAS);
    } catch (erro) {
      console.error("[processos] extrair o texto do PDF:", erro instanceof Error ? erro.message : erro);
      throw new ProcessosError("O arquivo não pôde ser lido como PDF (corrompido ou protegido por senha).", 422);
    }
    const semTexto = texto.paginas.filter((pagina) => pagina.trim().length < MINIMO_TEXTO_PAGINA).length;
    // Só vão para a IA as páginas que ela ainda não leu (em outro PDF do processo ou antes, neste mesmo).
    const impressoes = impressoesDasPaginas(texto.paginas);
    const paraLer = paginasParaLer(texto.paginas, impressoes, await marcasJaLidas(documento.processoId, documentoId));
    const avisoDasRepetidasDoPdf = avisoDasRepetidas(paraLer);
    const blocos = dividirEmBlocos(paraLer.paginas);
    if (!blocos.length && paraLer.deOutroPdf + paraLer.noMesmoPdf > 0) {
      // Nada de novo: tudo já foi lido em outro PDF deste processo.
      await encerrar(documentoId, {
        leitura_status: "lida",
        leitura_erro: avisoDasRepetidasDoPdf,
        paginas: texto.total,
        paginas_lidas: 0,
        paginas_sem_texto: semTexto,
        leitura_custo_us: 0,
        lido_em: new Date().toISOString(),
      });
      await descartarSeConcluido(documentoId);
      return { situacao: "lida", paginas: texto.total, paginasLidas: 0, sugestoes: 0, aviso: avisoDasRepetidasDoPdf };
    }
    if (!blocos.length) {
      await encerrar(documentoId, {
        leitura_status: "sem_texto",
        leitura_erro: "O PDF não tem camada de texto (páginas digitalizadas): a IA não consegue ler.",
        paginas: texto.total,
        paginas_lidas: 0,
        paginas_sem_texto: semTexto,
        lido_em: new Date().toISOString(),
      });
      return { situacao: "sem_texto", paginas: texto.total, paginasLidas: 0, sugestoes: 0, aviso: "O PDF não tem camada de texto." };
    }

    const processo = await detalharProcesso(documento.processoId);
    const contexto: ContextoDaLeitura = { valores: processo.valores, partes: processo.partes };
    const modelo = OPENAI_DEFAULT_MODEL;
    const trabalhista = ehTrabalhista(processo.valores.area);
    const leituras: LeituraDoBloco[] = [];
    const blocosLidos: BlocoDeTexto[] = [];
    let tokensDeEntrada = 0;
    let tokensEmCache = 0;
    let custoUS = 0;
    let falhas = 0;
    let paginasLidas = 0;
    let proximo = 0;

    async function trabalhar(): Promise<void> {
      while (proximo < blocos.length && Date.now() - inicio < PRAZO_MS) {
        const bloco = blocos[proximo];
        proximo += 1;
        try {
          const resultado = await lerBloco(apiKey as string, modelo, contexto, bloco, texto.total, trabalhista);
          leituras.push(resultado.lido);
          blocosLidos.push(bloco);
          custoUS += resultado.custoUS;
          tokensDeEntrada += resultado.entrada;
          tokensEmCache += resultado.cache;
          paginasLidas += bloco.paginas;
        } catch (erro) {
          falhas += 1;
          console.error(`[processos] leitura das páginas ${bloco.inicio}-${bloco.fim}:`, erro instanceof Error ? erro.message : erro);
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(EM_PARALELO, blocos.length) }, trabalhar));
    if (!leituras.length) throw new ProcessosError("A IA não respondeu à leitura dos autos. Tente de novo em alguns minutos.", 502);

    const sugestoes: SugestaoNova[] = [];
    let fatosLidos: FatoDosAutos[];
    let lidoDosAcordos: LeituraDosAutos["acordos"];
    if (trabalhista) {
      const leitura = juntarLeiturasTrabalhistas(leituras.flatMap((item) => (item.tipo === "trabalhista" ? [item.leitura] : [])));
      sugestoes.push(...montarSugestoes(leitura, contexto, texto.paginas));
      // Afastamentos pelo INSS e pedidos com o resultado em cada decisão, sem repetir a ficha.
      sugestoes.push(...sugestoesTrabalhistas(leitura.trabalhista, await itensTrabalhistasDoProcesso(documento.processoId), criarConferidor(texto.paginas)));
      fatosLidos = leitura.fatos;
      lidoDosAcordos = leitura.acordos;
    } else {
      const leitura = juntarLeituras(leituras.flatMap((item) => (item.tipo === "geral" ? [item.leitura] : [])));
      sugestoes.push(...montarSugestoes(leitura, contexto, texto.paginas));
      // Rec. Crédito: títulos, citações, pedidos e dinheiro, sem repetir o que a ficha já tem.
      // Os de outros documentos também contam: autos do eproc repetem o histórico do e-SAJ que veio antes.
      const [lancados, tipos, outros] = await Promise.all([
        itensDoProcesso(documento.processoId),
        tiposDeTitulo(),
        db().from("proc_sugestoes").select("valor").eq("processo_id", documento.processoId).eq("tipo", "rec_credito").neq("documento_id", documentoId),
      ]);
      if (outros.error) falhou("carregar as sugestões anteriores", outros.error);
      const jaSugeridos = (outros.data ?? []).map((linha) => linha.valor as ItemSugerido);
      const daRecCredito = sugestoesDaRecCredito(leitura.rec_credito, lancados, tipos, criarConferidor(texto.paginas), jaSugeridos);
      sugestoes.push(...daRecCredito);
      // Com os títulos um a um (lidos agora, já lançados ou sugeridos antes), a descrição do "contrato relacionado
      // ao crédito" só repetiria o mesmo (ex.: "Duplicatas 40123/1 a 40123/5"): não é proposta.
      const temTitulos =
        daRecCredito.some((item) => item.campo === "titulo") || lancados.titulos.length > 0 || jaSugeridos.some((item) => item.item === "titulo");
      if (temTitulos) {
        // Valor original e origem do débito saem dos títulos (soma dos valores de face e vencimento mais antigo),
        // não de um número solto de petição ou planilha de cálculo.
        const PELOS_TITULOS = new Set(["contrato_credito", "valor_original", "data_origem_debito"]);
        for (let i = sugestoes.length - 1; i >= 0; i -= 1) if (sugestoes[i].tipo === "campo" && PELOS_TITULOS.has(sugestoes[i].campo ?? "")) sugestoes.splice(i, 1);
        const credito = creditoDosTitulos([...comoSugeridos(lancados), ...jaSugeridos, ...daRecCredito.map((item) => item.valor as ItemSugerido)]);
        if (credito) sugestoes.push(...sugestoesDoCreditoPelosTitulos(credito, processo.valores));
      }
      fatosLidos = leitura.fatos;
      lidoDosAcordos = leitura.acordos;
    }
    // Acordos, pagamentos de parcela e descumprimento, em qualquer processo, sem repetir a ficha nem outros documentos.
    const [acordosNaFicha, outrosAcordos] = await Promise.all([
      carregarAcordos(documento.processoId),
      db().from("proc_sugestoes").select("valor").eq("processo_id", documento.processoId).eq("tipo", "acordo").neq("documento_id", documentoId),
    ]);
    if (outrosAcordos.error) falhou("carregar as sugestões anteriores de acordo", outrosAcordos.error);
    sugestoes.push(
      ...sugestoesDosAcordos(lidoDosAcordos, acordosNaFicha, criarConferidor(texto.paginas), (outrosAcordos.data ?? []).map((linha) => linha.valor as AcordoSugerido))
    );

    // A síntese do processo, redigida com os fatos de todos os pedaços. Falhar aqui não derruba o resto da leitura.
    const avisos: string[] = [];
    const camposRedigidos = new Set<string>();
    const fatos = fatosParaSintese(fatosLidos);
    if (!fatos.length) {
      avisos.push("A IA não encontrou fatos suficientes nos autos para redigir a síntese.");
    } else if (Date.now() - inicio > PRAZO_SINTESE_MS) {
      avisos.push("Não deu tempo de redigir a síntese nesta leitura. Leia de novo para gerá-la.");
    } else {
      try {
        // Síntese que a IA já escreveu (no cadastro, ou pendente de outro documento): a nova a consolida, para
        // o processo ter uma síntese só.
        const anterior = await sinteseAnterior(documento.processoId, documentoId, processo.valores.sintese);
        const redigida = await redigirSintese(apiKey, modelo, contexto, fatos, texto.total, anterior, trabalhista);
        custoUS += redigida.custoUS;
        const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
        const daSintese = sugestoesDaSintese(redigida.sintese, contexto, documentoId, hoje, Boolean(anterior));
        sugestoes.push(...daSintese);
        for (const item of daSintese) if (item.campo && (CAMPOS_REDIGIDOS as readonly string[]).includes(item.campo)) camposRedigidos.add(item.campo);
      } catch (erro) {
        console.error("[processos] síntese dos autos:", erro instanceof Error ? erro.message : erro);
        avisos.push("A IA não conseguiu redigir a síntese desta vez. Leia de novo para tentar outra vez.");
      }
    }
    // Autos do e-SAJ que terminam na certidão de migração: o processo continua no eproc.
    const migracao = migracaoParaEproc(texto.paginas);
    if (migracao) {
      if (lerSistema(typeof processo.valores.sistema_tribunal === "string" ? processo.valores.sistema_tribunal : null) !== "eproc") {
        const conferido = criarConferidor(texto.paginas).trecho(migracao.pagina, migracao.trecho);
        sugestoes.push({
          tipo: "campo",
          campo: "sistema_tribunal",
          parteId: null,
          item: "sistema_tribunal",
          chave: "campo:sistema_tribunal:eproc",
          resumo: `Sistema do tribunal: E-PROC (o processo migrou do e-SAJ para o eproc${migracao.numero ? `, nº ${migracao.numero}` : ""})`,
          valor: { valor: "E-PROC" },
          pagina: conferido.pagina,
          trecho: migracao.trecho,
          trechoConferido: conferido.conferido,
          confianca: conferido.conferido ? "alta" : "media",
        });
      }
      try {
        const aviso = await pedirContinuacaoNoEproc(documentoId, migracao);
        if (aviso) avisos.push(aviso);
      } catch (erro) {
        console.error("[processos] pedir os autos do eproc:", erro instanceof Error ? erro.message : erro);
        avisos.push(`O processo migrou para o eproc (p. ${migracao.pagina}), mas o pedido dos autos de lá falhou: peça na ficha.`);
      }
    }
    // Processo trabalhista não recebe proposta de campo da Rec. Crédito (próximos passos da carteira, crédito).
    if (trabalhista) {
      for (let i = sugestoes.length - 1; i >= 0; i -= 1) if (sugestoes[i].tipo === "campo" && campoPorChave(sugestoes[i].campo ?? "")?.tabela === "credito") sugestoes.splice(i, 1);
    }
    const gravadas = await gravarSugestoes(documento.processoId, documentoId, sugestoes);
    // Cada campo tem uma proposta só por processo: a desta leitura (síntese e parecer já consolidados com a
    // anterior; valores e datas lidos de novo) tira da fila as pendentes do mesmo campo de outros documentos.
    for (const item of sugestoes) if (item.tipo === "campo" && item.campo) camposRedigidos.add(item.campo);
    await removerRedigidasPendentes(documento.processoId, documentoId, [...camposRedigidos]);

    const naoLidos = blocos.length - leituras.length;
    if (naoLidos > 0) avisos.push(`Leitura parcial: ${naoLidos} de ${blocos.length} trechos ficaram sem ler (${falhas ? "falha da IA" : "tempo esgotado"}). Leia de novo para completar.`);
    if (texto.total > texto.paginas.length) avisos.push(`O arquivo tem ${texto.total} páginas; foram lidas as primeiras ${texto.paginas.length}.`);
    if (avisoDasRepetidasDoPdf) avisos.push(avisoDasRepetidasDoPdf);
    // A parte das instruções que a OpenAI reaproveita do cache (cobrada a 10%): para conferir no log da Vercel.
    console.info(
      `[processos] leitura dos autos: ${blocosLidos.length} trechos, ${paginasLidas} páginas, ${tokensDeEntrada} tokens de entrada (${tokensDeEntrada ? Math.round((100 * tokensEmCache) / tokensDeEntrada) : 0}% em cache), US$ ${custoUS.toFixed(4)}`
    );
    await guardarMarcasLidas(documentoId, marcasLidas(impressoes, blocosLidos));
    if (semTexto > 0) avisos.push(`${semTexto} página${semTexto === 1 ? "" : "s"} sem camada de texto (digitalizada${semTexto === 1 ? "" : "s"}) não ${semTexto === 1 ? "foi lida" : "foram lidas"}.`);
    const aviso = avisos.join(" ") || null;

    await encerrar(documentoId, {
      leitura_status: "lida",
      leitura_erro: aviso,
      paginas: texto.total,
      paginas_lidas: paginasLidas,
      paginas_sem_texto: semTexto,
      leitura_modelo: modelo,
      leitura_custo_us: Math.round(custoUS * 10000) / 10000,
      lido_em: new Date().toISOString(),
    });
    // Nada a conferir neste PDF (nenhuma sugestão pendente): ele já pode sair do armazenamento.
    if (!naoLidos) await descartarSeConcluido(documentoId);
    return { situacao: "lida", paginas: texto.total, paginasLidas, sugestoes: gravadas, aviso };
  } catch (erro) {
    const mensagem = erro instanceof ProcessosError ? erro.message : "A leitura falhou. Tente de novo.";
    if (!(erro instanceof ProcessosError)) console.error("[processos] leitura dos autos:", erro instanceof Error ? erro.message : erro);
    await encerrar(documentoId, { leitura_status: "erro", leitura_erro: mensagem });
    throw erro instanceof ProcessosError ? erro : new ProcessosError(mensagem, 500);
  }
}
