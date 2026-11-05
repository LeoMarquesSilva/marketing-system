import "server-only";

import {
  CONFIGURACOES_PADRAO,
  montarConfiguracoes,
  normalizarValor,
  type ChaveConfiguracao,
  type ConfiguracoesVistagem,
} from "./configuracoes";
import { admin, falhou } from "./server";

/** As regras mudam pouco: cada instância do servidor relê do banco no máximo a cada 60 s. */
const VALIDADE_MS = 60_000;
let guardadas: { valor: ConfiguracoesVistagem; em: number } | null = null;

/** Configurações em vigor (banco + padrões). Falha no banco não para a esteira: vale o padrão do código. */
export async function lerConfiguracoes(): Promise<ConfiguracoesVistagem> {
  if (guardadas && Date.now() - guardadas.em < VALIDADE_MS) return guardadas.valor;
  const { data, error } = await admin().from("vistagem_configuracoes").select("chave, valor");
  if (error) {
    console.error("[vistagem] configurações:", error.message);
    return guardadas?.valor ?? CONFIGURACOES_PADRAO;
  }
  const valor = montarConfiguracoes((data ?? []) as { chave: string; valor: unknown }[]);
  guardadas = { valor, em: Date.now() };
  return valor;
}

export interface AlteracaoDeConfiguracao {
  chave: string;
  valorAnterior: unknown;
  valorNovo: unknown;
  alteradoPor: string | null;
  alteradoEm: string;
}

/** Últimas alterações (de todas as regras), com o nome de quem mudou. */
export async function historicoDeConfiguracoes(limite = 40): Promise<AlteracaoDeConfiguracao[]> {
  const db = admin();
  const { data, error } = await db
    .from("vistagem_configuracoes_historico")
    .select("chave, valor_anterior, valor_novo, alterado_por, alterado_em")
    .order("alterado_em", { ascending: false })
    .limit(limite);
  if (error) falhou("carregar o histórico das configurações", error);
  type Linha = { chave: string; valor_anterior: unknown; valor_novo: unknown; alterado_por: string | null; alterado_em: string };
  const linhas = (data ?? []) as Linha[];
  const ids = [...new Set(linhas.map((linha) => linha.alterado_por).filter(Boolean) as string[])];
  const nomes = new Map<string, string>();
  if (ids.length) {
    const { data: usuarios } = await db.from("users").select("auth_id, name").in("auth_id", ids);
    for (const usuario of (usuarios ?? []) as { auth_id: string; name: string | null }[]) nomes.set(usuario.auth_id, usuario.name ?? "");
  }
  return linhas.map((linha) => ({
    chave: linha.chave,
    valorAnterior: linha.valor_anterior,
    valorNovo: linha.valor_novo,
    alteradoPor: linha.alterado_por ? nomes.get(linha.alterado_por) || null : null,
    alteradoEm: linha.alterado_em,
  }));
}

/** Grava uma regra (validada) e registra no histórico quem mudou, de quê para quê. */
export async function salvarConfiguracao<C extends ChaveConfiguracao>(chave: C, valor: unknown, authUserId: string): Promise<ConfiguracoesVistagem> {
  const novo = normalizarValor(chave, valor);
  const anteriores = await lerConfiguracoes();
  const anterior = anteriores[chave];
  const db = admin();
  const agora = new Date().toISOString();
  const { error } = await db
    .from("vistagem_configuracoes")
    .upsert({ chave, valor: novo, atualizado_por: authUserId, atualizado_em: agora }, { onConflict: "chave" });
  if (error) falhou("salvar a configuração", error);
  const { error: erroHistorico } = await db
    .from("vistagem_configuracoes_historico")
    .insert({ chave, valor_anterior: anterior, valor_novo: novo, alterado_por: authUserId, alterado_em: agora });
  if (erroHistorico) console.error("[vistagem] histórico das configurações:", erroHistorico.message);
  guardadas = null;
  return lerConfiguracoes();
}
