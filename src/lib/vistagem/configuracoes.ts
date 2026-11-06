import { z } from "zod";
import { ESCRITORIOS, ETIQUETAS_DE_RISCO_PADRAO } from "./triagem";
import { TODAS_AS_AREAS_VISTAGEM, VISTADORES_POR_AREA, listaDeNomes, type AreaDeVistador, type MapaDeVistadores } from "./vistadores";

/**
 * Regras da Vistagem que o admin altera em Vistagem › Configurações. Cada uma tem um padrão no código: sem linha no
 * banco (vistagem_configuracoes), vale o padrão. Quem lê do banco é `configuracoes-server.ts`; aqui ficam o formato,
 * a validação e os padrões, para a tela e o servidor falarem a mesma língua.
 */

export { ETIQUETAS_DE_RISCO_PADRAO };
export const HORA_ARQUIVO_PADRAO = 8;

/** Pessoas de um tipo: lista de nomes (aceita o formato antigo, um nome só ou vazio). */
const pessoas = z.preprocess(
  (valor) => (valor === null || valor === undefined ? [] : typeof valor === "string" ? [valor] : valor),
  z.array(z.string().trim().max(120)).max(40)
);

export const ESQUEMAS = {
  vistadores: z.partialRecord(z.enum([...ESCRITORIOS, TODAS_AS_AREAS_VISTAGEM]), z.object({ normal: pessoas.optional(), risco: pessoas.optional() })),
  etiquetasDeRisco: z.array(z.string().trim().min(2).max(60)).min(1).max(20),
  // O alerta de WhatsApp só é conferido no cron das 9h: depois disso ele nunca dispararia.
  horaArquivoEsperado: z.number().int().min(7).max(9),
  iaSugestaoTarefa: z.boolean(),
  iaSugestaoTriagem: z.boolean(),
} as const;

export type ChaveConfiguracao = keyof typeof ESQUEMAS;
export const CHAVES_CONFIGURACAO = Object.keys(ESQUEMAS) as ChaveConfiguracao[];

export interface ConfiguracoesVistagem {
  vistadores: MapaDeVistadores;
  etiquetasDeRisco: string[];
  horaArquivoEsperado: number;
  /** Sugestão de tarefas da IA (Trabalhista): no cron e ao abrir a publicação. */
  iaSugestaoTarefa: boolean;
  /** Passo da IA na sugestão de pasta das publicações sem pasta (as buscas por número e por parte continuam). */
  iaSugestaoTriagem: boolean;
}

export const CONFIGURACOES_PADRAO: ConfiguracoesVistagem = {
  vistadores: VISTADORES_POR_AREA,
  etiquetasDeRisco: ETIQUETAS_DE_RISCO_PADRAO,
  horaArquivoEsperado: HORA_ARQUIVO_PADRAO,
  iaSugestaoTarefa: true,
  iaSugestaoTriagem: true,
};

/** Valor guardado no banco que passou na validação; inválido ou ausente fica com o padrão. */
export function lerValor<C extends ChaveConfiguracao>(chave: C, valor: unknown): ConfiguracoesVistagem[C] {
  if (valor === undefined || valor === null) return CONFIGURACOES_PADRAO[chave];
  const resultado = ESQUEMAS[chave].safeParse(valor);
  return resultado.success ? (resultado.data as ConfiguracoesVistagem[C]) : CONFIGURACOES_PADRAO[chave];
}

/** Junta as linhas do banco aos padrões. */
export function montarConfiguracoes(linhas: { chave: string; valor: unknown }[]): ConfiguracoesVistagem {
  const porChave = new Map(linhas.map((linha) => [linha.chave, linha.valor]));
  return {
    vistadores: lerValor("vistadores", porChave.get("vistadores")),
    etiquetasDeRisco: lerValor("etiquetasDeRisco", porChave.get("etiquetasDeRisco")),
    horaArquivoEsperado: lerValor("horaArquivoEsperado", porChave.get("horaArquivoEsperado")),
    iaSugestaoTarefa: lerValor("iaSugestaoTarefa", porChave.get("iaSugestaoTarefa")),
    iaSugestaoTriagem: lerValor("iaSugestaoTriagem", porChave.get("iaSugestaoTriagem")),
  };
}

/** Limpa o que a tela mandou antes de gravar: nomes vazios e repetidos saem, etiquetas sem repetir. */
export function normalizarValor<C extends ChaveConfiguracao>(chave: C, valor: unknown): ConfiguracoesVistagem[C] {
  const dados = ESQUEMAS[chave].parse(valor) as ConfiguracoesVistagem[C];
  if (chave === "etiquetasDeRisco") {
    const vistas = new Set<string>();
    return (dados as string[]).filter((etiqueta) => {
      const chaveEtiqueta = etiqueta.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      if (vistas.has(chaveEtiqueta)) return false;
      vistas.add(chaveEtiqueta);
      return true;
    }) as ConfiguracoesVistagem[C];
  }
  if (chave === "vistadores") {
    const limpo: MapaDeVistadores = {};
    for (const [area, quem] of Object.entries(dados as MapaDeVistadores)) {
      const normal = listaDeNomes(quem?.normal);
      const risco = listaDeNomes(quem?.risco);
      if (normal.length || risco.length) limpo[area as AreaDeVistador] = { ...(normal.length ? { normal } : {}), ...(risco.length ? { risco } : {}) };
    }
    return limpo as ConfiguracoesVistagem[C];
  }
  return dados;
}
