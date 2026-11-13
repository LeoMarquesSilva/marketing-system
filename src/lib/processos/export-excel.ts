import "server-only";

import type { CellObject, CellStyle, WorkSheet } from "xlsx-js-style";
import * as XLSX from "xlsx-js-style";
import type { Valores } from "./campos";
import { COLUNAS_PLANILHA, linhaDaPlanilha } from "./planilha";
import type { Parte } from "./types";

/**
 * Planilha de processos no padrão das exportações do sistema: título navy, cabeçalho por origem
 * (navy = já existe no VIOS, verde-água = informação nova), zebra e filtro.
 */

const FONT = "Calibri";
const NAVY = "04202F";
const TEAL = "47CDD0";
const WHITE = "FFFFFF";
const ZEBRA = "F4F7F8";
const BORDER = "D0D7DE";
const LINHA_TITULO = 0;
const LINHA_LEGENDA = 1;
const LINHA_CABECALHO = 2;
const PRIMEIRA_LINHA = 3;

const fina = (cor = BORDER) => ({ style: "thin" as const, color: { rgb: cor } });
const caixa = (cor = BORDER): CellStyle["border"] => ({ top: fina(cor), bottom: fina(cor), left: fina(cor), right: fina(cor) });

const estiloTitulo: CellStyle = { font: { name: FONT, sz: 14, bold: true, color: { rgb: WHITE } }, fill: { patternType: "solid", fgColor: { rgb: NAVY } }, alignment: { vertical: "center" } };
const estiloLegenda: CellStyle = { font: { name: FONT, sz: 10, color: { rgb: NAVY } }, fill: { patternType: "solid", fgColor: { rgb: "E8F8F8" } }, alignment: { vertical: "center" } };
const cabecalho = (novo: boolean): CellStyle => ({
  font: { name: FONT, sz: 10, bold: true, color: { rgb: novo ? NAVY : WHITE } },
  fill: { patternType: "solid", fgColor: { rgb: novo ? TEAL : NAVY } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: caixa(NAVY),
});
const dado = (zebra: boolean): CellStyle => ({
  font: { name: FONT, sz: 10, color: { rgb: NAVY } },
  fill: zebra ? { patternType: "solid", fgColor: { rgb: ZEBRA } } : undefined,
  alignment: { vertical: "top", wrapText: true },
  border: caixa(),
});

function celula(ws: WorkSheet, r: number, c: number, valor: string, estilo: CellStyle) {
  const item: CellObject = { t: "s", v: valor, s: estilo };
  ws[XLSX.utils.encode_cell({ r, c })] = item;
}

const LARGAS = new Set(["sintese", "ultimo_andamento_texto", "executado_enderecos", "representantes", "corresponsaveis", "parte_ativa", "parte_passiva"]);

export function montarPlanilhaDeProcessos(processos: { valores: Valores; partes: Parte[] }[], agora: Date = new Date()): Buffer {
  const ws: WorkSheet = {};
  const ultima = COLUNAS_PLANILHA.length - 1;
  const geradaEm = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(agora);
  celula(ws, LINHA_TITULO, 0, "Processos — Bismarchi | Pires", estiloTitulo);
  celula(ws, LINHA_LEGENDA, 0, `Gerada em ${geradaEm} · ${processos.length} processo${processos.length === 1 ? "" : "s"} · Cabeçalho escuro: informação que já existe no VIOS · Cabeçalho verde-água: informação nova`, estiloLegenda);
  for (let c = 1; c <= ultima; c += 1) {
    celula(ws, LINHA_TITULO, c, "", estiloTitulo);
    celula(ws, LINHA_LEGENDA, c, "", estiloLegenda);
  }
  COLUNAS_PLANILHA.forEach((coluna, c) => celula(ws, LINHA_CABECALHO, c, coluna.rotulo, cabecalho(coluna.origem === "novo")));
  processos.forEach((processo, i) => {
    // O Excel aceita até 32.767 caracteres por célula; a síntese do VIOS às vezes passa de 15 mil.
    linhaDaPlanilha(processo.valores, processo.partes).forEach((valor, c) => celula(ws, PRIMEIRA_LINHA + i, c, valor.slice(0, 32000), dado(i % 2 === 1)));
  });
  const ultimaLinha = PRIMEIRA_LINHA + Math.max(processos.length, 1) - 1;
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: ultimaLinha, c: ultima } });
  ws["!merges"] = [
    { s: { r: LINHA_TITULO, c: 0 }, e: { r: LINHA_TITULO, c: ultima } },
    { s: { r: LINHA_LEGENDA, c: 0 }, e: { r: LINHA_LEGENDA, c: ultima } },
  ];
  ws["!cols"] = COLUNAS_PLANILHA.map((coluna) => ({ wch: LARGAS.has(coluna.chave) ? 48 : 22 }));
  ws["!rows"] = [{ hpt: 26 }, { hpt: 18 }, { hpt: 34 }];
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: LINHA_CABECALHO, c: 0 }, e: { r: ultimaLinha, c: ultima } }) };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Processos");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
