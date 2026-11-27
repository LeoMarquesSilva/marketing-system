import "server-only";

import type { CellObject, CellStyle, WorkSheet } from "xlsx-js-style";
import * as XLSX from "xlsx-js-style";
import { cabecalho, dado, estiloLegenda, estiloTitulo } from "./export-excel";
import { idsTrabalhistas, negociacoesPorProcesso } from "./negociacao-server";
import { rotuloDoStatus } from "./negociacao";
import { calcularPreenchimento } from "./preenchimento";
import { carregarParaPlanilha } from "./processos-server";
import { SEM_ATUALIZACAO, formatarMomento } from "./rec-credito";
import { autosPorProcesso } from "./rec-credito-server";
import { linhaDaCarteiraTrabalhista, type LinhaCarteiraTrabalhista } from "./trabalhista-carteira";
import { itensTrabalhistasPorProcesso } from "./trabalhista-server";

/** A Carteira Trabalhista: uma linha por processo da área (todos, ou os `ids` filtrados na tela). */
export async function carregarCarteiraTrabalhista(ids: string[] | null = null): Promise<LinhaCarteiraTrabalhista[]> {
  const todos = await idsTrabalhistas();
  const escolhidos = ids ? todos.filter((id) => ids.includes(id)) : todos;
  if (!escolhidos.length) return [];
  const [processos, itens, autos, negociacoes] = await Promise.all([
    carregarParaPlanilha(escolhidos),
    itensTrabalhistasPorProcesso(escolhidos),
    autosPorProcesso(escolhidos),
    negociacoesPorProcesso(escolhidos),
  ]);
  return processos
    .map(({ id, valores, partes, naoAplicaveis }) => {
      const doProcesso = itens.get(id) ?? { afastamentos: [], pedidos: [] };
      const negociacao = negociacoes.get(id);
      return linhaDaCarteiraTrabalhista(
        id,
        valores,
        partes,
        doProcesso,
        calcularPreenchimento(valores, partes, naoAplicaveis, { pedidos: doProcesso.pedidos.length }),
        autos.get(id) ?? SEM_ATUALIZACAO,
        { status: negociacao?.status ?? "a_enviar", valorMaximoCliente: negociacao?.valorMaximoCliente ?? null }
      );
    })
    .sort((a, b) => (b.ci ?? "").localeCompare(a.ci ?? "", "pt-BR", { numeric: true }));
}

type Valor = string | number | null;
const data = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

