import { describe, expect, it } from "vitest";
import { areaDaLista, importarVistadores, tipoDaLinha, type LinhaDaListaUsuarios } from "./vistadores-importacao";
import { TODAS_AS_AREAS_VISTAGEM, nomesDosVistadores, vistadoresDa } from "./vistadores";

const linha = (nome: string, area: string, gerente: string | null = null, responsavel = true): LinhaDaListaUsuarios => ({
  nome,
  email: null,
  area,
  responsavel,
  gerente,
});

describe("áreas e tipos da lista USUARIOS", () => {
  it("converte a área da lista para a do sistema", () => {
    expect(areaDaLista("CÍVEL | INSOLVÊNCIA")).toBe("Cível | Insolvência");
    expect(areaDaLista("RECUPERAÇÃO DE CRÉDITO")).toBe("Recuperação de Crédito");
    expect(areaDaLista("SPECIAL SITUATIONS")).toBe("Distressed Deals");
    expect(areaDaLista("TODAS")).toBe(TODAS_AS_AREAS_VISTAGEM);
    expect(areaDaLista("Área inventada")).toBeNull();
  });

  it("GERENTE = SIM vai para as demandas de risco", () => {
    expect(tipoDaLinha({ gerente: "SIM" })).toBe("risco");
    expect(tipoDaLinha({ gerente: "Sim" })).toBe("risco");
    expect(tipoDaLinha({ gerente: "NÃO" })).toBe("normal");
    expect(tipoDaLinha({ gerente: null })).toBe("normal");
  });
});

describe("importarVistadores", () => {
  it("entra só quem é responsável pela vistagem, por área e tipo, sem repetir", () => {
    const resultado = importarVistadores(
      [
        linha("Giancarlo", "CÍVEL", "SIM"),
        linha("GIANCARLO", "CÍVEL", "SIM"),
        linha("Maria Caroline", "CÍVEL"),
        linha("Fernanda", "TRABALHISTA", null, false),
        linha("Ricardo Pires", "TODAS"),
        linha("Fulano", "MARKETING"),
      ],
      {}
    );
    expect(vistadoresDa("Cível", "risco", resultado.mapa)).toEqual(["Giancarlo"]);
    expect(vistadoresDa("Cível", "normal", resultado.mapa)).toEqual(["Maria Caroline"]);
    expect(vistadoresDa(TODAS_AS_AREAS_VISTAGEM, "normal", resultado.mapa)).toEqual(["Ricardo Pires"]);
    expect(nomesDosVistadores(resultado.mapa)).not.toContain("Fernanda");
    expect(resultado.ignorados).toEqual([{ nome: "Fulano", motivo: 'área "MARKETING" não existe no sistema' }]);
    expect(resultado.responsaveis).toBe(5);
  });

  it("quem já está cadastrado fica no tipo escolhido no sistema (ex.: Giovani comum, mesmo com GERENTE = SIM)", () => {
    const resultado = importarVistadores([linha("Giovani", "CÍVEL", "SIM"), linha("Isadora", "TRABALHISTA")], {
      Cível: { normal: ["Giovani"] },
      Trabalhista: { normal: ["Isadora"], risco: ["Caroline Abdalla"] },
    });
    expect(vistadoresDa("Cível", "risco", resultado.mapa)).toEqual([]);
    expect(vistadoresDa("Cível", "normal", resultado.mapa)).toEqual(["Giovani"]);
    // Quem não está na lista continua (a importação só acrescenta).
    expect(vistadoresDa("Trabalhista", "risco", resultado.mapa)).toEqual(["Caroline Abdalla"]);
    expect(resultado.novos).toEqual([]);
  });

  it("quem o admin pôs nos dois tipos continua nos dois depois de atualizar da lista", () => {
    const resultado = importarVistadores([linha("Giovani", "CÍVEL", "SIM")], { Cível: { normal: ["Giovani"], risco: ["Giovani"] } });
    expect(vistadoresDa("Cível", "normal", resultado.mapa)).toEqual(["Giovani"]);
    expect(vistadoresDa("Cível", "risco", resultado.mapa)).toEqual(["Giovani"]);
    expect(resultado.novos).toEqual([]);
  });

  it("usa o nome completo achado pelo e-mail", () => {
    const resultado = importarVistadores([{ ...linha("Giovani", "CÍVEL"), email: "giovani@x" }], {}, (item) =>
      item.email === "giovani@x" ? "Giovani Nome Completo" : item.nome
    );
    expect(resultado.novos).toEqual([{ area: "Cível", tipo: "normal", nome: "Giovani Nome Completo" }]);
  });

  it("aceita o formato antigo (um nome só) no mapa em vigor", () => {
    const antigo = { Trabalhista: { normal: "Isadora Godoy" } } as unknown as Parameters<typeof importarVistadores>[1];
    const resultado = importarVistadores([], antigo);
    expect(vistadoresDa("Trabalhista", "normal", resultado.mapa)).toEqual(["Isadora Godoy"]);
  });
});
