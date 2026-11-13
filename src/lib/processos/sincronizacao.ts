import { campoPorChave, textoDoValor, type Valores } from "./campos";

/**
 * Regra da sincronização diária, sem banco: o que fazer com um processo quando chega a versão do VIOS.
 *
 * O VIOS manda nos campos dele, exceto no campo que foi editado aqui e ainda espera a gravação no
 * VIOS (envio em aberto): nesse caso vale o valor do ORQESTRAI. Quando o VIOS passa a trazer o mesmo
 * valor que foi pedido, o envio está confirmado.
 */

export interface MudancaDoVios {
  campo: string;
  anterior: string;
  novo: string;
}

export interface ResultadoMescla {
  /** Colunas a gravar em proc_processos. Vazio = nada mudou. */
  patch: Valores;
  /** Mudanças vindas do VIOS, para o histórico (não há histórico na primeira carga). */
  mudancas: MudancaDoVios[];
  /** Campos cujo envio em aberto o VIOS já reflete. */
  confirmados: string[];
}

// Controle da sincronização: gravam sempre, sem entrar no histórico.
const SEM_HISTORICO = new Set(["vios_editado_em"]);

/**
 * @param atual valores gravados hoje (null na primeira carga)
 * @param importado só os campos que a fonte trouxe; campo ausente não é tocado
 * @param pendentes campo → valor pedido ao VIOS (texto canônico), dos envios em aberto
 */
export function mesclarComVios(atual: Valores | null, importado: Valores, pendentes: Map<string, string>): ResultadoMescla {
  const patch: Valores = {};
  const mudancas: MudancaDoVios[] = [];
  const confirmados: string[] = [];
  for (const [chave, valor] of Object.entries(importado)) {
    const item = campoPorChave(chave);
    const novo = textoDoValor(item, valor);
    const pedido = pendentes.get(chave);
    if (pedido !== undefined) {
      if (pedido === novo) confirmados.push(chave);
      continue;
    }
    if (!atual) {
      patch[chave] = valor;
      continue;
    }
    const anterior = textoDoValor(item, atual[chave]);
    if (anterior === novo) continue;
    patch[chave] = valor;
    if (!SEM_HISTORICO.has(chave)) mudancas.push({ campo: chave, anterior, novo });
  }
  return { patch, mudancas, confirmados };
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Recorte da carga: áreas e grupos que entram. null = todos. */
export interface Recorte {
  areas: string[] | null;
  grupos: string[] | null;
}

function lerLista(valor: string | undefined, padrao: string[]): string[] | null {
  const texto = valor?.trim();
  if (!texto) return padrao;
  if (texto === "*") return null;
  const itens = texto.split(/[;,]/).map((item) => item.trim()).filter(Boolean);
  return itens.length ? itens : padrao;
}

/**
 * PROCESSOS_AREAS e PROCESSOS_GRUPOS (separados por vírgula; "*" = todos). O padrão é o piloto:
 * Recuperação de Crédito, Grupo PST.
 */
export function lerRecorte(env: Record<string, string | undefined> = process.env): Recorte {
  return {
    areas: lerLista(env.PROCESSOS_AREAS, ["Recuperação de Crédito"]),
    grupos: lerLista(env.PROCESSOS_GRUPOS, ["Grupo PST"]),
  };
}

export function estaNoRecorte(valores: Valores, recorte: Recorte): boolean {
  const dentro = (lista: string[] | null, valor: unknown) => lista === null || (typeof valor === "string" && lista.some((item) => normalizar(item) === normalizar(valor)));
  return dentro(recorte.areas, valores.area) && dentro(recorte.grupos, valores.grupo_cliente);
}

/** Mesma parte? Compara polo e nome sem acento, caixa ou espaço sobrando. */
export function chaveDaParte(polo: string, nome: string): string {
  return `${polo}|${normalizar(nome)}`;
}
