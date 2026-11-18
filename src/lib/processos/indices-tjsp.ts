import JSZip from "jszip";
import type { IndiceMensal } from "./calculo-tjsp";

/**
 * Índices do TJSP a partir da planilha oficial "Atualização Monetária e Juros Moratórios - Curto" (Primeira
 * Instância > Cálculos Judiciais > Cível - Cálculos em Geral), aba "Índices":
 * - coluna "Tabela Prática TJSP - Lei 14.905/2024": índice da correção monetária, um por mês;
 * - coluna "Tabela Prática TJSP - Lei 14.905/2024 - Selic menos correção": taxa legal do mês, em %.
 *
 * As colunas são achadas pelo cabeçalho, não pela letra: se o tribunal mudar a planilha, a leitura falha em vez
 * de gravar a coluna errada. A aba tem quase 100 MB de XML; ela é lida em fluxo, linha a linha.
 */

export const URL_PLANILHA_TJSP = "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=205829";

const CABECALHO_TABELA = /^Tabela Prática TJSP - Lei (nº )?14\.905\/2024$/i;
const CABECALHO_TAXA = /^Tabela Prática TJSP - Lei (nº )?14\.905\/2024 - Selic menos correção$/i;

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
}

function desfazerXml(texto: string): string {
  return texto.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function textosCompartilhados(xml: string): string[] {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((si) => desfazerXml([...si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")));
}

/** Data do Excel (dias desde 30/12/1899) para AAAA-MM-01. */
function mesDoExcel(serial: number): string {
  const data = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000);
  return `${data.toISOString().slice(0, 7)}-01`;
}

async function caminhoDaAba(zip: JSZip, nome: string): Promise<string> {
  const workbook = (await zip.file("xl/workbook.xml")?.async("string")) ?? "";
  const rels = (await zip.file("xl/_rels/workbook.xml.rels")?.async("string")) ?? "";
  const aba = [...workbook.matchAll(/<sheet\b[^>]*\bname="([^"]+)"[^>]*\br:id="([^"]+)"/g)].find((item) => semAcento(desfazerXml(item[1])) === semAcento(nome));
  if (!aba) throw new Error(`A planilha do TJSP não tem a aba "${nome}".`);
  const alvo = new RegExp(`<Relationship\\b[^>]*\\bId="${aba[2]}"[^>]*\\bTarget="([^"]+)"`).exec(rels)?.[1] ?? new RegExp(`<Relationship\\b[^>]*\\bTarget="([^"]+)"[^>]*\\bId="${aba[2]}"`).exec(rels)?.[1];
  if (!alvo) throw new Error(`Não achei o arquivo da aba "${nome}" na planilha do TJSP.`);
  return alvo.startsWith("/") ? alvo.slice(1) : `xl/${alvo.replace(/^\.?\//, "")}`;
}

interface Celula {
  coluna: string;
  texto: string | null;
  numero: number | null;
}

function celulasDaLinha(linha: string, compartilhados: string[]): Celula[] {
  const celulas: Celula[] = [];
  for (const celula of linha.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const atributos = celula[1];
    const coluna = /\br="([A-Z]+)\d+"/.exec(atributos)?.[1];
    const valor = /<v>([\s\S]*?)<\/v>/.exec(celula[2] ?? "")?.[1];
    if (!coluna || valor === undefined) continue;
    if (/\bt="s"/.test(atributos)) celulas.push({ coluna, texto: compartilhados[Number(valor)] ?? null, numero: null });
    else if (/\bt="(str|inlineStr)"/.test(atributos)) celulas.push({ coluna, texto: desfazerXml(valor), numero: null });
    else celulas.push({ coluna, texto: null, numero: Number.isFinite(Number(valor)) ? Number(valor) : null });
  }
  return celulas;
}

/** Lê os índices mensais da planilha oficial do TJSP (o arquivo .xlsm inteiro). */
export async function lerIndicesDaPlanilha(arquivo: Uint8Array): Promise<IndiceMensal[]> {
  const zip = await JSZip.loadAsync(arquivo);
  const compartilhados = textosCompartilhados((await zip.file("xl/sharedStrings.xml")?.async("string")) ?? "");
  const caminho = await caminhoDaAba(zip, "Índices");
  const entrada = zip.file(caminho);
  if (!entrada) throw new Error("A aba de índices da planilha do TJSP está vazia.");

  let colunaTabela: string | null = null;
  let colunaTaxa: string | null = null;
  const indices: IndiceMensal[] = [];
  // Antes dos dados: acha as colunas pelo texto do cabeçalho.
  const tratar = (linha: string) => {
    for (const celula of celulasDaLinha(linha, compartilhados)) {
      const cabecalho = celula.texto?.replace(/\s+/g, " ").trim() ?? "";
      if (CABECALHO_TABELA.test(cabecalho)) colunaTabela = celula.coluna;
      if (CABECALHO_TAXA.test(cabecalho)) colunaTaxa = celula.coluna;
    }
  };
  // Depois do cabeçalho, cada linha de dados tem fórmulas em dezenas de colunas: em vez de ler a linha inteira,
  // busca só as três células que interessam (data, Tabela Prática e taxa legal).
  const numeroDaCelula = (linha: string, referencia: string): number | null => {
    const inicio = linha.indexOf(`<c r="${referencia}"`);
    if (inicio < 0) return null;
    const fechamento = linha.indexOf(">", inicio);
    if (linha[fechamento - 1] === "/") return null;
    const fim = linha.indexOf("</c>", fechamento);
    const valor = /<v>([^<]*)<\/v>/.exec(linha.slice(fechamento, fim))?.[1];
    if (valor === undefined || /\bt="(s|str|inlineStr)"/.test(linha.slice(inicio, fechamento))) return null;
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : null;
  };
  const tratarDados = (linha: string) => {
    const numeroDaLinha = /<row\b[^>]*\br="(\d+)"/.exec(linha)?.[1];
    if (!numeroDaLinha || !colunaTabela || !colunaTaxa) return;
    const data = numeroDaCelula(linha, `A${numeroDaLinha}`);
    const tabela = numeroDaCelula(linha, `${colunaTabela}${numeroDaLinha}`);
    if (!data || data < 20_000 || !tabela || tabela <= 0) return;
    indices.push({ mes: mesDoExcel(data), tabelaPratica: tabela, taxaLegal: numeroDaCelula(linha, `${colunaTaxa}${numeroDaLinha}`) });
  };

  // A aba descompactada tem cerca de 95 MB: fica em bytes (sem virar um texto único) e só cada linha é
  // decodificada. A busca anda sempre para a frente, uma passada só.
  const xml = await entrada.async("nodebuffer");
  for (let cursor = 0; ; ) {
    const fim = xml.indexOf("</row>", cursor);
    if (fim < 0) break;
    const abertura = xml.lastIndexOf("<row", fim);
    if (abertura >= cursor) {
      const linha = xml.toString("utf8", abertura, fim);
      if (colunaTabela && colunaTaxa) tratarDados(linha);
      else tratar(linha);
    }
    cursor = fim + 6;
  }

  if (!colunaTabela || !colunaTaxa) throw new Error("A planilha do TJSP mudou: não achei as colunas da Tabela Prática (Lei 14.905/2024) e da taxa legal. Nada foi importado.");
  const porMes = new Map(indices.map((indice) => [indice.mes, indice]));
  return [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}
