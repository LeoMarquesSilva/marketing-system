import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { CRITERIO_DA_MEMORIA, formatarData, formatarReal, type MemoriaDoCalculo } from "./rec-credito";

/** Quem é o processo, no topo do PDF. */
export interface IdentificacaoDoProcesso {
  cnj: string | null;
  ci: string | null;
  cliente: string | null;
  devedor: string | null;
}

const A4 = { largura: 595.28, altura: 841.89 };
const MARGEM = 32;
const CORPO = 8;
const AZUL = rgb(0.063, 0.161, 0.227);
const CINZA = rgb(0.4, 0.45, 0.5);
const LINHA = rgb(0.85, 0.9, 0.92);
const VERDE = rgb(0.02, 0.37, 0.27);

/** Colunas da tabela: largura e alinhamento (a soma cabe na largura útil do A4). */
const COLUNAS = [
  { titulo: "Item", largura: 171, direita: false },
  { titulo: "Desde", largura: 50, direita: false },
  { titulo: "Valor", largura: 64, direita: true },
  { titulo: "Fator de correção", largura: 52, direita: true },
  { titulo: "Corrigido", largura: 64, direita: true },
  { titulo: "Juros", largura: 64, direita: true },
  { titulo: "Total", largura: 66, direita: true },
];

/**
 * As fontes padrão do PDF só têm o alfabeto WinAnsi: troca o que não existe nele (sinal de menos, espaço fino do
 * Intl, travessões longos) e descarta o resto, para o PDF nunca falhar por um caractere.
 */
export function textoSeguro(texto: string): string {
  return texto
    .replace(/[−‒–]/g, "-")
    .replace(/[   ]/g, " ")
    .replace(/[^\x20-\x7e¡-ÿ—‘’“”•…\n]/g, "");
}

function quebrar(texto: string, fonte: PDFFont, tamanho: number, largura: number): string[] {
  const linhas: string[] = [];
  for (const paragrafo of textoSeguro(texto).split("\n")) {
    let atual = "";
    for (const palavra of paragrafo.split(/\s+/).filter(Boolean)) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (atual && fonte.widthOfTextAtSize(tentativa, tamanho) > largura) {
        linhas.push(atual);
        atual = palavra;
      } else atual = tentativa;
    }
    linhas.push(atual);
  }
  return linhas;
}

