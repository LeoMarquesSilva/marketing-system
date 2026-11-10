import { describe, expect, it } from "vitest";
import { comecaComoPdf, ehPaginaDeLogin, ehPaginaDoProcesso, escolherCertificado, lerCnj, nomeDoPdf, tribunalEsaj, tribunalEsajDoCnj, urlDaConsulta, urlDeLogin } from "./esaj-urls";

const TJSP = tribunalEsaj("TJSP");

describe("lerCnj", () => {
  it("separa o número, o foro e o grau", () => {
    expect(lerCnj("10123456720248260114")).toEqual({ mascarado: "1012345-67.2024.8.26.0114", numeroDigitoAno: "1012345-67.2024", foro: "0114", segundoGrau: false });
    expect(lerCnj("2001234-56.2025.8.26.0000")?.segundoGrau).toBe(true);
    expect(lerCnj("1012345-67.2024")).toBeNull();
  });
});

describe("endereços do e-SAJ", () => {
  it("consulta o 1º grau no cpopg e o 2º grau no cposg", () => {
    const primeiro = urlDaConsulta(TJSP, lerCnj("1012345-67.2024.8.26.0114")!);
    expect(primeiro).toContain("https://esaj.tjsp.jus.br/cpopg/search.do?");
    expect(primeiro).toContain("numeroDigitoAnoUnificado=1012345-67.2024&foroNumeroUnificado=0114");
    expect(primeiro).toContain("dadosConsulta.valorConsultaNuUnificado=1012345-67.2024.8.26.0114");
    const segundo = urlDaConsulta(TJSP, lerCnj("2001234-56.2025.8.26.0000")!);
    expect(segundo).toContain("/cposg/search.do?");
    expect(segundo).toContain("dePesquisaNuUnificado=2001234-56.2025.8.26.0000");
  });

  it("reconhece a página de login", () => {
    expect(ehPaginaDeLogin(urlDeLogin(TJSP.base))).toBe(true);
    expect(ehPaginaDeLogin("https://esaj.tjsp.jus.br/esaj/portal.do?servico=740000")).toBe(false);
  });

  it("reconhece a página do processo, principal ou incidente", () => {
    const cnj = lerCnj("0001234-56.2026.8.26.0114")!;
    expect(ehPaginaDoProcesso("https://esaj.tjsp.jus.br/cpopg/show.do?processo.codigo=XX&processo.foro=114&processo.numero=0001234-56.2026.8.26.0114", "", cnj)).toBe(true);
    expect(ehPaginaDoProcesso("https://esaj.tjsp.jus.br/cposg/show.do?processo.codigo=XX", "Agravo 0001234-56.2026.8.26.0114", cnj)).toBe(true);
    expect(ehPaginaDoProcesso("https://esaj.tjsp.jus.br/cpopg/show.do?processo.codigo=XX&processo.numero=1009876-54.2025.8.26.0114", "1009876-54.2025.8.26.0114", cnj)).toBe(false);
    expect(ehPaginaDoProcesso("https://esaj.tjsp.jus.br/cpopg/search.do?numero=0001234-56.2026.8.26.0114", "", cnj)).toBe(false);
  });

  it("dá nome ao PDF pelo número do processo", () => {
    expect(nomeDoPdf(lerCnj("10123456720248260114")!)).toBe("Autos 1012345-67.2024.8.26.0114.pdf");
  });
});

describe("tribunais do e-SAJ", () => {
  it("acha o tribunal pelo J.TR do número", () => {
    expect(tribunalEsajDoCnj("0001234-56.2024.8.06.0001")?.sigla).toBe("TJCE");
    expect(tribunalEsajDoCnj("0001234-56.2024.8.02.0001")?.sigla).toBe("TJAL");
    expect(tribunalEsajDoCnj("0001234-56.2024.8.12.0001")?.sigla).toBe("TJMS");
    expect(tribunalEsajDoCnj("0001234-56.2024.8.13.0001")).toBeNull();
    expect(tribunalEsajDoCnj("0001234-56.2024.5.02.0001")).toBeNull();
  });

  it("usa o endereço e o caminho de cada grau do tribunal", () => {
    expect(urlDaConsulta(tribunalEsaj("TJCE"), lerCnj("0001234-56.2024.8.06.0001")!)).toContain("https://esaj.tjce.jus.br/cpopg/search.do?");
    expect(urlDaConsulta(tribunalEsaj("TJCE"), lerCnj("0001234-56.2024.8.06.0000")!)).toContain("https://esaj.tjce.jus.br/cposg5/search.do?");
    expect(urlDaConsulta(tribunalEsaj("TJAL"), lerCnj("0001234-56.2024.8.02.0001")!)).toContain("https://www2.tjal.jus.br/cpopg/search.do?");
    expect(urlDaConsulta(tribunalEsaj("TJMS"), lerCnj("0001234-56.2024.8.12.0001")!)).toContain("https://esaj.tjms.jus.br/cpopg5/search.do?");
    expect(urlDeLogin(tribunalEsaj("TJCE").base)).toBe("https://esaj.tjce.jus.br/sajcas/login?service=https%3A%2F%2Fesaj.tjce.jus.br%2Fesaj%2Fj_spring_cas_security_check");
  });
});

describe("comecaComoPdf", () => {
  it("aceita PDF e recusa página de erro em HTML", () => {
    expect(comecaComoPdf(new TextEncoder().encode("%PDF-1.7\n"))).toBe(true);
    expect(comecaComoPdf(new TextEncoder().encode("<html>erro</html>"))).toBe(false);
    expect(comecaComoPdf(new Uint8Array())).toBe(false);
  });
});

describe("escolherCertificado", () => {
  const lista = ["Selecione o certificado", "MARIA EXEMPLO DA SILVA:12345678901", "JOÃO EXEMPLO PEREIRA:98765432100"];

  it("escolhe pelo trecho do nome, sem ligar para acento ou caixa", () => {
    expect(escolherCertificado(lista, "joao exemplo")).toBe(2);
    expect(escolherCertificado(lista, "Maria")).toBe(1);
  });

  it("sem trecho, só escolhe quando há um único certificado", () => {
    expect(escolherCertificado(["Selecione o certificado", "MARIA EXEMPLO DA SILVA:12345678901"], "")).toBe(1);
    expect(escolherCertificado(lista, "")).toBe(-1);
  });

  it("deixa para a pessoa quando o trecho não bate ou bate em mais de um", () => {
    expect(escolherCertificado(lista, "Carlos")).toBe(-1);
    expect(escolherCertificado(lista, "exemplo")).toBe(-1);
    expect(escolherCertificado([], "Maria")).toBe(-1);
  });
});
