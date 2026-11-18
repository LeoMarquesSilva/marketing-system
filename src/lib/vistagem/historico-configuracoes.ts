import { TIPOS_DE_DEMANDA, listaDeNomes, vistadoresDa, type MapaDeVistadores, type TipoDeDemanda } from "./vistadores";

/**
 * O que mudou numa alteração das Configurações da Vistagem, para o histórico mostrar só a diferença (quem entrou,
 * quem saiu, quem trocou de tipo) em vez do valor inteiro de antes e de depois.
 */
export type Diferenca =
  | { tipo: "pessoa"; area: string; demanda: TipoDeDemanda; nome: string; acao: "entrou" | "saiu" }
  | { tipo: "moveu"; area: string; nome: string; de: TipoDeDemanda; para: TipoDeDemanda }
  | { tipo: "etiqueta"; etiqueta: string; acao: "entrou" | "saiu" }
  | { tipo: "valor"; antes: string; depois: string };

const chave = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

function diferencaDeVistadores(antes: MapaDeVistadores, depois: MapaDeVistadores): Diferenca[] {
  const areas = [...new Set([...Object.keys(antes ?? {}), ...Object.keys(depois ?? {})])];
  const diferencas: Diferenca[] = [];
  for (const area of areas) {
    // Tipos de cada pessoa antes e depois (a mesma pessoa pode estar nos dois tipos).
    const tipos = (mapa: MapaDeVistadores) => {
      const porPessoa = new Map<string, { nome: string; tipos: Set<TipoDeDemanda> }>();
      for (const demanda of TIPOS_DE_DEMANDA) {
        for (const nome of vistadoresDa(area, demanda, mapa ?? {})) {
          const atual = porPessoa.get(chave(nome)) ?? { nome, tipos: new Set<TipoDeDemanda>() };
          atual.tipos.add(demanda);
          porPessoa.set(chave(nome), atual);
        }
      }
      return porPessoa;
    };
    const eram = tipos(antes);
    const ficaram = tipos(depois);
    const pessoas = [...new Set([...eram.keys(), ...ficaram.keys()])];
    for (const pessoa of pessoas) {
      const nome = ficaram.get(pessoa)?.nome ?? eram.get(pessoa)?.nome ?? pessoa;
      const de = eram.get(pessoa)?.tipos ?? new Set<TipoDeDemanda>();
      const para = ficaram.get(pessoa)?.tipos ?? new Set<TipoDeDemanda>();
      const saiu = TIPOS_DE_DEMANDA.filter((demanda) => de.has(demanda) && !para.has(demanda));
      const entrou = TIPOS_DE_DEMANDA.filter((demanda) => para.has(demanda) && !de.has(demanda));
      if (saiu.length === 1 && entrou.length === 1 && de.size === 1 && para.size === 1) {
        diferencas.push({ tipo: "moveu", area, nome, de: saiu[0], para: entrou[0] });
        continue;
      }
      for (const demanda of saiu) diferencas.push({ tipo: "pessoa", area, demanda, nome, acao: "saiu" });
      for (const demanda of entrou) diferencas.push({ tipo: "pessoa", area, demanda, nome, acao: "entrou" });
    }
  }
  return diferencas;
}

function diferencaDeEtiquetas(antes: unknown, depois: unknown): Diferenca[] {
  const eram = listaDeNomes(antes);
  const ficaram = listaDeNomes(depois);
  const tem = (lista: string[], etiqueta: string) => lista.some((item) => chave(item) === chave(etiqueta));
  return [
    ...eram.filter((etiqueta) => !tem(ficaram, etiqueta)).map((etiqueta): Diferenca => ({ tipo: "etiqueta", etiqueta, acao: "saiu" })),
    ...ficaram.filter((etiqueta) => !tem(eram, etiqueta)).map((etiqueta): Diferenca => ({ tipo: "etiqueta", etiqueta, acao: "entrou" })),
  ];
}

function emTexto(chaveDaRegra: string, valor: unknown): string {
  if (valor === null || valor === undefined) return "padrão";
  if (chaveDaRegra === "horaArquivoEsperado") return `${valor}h`;
  if (typeof valor === "boolean") return valor ? "Ligada" : "Desligada";
  return String(valor);
}

/** Diferenças de uma alteração; lista vazia quando a pessoa salvou sem mudar nada. */
export function diferencasDaAlteracao(chaveDaRegra: string, antes: unknown, depois: unknown): Diferenca[] {
  if (chaveDaRegra === "vistadores") return diferencaDeVistadores((antes ?? {}) as MapaDeVistadores, (depois ?? {}) as MapaDeVistadores);
  if (chaveDaRegra === "etiquetasDeRisco") return diferencaDeEtiquetas(antes, depois);
  const de = emTexto(chaveDaRegra, antes);
  const para = emTexto(chaveDaRegra, depois);
  return de === para ? [] : [{ tipo: "valor", antes: de, depois: para }];
}

/** Diferenças de vistadores agrupadas por área, na ordem em que aparecem. */
export function porArea(diferencas: Diferenca[]): { area: string; itens: Diferenca[] }[] {
  const grupos = new Map<string, Diferenca[]>();
  for (const diferenca of diferencas) {
    if (diferenca.tipo !== "pessoa" && diferenca.tipo !== "moveu") continue;
    grupos.set(diferenca.area, [...(grupos.get(diferenca.area) ?? []), diferenca]);
  }
  return [...grupos.entries()].map(([area, itens]) => ({ area, itens }));
}
