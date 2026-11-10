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

  it("respeita o sistema do cadastro: processo do TJSP no eproc ainda não tem robô", () => {
    const robo = roboDoProcesso("1012345-67.2023.8.26.0100", "E-PROC");
    expect(robo.disponivel).toBe(false);
    expect(robo.motivo).toContain("eproc do TJSP");
  });

  it("não atende e-SAJ de outro tribunal nem processo sem CNJ", () => {
    expect(roboDoProcesso("0001234-56.2020.8.06.0001", "E-saj").disponivel).toBe(false);
    expect(roboDoProcesso("0001234-56.2020.8.13.0024", "pje").motivo).toContain("PJe do TJMG");
    expect(roboDoProcesso("123", "E-saj")).toMatchObject({ disponivel: false, cnj: null });
  });
});
