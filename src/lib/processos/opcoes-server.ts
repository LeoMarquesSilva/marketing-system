import "server-only";

import { z } from "zod";
import { CAMPOS, campoPorChave, type ValorCampo } from "./campos";
import { ProcessosError } from "./errors";
import { LISTAS, chaveDaOpcao, definicaoDaLista, normalizar, type Opcao } from "./opcoes";
import { db, falhou, type Ator } from "./server";

/** Cadastros: as opções dos campos de escolha (proc_opcoes). */

const COLUNAS = "id, lista, valor, vios_ci, extra, ativo, origem";

function paraOpcao(linha: Record<string, unknown>): Opcao {
  return {
    id: linha.id as string,
    lista: linha.lista as string,
    valor: linha.valor as string,
    viosCi: (linha.vios_ci as string | null) ?? null,
    extra: (linha.extra as Record<string, unknown> | null) ?? {},
    ativo: linha.ativo === true,
    origem: linha.origem as Opcao["origem"],
  };
}

function exigirLista(lista: string): void {
  if (!definicaoDaLista(lista)) throw new ProcessosError("Lista desconhecida.", 404);
}

/** Todas as opções de uma lista (ativas e desativadas), na ordem. Nas listas por UF, só as da UF pedida. */
export async function opcoesDaLista(lista: string, uf?: string | null): Promise<Opcao[]> {
  exigirLista(lista);
  const opcoes: Opcao[] = [];
  for (let inicio = 0; ; inicio += 1000) {
    let consulta = db().from("proc_opcoes").select(COLUNAS).eq("lista", lista);
    if (uf && definicaoDaLista(lista)?.porUf) consulta = consulta.eq("extra->>uf", uf.toUpperCase());
    const { data, error } = await consulta.order("ordem").order("valor").range(inicio, inicio + 999);
    if (error) falhou("carregar as opções", error);
    opcoes.push(...((data ?? []) as Record<string, unknown>[]).map(paraOpcao));
    if (!data || data.length < 1000) break;
  }
  return opcoes;
}

/** As opções ativas de várias listas de uma vez (para a edição da ficha). */
export async function opcoesParaEdicao(listas: string[], uf?: string | null): Promise<Record<string, Opcao[]>> {
  const unicas = [...new Set(listas)].filter((lista) => definicaoDaLista(lista));
  const resultado: Record<string, Opcao[]> = {};
  await Promise.all(
    unicas.map(async (lista) => {
      resultado[lista] = (await opcoesDaLista(lista, uf)).filter((opcao) => opcao.ativo);
    })
  );
  return resultado;
}

export interface ResumoDaLista {
  chave: string;
  rotulo: string;
  origemVios: string;
  total: number;
  ativas: number;
  manuais: number;
}

export async function resumoDasListas(): Promise<ResumoDaLista[]> {
  const contagem = new Map<string, { total: number; ativas: number; manuais: number }>();
  for (let inicio = 0; ; inicio += 1000) {
    const { data, error } = await db().from("proc_opcoes").select("lista, ativo, origem").range(inicio, inicio + 999);
    if (error) falhou("contar as opções", error);
    for (const linha of data ?? []) {
      const atual = contagem.get(linha.lista as string) ?? { total: 0, ativas: 0, manuais: 0 };
      atual.total += 1;
      if (linha.ativo) atual.ativas += 1;
      if (linha.origem === "manual") atual.manuais += 1;
      contagem.set(linha.lista as string, atual);
    }
    if (!data || data.length < 1000) break;
  }
  return LISTAS.map((lista) => ({ chave: lista.chave, rotulo: lista.rotulo, origemVios: lista.origemVios, ...(contagem.get(lista.chave) ?? { total: 0, ativas: 0, manuais: 0 }) }));
}

const esquemaNova = z.object({
  valor: z.string().trim().min(1, "Informe o nome da opção.").max(300),
  uf: z
    .string()
    .trim()
    .length(2)
    .nullish()
    .transform((valor) => valor?.toUpperCase() ?? null),
});

