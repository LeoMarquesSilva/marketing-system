import "server-only";

import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { COLUNAS_PEDIDO, jaVeioDoEproc, paraPedido, pecasBaixadas, prepararUpload, registrarDocumento } from "./autos-server";
import { lerRepasse } from "./autos-repasse";
import { MOTIVOS_ESPERA, TAMANHO_MAXIMO_AUTOS, type DocumentoAutos, type PedidoAutos } from "./autos-types";
import { completarCapaPeloJusbr } from "./capa-server";
import { ProcessosError } from "./errors";
import { registrarNoHistorico } from "./processos-server";
import { db, falhou } from "./server";
import { ROTULO_SISTEMA, roboPeloJusbr, type SistemaTribunal } from "./tribunais";
import { resumirFila, type LinhaDaFila, type ResumoDaFila } from "./fila-resumo";
import { decidirFila } from "./fila-escolha";

/**
 * O lado do servidor da fila do robô de autos (robos/autos). O robô roda fora da Vercel e fala só com
 * estas rotas, com um token próprio (ROBO_AUTOS_TOKEN): ele não recebe a service role do banco. A
 * credencial do tribunal fica na máquina do robô e nunca passa por aqui.
 */

export function exigirRobo(request: Request): void {
  const esperado = process.env.ROBO_AUTOS_TOKEN?.trim() ?? "";
  if (esperado.length < 24) throw new ProcessosError("O robô de autos não está habilitado neste ambiente (ROBO_AUTOS_TOKEN).", 503);
  const recebido = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const [a, b] = [Buffer.from(recebido), Buffer.from(esperado)];
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new ProcessosError("Não autorizado.", 401);
}

const esquemaProximo = z.object({
  /** Conectores que este robô tem, no formato "sistema:TRIBUNAL" (ex.: "esaj:TJSP"). */
  conectores: z.array(z.string().regex(/^[a-z]+:[A-Z0-9]+$/)).min(1).max(30),
  robo: z.string().trim().min(1).max(80),
});

function validar<T>(esquema: z.ZodType<T>, entrada: unknown): T {
  const lido = esquema.safeParse(entrada);
  if (!lido.success) throw new ProcessosError(lido.error.issues[0]?.message ?? "Dados inválidos.", 400);
  return lido.data;
}

/**
 * O pedido como o robô recebe: com as peças já baixadas (ele traz só as novas) e, no pedido ao Jus.br, a reserva
 * (o conector do tribunal, "eproc:TJSP"), que o robô usa quando o Jus.br não traz os autos.
 */
export type PedidoParaRobo = PedidoAutos & { pecasBaixadas: string[]; reserva: string | null };

/** O conector do tribunal para o pedido ao Jus.br (o mesmo que atenderia o processo sem o Jus.br). */
async function reservaDoPedido(pedido: PedidoAutos): Promise<string | null> {
  if (pedido.sistema !== "jusbr") return null;
  const { data } = await db().from("proc_processos").select("sistema_tribunal").eq("id", pedido.processoId).maybeSingle();
  const robo = roboPeloJusbr(pedido.cnj, (await jaVeioDoEproc(pedido.processoId)) ? "eproc" : ((data?.sistema_tribunal as string | null) ?? null));
  return robo.reserva;
}

/**
 * Entrega ao robô o próximo pedido que ele sabe atender e o marca como "em andamento". Pedido novo vem antes do que
 * já parou esperando uma pessoa; o que parou vezes demais sai da fila como erro (fila-escolha.ts).
 */
export async function proximoPedido(entrada: unknown): Promise<PedidoParaRobo | null> {
  const dados = validar(esquemaProximo, entrada);
  const { data, error } = await db()
    .from("proc_autos_pedidos")
    .select(COLUNAS_PEDIDO)
    .in("status", ["pendente", "em_andamento", "aguardando_pessoa"])
    .order("criado_em", { ascending: true })
    .limit(100);
  if (error) falhou("consultar a fila de autos", error);
  const pedidos = ((data ?? []) as Record<string, unknown>[]).map(paraPedido);
  for (const decisao of decidirFila(pedidos, new Set(dados.conectores), Date.now())) {
    const { pedido } = decisao;
    const marca = new Date().toISOString();
    const patch =
      decisao.tipo === "tirar"
        ? { status: "erro", motivo_espera: null, erro: decisao.mensagem, concluido_em: marca, atualizado_em: marca }
        : { status: "em_andamento", motivo_espera: null, erro: null, robo: dados.robo, tentativas: pedido.tentativas + 1, iniciado_em: marca, atualizado_em: marca };
    // Só muda se ninguém mexeu no pedido desde a leitura (outro robô, a ficha, um sinal de vida).
    const { data: mudado, error: erroMudar } = await db()
      .from("proc_autos_pedidos")
      .update(patch)
      .eq("id", pedido.id)
      .eq("status", pedido.status)
      .eq("atualizado_em", pedido.atualizadoEm)
      .select(COLUNAS_PEDIDO);
    if (erroMudar) falhou(decisao.tipo === "tirar" ? "tirar da fila o pedido parado" : "reservar o pedido", erroMudar);
    if (decisao.tipo === "tirar" || !mudado?.length) continue;
    const reservado = paraPedido(mudado[0] as Record<string, unknown>);
    // Peças já baixadas do processo (eproc: "evento:nome"; e-SAJ: "esaj:texto do documento"): o robô traz só as novas.
    return { ...reservado, pecasBaixadas: await pecasBaixadas(reservado.processoId), reserva: await reservaDoPedido(reservado) };
  }
  return null;
}

