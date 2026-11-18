import { describe, expect, it } from "vitest";
import { etiquetasDaPasta, listasDasPastas, montarCapa, nomesDaLista, resumoDaCapa, type DadosDaCapa, type ListasDoVios } from "./capa-abertura";

const pasta = (cliente: string, grupo: string | null, acao: string | null, etiquetas: string | null) => ({ cliente, grupoCliente: grupo, acao, etiquetas });

describe("listas do Processos Completo", () => {
  it("separa as etiquetas como o relatório do VIOS manda", () => {
    expect(etiquetasDaPasta("Carteira Ex-Cliente | Demanda de risco")).toEqual(["Carteira Ex-Cliente", "Demanda de risco"]);
    expect(etiquetasDaPasta("Carteira Lira; Demanda de risco")).toEqual(["Carteira Lira", "Demanda de risco"]);
    expect(etiquetasDaPasta(null)).toEqual([]);
  });

  it("clientes em ordem alfabética com o grupo mais frequente; ações e etiquetas mais usadas primeiro", () => {
    const listas = listasDasPastas([
      pasta("Lira Alimentos Ltda", "Grupo Lira", "Agravo de instrumento", "Carteira Lira"),
      pasta("Lira Alimentos Ltda", "Grupo Lira", "Habilitação de Crédito", "Carteira Lira | Demanda de risco"),
      pasta("LIRA ALIMENTOS LTDA", "Grupo Ex-Cliente", "Habilitação de Crédito", "Carteira Ex-Cliente"),
      pasta("Acme S.A.", null, null, null),
    ]);
    expect(listas.clientes).toEqual([
      { nome: "Acme S.A.", grupo: null, pastas: 1 },
      { nome: "Lira Alimentos Ltda", grupo: "Grupo Lira", pastas: 3 },
    ]);
    expect(listas.acoes).toEqual(["Habilitação de Crédito", "Agravo de instrumento"]);
    expect(listas.etiquetas).toEqual(["Carteira Lira", "Carteira Ex-Cliente", "Demanda de risco"]);
  });

  it("os nomes de cada lista, inclusive a de clientes", () => {
    const listas: Partial<ListasDoVios> = { clientes: [{ nome: "Acme S.A.", grupo: null, pastas: 1 }], acoes: ["Falência"] };
    expect(nomesDaLista(listas, "clientes")).toEqual(["Acme S.A."]);
    expect(nomesDaLista(listas, "acoes")).toEqual(["Falência"]);
    expect(nomesDaLista(listas, "etiquetas")).toEqual([]);
  });
});

describe("campos que se escolhem numa lista do VIOS", () => {
  const dados: DadosDaCapa = {
    numero: "2266041-23.2026.8.26.0000",
    djen: null,
    esaj: { classe: "Agravo de Instrumento", assunto: null, foro: null, vara: null, orgaoJulgador: null, distribuicao: "06/11/2026", valor: 1000 },
    datajud: null,
    area: "Insolvência",
    grupo: "Grupo Lira",
    cliente: "lira alimentos industria e comercio ltda",
    par: { responsavel: "Manuela Lutke", auxiliar: "Pedro Vittale Rossi", pastas: 4 },
  };
  const listas: ListasDoVios = {
    usuarios: ["Manuela Lutke", "Pedro Vittale Rossi"],
    materias: ["FALENCIA"],
    sistemas: ["E-saj"],
    clientes: [{ nome: "Lira Alimentos Industria e Comercio Ltda", grupo: "Grupo Lira", pastas: 40 }],
    acoes: ["Agravo de instrumento", "Habilitação de Crédito"],
    etiquetas: ["Carteira Lira", "Demanda de risco"],
  };
  const campo = (campos: ReturnType<typeof montarCapa>, chave: string) => campos.find((item) => item.chave === chave);

  it("o valor das fontes fica com a grafia do VIOS quando está na lista", () => {
    const campos = montarCapa(dados, { listas });
    expect(campo(campos, "cliente")?.valor).toBe("Lira Alimentos Industria e Comercio Ltda");
    expect(campo(campos, "cliente")?.foraDaLista).toBeUndefined();
    expect(campo(campos, "acao")?.valor).toBe("Agravo de instrumento");
    expect(campo(campos, "etiqueta")?.valor).toBe("Carteira Lira");
  });

  it("o que não está na lista do VIOS fica marcado para conferir", () => {
    const campos = montarCapa({ ...dados, cliente: "Cliente Novo Ltda", grupo: "Grupo Novo" }, { listas });
    expect(campo(campos, "cliente")).toMatchObject({ valor: "Cliente Novo Ltda", conferir: true, foraDaLista: ["Cliente Novo Ltda"] });
    expect(campo(campos, "etiqueta")).toMatchObject({ foraDaLista: ["Carteira Novo"] });
    expect(resumoDaCapa(campos).conferir.map((item) => item.chave)).toContain("etiqueta");
  });

  it("vale também para o que a controladoria editou, item a item nas etiquetas", () => {
    const ajuste = (valor: string) => ({ valor, por: "u1", porNome: "Maria", em: "2026-11-13T12:00:00.000Z" });
    const campos = montarCapa(dados, { listas, ajustes: { etiqueta: ajuste("carteira lira; Etiqueta Nova"), acao: ajuste("habilitação de crédito") } });
    expect(campo(campos, "etiqueta")).toMatchObject({ valor: "Carteira Lira; Etiqueta Nova", fonte: "editado", conferir: true, foraDaLista: ["Etiqueta Nova"] });
    expect(campo(campos, "acao")).toMatchObject({ valor: "Habilitação de Crédito", fonte: "editado", conferir: false });
    expect(campo(campos, "acao")?.foraDaLista).toBeUndefined();
  });

  it("sem a lista (não carregou), nada é marcado", () => {
    const campos = montarCapa({ ...dados, cliente: "Cliente Novo Ltda" }, { listas: { usuarios: [], materias: [], sistemas: [] } });
    expect(campo(campos, "cliente")?.foraDaLista).toBeUndefined();
  });
});
