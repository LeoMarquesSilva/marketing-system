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

  async seguir(pedidoId: string): Promise<void> {
    await this.chamar(`/pedidos/${pedidoId}`, { acao: "seguir" });
  }

  async erro(pedidoId: string, mensagem: string): Promise<void> {
    await this.chamar(`/pedidos/${pedidoId}`, { acao: "erro", mensagem: mensagem.slice(0, 900) });
  }

  /** Sobe o PDF ao bucket privado e registra o documento no processo. */
  async entregar(pedidoId: string, arquivo: string, nome: string): Promise<void> {
    const { size } = await stat(arquivo);
    const { upload } = await this.chamar<{ upload: Upload }>(`/pedidos/${pedidoId}`, { acao: "upload", nome, tamanho: size });
    const armazenamento = createClient(upload.supabaseUrl, upload.anonKey, { auth: { persistSession: false } }).storage;
    const { error } = await armazenamento.from(upload.bucket).uploadToSignedUrl(upload.path, upload.token, await openAsBlob(arquivo, { type: "application/pdf" }), { contentType: "application/pdf" });
    if (error) throw new Error(`O envio do PDF ao ORQESTRAI falhou: ${error.message}`);
    await this.chamar(`/pedidos/${pedidoId}`, { acao: "concluir", path: upload.path, nome });
  }
}