export async function incluirOpcao(lista: string, entrada: unknown, ator: Ator): Promise<Opcao> {
  exigirLista(lista);
  const lido = esquemaNova.safeParse(entrada);
  if (!lido.success) throw new ProcessosError(lido.error.issues[0]?.message ?? "Opção inválida.", 400);
  const { valor, uf } = lido.data;
  if (definicaoDaLista(lista)?.porUf && !uf) throw new ProcessosError("Informe a UF: nesta lista o mesmo nome existe em estados diferentes.", 400);
  const { data, error } = await db()
    .from("proc_opcoes")
    .insert({ lista, valor, chave: chaveDaOpcao(lista, valor, uf), extra: uf ? { uf } : {}, origem: "manual", criado_por: ator.authUserId, criado_por_nome: ator.nome })
    .select(COLUNAS)
    .single();
  if (error) {
    if ((error as { code?: string }).code === "23505") throw new ProcessosError("Esta opção já existe na lista (talvez desativada).", 409);
    falhou("incluir a opção", error);
  }
  return paraOpcao(data as Record<string, unknown>);
}

const esquemaEdicao = z.object({
  valor: z.string().trim().min(1).max(300).optional(),
  ativo: z.boolean().optional(),
});

/** Corrige o nome ou ativa/desativa. Os processos que já usam o nome antigo continuam com ele. */
export async function editarOpcao(id: string, entrada: unknown): Promise<Opcao> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ProcessosError("Opção não encontrada.", 404);
  const lido = esquemaEdicao.safeParse(entrada);
  if (!lido.success) throw new ProcessosError(lido.error.issues[0]?.message ?? "Edição inválida.", 400);
  const { data: atual, error: erroAtual } = await db().from("proc_opcoes").select(COLUNAS).eq("id", id).maybeSingle();
  if (erroAtual) falhou("carregar a opção", erroAtual);
  if (!atual) throw new ProcessosError("Opção não encontrada.", 404);
  const opcao = paraOpcao(atual as Record<string, unknown>);
  const patch: Record<string, unknown> = {};
  if (lido.data.valor !== undefined && lido.data.valor !== opcao.valor) {
    patch.valor = lido.data.valor;
    patch.chave = chaveDaOpcao(opcao.lista, lido.data.valor, typeof opcao.extra.uf === "string" ? opcao.extra.uf : null);
  }
  if (lido.data.ativo !== undefined) patch.ativo = lido.data.ativo;
  if (!Object.keys(patch).length) return opcao;
  const { data, error } = await db().from("proc_opcoes").update(patch).eq("id", id).select(COLUNAS).single();
  if (error) {
    if ((error as { code?: string }).code === "23505") throw new ProcessosError("Já existe outra opção com este nome na lista.", 409);
    falhou("salvar a opção", error);
  }
  return paraOpcao(data as Record<string, unknown>);
}

/** Campos de escolha (com lista) presentes na entrada. */
const CAMPOS_COM_LISTA = new Map(CAMPOS.filter((item) => item.lista).map((item) => [item.chave, item.lista as string]));

/**
 * Antes de gravar: cada valor de campo de escolha tem de existir, ativo, na lista dele (como no VIOS). Diferença
 * de caixa, acento ou espaço é corrigida para a grafia do cadastro. Devolve a entrada com os valores ajustados.
 */
export async function conferirEscolhas(entrada: Record<string, ValorCampo>): Promise<Record<string, ValorCampo>> {
  const usados = Object.keys(entrada).filter((campo) => CAMPOS_COM_LISTA.has(campo));
  if (!usados.length) return entrada;
  const listas = [...new Set(usados.map((campo) => CAMPOS_COM_LISTA.get(campo) as string))];
  const porLista = new Map<string, Map<string, string>>();
  await Promise.all(
    listas.map(async (lista) => {
      const opcoes = (await opcoesDaLista(lista)).filter((opcao) => opcao.ativo);
      porLista.set(lista, new Map(opcoes.map((opcao) => [normalizar(opcao.valor), opcao.valor])));
    })
  );
  const ajustada: Record<string, ValorCampo> = { ...entrada };
  for (const campo of usados) {
    const lista = CAMPOS_COM_LISTA.get(campo) as string;
    const validas = porLista.get(lista) as Map<string, string>;
    // Lista ainda vazia (cadastro não carregado): não trava a gravação.
    if (!validas.size) continue;
    const item = campoPorChave(campo);
    const canonico = (texto: string) => {
      const achado = validas.get(normalizar(texto));
      if (!achado) throw new ProcessosError(`"${texto}" não está na lista de ${item?.rotulo ?? campo}. Escolha uma opção da lista ou cadastre-a em Cadastros.`, 400);
      return achado;
    };
    const valor = entrada[campo];
    if (valor === null || valor === undefined || valor === "") continue;
    ajustada[campo] = Array.isArray(valor) ? valor.map((texto) => canonico(String(texto))) : canonico(String(valor));
  }
  return ajustada;
}
