import { openAsBlob } from "node:fs";
import { stat } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import type { Config } from "./config.ts";

/**
 * A fila de pedidos, pelo lado do robô. Ele fala só com as rotas /api/robos/autos do ORQESTRAI, com o
 * token próprio: não tem a chave do banco. O PDF sobe direto ao bucket privado por URL assinada.
 */

export type MotivoEspera = "login" | "segundo_fator" | "captcha" | "segredo_justica";

export interface Pedido {
  id: string;
  processoId: string;
  cnj: string;
  sistema: string;
  tribunal: string;
  status: string;
  segredoLiberado: boolean;
  tentativas: number;
  /** eproc: peças ("evento:nome") já baixadas em pedidos anteriores do processo. */
  pecasBaixadas?: string[];
  /** Pedido ao Jus.br: o conector do tribunal ("eproc:TJSP") para quando o Jus.br não trouxer os autos. */
  reserva?: string | null;
}

/** O pedido saiu das mãos do robô (cancelado na ficha, por exemplo): ele larga o que estava fazendo. */
export class PedidoEncerrado extends Error {}

interface Upload {
  supabaseUrl: string;
  anonKey: string;
  bucket: string;
  path: string;
  token: string;
}

export class Fila {
  constructor(private readonly config: Config) {}

  private async chamar<T>(caminho: string, corpo: unknown): Promise<T> {
    const resposta = await fetch(`${this.config.orqestraiUrl}/api/robos/autos${caminho}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const dados = (await resposta.json().catch(() => null)) as (T & { error?: string }) | null;
    if (resposta.status === 409) throw new PedidoEncerrado(dados?.error ?? "O pedido não está mais com o robô.");
    if (!resposta.ok || !dados) throw new Error(`ORQESTRAI respondeu ${resposta.status}: ${dados?.error ?? "sem detalhe"}`);
    return dados;
  }

  /** O pedido mais antigo que algum conector deste robô atende, já reservado; nulo com a fila vazia. */
  async proximo(conectores: string[]): Promise<Pedido | null> {
    return (await this.chamar<{ pedido: Pedido | null }>("/proximo", { conectores, robo: this.config.nome })).pedido;
  }

  async aguardarPessoa(pedidoId: string, motivo: MotivoEspera): Promise<void> {
    await this.chamar(`/pedidos/${pedidoId}`, { acao: "aguardar_pessoa", motivo });
  }

  /**
   * Com a fila de autos vazia: pede ao ORQESTRAI a capa do próximo processo no DataJud (uma consulta por
   * chamada, que pode levar até um minuto). As sugestões ficam na ficha para aprovação.
   */
  async proximaCapa(): Promise<{ nada: boolean; recusado: boolean; achou: boolean; sugestoes: number; restantes: number }> {
    const resposta = await fetch(`${this.config.orqestraiUrl}/api/robos/autos/capa`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.token}` },
      signal: AbortSignal.timeout(130_000),
    });
    const dados = (await resposta.json().catch(() => null)) as ({ nada: boolean; recusado: boolean; achou: boolean; sugestoes: number; restantes: number } & { error?: string }) | null;
    if (!resposta.ok || !dados) throw new Error(`ORQESTRAI respondeu ${resposta.status}: ${dados?.error ?? "sem detalhe"}`);
    return dados;
  }

  async seguir(pedidoId: string): Promise<void> {
    await this.chamar(`/pedidos/${pedidoId}`, { acao: "seguir" });
  }

  /**
   * O Jus.br não trouxe os autos e este robô não tem o conector da reserva: o pedido volta à fila no sistema do
   * tribunal (`reserva`, ex.: "esaj:TJSP"), para o robô do tribunal.
   */
  async repassar(pedidoId: string, reserva: string): Promise<void> {
    await this.chamar(`/pedidos/${pedidoId}`, { acao: "repassar", reserva });
  }

  async erro(pedidoId: string, mensagem: string): Promise<void> {
    await this.chamar(`/pedidos/${pedidoId}`, { acao: "erro", mensagem: mensagem.slice(0, 900) });
  }

  /** Sobe um PDF ao bucket privado. Devolve o caminho dele no armazenamento. */
  private async subir(pedidoId: string, arquivo: string, nome: string): Promise<string> {
    const { size } = await stat(arquivo);
    const { upload } = await this.chamar<{ upload: Upload }>(`/pedidos/${pedidoId}`, { acao: "upload", nome, tamanho: size });
    const armazenamento = createClient(upload.supabaseUrl, upload.anonKey, { auth: { persistSession: false } }).storage;
    const { error } = await armazenamento.from(upload.bucket).uploadToSignedUrl(upload.path, upload.token, await openAsBlob(arquivo, { type: "application/pdf" }), { contentType: "application/pdf" });
    if (error) throw new Error(`O envio do PDF ao ORQESTRAI falhou: ${error.message}`);
    return upload.path;
  }

  /**
   * Sobe o PDF (ou as partes, num processo grande) e registra os documentos no processo. `sistema`: quem acabou
   * atendendo o pedido, quando não foi o sistema pedido (DCP que seguiu pelo eproc, Jus.br que seguiu pelo tribunal).
   */
  async entregar(pedidoId: string, arquivo: string, nome: string, pecas?: string[], sistema?: string, partes?: { caminho: string; pecas: string[] }[], capa?: unknown): Promise<void> {
    if (partes && partes.length > 1) {
      const enviadas: { path: string; nome: string; pecas: string[] }[] = [];
      for (const [i, parte] of partes.entries()) {
        const nomeDaParte = nome.replace(/\.pdf$/i, ` (parte ${i + 1} de ${partes.length}).pdf`);
        enviadas.push({ path: await this.subir(pedidoId, parte.caminho, nomeDaParte), nome: nomeDaParte, pecas: parte.pecas });
      }
      const [primeira, ...outras] = enviadas;
      await this.chamar(`/pedidos/${pedidoId}`, {
        acao: "concluir",
        path: primeira.path,
        nome: primeira.nome,
        ...(primeira.pecas.length ? { pecas: primeira.pecas } : {}),
        outrasPartes: outras.map((parte) => ({ path: parte.path, nome: parte.nome, ...(parte.pecas.length ? { pecas: parte.pecas } : {}) })),
        ...(sistema ? { sistema } : {}),
        ...(capa ? { capa } : {}),
      });
      return;
    }
    const path = await this.subir(pedidoId, arquivo, nome);
    await this.chamar(`/pedidos/${pedidoId}`, { acao: "concluir", path, nome, ...(pecas?.length ? { pecas } : {}), ...(sistema ? { sistema } : {}), ...(capa ? { capa } : {}) });
  }

  /** Os autos foram conferidos e não há peça nova: o pedido termina sem PDF. */
  async semNovidades(pedidoId: string, sistema?: string, capa?: unknown): Promise<void> {
    await this.chamar(`/pedidos/${pedidoId}`, { acao: "sem_novidades", ...(sistema ? { sistema } : {}), ...(capa ? { capa } : {}) });
  }
}
