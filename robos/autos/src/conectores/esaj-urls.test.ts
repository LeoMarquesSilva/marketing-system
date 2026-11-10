import { describe, expect, it } from "vitest";
import { ESAJ_TJSP, comecaComoPdf, ehPaginaDeLogin, escolherCertificado, lerCnj, nomeDoPdf, urlDaConsulta, urlDeLogin } from "./esaj-urls";

describe("lerCnj", () => {
  it("separa o número, o foro e o grau", () => {
    expect(lerCnj("10123456720248260114")).toEqual({ mascarado: "1012345-67.2024.8.26.0114", numeroDigitoAno: "1012345-67.2024", foro: "0114", segundoGrau: false });
    expect(lerCnj("2001234-56.2025.8.26.0000")?.segundoGrau).toBe(true);
    expect(lerCnj("1012345-67.2024")).toBeNull();
  });
});

describe("endereços do e-SAJ", () => {
  it("consulta o 1º grau no cpopg e o 2º grau no cposg", () => {
    const primeiro = urlDaConsulta(ESAJ_TJSP, lerCnj("1012345-67.2024.8.26.0114")!);
    expect(primeiro).toContain("https://esaj.tjsp.jus.br/cpopg/search.do?");
    expect(primeiro).toContain("numeroDigitoAnoUnificado=1012345-67.2024&foroNumeroUnificado=0114");
    expect(primeiro).toContain("dadosConsulta.valorConsultaNuUnificado=1012345-67.2024.8.26.0114");
    const segundo = urlDaConsulta(ESAJ_TJSP, lerCnj("2001234-56.2025.8.26.0000")!);
    expect(segundo).toContain("/cposg/search.do?");
    expect(segundo).toContain("dePesquisaNuUnificado=2001234-56.2025.8.26.0000");
  });

  it("reconhece a página de login", () => {
    expect(ehPaginaDeLogin(urlDeLogin(ESAJ_TJSP))).toBe(true);
    expect(ehPaginaDeLogin("https://esaj.tjsp.jus.br/esaj/portal.do?servico=740000")).toBe(false);
  });

  it("dá nome ao PDF pelo número do processo", () => {
    expect(nomeDoPdf(lerCnj("10123456720248260114")!)).toBe("Autos 1012345-67.2024.8.26.0114.pdf");
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
