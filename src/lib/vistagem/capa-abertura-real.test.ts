import { describe, expect, it } from "vitest";
import { ciDaPastaAberta, pastaDaCapaAberta, situacaoDaAberturaReal, type CapaDoVios, type PedidoDeAbertura } from "./capa-abertura";

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
  it("abre direto, sem simulação antes (pedido de 16/11/2026)", () => {
    expect(situacaoDaAberturaReal([])).toEqual({ pode: true });
    // Uma simulação antiga, com ou sem pendência, não muda nada.
    expect(situacaoDaAberturaReal([pedido({ resultado: { recusaria: ["Matéria"] } })])).toEqual({ pode: true });
  });

  it("na fila ou já aberta, não deixa pedir de novo", () => {
    expect(situacaoDaAberturaReal([pedido({ status: "processando", simulado: false })])).toMatchObject({ pode: false, motivo: expect.stringContaining("na fila") });
    const aberta = pedido({ simulado: false, resultado: { ci_pasta: "61402" } });
    expect(situacaoDaAberturaReal([aberta])).toMatchObject({ pode: false, motivo: "A pasta já foi aberta no VIOS: CI 61402." });
    // Já aberta, nem a conferência no VIOS libera outro pedido.
    expect(situacaoDaAberturaReal([aberta], { conferidoNoVios: true })).toMatchObject({ pode: false });
  });

  it("parada depois do Gravar: só pede de novo quem conferiu no VIOS", () => {
    const parou = pedido({ simulado: false, status: "erro", erro: "ATENÇÃO: o Gravar já tinha sido clicado — confira no VIOS…" });
    expect(situacaoDaAberturaReal([parou])).toEqual({
      pode: false,
      conferirNoVios: true,
      motivo: "O último pedido parou depois do Gravar: confira no VIOS se a pasta foi criada. Se não foi, peça de novo.",
    });
    expect(situacaoDaAberturaReal([parou], { conferidoNoVios: true })).toEqual({ pode: true });
    // Recusa antes do Gravar (ex.: o número já tinha pasta, a pesquisa por cima do botão): pode pedir de novo.
    const recusada = pedido({ simulado: false, status: "erro", erro: "O processo já tem pasta no VIOS (CI 61128): nada foi gravado." });
    expect(situacaoDaAberturaReal([recusada])).toEqual({ pode: true });
  });

  it("a CI da pasta só vale de um pedido de verdade concluído", () => {
    expect(ciDaPastaAberta(pedido({ simulado: false, resultado: { ci_pasta: "61402" } }))).toBe("61402");
    expect(ciDaPastaAberta(pedido({ resultado: { ci_pasta: "61402" } }))).toBeNull();
    expect(ciDaPastaAberta(pedido({ simulado: false, status: "erro", resultado: { ci_pasta: "61402" } }))).toBeNull();
    expect(ciDaPastaAberta(undefined)).toBeNull();
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
