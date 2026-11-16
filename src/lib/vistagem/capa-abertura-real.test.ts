import { describe, expect, it } from "vitest";
import { ciDaPastaAberta, mesmaCapa, pastaDaCapaAberta, situacaoDaAberturaReal, type CapaDoVios, type PedidoDeAbertura } from "./capa-abertura";

// A capa do Embargos de Declaração 0155097-64.2026.8.16.0000 (TJPR, Mix Etiquetas), simulada pela Giovanna em 16/11/2026.
const CAPA = {
  cnj: "0155097-64.2026.8.16.0000",
  jurisdicao: "SEGUNDO GRAU",
  justica: "Justiça Estadual",
  orgao: "Tribunal de Justiça do Estado do Paraná",
  sistema: "projudi",
  uf: "PR",
  cidade: "Curitiba",
  vara: "14ª",
  tipoVara: "Câmara Cível",
  acao: "Embargos de declaração cível",
  fase: "Recursal",
  dataAcao: "27/10/2026",
  valor: "161.341,87",
  situacao: "Ativo",
  segredo: "Não",
  polo: "Ativo",
  cliente: "Mix Etiquetas e Rotulos Ltda",
  escritorio: "BISMARCHI PIRES SOCIEDADE DE ADVOGADOS",
  departamento: "Insolvência",
  area: "Cível | Insolvência",
  responsavel: "Gabriella Borim Assumpção",
  auxiliar: "Mariana Manuel Araújo",
  etiquetas: ["Carteira Mix Etiquetas", "Demanda de risco"],
  materias: ["CEDULA DE CREDITO BANCARIO"],
} as unknown as CapaDoVios;

const pedido = (extra: Partial<PedidoDeAbertura>): PedidoDeAbertura => ({
  id: "p",
  status: "concluido",
  erro: null,
  simulado: true,
  autor: "Giovanna Pereira de Souza",
  criadoEm: "2026-11-16T13:21:03.000Z",
  atualizadoEm: null,
  resultado: { preenchidos: { cnj: CAPA.cnj as string }, nao_encontrados: [], recusaria: [] },
  capa: CAPA,
  ...extra,
});

describe("abertura de verdade (Fase 3, 16/11/2026)", () => {
  it("pode abrir depois de uma simulação sem pendência com a mesma capa", () => {
    expect(situacaoDaAberturaReal([pedido({})], CAPA)).toEqual({ pode: true });
    // A tela não compara a capa: o servidor compara ao receber o pedido.
    expect(situacaoDaAberturaReal([pedido({})])).toEqual({ pode: true });
  });

  it("sem simulação, com pendência ou com a capa mudada, simula de novo", () => {
    expect(situacaoDaAberturaReal([], CAPA)).toMatchObject({ pode: false, motivo: "Simule a abertura antes de abrir de verdade." });
    const comPendencia = pedido({ resultado: { recusaria: ["Matéria"] } });
    expect(situacaoDaAberturaReal([comPendencia], CAPA)).toMatchObject({ pode: false, motivo: expect.stringContaining("teve pendência") });
    const outraCapa = { ...CAPA, valor: "0,01" } as CapaDoVios;
    expect(situacaoDaAberturaReal([pedido({})], outraCapa)).toMatchObject({ pode: false, motivo: expect.stringContaining("A capa mudou") });
  });

  it("na fila, já aberta ou parada depois do Gravar, não deixa pedir de novo", () => {
    expect(situacaoDaAberturaReal([pedido({ status: "processando", simulado: false }), pedido({})], CAPA)).toMatchObject({ pode: false, motivo: expect.stringContaining("na fila") });
    const aberta = pedido({ simulado: false, resultado: { ci_pasta: "61402" } });
    expect(situacaoDaAberturaReal([aberta, pedido({})], CAPA)).toMatchObject({ pode: false, motivo: "A pasta já foi aberta no VIOS: CI 61402." });
    const parou = pedido({ simulado: false, status: "erro", erro: "ATENÇÃO: o Gravar já tinha sido clicado — confira no VIOS…" });
    expect(situacaoDaAberturaReal([parou, pedido({})], CAPA)).toMatchObject({ pode: false, motivo: expect.stringContaining("parou depois do Gravar") });
    // Recusa antes do Gravar (ex.: o número já tinha pasta): depois de resolver, pode simular e abrir de novo.
    const recusada = pedido({ simulado: false, status: "erro", erro: "O processo já tem pasta no VIOS (CI 61128): nada foi gravado." });
    expect(situacaoDaAberturaReal([pedido({ id: "nova" }), recusada], CAPA)).toEqual({ pode: true });
  });

  it("a CI da pasta só vale de um pedido de verdade concluído", () => {
    expect(ciDaPastaAberta(pedido({ simulado: false, resultado: { ci_pasta: "61402" } }))).toBe("61402");
    expect(ciDaPastaAberta(pedido({ resultado: { ci_pasta: "61402" } }))).toBeNull();
    expect(ciDaPastaAberta(pedido({ simulado: false, status: "erro", resultado: { ci_pasta: "61402" } }))).toBeNull();
    expect(ciDaPastaAberta(undefined)).toBeNull();
  });

  it("mesma capa não depende da ordem das chaves nem de espaço sobrando", () => {
    const reordenada = Object.fromEntries(Object.entries(CAPA).reverse()) as CapaDoVios;
    expect(mesmaCapa(CAPA, reordenada)).toBe(true);
    expect(mesmaCapa(CAPA, { ...CAPA, cliente: " Mix Etiquetas e Rotulos Ltda " } as CapaDoVios)).toBe(true);
    expect(mesmaCapa(CAPA, { ...CAPA, etiquetas: ["Carteira Mix Etiquetas"] } as CapaDoVios)).toBe(false);
    expect(mesmaCapa(CAPA, null)).toBe(false);
  });

  it("a pasta aberta vai para a triagem montada da capa (o SIOE só copia de madrugada)", () => {
    expect(pastaDaCapaAberta("61402", CAPA, "Grupo Mix Etiquetas")).toEqual({
      ci: "61402",
      cnj: "0155097-64.2026.8.16.0000",
      vinculo: null,
      cliente: "Mix Etiquetas e Rotulos Ltda",
      grupoCliente: "Grupo Mix Etiquetas",
      area: "Cível | Insolvência",
      advogadoResponsavel: "Gabriella Borim Assumpção",
      situacao: "Ativo",
      etiquetas: "Carteira Mix Etiquetas | Demanda de risco",
      acao: "Embargos de declaração cível",
      fase: "Recursal",
      valorAcao: 161341.87,
    });
  });
});
