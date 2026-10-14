import * as XLSX from "xlsx";
import type { KurierLinha } from "./types";

const NOME_ARQUIVO = /_Lote-(\d+)_(\d{2})(\d{2})(\d{4})\.xlsx$/i;

/** "bismarchi.pires.adv2_Lote-01_14102026.xlsx" → lote 1 de 2026-10-14. */
export function lerNomeArquivoKurier(nome: string): { lote: number; dataArquivo: string } | null {
  const achado = nome.match(NOME_ARQUIVO);
  if (!achado) return null;
  const [, lote, dia, mes, ano] = achado;
  const data = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
  if (data.getUTCDate() !== Number(dia) || data.getUTCMonth() !== Number(mes) - 1) return null;
  return { lote: Number(lote), dataArquivo: `${ano}-${mes}-${dia}` };
}

function paraDataIso(valor: unknown): string | null {
  if (typeof valor === "number" && Number.isFinite(valor)) {
    const data = XLSX.SSF.parse_date_code(valor);
    if (!data) return null;
    return `${data.y}-${String(data.m).padStart(2, "0")}-${String(data.d).padStart(2, "0")}`;
  }
  const texto = String(valor ?? "").trim();
  const br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

function cabecalho(celula: unknown): string {
  return String(celula ?? "").replace(/\s+/g, " ").trim().toUpperCase();
}

export class KurierArquivoInvalidoError extends Error {}

/**
 * Lê a aba "Publicações" do xlsx da Kurier. Publicações longas continuam nas
 * colunas "CONTINUAÇÃO PUBLICAÇÃO 1..N", que aqui são reunidas ao teor.
 */
export function lerPlanilhaKurier(conteudo: ArrayBuffer | Uint8Array): KurierLinha[] {
  const workbook = XLSX.read(conteudo, { type: "array" });
  const nomeAba = workbook.SheetNames.find((nome) => cabecalho(nome) === "PUBLICAÇÕES") ?? workbook.SheetNames[0];
  const aba = nomeAba ? workbook.Sheets[nomeAba] : undefined;
  if (!aba) throw new KurierArquivoInvalidoError("Planilha sem abas.");

  const grade = XLSX.utils.sheet_to_json<unknown[]>(aba, { header: 1, defval: "", raw: true, blankrows: true });
  const linhaCabecalho = grade.findIndex((linha) => linha.some((celula) => cabecalho(celula) === "NÚMERO DO PROCESSO"));
  if (linhaCabecalho < 0) throw new KurierArquivoInvalidoError("Cabeçalho da Kurier não encontrado (coluna NÚMERO DO PROCESSO).");

  const colunas = grade[linhaCabecalho].map(cabecalho);
  const coluna = (nome: string) => colunas.indexOf(nome);
  const obrigatorias = ["NÚMERO DO PROCESSO", "PUBLICAÇÃO", "DATA DE PUBLICAÇÃO", "DATA DE DIVULGAÇÃO", "DIÁRIO - DIVISÃO"];
  const faltando = obrigatorias.filter((nome) => coluna(nome) < 0);
  if (faltando.length) throw new KurierArquivoInvalidoError(`Colunas ausentes: ${faltando.join(", ")}.`);

  const continuacoes = colunas
    .map((nome, indice) => ({ indice, ordem: Number(nome.match(/^CONTINUAÇÃO PUBLICAÇÃO\s*(\d+)$/)?.[1]) }))
    .filter((c) => Number.isFinite(c.ordem))
    .sort((a, b) => a.ordem - b.ordem)
    .map((c) => c.indice);

  // A primeira linha do range pode não ser a linha 1 do Excel (a Kurier deixa a linha 1 vazia).
  const inicio = XLSX.utils.decode_range(aba["!ref"] ?? "A1").s.r;
  const texto = (linha: unknown[], indice: number) => (indice < 0 ? "" : String(linha[indice] ?? "").replace(/\r\n?/g, "\n").trim());

  const linhas: KurierLinha[] = [];
  grade.slice(linhaCabecalho + 1).forEach((linha, deslocamento) => {
    if (!linha.some((celula) => String(celula ?? "").trim())) return;
    const teor = [linha[coluna("PUBLICAÇÃO")], ...continuacoes.map((indice) => linha[indice])]
      .map((parte) => String(parte ?? "").replace(/\r\n?/g, "\n"))
      .join("")
      .trim();
    linhas.push({
      linha: inicio + linhaCabecalho + deslocamento + 2,
      dataDivulgacao: paraDataIso(linha[coluna("DATA DE DIVULGAÇÃO")]),
      dataPublicacao: paraDataIso(linha[coluna("DATA DE PUBLICAÇÃO")]),
      numeroProcesso: texto(linha, coluna("NÚMERO DO PROCESSO")),
      estado: texto(linha, coluna("ESTADO")),
      diario: texto(linha, coluna("DIÁRIO - DIVISÃO")),
      nomeLocalizado: texto(linha, coluna("NOME LOCALIZADO NA PUBLICAÇÃO")),
      caderno: texto(linha, coluna("CADERNO")),
      comarca: texto(linha, coluna("COMARCA/CIDADE")),
      titulo: texto(linha, coluna("TÍTULO")),
      teor,
    });
  });
  return linhas;
}