const COLUNAS: { rotulo: string; largura: number; real?: boolean; percentual?: boolean; valor: (linha: LinhaCarteiraTrabalhista) => Valor }[] = [
  { rotulo: "CI", largura: 9, valor: (linha) => linha.ci },
  { rotulo: "N.º CNJ", largura: 27, valor: (linha) => linha.cnj },
  { rotulo: "Grupo do cliente", largura: 18, valor: (linha) => linha.grupoCliente },
  { rotulo: "Cliente", largura: 28, valor: (linha) => linha.cliente },
  { rotulo: "Reclamante", largura: 30, valor: (linha) => linha.reclamante },
  { rotulo: "Advogado(s) do reclamante", largura: 34, valor: (linha) => linha.advogadosReclamante.map((item) => `${item.nome}${item.oab ? ` (OAB ${item.oab})` : ""}`).join("\n") },
  { rotulo: "E-mail(s)", largura: 30, valor: (linha) => [...new Set(linha.advogadosReclamante.flatMap((item) => item.emails))].join("\n") },
  { rotulo: "Advogado responsável", largura: 24, valor: (linha) => linha.advogadoResponsavel },
  { rotulo: "Fase", largura: 14, valor: (linha) => linha.fase },
  { rotulo: "Situação", largura: 14, valor: (linha) => (linha.encerrado ? "Encerrado" : "Ativo") },
  { rotulo: "Cargo", largura: 22, valor: (linha) => linha.cargo },
  { rotulo: "Admissão", largura: 12, valor: (linha) => data(linha.admissao) },
  { rotulo: "Término", largura: 12, valor: (linha) => data(linha.termino) },
  { rotulo: "Tipo de término", largura: 22, valor: (linha) => linha.tipoTermino },
  { rotulo: "Afastamentos INSS", largura: 11, valor: (linha) => linha.afastamentos || null },
  { rotulo: "Laudo", largura: 22, valor: (linha) => linha.laudo },
  { rotulo: "Decisão que prevalece", largura: 18, valor: (linha) => linha.decisao },
  { rotulo: "Trânsito", largura: 12, valor: (linha) => data(linha.transito) },
  { rotulo: "Pedidos", largura: 9, valor: (linha) => linha.pedidos || null },
  { rotulo: "Pedidos deferidos", largura: 10, valor: (linha) => linha.pedidosDeferidos || null },
  { rotulo: "Risco: valor", largura: 15, real: true, valor: (linha) => linha.riscoValor },
  { rotulo: "Risco: reflexos", largura: 15, real: true, valor: (linha) => linha.riscoReflexos },
  { rotulo: "Risco: total", largura: 15, real: true, valor: (linha) => linha.riscoTotal },
  { rotulo: "Acordo: status", largura: 16, valor: (linha) => rotuloDoStatus(linha.negociacao) },
  { rotulo: "Valor máximo do cliente", largura: 16, real: true, valor: (linha) => linha.valorMaximoCliente },
  { rotulo: "Saneamento", largura: 10, percentual: true, valor: (linha) => linha.saneamento.percentual / 100 },
  { rotulo: "Falta no saneamento", largura: 40, valor: (linha) => linha.saneamento.faltando.join("\n") },
  { rotulo: "Robô: última conferência", largura: 18, valor: (linha) => (linha.autos.roboEm ? formatarMomento(linha.autos.roboEm) : "nunca") },
  { rotulo: "IA: última leitura", largura: 18, valor: (linha) => (linha.autos.iaEm ? formatarMomento(linha.autos.iaEm) : linha.autos.documentos ? "não lida" : "sem autos") },
];

export function montarPlanilhaDaCarteiraTrabalhista(linhas: LinhaCarteiraTrabalhista[], agora: Date = new Date()): Buffer {
  const ws: WorkSheet = {};
  const ultima = COLUNAS.length - 1;
  const geradaEm = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(agora);
  const por = (r: number, c: number, item: CellObject) => {
    ws[XLSX.utils.encode_cell({ r, c })] = item;
  };
  por(0, 0, { t: "s", v: "Carteira Trabalhista — Bismarchi | Pires", s: estiloTitulo });
  por(1, 0, { t: "s", v: `Gerada em ${geradaEm} · ${linhas.length} processo${linhas.length === 1 ? "" : "s"} · Risco = adicional nominal + reflexos, sem correção nem juros`, s: estiloLegenda });
  for (let c = 1; c <= ultima; c += 1) {
    por(0, c, { t: "s", v: "", s: estiloTitulo });
    por(1, c, { t: "s", v: "", s: estiloLegenda });
  }
  COLUNAS.forEach((coluna, c) => por(2, c, { t: "s", v: coluna.rotulo, s: cabecalho(false) }));
  linhas.forEach((linha, i) => {
    const estilo = dado(i % 2 === 1);
    COLUNAS.forEach((coluna, c) => {
      const valor = coluna.valor(linha);
      if (typeof valor === "number") {
        const s: CellStyle = { ...estilo, numFmt: coluna.real ? '"R$" #,##0.00' : coluna.percentual ? "0%" : undefined, alignment: { ...estilo.alignment, horizontal: "right" } };
        por(3 + i, c, { t: "n", v: valor, s });
      } else por(3 + i, c, { t: "s", v: (valor ?? "").slice(0, 32000), s: estilo });
    });
  });
  const ultimaLinha = 3 + Math.max(linhas.length, 1) - 1;
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: ultimaLinha, c: ultima } });
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: ultima } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: ultima } },
  ];
  ws["!cols"] = COLUNAS.map((coluna) => ({ wch: coluna.largura }));
  ws["!rows"] = [{ hpt: 26 }, { hpt: 18 }, { hpt: 34 }];
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 2, c: 0 }, e: { r: ultimaLinha, c: ultima } }) };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Carteira");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
