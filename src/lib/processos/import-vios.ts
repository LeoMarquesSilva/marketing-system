import { parse } from "csv-parse/sync";
import { CAMPOS, lerNumeroBr, type CampoProcesso, type Valores } from "./campos";
import type { ParteImportada, PoloParte, RegistroImportado } from "./types";

/**
 * Leitura do "Processos Lista" do VIOS (CSV com `;`, windows-1252 já decodificado) e das linhas de
 * processos_completo do SIOE. Só transforma texto em registro: quem grava é a sincronização.
 *
 * Particularidades do CSV conferidas no export de 10/11/2026:
 * - CI e órgão julgador vêm como `="41835"` (truque do Excel);
 * - as duas últimas linhas são "Média:" e "Total: N", sem CI;
 * - "Número" junta os números sem separador: `CNJ: 0000000-00.0000.0.00.0000Outros: 123`;
 * - as partes vêm como `Tipo: NomeTipo: Nome`, também sem separador;
 * - "Etiquetas" junta as etiquetas com um espaço, por isso precisa do catálogo para separar.
 */

export function normalizarCabecalho(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** `="41835"` → `41835`; `=0` (sem tipo de órgão) → vazio. */
export function limparExcel(valor: unknown): string {
  const texto = String(valor ?? "").trim();
  const semTruque = texto.replace(/^="?/, "").replace(/"$/, "").trim();
  return texto.startsWith("=") && semTruque === "0" ? "" : semTruque;
}

export function limparCi(valor: unknown): string {
  return String(valor ?? "").replace(/[="\s]/g, "");
}

/** dd/mm/aaaa (com ou sem hora) ou aaaa-mm-dd → aaaa-mm-dd. */
export function lerData(valor: unknown): string | null {
  const texto = String(valor ?? "").trim();
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(texto);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

const CNJ = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/;
// Rótulo de número no VIOS ("Tipo de Número"): CNJ, Outros, T, 2.° Grau…
const ROTULO_NUMERO = /(CNJ|Outros|\d\.?\s?[°ºª]\s?Grau|[A-Z]{1,4}):\s*/g;

/** Separa a célula "Número" no CNJ (o primeiro número com a máscara) e nos demais, como "Tipo: número". */
export function lerNumeros(celula: unknown): { cnj: string | null; outros: string[] } {
  const texto = String(celula ?? "").trim();
  if (!texto) return { cnj: null, outros: [] };
  const itens: { rotulo: string; numero: string }[] = [];
  const marcas = [...texto.matchAll(ROTULO_NUMERO)];
  if (!marcas.length) {
    itens.push({ rotulo: "", numero: texto });
  } else {
    marcas.forEach((marca, i) => {
      const inicio = (marca.index ?? 0) + marca[0].length;
      const fim = i + 1 < marcas.length ? marcas[i + 1].index : texto.length;
      const numero = texto.slice(inicio, fim).trim();
      if (numero) itens.push({ rotulo: marca[1].trim(), numero });
    });
  }
  const principal = itens.find((item) => CNJ.test(item.numero));
  const cnj = principal ? (CNJ.exec(principal.numero)?.[0] ?? null) : null;
  const outros = itens
    .filter((item) => item !== principal || item.numero.replace(CNJ, "").trim())
    .map((item) => {
      const numero = item === principal ? item.numero.replace(CNJ, "").trim() : item.numero;
      return item.rotulo && item.rotulo !== "CNJ" ? `${item.rotulo}: ${numero}` : numero;
    });
  return { cnj, outros };
}

// Tipo de parte do VIOS: uma ou duas palavras com inicial maiúscula antes dos dois-pontos ("Terceiro Interessado:").
const TIPO_PARTE = /([A-ZÀ-Ú][a-zà-ú]+(?: [A-ZÀ-Ú][a-zà-ú]+)?):\s*/g;

/** `Requerente: Fulano LtdaExequente: Beltrano` → [{tipo, nome}, …]. Sem rótulo, a célula inteira é um nome. */
export function lerPartes(celula: unknown, polo: PoloParte): ParteImportada[] {
  const texto = String(celula ?? "").trim();
  if (!texto) return [];
  const marcas = [...texto.matchAll(TIPO_PARTE)];
  if (!marcas.length) return [{ polo, tipo: null, nome: texto }];
  const partes: ParteImportada[] = [];
  const antes = texto.slice(0, marcas[0].index).trim();
  if (antes) partes.push({ polo, tipo: null, nome: antes });
  marcas.forEach((marca, i) => {
    const inicio = (marca.index ?? 0) + marca[0].length;
    const fim = i + 1 < marcas.length ? marcas[i + 1].index : texto.length;
    const nome = texto.slice(inicio, fim).trim();
    if (nome) partes.push({ polo, tipo: marca[1], nome });
  });
  return partes;
}

/** Sem caixa nem espaço repetido, para comparar etiqueta com etiqueta. */
function chaveEtiqueta(texto: string): string {
  return texto.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Etiqueta conhecida já com a chave de comparação, para não recalcular a cada linha do relatório. */
interface EtiquetaConhecida {
  valor: string;
  chave: string;
}

/** Sem repetição e da mais longa para a mais curta (a mais longa que casa é a que vale). */
function prepararEtiquetas(lista: string[]): EtiquetaConhecida[] {
  const porChave = new Map<string, EtiquetaConhecida>();
  for (const item of lista) {
    const valor = String(item ?? "").replace(/\s+/g, " ").trim();
    const chave = chaveEtiqueta(valor);
    if (valor && !porChave.has(chave)) porChave.set(chave, { valor, chave });
  }
  return [...porChave.values()].sort((a, b) => b.chave.length - a.chave.length);
}

/** Corta o texto nas etiquetas conhecidas; o trecho que não casa com nenhuma fica junto, como uma só. */
function cortarEtiquetas(texto: string, conhecidas: EtiquetaConhecida[]): { etiquetas: string[]; semCasar: boolean } {
  let resto = texto.replace(/\s+/g, " ").trim();
  const etiquetas: string[] = [];
  let pendente = "";
  let semCasar = false;
  const fecharPendente = () => {
    if (pendente.trim()) {
      etiquetas.push(pendente.trim());
      semCasar = true;
    }
    pendente = "";
  };
  while (resto) {
    const minusculo = resto.toLowerCase();
    const achada = conhecidas.find((item) => minusculo === item.chave || minusculo.startsWith(`${item.chave} `));
    if (achada) {
      fecharPendente();
      etiquetas.push(achada.valor);
      resto = resto.slice(achada.chave.length).trim();
    } else {
      const espaco = resto.indexOf(" ");
      pendente += ` ${espaco === -1 ? resto : resto.slice(0, espaco)}`;
      resto = espaco === -1 ? "" : resto.slice(espaco + 1).trim();
    }
  }
  fecharPendente();
  return { etiquetas: [...new Set(etiquetas)], semCasar };
}

/**
 * Catálogo pronto para a separação, a partir de uma ou mais fontes (o cadastro de etiquetas do
 * ORQESTRAI, as etiquetas do SIOE). Sai sem as "etiquetas" que são só duas ou mais etiquetas do próprio
 * catálogo coladas ("Carteira X Crédito Ativo" quando existem "Carteira X" e "Crédito Ativo"): uma
 * carga sem catálogo já gravou etiquetas assim e, se elas entrassem aqui, a mais longa ganharia e o
 * erro nunca mais se desfaria.
 */
export function catalogoDeEtiquetas(...fontes: string[][]): string[] {
  const todas = prepararEtiquetas(fontes.flat());
  return todas
    .filter((item) => {
      const corte = cortarEtiquetas(item.valor, todas.filter((outra) => outra !== item));
      return corte.semCasar || corte.etiquetas.length < 2;
    })
    .map((item) => item.valor);
}

/**
 * Separa "Carteira X RC-Insolvência Crédito Ativo" usando as etiquetas conhecidas, sempre pela mais
 * longa que casa. O que sobrar sem casar fica como uma etiqueta só. Para muitas linhas, passe o
 * catálogo já pronto de catalogoDeEtiquetas.
 */
export function separarEtiquetas(texto: unknown, catalogo: string[]): string[] {
  return cortarEtiquetas(String(texto ?? ""), prepararEtiquetas(catalogo)).etiquetas;
}

/**
 * Desfaz etiquetas que foram gravadas coladas: cada item que não é do catálogo e se divide por inteiro
 * em etiquetas do catálogo vira essas etiquetas. Devolve null quando não há o que mudar.
 */
export function desgrudarEtiquetas(etiquetas: string[], catalogo: string[]): string[] | null {
  const conhecidas = prepararEtiquetas(catalogoDeEtiquetas(catalogo));
  const chaves = new Set(conhecidas.map((item) => item.chave));
  let mudou = false;
  const saida: string[] = [];
  for (const item of etiquetas) {
    const corte = chaves.has(chaveEtiqueta(item)) ? null : cortarEtiquetas(item, conhecidas);
    if (corte && !corte.semCasar && corte.etiquetas.length > 1) {
      saida.push(...corte.etiquetas);
      mudou = true;
    } else saida.push(item);
  }
  return mudou ? [...new Set(saida)] : null;
}

function lerLista(valor: unknown): string[] {
  return [...new Set(limparExcel(valor).split(/[;,|/]/).map((item) => item.trim()).filter(Boolean))];
}

function converter(item: CampoProcesso, bruto: unknown) {
  const texto = limparExcel(bruto);
  switch (item.tipo) {
    case "data":
      return lerData(texto);
    case "valor":
    case "percentual":
      return texto ? lerNumeroBr(texto) : null;
    case "lista":
      return lerLista(texto);
    case "booleano":
      return /^sim$/i.test(texto) ? true : /^n[ãa]o$/i.test(texto) ? false : null;
    default:
      return texto || null;
  }
}

const POR_COLUNA_VIOS = new Map<string, CampoProcesso>();
for (const item of CAMPOS) for (const coluna of item.colunasVios ?? []) POR_COLUNA_VIOS.set(normalizarCabecalho(coluna), item);

// Colunas tratadas à parte ou calculadas pelo VIOS (não viram campo).
const COLUNA_NUMERO = normalizarCabecalho("Número");
const COLUNA_ETIQUETAS = normalizarCabecalho("Etiquetas");
const COLUNA_EDICAO = normalizarCabecalho("Última edição");
const COLUNAS_PARTE: Record<string, { polo: PoloParte; chave: string }> = {
  [normalizarCabecalho("Parte ativa")]: { polo: "ativo", chave: "parte_ativa" },
  [normalizarCabecalho("Parte passiva")]: { polo: "passivo", chave: "parte_passiva" },
  [normalizarCabecalho("Terceiro(s)")]: { polo: "terceiro", chave: "terceiros" },
};
const COLUNAS_CALCULADAS = new Set([normalizarCabecalho("Vida Útil")]);

export interface LeituraCsv {
  registros: RegistroImportado[];
  /** Cabeçalhos que o importador não conhece (aparecem na tela de importação). */
  colunasIgnoradas: string[];
  linhasSemCi: number;
  /** Linhas com etiqueta que ficaram sem etiqueta na leitura por falta de catálogo para separar. */
  etiquetasSemCatalogo: number;
}

/**
 * Lê o CSV do "Processos Lista". `etiquetasConhecidas` separa a coluna Etiquetas, que vem com as
 * etiquetas coladas por um espaço. Sem catálogo não há como saber onde uma termina e a outra começa:
 * a linha fica sem o campo (o que já está gravado não é tocado) e entra em `etiquetasSemCatalogo`.
 */
export function lerCsvProcessos(texto: string, etiquetasConhecidas: string[] = []): LeituraCsv {
  const linhas = parse(texto.replace(/^﻿/, ""), {
    delimiter: ";",
    columns: true,
    relax_quotes: true,
    relax_column_count: true,
    skip_empty_lines: true,
  }) as Record<string, string>[];
  if (!linhas.length) return { registros: [], colunasIgnoradas: [], linhasSemCi: 0, etiquetasSemCatalogo: 0 };
  const cabecalhos = Object.keys(linhas[0]);
  const colunaCi = cabecalhos.find((cabecalho) => normalizarCabecalho(cabecalho) === "ci");
  if (!colunaCi) throw new Error("O arquivo não tem a coluna CI: não parece o relatório de processos do VIOS.");

  const ignoradas = cabecalhos.filter((cabecalho) => {
    const chave = normalizarCabecalho(cabecalho);
    return (
      chave !== "ci" &&
      !POR_COLUNA_VIOS.has(chave) &&
      !(chave in COLUNAS_PARTE) &&
      chave !== COLUNA_NUMERO &&
      chave !== COLUNA_ETIQUETAS &&
      chave !== COLUNA_EDICAO &&
      !COLUNAS_CALCULADAS.has(chave)
    );
  });

  const registros = new Map<string, RegistroImportado>();
  let linhasSemCi = 0;
  let etiquetasSemCatalogo = 0;
  const catalogo = prepararEtiquetas(catalogoDeEtiquetas(etiquetasConhecidas));
  for (const linha of linhas) {
    const ci = limparCi(linha[colunaCi]);
    if (!/^\d+$/.test(ci)) {
      linhasSemCi += 1;
      continue;
    }
    const valores: Valores = { ci };
    const partes: ParteImportada[] = [];
    for (const cabecalho of cabecalhos) {
      const chave = normalizarCabecalho(cabecalho);
      const bruto = linha[cabecalho];
      if (chave === "ci") continue;
      if (chave === COLUNA_NUMERO) {
        const { cnj, outros } = lerNumeros(bruto);
        valores.cnj = cnj;
        valores.outros_numeros = outros;
      } else if (chave === COLUNA_ETIQUETAS) {
        const coladas = limparExcel(bruto);
        if (!coladas) valores.etiquetas = [];
        else if (catalogo.length) valores.etiquetas = cortarEtiquetas(coladas, catalogo).etiquetas;
        else etiquetasSemCatalogo += 1;
      } else if (chave === COLUNA_EDICAO) {
        valores.vios_editado_em = limparExcel(bruto) || null;
      } else if (chave in COLUNAS_PARTE) {
        const lidas = lerPartes(bruto, COLUNAS_PARTE[chave].polo);
        partes.push(...lidas);
        valores[COLUNAS_PARTE[chave].chave] = lidas.map((parte) => parte.nome).join("; ") || null;
      } else {
        const item = POR_COLUNA_VIOS.get(chave);
        if (item) valores[item.chave] = converter(item, bruto);
      }
    }
    registros.set(ci, { ci, valores, partes });
  }
  return { registros: [...registros.values()], colunasIgnoradas: ignoradas, linhasSemCi, etiquetasSemCatalogo };
}

/** Etiquetas do SIOE: "Carteira PST | Crédito Ativo". */
export function lerEtiquetasSioe(valor: unknown): string[] {
  return [...new Set(String(valor ?? "").split("|").map((item) => item.trim()).filter(Boolean))];
}

const CAMPOS_SIOE = CAMPOS.filter((item) => item.colunaSioe);

/** Linha de processos_completo (SIOE) → registro. Só os campos que a linha realmente traz. */
export function registroDoSioe(linha: Record<string, unknown>): RegistroImportado | null {
  const ci = limparCi(linha.ci);
  if (!/^\d+$/.test(ci)) return null;
  const valores: Valores = { ci };
  for (const item of CAMPOS_SIOE) {
    const coluna = item.colunaSioe as string;
    if (item.chave === "ci" || !(coluna in linha)) continue;
    const bruto = linha[coluna];
    if (item.chave === "etiquetas") valores.etiquetas = lerEtiquetasSioe(bruto);
    else if (item.tipo === "valor") valores[item.chave] = bruto === null || bruto === "" ? null : (Number.isFinite(Number(bruto)) ? Math.round(Number(bruto) * 100) / 100 : null);
    else valores[item.chave] = converter(item, bruto);
  }
  return { ci, valores, partes: [] };
}

/**
 * Junta o que veio do CSV com o que veio do SIOE para a mesma pasta. O CSV manda (é o relatório mais
 * completo e mais recente), menos nas etiquetas, que só o SIOE traz separadas, e nos campos que o CSV
 * deixou vazios.
 */
export function juntarFontes(csv: RegistroImportado | undefined, sioe: RegistroImportado | undefined): RegistroImportado | null {
  if (!csv && !sioe) return null;
  if (!csv) return sioe as RegistroImportado;
  if (!sioe) return csv;
  const valores: Valores = { ...sioe.valores };
  for (const [chave, valor] of Object.entries(csv.valores)) {
    const vazio = valor === null || valor === "" || (Array.isArray(valor) && !valor.length);
    if (!vazio || !(chave in valores)) valores[chave] = valor;
  }
  const etiquetasSioe = sioe.valores.etiquetas;
  if (Array.isArray(etiquetasSioe) && etiquetasSioe.length) valores.etiquetas = etiquetasSioe;
  return { ci: csv.ci, valores, partes: csv.partes };
}
