import { ESCRITORIOS } from "./triagem";
import {
  TIPOS_DE_DEMANDA,
  TODAS_AS_AREAS_VISTAGEM,
  listaDeNomes,
  vistadoresDa,
  type AreaDeVistador,
  type MapaDeVistadores,
  type TipoDeDemanda,
} from "./vistadores";

/**
 * Importação dos vistadores da lista USUARIOS do SharePoint (site BISMARCHIPIRES). Na lista: Nome, Email, Área,
 * "RESP. POR VISTAGEM DE PUBLI" (sim/não), GESTOR e GERENTE. Entra só quem é responsável pela vistagem; GERENTE = SIM
 * vai para as demandas de risco, o resto para as normais. Quem já está cadastrado na área fica com o tipo que o
 * admin escolheu (a lista não desfaz um ajuste feito no sistema).
 */

export interface LinhaDaListaUsuarios {
  nome: string;
  email: string | null;
  area: string | null;
  responsavel: boolean;
  gerente: string | null;
}

export interface VistadorImportado {
  area: AreaDeVistador;
  tipo: TipoDeDemanda;
  nome: string;
}

export interface ResultadoDaImportacao {
  /** Mapa em vigor + quem veio de novo da lista (sem tirar ninguém). */
  mapa: MapaDeVistadores;
  /** Quem entrou agora. */
  novos: VistadorImportado[];
  /** Linhas de responsável que não deu para usar (área que o sistema não conhece). */
  ignorados: { nome: string; motivo: string }[];
  /** Responsáveis pela vistagem na lista. */
  responsaveis: number;
}

const normalizar = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** Área da lista → área do sistema. "Special Situations" é Distressed Deals; "TODAS" vista qualquer área. */
const AREA_DA_LISTA = new Map<string, AreaDeVistador>([
  ...ESCRITORIOS.map((area) => [normalizar(area), area] as const),
  ["special situations", "Distressed Deals"],
  ["distressed deals - special situations", "Distressed Deals"],
  ["todas", TODAS_AS_AREAS_VISTAGEM],
  ["todas as areas", TODAS_AS_AREAS_VISTAGEM],
]);

export function areaDaLista(texto: string | null | undefined): AreaDeVistador | null {
  return texto ? (AREA_DA_LISTA.get(normalizar(texto)) ?? null) : null;
}

/** GERENTE = SIM: vista as demandas de risco. */
export function tipoDaLinha(linha: Pick<LinhaDaListaUsuarios, "gerente">): TipoDeDemanda {
  return normalizar(linha.gerente ?? "") === "sim" ? "risco" : "normal";
}

/**
 * Junta a lista ao mapa em vigor. `nomeCompleto` troca o nome da lista (às vezes só o primeiro nome) pelo do RH,
 * achado pelo e-mail.
 */
export function importarVistadores(
  linhas: LinhaDaListaUsuarios[],
  atual: MapaDeVistadores,
  nomeCompleto: (linha: LinhaDaListaUsuarios) => string = (linha) => linha.nome.trim()
): ResultadoDaImportacao {
  const mapa: Record<string, Record<TipoDeDemanda, string[]>> = {};
  for (const [area, quem] of Object.entries(atual)) {
    mapa[area] = { normal: vistadoresDa(area, "normal", atual), risco: vistadoresDa(area, "risco", atual) };
    if (!quem) delete mapa[area];
  }
  const chave = (nome: string) => normalizar(nome);
  const novos: VistadorImportado[] = [];
  const ignorados: ResultadoDaImportacao["ignorados"] = [];
  const responsaveis = linhas.filter((linha) => linha.responsavel);

  for (const linha of responsaveis) {
    const nome = nomeCompleto(linha).trim();
    if (!nome) continue;
    const area = areaDaLista(linha.area);
    if (!area) {
      ignorados.push({ nome, motivo: `área "${linha.area ?? "vazia"}" não existe no sistema` });
      continue;
    }
    const daArea = (mapa[area] ??= { normal: [], risco: [] });
    const jaEsta = TIPOS_DE_DEMANDA.some((tipo) => daArea[tipo].some((pessoa) => chave(pessoa) === chave(nome)));
    if (jaEsta) continue;
    const tipo = tipoDaLinha(linha);
    daArea[tipo] = listaDeNomes([...daArea[tipo], nome]);
    novos.push({ area, tipo, nome });
  }

  const final: MapaDeVistadores = {};
  for (const [area, quem] of Object.entries(mapa)) {
    const normal = listaDeNomes(quem.normal);
    const risco = listaDeNomes(quem.risco);
    if (normal.length || risco.length) final[area as AreaDeVistador] = { ...(normal.length ? { normal } : {}), ...(risco.length ? { risco } : {}) };
  }
  return { mapa: final, novos, ignorados, responsaveis: responsaveis.length };
}
