import "server-only";

import type { CellObject, CellStyle, WorkSheet } from "xlsx-js-style";
import * as XLSX from "xlsx-js-style";
import { cabecalho, dado, estiloLegenda, estiloTitulo } from "./export-excel";
import { ROTULO_SITUACAO_ACORDO } from "./acordos";
import { ROTULO_ROBO_AGORA, ROTULO_SITUACAO_CITACAO, SITUACOES_PEDIDO, formatarData, formatarMomento, formatarReal, type LinhaCarteira } from "./rec-credito";

/** Planilha da carteira de Recuperação de Crédito: uma linha por processo, valores como número. */

type Valor = string | number | null;
interface Coluna {
  rotulo: string;
  largura: number;
  formato?: "real" | "percentual";
  valor: (linha: LinhaCarteira) => Valor;
}

const data = (iso: string | null) => (iso ? formatarData(iso) : "");
const situacaoPedido = (valor: string) => SITUACOES_PEDIDO.find((item) => item.valor === valor)?.rotulo ?? valor;

const COLUNAS: Coluna[] = [
  { rotulo: "CI", largura: 10, valor: (linha) => linha.ci },
  { rotulo: "N.º CNJ", largura: 27, valor: (linha) => linha.cnj },
  { rotulo: "Grupo do cliente", largura: 18, valor: (linha) => linha.grupoCliente },
  { rotulo: "Cliente", largura: 28, valor: (linha) => linha.cliente },
  { rotulo: "Devedor", largura: 32, valor: (linha) => linha.devedor },
  { rotulo: "Advogado responsável", largura: 26, valor: (linha) => linha.advogadoResponsavel },
  { rotulo: "Ação", largura: 24, valor: (linha) => linha.acao },
  { rotulo: "Fase", largura: 16, valor: (linha) => linha.fase },
  { rotulo: "Situação", largura: 18, valor: (linha) => linha.situacao },
  { rotulo: "Tipo do crédito", largura: 24, valor: (linha) => linha.tiposCredito.join("; ") },
  { rotulo: "Títulos", largura: 9, valor: (linha) => linha.quantidadeTitulos || null },
  { rotulo: "Valor original", largura: 16, formato: "real", valor: (linha) => linha.valorOriginal },
  { rotulo: "Valor no ajuizamento (TJSP)", largura: 18, formato: "real", valor: (linha) => linha.valorNoAjuizamento },
  { rotulo: "Valor atualizado (TJSP)", largura: 18, formato: "real", valor: (linha) => linha.valorAtualizado },
  { rotulo: "Citação", largura: 18, valor: (linha) => ROTULO_SITUACAO_CITACAO[linha.citacao] },
  { rotulo: "Endereços já pleiteados", largura: 48, valor: (linha) => linha.enderecosTentados.join("\n") },
  {
    rotulo: "Passos realizados e pedidos de execução",
    largura: 56,
    valor: (linha) => linha.pedidos.map((pedido) => `${pedido.data ? `${data(pedido.data)} ` : ""}${pedido.tipo}: ${situacaoPedido(pedido.situacao)}${pedido.resultado ? ` (${pedido.resultado})` : ""}`).join("\n"),
  },
  {
    rotulo: "Acordo",
    largura: 30,
    valor: (linha) =>
      linha.acordo
        ? [
            `${ROTULO_SITUACAO_ACORDO[linha.acordo.resumo.situacao]}: ${formatarReal(linha.acordo.valorTotal)}`,
            `${linha.acordo.resumo.pagas} de ${linha.acordo.resumo.parcelas} parcelas pagas (${formatarReal(linha.acordo.resumo.valorPago)})`,
            linha.acordo.resumo.vencidas ? `${linha.acordo.resumo.vencidas} vencida(s), ${linha.acordo.resumo.diasDeAtraso} dia(s) de atraso` : "",
          ]
            .filter(Boolean)
            .join("\n")
        : "",
  },
  { rotulo: "Pedidos deferidos", largura: 10, valor: (linha) => linha.pedidosDeferidos || null },
  { rotulo: "Guias pagas", largura: 16, formato: "real", valor: (linha) => linha.guiasPagas || null },
  { rotulo: "Valor recuperado", largura: 16, formato: "real", valor: (linha) => linha.valorRecuperado || null },
  { rotulo: "Saving", largura: 10, formato: "percentual", valor: (linha) => (linha.saving === null ? null : linha.saving / 100) },
  { rotulo: "Distribuição", largura: 13, valor: (linha) => data(linha.dataDistribuicao) },
  { rotulo: "Encerramento", largura: 13, valor: (linha) => data(linha.dataEncerramento) },
  { rotulo: "Duração", largura: 18, valor: (linha) => (linha.duracao ? `${linha.duracao.rotulo}${linha.duracao.desde === "cadastro" ? " (desde o cadastro)" : ""}` : "") },
  { rotulo: "Próximos passos", largura: 48, valor: (linha) => linha.proximosPassos },
  {
    rotulo: "Robô: última conferência",
    largura: 20,
    valor: (linha) => [linha.autos.roboEm ? formatarMomento(linha.autos.roboEm) : "nunca", linha.autos.roboAgora ? ROTULO_ROBO_AGORA[linha.autos.roboAgora] : ""].filter(Boolean).join("\n"),
  },
  {
    rotulo: "IA: última leitura",
    largura: 20,
    valor: (linha) =>
      [
        linha.autos.iaEm ? formatarMomento(linha.autos.iaEm) : linha.autos.documentos ? "não lida" : "sem autos",
        linha.autos.iaPendentes ? `${linha.autos.iaPendentes} por ler` : "",
        linha.autos.iaErros ? `${linha.autos.iaErros} com erro` : "",
      ]
        .filter(Boolean)
        .join("\n"),
  },
  { rotulo: "Observações do cálculo", largura: 40, valor: (linha) => linha.avisos.join("\n") },
];

const FORMATO = { real: '"R$" #,##0.00', percentual: "0.0%" };

export function montarPlanilhaDaCarteira(linhas: LinhaCarteira[], indicesAte: string | null, agora: Date = new Date()): Buffer {
  const ws: WorkSheet = {};
  const ultima = COLUNAS.length - 1;
  const geradaEm = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(agora);
  const indices = indicesAte ? `índices do TJSP até ${indicesAte.slice(5, 7)}/${indicesAte.slice(0, 4)}` : "sem índices do TJSP";
  const por = (r: number, c: number, item: CellObject) => {
    ws[XLSX.utils.encode_cell({ r, c })] = item;
  };
  por(0, 0, { t: "s", v: "Carteira de Recuperação de Crédito — Bismarchi | Pires", s: estiloTitulo });
  por(1, 0, {
    t: "s",
    v: `Gerada em ${geradaEm} · ${linhas.length} processo${linhas.length === 1 ? "" : "s"} · Atualização pela Tabela Prática do TJSP (Lei 14.905/2024), juros de 1% a.m. até 27/08/2024 e taxa legal depois · ${indices} · Saving = valor recuperado ÷ valor atualizado`,
    s: estiloLegenda,
  });
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
        const s: CellStyle = { ...estilo, numFmt: coluna.formato ? FORMATO[coluna.formato] : undefined, alignment: { ...estilo.alignment, horizontal: "right" } };
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
