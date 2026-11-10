import "server-only";

import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { COLUNAS_PEDIDO, paraPedido, prepararUpload, registrarDocumento } from "./autos-server";
import { MOTIVOS_ESPERA, TAMANHO_MAXIMO_AUTOS, type DocumentoAutos, type PedidoAutos } from "./autos-types";
import { ProcessosError } from "./errors";
import { db, falhou } from "./server";

/**
 * O lado do servidor da fila do robô de autos (robos/autos). O robô roda fora da Vercel e fala só com
 * estas rotas, com um token próprio (ROBO_AUTOS_TOKEN): ele não recebe a service role do banco. A
 * credencial do tribunal fica na máquina do robô e nunca passa por aqui.
 */

/** Pedido "em andamento" sem notícia do robô há este tempo volta para a fila. */
const PEDIDO_PARADO_MS = 20 * 60_000;
/** Enquanto espera a pessoa (login, segundo fator, CAPTCHA), o robô dá sinal a cada minuto; sem sinal, o pedido volta a ser oferecido. */
const ESPERA_PARADA_MS = 3 * 60_000;

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

/** Entrega ao robô o pedido mais antigo que ele sabe atender e o marca como "em andamento". */
export async function proximoPedido(entrada: unknown): Promise<PedidoAutos | null> {
  const dados = validar(esquemaProximo, entrada);
  const aceitos = new Set(dados.conectores);
  const { data, error } = await db()
    .from("proc_autos_pedidos")
    .select(COLUNAS_PEDIDO)
    .in("status", ["pendente", "em_andamento", "aguardando_pessoa"])
    .order("criado_em", { ascending: true })
    .limit(100);
  if (error) falhou("consultar a fila de autos", error);
  const agora = Date.now();
  for (const linha of (data ?? []) as Record<string, unknown>[]) {
    const pedido = paraPedido(linha);
    if (!aceitos.has(`${pedido.sistema}:${pedido.tribunal}`)) continue;
    const parado = agora - new Date(pedido.atualizadoEm).getTime();
    const livre =
      pedido.status === "pendente" ||
      (pedido.status === "em_andamento" && parado > PEDIDO_PARADO_MS) ||
      // Segredo de justiça sem liberação não volta para o robô: espera a decisão de uma pessoa na ficha.
      (pedido.status === "aguardando_pessoa" && pedido.motivoEspera !== "segredo_justica" && parado > ESPERA_PARADA_MS);
    if (!livre) continue;
    const marca = new Date().toISOString();
    const { data: tomado, error: erroTomar } = await db()
      .from("proc_autos_pedidos")
      .update({ status: "em_andamento", motivo_espera: null, erro: null, robo: dados.robo, tentativas: pedido.tentativas + 1, iniciado_em: marca, atualizado_em: marca })
      .eq("id", pedido.id)
      .eq("status", pedido.status)
      .eq("atualizado_em", pedido.atualizadoEm)
      .select(COLUNAS_PEDIDO);
    if (erroTomar) falhou("reservar o pedido", erroTomar);
    if (tomado?.length) return paraPedido(tomado[0] as Record<string, unknown>);
  }
  return null;
}

const esquemaAtualizacao = z.discriminatedUnion("acao", [
  /** O robô parou e espera uma pessoa: login, segundo fator, CAPTCHA ou segredo de justiça sem liberação. */
  z.object({ acao: z.literal("aguardar_pessoa"), motivo: z.enum(MOTIVOS_ESPERA) }),
  /** A pessoa resolveu (ou o robô só está dando sinal de vida): segue em andamento. */
  z.object({ acao: z.literal("seguir") }),
  z.object({ acao: z.literal("erro"), mensagem: z.string().trim().min(1).max(1000) }),
  z.object({ acao: z.literal("upload"), nome: z.string().trim().min(1).max(200), tamanho: z.number().int().positive().max(TAMANHO_MAXIMO_AUTOS) }),
  z.object({ acao: z.literal("concluir"), path: z.string().trim().min(1).max(500), nome: z.string().trim().min(1).max(200) }),
]);

export type RespostaDoRobo =
  | { pedido: PedidoAutos }
  | { pedido: PedidoAutos; upload: { supabaseUrl: string; anonKey: string; bucket: string; path: string; token: string } }
  | { pedido: PedidoAutos; documento: DocumentoAutos };

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
    case "upload": {
      const upload = await prepararUpload(pedido.processoId, { nome: dados.nome, tamanho: dados.tamanho });
      return {
        pedido: await mudar(pedido, {}),
        upload: { supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", ...upload },
      };
    }
    case "concluir": {
      const documento = await registrarDocumento(pedido.processoId, { path: dados.path, nome: dados.nome }, { origem: "robo", pedidoId: pedido.id, robo: pedido.robo });
      return { pedido: await mudar(pedido, { status: "concluido", motivo_espera: null, erro: null, concluido_em: new Date().toISOString() }), documento };
    }
  }
}