/** Capa lida na ficha do Jus.br (sem partes nem documentos): grava a capa e a linha do tempo junto com a entrega. */
const esquemaCapaJusbr = z.object({
  siglaTribunal: z.string().max(20).nullish(),
  nivelSigilo: z.number().int().min(0).max(10).nullish(),
  tramitacoes: z
    .array(
      z.object({
        grau: z.string().max(10).nullish(),
        dataHoraAjuizamento: z.string().max(40).nullish(),
        classe: z.string().max(300).nullish(),
        orgaoJulgador: z.string().max(300).nullish(),
        cidade: z.string().max(120).nullish(),
        movimentos: z
          .array(z.object({ dataHora: z.string().max(40).nullish(), descricao: z.string().max(1000).nullish(), codigo: z.number().int().nullish(), complementos: z.array(z.string().max(300)).max(20).nullish() }))
          .max(5000),
      })
    )
    .max(10),
});

/** Sistemas que podem constar como "quem atendeu" o pedido na entrega. */
const SISTEMAS_DE_ENTREGA = ["eproc", "esaj", "pje", "dcp", "jusbr"] as const;

const esquemaAtualizacao = z.discriminatedUnion("acao", [
  /** O robô parou e espera uma pessoa: login, segundo fator, CAPTCHA ou segredo de justiça sem liberação. */
  z.object({ acao: z.literal("aguardar_pessoa"), motivo: z.enum(MOTIVOS_ESPERA) }),
  /** A pessoa resolveu (ou o robô só está dando sinal de vida): segue em andamento. */
  z.object({ acao: z.literal("seguir") }),
  z.object({ acao: z.literal("erro"), mensagem: z.string().trim().min(1).max(1000) }),
  /**
   * O Jus.br não trouxe os autos e este robô não tem o conector do tribunal: o pedido volta à fila no sistema da
   * reserva ("esaj:TJSP"), para o robô do tribunal. Também o processo que o PJe ou o DCP dizem ter migrado para o
   * eproc, quando este robô não atende o eproc do tribunal (autos-repasse.ts).
   */
  z.object({ acao: z.literal("repassar"), reserva: z.string().trim().regex(/^[a-z]+:[A-Z0-9]+$/, "Reserva inválida.") }),
  z.object({ acao: z.literal("upload"), nome: z.string().trim().min(1).max(200), tamanho: z.number().int().positive().max(TAMANHO_MAXIMO_AUTOS) }),
  z.object({
    acao: z.literal("concluir"),
    path: z.string().trim().min(1).max(500),
    nome: z.string().trim().min(1).max(200),
    /** As peças que vieram neste PDF (eproc: "evento:nome"; e-SAJ e DCP: o rótulo do índice; Jus.br: "jusbr:…"). */
    pecas: z.array(z.string().trim().min(1).max(300)).max(5000).optional(),
    /** Processo grande em partes (Jus.br): os outros PDFs, já enviados, cada um com as suas peças. */
    outrasPartes: z
      .array(z.object({ path: z.string().trim().min(1).max(500), nome: z.string().trim().min(1).max(200), pecas: z.array(z.string().trim().min(1).max(300)).max(5000).optional() }))
      .max(19)
      .optional(),
    /** O pedido acabou atendido por outro sistema: o DCP seguiu pelo eproc, ou o Jus.br pelo robô do tribunal. */
    sistema: z.enum(SISTEMAS_DE_ENTREGA).optional(),
    capa: esquemaCapaJusbr.optional(),
    /** Processo enorme no Jus.br: documentos que ficaram fora deste lote. Vira um pedido novo no fim da fila. */
    restantes: z.number().int().min(1).max(100_000).optional(),
  }),
  /** O robô conferiu os autos e não há peça nova desde o último download. */
  z.object({ acao: z.literal("sem_novidades"), sistema: z.enum(SISTEMAS_DE_ENTREGA).optional(), capa: esquemaCapaJusbr.optional() }),
]);

