import { describe, expect, it } from "vitest";
import { avisoDasRepetidas, impressoesDasPaginas, marcasLidas, paginasParaLer } from "./paginas-repetidas";

const CORPO = [
  "Vistos. Trata-se de execução de título extrajudicial fundada em cédula de crédito bancário.",
  "Defiro a pesquisa de bens pelo SISBAJUD no valor de R$ 10.000,00, intimando-se a parte autora.",
  "Decorrido o prazo sem manifestação, tornem conclusos para deliberação sobre o prosseguimento.",
];

/** Peça com o carimbo do sistema de origem em cima e embaixo (o número muda a cada página). */
function pagina(corpo: string, carimbo: string, numero: number): string {
  return [`${carimbo} - fls. ${numero}`, corpo, `Documento assinado digitalmente conforme a lei - página ${numero}`].join("\n");
}

function pdf(carimbo: string, corpos: string[]): string[] {
  return corpos.map((corpo, i) => pagina(corpo, carimbo, i + 1));
}

const pecas = (n: number) => Array.from({ length: n }, (_, i) => `${CORPO[i % CORPO.length]} Peça número ${i + 1}, com o texto próprio desta folha dos autos. `.repeat(2));

describe("páginas repetidas na leitura dos autos", () => {
  it("o mesmo PDF baixado de novo não vai à IA", () => {
    const antigo = pdf("TRIBUNAL DE JUSTIÇA", pecas(6));
    const lidas = new Set(marcasLidas(impressoesDasPaginas(antigo), [{ inicio: 1, fim: 6 }]));
    const novo = [...antigo, pagina("Sentença: julgo procedente o pedido e condeno a executada ao pagamento integral do débito, com custas.", "TRIBUNAL DE JUSTIÇA", 7)];
    const resultado = paginasParaLer(novo, impressoesDasPaginas(novo), lidas);
    expect(resultado.deOutroPdf).toBe(6);
    expect(resultado.paginas.slice(0, 6).every((p) => p === "")).toBe(true);
    expect(resultado.paginas[6]).toBe(novo[6]);
  });

  it("a mesma peça vinda de outro sistema, com outro carimbo, também conta como lida", () => {
    const corpos = pecas(6);
    const doTribunal = pdf("e-SAJ PRIMEIRO GRAU", corpos);
    const doJusbr = pdf("JUS.BR CONSULTA PROCESSUAL 27/11/2026", corpos);
    const lidas = new Set(marcasLidas(impressoesDasPaginas(doTribunal), [{ inicio: 1, fim: 6 }]));
    expect(paginasParaLer(doJusbr, impressoesDasPaginas(doJusbr), lidas).deOutroPdf).toBe(6);
  });

  it("decisão do mesmo modelo que muda um valor é página nova", () => {
    const base = pecas(5);
    const antigo = pdf("TRIBUNAL", base);
    const lidas = new Set(marcasLidas(impressoesDasPaginas(antigo), [{ inicio: 1, fim: 5 }]));
    const mudada = base.map((p, i) => (i === 1 ? p.replace("R$ 10.000,00", "R$ 12.500,00") : p));
    const novo = pdf("TRIBUNAL", mudada);
    const resultado = paginasParaLer(novo, impressoesDasPaginas(novo), lidas);
    expect(resultado.deOutroPdf).toBe(4);
    expect(resultado.paginas[1]).toBe(novo[1]);
  });

  it("página repetida dentro do mesmo PDF é lida só uma vez", () => {
    const corpos = pecas(4);
    const comRepeticao = pdf("JUS.BR", [...corpos, corpos[1], corpos[2]]);
    const resultado = paginasParaLer(comRepeticao, impressoesDasPaginas(comRepeticao), new Set());
    expect(resultado.noMesmoPdf).toBe(2);
    expect(resultado.paginas.filter(Boolean)).toHaveLength(4);
  });

  it("folhas só com carimbo ou com pouco texto nunca são dadas como repetidas", () => {
    const vazias = Array.from({ length: 6 }, (_, i) => pagina("Certidão.", "TRIBUNAL", i + 1));
    const resultado = paginasParaLer(vazias, impressoesDasPaginas(vazias), new Set());
    expect(resultado.noMesmoPdf).toBe(0);
  });

  it("só guarda as marcas dos trechos que a IA leu de fato", () => {
    const paginas = pdf("TRIBUNAL", pecas(6));
    const impressoes = impressoesDasPaginas(paginas);
    const lidas = new Set(marcasLidas(impressoes, [{ inicio: 1, fim: 3 }]));
    const resultado = paginasParaLer(paginas, impressoes, lidas);
    expect(resultado.deOutroPdf).toBe(3);
    expect(resultado.paginas.slice(3).every(Boolean)).toBe(true);
  });

  it("o aviso diz quantas páginas ficaram de fora e por quê", () => {
    expect(avisoDasRepetidas({ deOutroPdf: 0, noMesmoPdf: 0 })).toBeNull();
    expect(avisoDasRepetidas({ deOutroPdf: 40, noMesmoPdf: 1 })).toBe(
      "41 páginas não foram para a IA: 40 já lidas em outro PDF deste processo e 1 repetida dentro deste PDF."
    );
  });
});