const fator = (valor: number) => valor.toLocaleString("pt-BR", { minimumFractionDigits: 6, maximumFractionDigits: 6 });
const percentual = (valor: number) => `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;

/** Memória do cálculo do valor atualizado em PDF (A4 retrato), com o processo, a tabela, as observações e o critério. */
export async function montarPdfDaMemoria(memoria: MemoriaDoCalculo, processo: IdentificacaoDoProcesso, vios: string | null, geradoEm: Date = new Date()): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(textoSeguro(`Memória do cálculo${processo.cnj ? ` - ${processo.cnj}` : ""}`));
  pdf.setCreator("ORQESTRAI");
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const larguraUtil = A4.largura - 2 * MARGEM;

  let pagina: PDFPage = pdf.addPage([A4.largura, A4.altura]);
  let y = A4.altura - MARGEM;
  const novaPagina = () => {
    pagina = pdf.addPage([A4.largura, A4.altura]);
    y = A4.altura - MARGEM;
  };
  const caber = (altura: number) => {
    if (y - altura < MARGEM + 14) novaPagina();
  };
  const escrever = (texto: string, x: number, opcoes: { fonte?: PDFFont; tamanho?: number; cor?: ReturnType<typeof rgb>; direita?: number } = {}) => {
    const fonte = opcoes.fonte ?? normal;
    const tamanho = opcoes.tamanho ?? CORPO;
    const seguro = textoSeguro(texto);
    const posicao = opcoes.direita !== undefined ? opcoes.direita - fonte.widthOfTextAtSize(seguro, tamanho) : x;
    pagina.drawText(seguro, { x: posicao, y, size: tamanho, font: fonte, color: opcoes.cor ?? AZUL });
  };
  const paragrafo = (texto: string, opcoes: { fonte?: PDFFont; tamanho?: number; cor?: ReturnType<typeof rgb>; recuo?: number } = {}) => {
    const tamanho = opcoes.tamanho ?? CORPO;
    const recuo = opcoes.recuo ?? 0;
    for (const linha of quebrar(texto, opcoes.fonte ?? normal, tamanho, larguraUtil - recuo)) {
      caber(tamanho + 3);
      escrever(linha, MARGEM + recuo, opcoes);
      y -= tamanho + 3;
    }
  };

  // Cabeçalho
  escrever("Memória do cálculo", MARGEM, { fonte: negrito, tamanho: 15 });
  y -= 18;
  paragrafo(`Valor da ação atualizado pelo cálculo do TJSP até ${formatarData(memoria.ate)}, abatidos os valores levantados, com multa, honorários e guias pagas.`, { cor: CINZA, tamanho: 9 });
  y -= 6;
  const identificacao = [
    ["Processo", processo.cnj ?? "Sem número CNJ"],
    ["CI", processo.ci],
    ["Cliente", processo.cliente],
    ["Devedor", processo.devedor],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  for (const [rotulo, valor] of identificacao) {
    caber(12);
    escrever(`${rotulo}:`, MARGEM, { fonte: negrito, tamanho: 9 });
    const linhas = quebrar(valor, normal, 9, larguraUtil - 56);
    for (const [indice, linha] of linhas.entries()) {
      if (indice) caber(12);
      escrever(linha, MARGEM + 56, { tamanho: 9 });
      y -= 12;
    }
  }
  y -= 8;

  // Tabela
  const cabecalhoDaTabela = () => {
    caber(30);
    pagina.drawRectangle({ x: MARGEM, y: y - 6, width: larguraUtil, height: 20, color: rgb(0.97, 0.98, 0.99) });
    let x = MARGEM;
    for (const coluna of COLUNAS) {
      const linhas = quebrar(coluna.titulo, negrito, 7, coluna.largura - 8);
      const topo = y + (linhas.length > 1 ? 4 : 0);
      for (const [indice, linha] of linhas.entries()) {
        const salvo = y;
        y = topo - indice * 8;
        escrever(linha, x + 4, { fonte: negrito, tamanho: 7, cor: CINZA, direita: coluna.direita ? x + coluna.largura - 4 : undefined });
        y = salvo;
      }
      x += coluna.largura;
    }
    y -= 18;
  };
  cabecalhoDaTabela();

  for (const linha of memoria.linhas) {
    const sobreBase = linha.percentual !== undefined;
    const prefixo = linha.sinal < 0 ? "(-) " : linha.tipo === "acao" ? "" : "(+) ";
    const item = quebrar(`${prefixo}${linha.descricao}`, normal, CORPO, COLUNAS[0].largura - 8);
    if (sobreBase) item.push(...quebrar(`sobre a dívida atualizada de ${formatarReal(linha.valor)}`, normal, 6.5, COLUNAS[0].largura - 8));
    const altura = Math.max(item.length, linha.jurosPercentual ? 2 : 1) * (CORPO + 2) + 6;
    if (y - altura < MARGEM + 14) {
      novaPagina();
      cabecalhoDaTabela();
    }
    const cor = linha.sinal < 0 ? VERDE : AZUL;
    const celulas = [
      sobreBase ? "—" : formatarData(linha.data),
      formatarReal(linha.valor),
      sobreBase ? "—" : fator(linha.fatorCorrecao),
      sobreBase ? "—" : formatarReal(linha.corrigido),
      linha.jurosPercentual ? formatarReal(linha.juros) : "—",
      `${linha.sinal < 0 ? "- " : ""}${formatarReal(linha.total)}`,
    ];
    const topo = y;
    for (const [indice, texto] of item.entries()) {
      y = topo - indice * (CORPO + 2);
      const detalhe = sobreBase && indice >= item.length - 1;
      escrever(texto, MARGEM + 4, { tamanho: detalhe ? 6.5 : CORPO, cor: detalhe ? CINZA : cor });
    }
    let x = MARGEM + COLUNAS[0].largura;
    for (const [indice, texto] of celulas.entries()) {
      const coluna = COLUNAS[indice + 1];
      y = topo;
      escrever(texto, x + 4, { fonte: indice === celulas.length - 1 ? negrito : normal, cor, direita: coluna.direita ? x + coluna.largura - 4 : undefined });
      if (indice === 4 && linha.jurosPercentual) {
        y = topo - (CORPO + 2);
        escrever(percentual(linha.jurosPercentual), x + 4, { tamanho: 6.5, cor: CINZA, direita: x + coluna.largura - 4 });
      }
      x += coluna.largura;
    }
    y = topo - altura;
    pagina.drawLine({ start: { x: MARGEM, y: y + CORPO }, end: { x: MARGEM + larguraUtil, y: y + CORPO }, thickness: 0.5, color: LINHA });
  }

  caber(24);
  pagina.drawRectangle({ x: MARGEM, y: y - 8, width: larguraUtil, height: 22, color: rgb(0.97, 0.98, 0.99) });
  const total = textoSeguro(formatarReal(memoria.total));
  const larguraDoTotal = negrito.widthOfTextAtSize(total, 10.5);
  escrever(`Valor atualizado em ${formatarData(memoria.ate)}`, 0, { fonte: negrito, tamanho: 9.5, direita: MARGEM + larguraUtil - 4 - larguraDoTotal - 16 });
  escrever(total, 0, { fonte: negrito, tamanho: 10.5, direita: MARGEM + larguraUtil - 4 });
  y -= 30;

  // Observações e critério
  if (memoria.avisos.length) {
    for (const aviso of memoria.avisos) paragrafo(aviso, { cor: rgb(0.6, 0.35, 0) });
    y -= 4;
  }
  paragrafo(
    `Honorários de ${memoria.encargos.honorarios.toLocaleString("pt-BR")}% e multa de ${memoria.encargos.multa.toLocaleString("pt-BR")}%: ${memoria.encargos.origem}.`,
    { cor: CINZA }
  );
  if (vios) paragrafo(`No VIOS, o valor da ação atualizado está em ${vios}.`, { cor: CINZA });
  y -= 6;
  caber(14);
  escrever("CRITÉRIO", MARGEM, { fonte: negrito, tamanho: 8, cor: rgb(0.157, 0.373, 0.478) });
  y -= 12;
  for (const item of CRITERIO_DA_MEMORIA) {
    const linhas = quebrar(item, normal, CORPO, larguraUtil - 12);
    for (const [indice, linha] of linhas.entries()) {
      caber(CORPO + 3);
      if (!indice) escrever("•", MARGEM + 2, { cor: CINZA });
      escrever(linha, MARGEM + 12, { cor: CINZA });
      y -= CORPO + 3;
    }
  }

  // Rodapé em todas as páginas
  const quando = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(geradoEm);
  const paginas = pdf.getPages();
  for (const [indice, folha] of paginas.entries()) {
    const rodape = textoSeguro(`Gerado pelo ORQESTRAI em ${quando} · página ${indice + 1} de ${paginas.length}`);
    folha.drawText(rodape, { x: MARGEM, y: MARGEM - 12, size: 7, font: normal, color: CINZA });
  }
  return pdf.save();
}

/** Nome do arquivo: memoria-calculo-<cnj ou ci>-<dia>.pdf */
export function nomeDoPdfDaMemoria(processo: IdentificacaoDoProcesso, ate: string): string {
  const id = (processo.cnj ?? processo.ci ?? "processo").replace(/[^0-9A-Za-z.-]/g, "");
  return `memoria-calculo-${id}-${ate.slice(0, 10)}.pdf`;
}