export type RespostaDoRobo =
  | { pedido: PedidoAutos }
  | { pedido: PedidoAutos; upload: { supabaseUrl: string; anonKey: string; bucket: string; path: string; token: string } }
  | { pedido: PedidoAutos; documento: DocumentoAutos; documentos: DocumentoAutos[] };

async function carregarPedidoDoRobo(pedidoId: string): Promise<PedidoAutos> {
  if (!/^[0-9a-f-]{36}$/i.test(pedidoId)) throw new ProcessosError("Pedido não encontrado.", 404);
  const { data, error } = await db().from("proc_autos_pedidos").select(COLUNAS_PEDIDO).eq("id", pedidoId).maybeSingle();
  if (error) falhou("carregar o pedido", error);
  if (!data) throw new ProcessosError("Pedido não encontrado.", 404);
  return paraPedido(data as Record<string, unknown>);
}

async function mudar(pedido: PedidoAutos, patch: Record<string, unknown>): Promise<PedidoAutos> {
  const { data, error } = await db()
    .from("proc_autos_pedidos")
    .update({ ...patch, atualizado_em: new Date().toISOString() })
    .eq("id", pedido.id)
    .in("status", ["em_andamento", "aguardando_pessoa"])
    .select(COLUNAS_PEDIDO);
  if (error) falhou("atualizar o pedido", error);
  // Cancelado na ficha enquanto o robô trabalhava: ele recebe 409 e abandona o pedido.
  if (!data?.length) throw new ProcessosError("O pedido não está mais com o robô (cancelado ou encerrado).", 409);
  return paraPedido(data[0] as Record<string, unknown>);
}

/**
 * O resto de um processo enorme (o robô entregou um lote e sobraram `restantes` documentos): pedido novo no fim da
 * fila, no mesmo sistema, em nome de quem pediu e com a mesma liberação de segredo. O próximo download pula as peças
 * já entregues. Falha aqui não desfaz a entrega: fica no histórico para alguém pedir de novo.
 */
async function pedirOResto(pedido: PedidoAutos, restantes: number): Promise<void> {
  const { data: origem } = await db()
    .from("proc_autos_pedidos")
    .select("segredo_liberado, segredo_liberado_por, segredo_liberado_por_nome, segredo_liberado_em, pedido_por, pedido_por_nome")
    .eq("id", pedido.id)
    .maybeSingle();
  const { error } = await db()
    .from("proc_autos_pedidos")
    .insert({ processo_id: pedido.processoId, cnj: pedido.cnj, sistema: pedido.sistema, tribunal: pedido.tribunal, ...(origem ?? {}) });
  // 23505: alguém já pediu de novo (há pedido em aberto); esse pedido traz o resto.
  const pedidoOk = !error || (error as { code?: string }).code === "23505";
  if (!pedidoOk) console.error("[robos/autos] pedido do resto:", error?.message);
  await registrarNoHistorico(
    pedido.processoId,
    "autos",
    null,
    pedidoOk
      ? `Processo grande: ${restantes} documentos ficaram para um novo pedido, no fim da fila do robô`
      : `Processo grande: ${restantes} documentos não vieram neste download; peça os autos de novo para trazê-los`,
    { authUserId: (origem?.pedido_por as string | null) as string, nome: (origem?.pedido_por_nome as string | null) ?? null }
  );
}

/** Grava a capa e a linha do tempo lidas no Jus.br. Falha aqui não impede a entrega dos autos. */
async function capaDoJusbr(processoId: string, capa: z.infer<typeof esquemaCapaJusbr>): Promise<void> {
  try {
    await completarCapaPeloJusbr(processoId, { ...capa, tramitacoes: capa.tramitacoes.map((t) => ({ ...t, movimentos: t.movimentos ?? [] })) });
  } catch (erro) {
    console.error("[robos/autos] capa do Jus.br:", erro instanceof Error ? erro.message : erro);
  }
}

