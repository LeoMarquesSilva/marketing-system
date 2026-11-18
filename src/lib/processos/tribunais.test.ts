import { describe, expect, it } from "vitest";
import { lerSistema, roboDoProcesso, tribunalDoCnj } from "./tribunais";

describe("tribunalDoCnj", () => {
  it("lê o tribunal do J.TR", () => {
    expect(tribunalDoCnj("1012345-67.2023.8.26.0100")).toBe("TJSP");
    expect(tribunalDoCnj("0001234-56.2020.8.06.0001")).toBe("TJCE");
    expect(tribunalDoCnj("0001234-56.2020.5.02.0001")).toBe("TRT2");
  });

  it("devolve nulo sem os 20 dígitos", () => {
    expect(tribunalDoCnj("1012345-67.2023")).toBeNull();
    expect(tribunalDoCnj(null)).toBeNull();
  });
});

describe("lerSistema", () => {
  it("entende as grafias do cadastro", () => {
    expect(lerSistema("E-saj")).toBe("esaj");
    expect(lerSistema("E-PROC")).toBe("eproc");
    expect(lerSistema("pje")).toBe("pje");
    expect(lerSistema("projudi")).toBe("projudi");
    expect(lerSistema("Próprio")).toBe("outro");
    expect(lerSistema("")).toBeNull();
  });
});

describe("roboDoProcesso", () => {
  it("atende o e-SAJ do TJSP", () => {
    expect(roboDoProcesso("10123456720238260100", "E-saj")).toMatchObject({ cnj: "1012345-67.2023.8.26.0100", tribunal: "TJSP", sistema: "esaj", disponivel: true, motivo: null });
  });

  it("usa o sistema mais comum do tribunal quando o cadastro não diz", () => {
    expect(roboDoProcesso("1012345-67.2023.8.26.0100", null)).toMatchObject({ sistema: "esaj", disponivel: true });
  });

  it("respeita o sistema do cadastro: processo do TJSP no eproc vai para o conector do eproc", () => {
    expect(roboDoProcesso("1012345-67.2023.8.26.0100", "E-PROC")).toMatchObject({ tribunal: "TJSP", sistema: "eproc", disponivel: true, motivo: null });
    const santaCatarina = roboDoProcesso("5001234-56.2023.8.24.0001", "E-PROC");
    expect(santaCatarina.disponivel).toBe(false);
    expect(santaCatarina.motivo).toContain("eproc do TJSC");
  });

  it("atende o e-SAJ do TJCE, do TJAL e do TJMS", () => {
    expect(roboDoProcesso("0001234-56.2020.8.06.0001", "E-saj")).toMatchObject({ tribunal: "TJCE", sistema: "esaj", disponivel: true });
    expect(roboDoProcesso("0001234-56.2020.8.02.0001", null)).toMatchObject({ tribunal: "TJAL", sistema: "esaj", disponivel: true });
    expect(roboDoProcesso("0001234-56.2020.8.12.0001", "E-saj")).toMatchObject({ tribunal: "TJMS", disponivel: true });
  });

  // Números fictícios (dígito verificador inválido de propósito).
  it("manda o TJRJ para o eproc, inclusive o que o cadastro chama de Próprio (DCP) ou PJe", () => {
    expect(roboDoProcesso("00123456720198190001", "Próprio")).toMatchObject({ cnj: "0012345-67.2019.8.19.0001", tribunal: "TJRJ", sistema: "eproc", disponivel: true, motivo: null });
    expect(roboDoProcesso("0801234-56.2024.8.19.0001", "pje")).toMatchObject({ tribunal: "TJRJ", sistema: "eproc", disponivel: true });
    expect(roboDoProcesso("3001234-56.2026.8.19.0001", "E-PROC")).toMatchObject({ tribunal: "TJRJ", sistema: "eproc", disponivel: true });
    expect(roboDoProcesso("0012345-67.2019.8.19.0001", null)).toMatchObject({ tribunal: "TJRJ", sistema: "eproc", disponivel: true });
  });

  it("só o TJRJ troca o sistema antigo pelo eproc", () => {
    expect(roboDoProcesso("0001234-56.2020.8.13.0024", "Próprio")).toMatchObject({ tribunal: "TJMG", sistema: "outro", disponivel: false });
  });

  it("não atende e-SAJ de tribunal sem conector nem processo sem CNJ", () => {
    expect(roboDoProcesso("0001234-56.2020.8.04.0001", "E-saj").disponivel).toBe(false);
    expect(roboDoProcesso("0001234-56.2020.8.13.0024", "pje").motivo).toContain("PJe do TJMG");
    expect(roboDoProcesso("123", "E-saj")).toMatchObject({ disponivel: false, cnj: null });
  });
});