/** Tudo o que o robô informa sobre um pedido que está com ele. */
export async function atualizarPedidoDoRobo(pedidoId: string, entrada: unknown): Promise<RespostaDoRobo> {
  const dados = validar(esquemaAtualizacao, entrada);
  const pedido = await carregarPedidoDoRobo(pedidoId);
  if (pedido.status !== "em_andamento" && pedido.status !== "aguardando_pessoa") throw new ProcessosError("O pedido não está mais com o robô (cancelado ou encerrado).", 409);

  switch (dados.acao) {
    case "aguardar_pessoa":
      return { pedido: await mudar(pedido, { status: "aguardando_pessoa", motivo_espera: dados.motivo }) };
    case "seguir":
      // Segredo de justiça só destrava pela ficha (decidirPedido), nunca pelo robô.
      if (pedido.motivoEspera === "segredo_justica") throw new ProcessosError("O pedido espera a liberação de uma pessoa.", 409);
      return { pedido: await mudar(pedido, { status: "em_andamento", motivo_espera: null }) };
    case "erro":
      return { pedido: await mudar(pedido, { status: "erro", motivo_espera: null, erro: dados.mensagem, concluido_em: new Date().toISOString() }) };
    case "repassar": {
      if (pedido.motivoEspera === "segredo_justica") throw new ProcessosError("O pedido espera a liberação de uma pessoa.", 409);
      const destino = lerRepasse(pedido, dados.reserva);
      if ("erro" in destino) throw new ProcessosError(destino.erro, 400);
      return { pedido: await mudar(pedido, { status: "pendente", sistema: destino.sistema, motivo_espera: null, erro: null, robo: null }) };
    }
    case "upload": {
      const upload = await prepararUpload(pedido.processoId, { nome: dados.nome, tamanho: dados.tamanho });
      return {
        pedido: await mudar(pedido, {}),
        upload: { supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", ...upload },
      };
    }
    case "concluir": {
      if (dados.capa) await capaDoJusbr(pedido.processoId, dados.capa);
      const documentos: DocumentoAutos[] = [];
      for (const parte of [{ path: dados.path, nome: dados.nome, pecas: dados.pecas }, ...(dados.outrasPartes ?? [])]) {
        const documento = await registrarDocumento(pedido.processoId, { path: parte.path, nome: parte.nome }, { origem: "robo", pedidoId: pedido.id, robo: pedido.robo });
        if (parte.pecas?.length) {
          const { error } = await db().from("proc_documentos").update({ pecas: parte.pecas }).eq("id", documento.id);
          if (error) falhou("registrar as peças do documento", error);
        }
        documentos.push(documento);
      }
      const concluido = await mudar(pedido, { status: "concluido", motivo_espera: null, erro: null, concluido_em: new Date().toISOString(), ...(dados.sistema ? { sistema: dados.sistema } : {}) });
      // Só depois de concluir: o índice permite um pedido em aberto por processo.
      if (dados.restantes) await pedirOResto(pedido, dados.restantes).catch((erro) => console.error("[robos/autos] pedido do resto:", erro instanceof Error ? erro.message : erro));
      return { pedido: concluido, documento: documentos[0], documentos };
    }
    case "sem_novidades": {
      if (dados.capa) await capaDoJusbr(pedido.processoId, dados.capa);
      const concluido = await mudar(pedido, { status: "concluido", motivo_espera: null, erro: null, concluido_em: new Date().toISOString(), ...(dados.sistema ? { sistema: dados.sistema } : {}) });
      const { data } = await db().from("proc_autos_pedidos").select("pedido_por, pedido_por_nome").eq("id", pedido.id).maybeSingle();
      await registrarNoHistorico(
        pedido.processoId,
        "autos",
        null,
        `Autos conferidos no ${ROTULO_SISTEMA[concluido.sistema as SistemaTribunal] ?? concluido.sistema} (${concluido.tribunal}): nenhuma peça nova desde o último download`,
        { authUserId: (data?.pedido_por as string | null) as string, nome: (data?.pedido_por_nome as string | null) ?? null }
      );
      return { pedido: concluido };
    }
  }
}

/* ------------------------------------------- resumo para o painel de robôs */

const COLUNAS_RESUMO = "status, motivo_espera, sistema, tribunal, cnj, robo, erro, criado_em, atualizado_em, concluido_em";

/** Fila do robô de autos para o painel de robôs: o que está aberto e o que terminou nas últimas 24 h. */
export async function resumoDaFila(agoraMs = Date.now()): Promise<ResumoDaFila> {
  const desde = new Date(agoraMs - 24 * 3600_000).toISOString();
  const [abertos, finais] = await Promise.all([
    db().from("proc_autos_pedidos").select(COLUNAS_RESUMO).in("status", ["pendente", "em_andamento", "aguardando_pessoa"]).order("criado_em").limit(2000),
    db().from("proc_autos_pedidos").select(COLUNAS_RESUMO).in("status", ["concluido", "erro"]).gte("atualizado_em", desde).order("atualizado_em", { ascending: false }).limit(2000),
  ]);
  if (abertos.error) falhou("ler a fila do robô", abertos.error);
  if (finais.error) falhou("ler os pedidos concluídos", finais.error);
  return resumirFila((abertos.data ?? []) as LinhaDaFila[], (finais.data ?? []) as LinhaDaFila[], agoraMs);
}
