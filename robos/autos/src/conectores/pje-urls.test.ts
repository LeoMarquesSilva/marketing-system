import { describe, expect, it } from "vitest";
import {
  camposCnjPje,
  chaveDaPecaPje,
  downloadEmSegundoPlano,
  ehAreaLogadaPje,
  ehAutosDigitais,
  ehLoginPje,
  emSegredoPje,
  idDoDocumentoPje,
  idInicialDoIncremental,
  instanciaPjeTjrj,
  urlDaConsultaPublicaPje,
  urlDeLoginPje,
} from "./pje-urls";

// Números fictícios (dígito verificador inválido de propósito). Nenhum dado real.
const primeiro = instanciaPjeTjrj("1g");
const segundo = instanciaPjeTjrj("2g");

describe("instâncias do PJe do TJRJ", () => {
  it("1º grau pelo SSO da PDPJ, 2º grau com login próprio", () => {
    expect(urlDeLoginPje(primeiro)).toBe("https://tjrj.pje.jus.br/1g/login.seam");
    expect(primeiro.sso).toBe(true);
    expect(urlDeLoginPje(segundo)).toBe("https://tjrj.pje.jus.br/2g/login.seam");
    expect(segundo.sso).toBe(false);
    expect(urlDaConsultaPublicaPje(primeiro)).toBe("https://tjrj.pje.jus.br/1g/ConsultaPublica/listView.seam");
  });
});

describe("login e área logada", () => {
  it("reconhece o SSO da PDPJ, o gov.br e o login.seam", () => {
    expect(ehLoginPje("https://sso.cloud.pje.jus.br/auth/realms/pje/protocol/openid-connect/auth?client_id=pje-tjrj-1g&state=x", primeiro)).toBe(true);
    expect(ehLoginPje("https://sso.cloud.pje.jus.br/auth/realms/pje/login-actions/authenticate?session_code=x", primeiro)).toBe(true);
    expect(ehLoginPje("https://sso.acesso.gov.br/login?client_id=x", primeiro)).toBe(true);
    expect(ehLoginPje("https://tjrj.pje.jus.br/1g/login.seam?code=abc", primeiro)).toBe(true);
    expect(ehLoginPje("https://tjrj.pje.jus.br/1g/Painel/painel_usuario/advogado.seam", primeiro)).toBe(false);
  });

  it("logado é estar numa página do PJe da instância, fora do login, da consulta pública e do Push", () => {
    expect(ehAreaLogadaPje("https://tjrj.pje.jus.br/1g/Painel/painel_usuario/advogado.seam", primeiro)).toBe(true);
    expect(ehAreaLogadaPje("https://tjrj.pje.jus.br/1g/ConsultaPublica/listView.seam", primeiro)).toBe(false);
    expect(ehAreaLogadaPje("https://tjrj.pje.jus.br/1g/Push/loginPush.seam", primeiro)).toBe(false);
    expect(ehAreaLogadaPje("https://tjrj.pje.jus.br/2g/Painel/painel_usuario/advogado.seam", primeiro)).toBe(false);
    expect(ehAreaLogadaPje("https://tjrj.pje.jus.br/1g/login.seam", primeiro)).toBe(false);
  });

  it("reconhece os autos digitais", () => {
    expect(ehAutosDigitais("https://tjrj.pje.jus.br/1g/Processo/ConsultaProcesso/Detalhe/listAutosDigitais.seam?idProcesso=1&ca=x")).toBe(true);
    expect(ehAutosDigitais("https://tjrj.pje.jus.br/1g/Processo/ConsultaProcesso/listView.seam")).toBe(false);
  });
});

describe("número do processo", () => {
  it("separa nos campos da consulta", () => {
    expect(camposCnjPje("0099999-00.2020.8.19.0203")).toEqual({
      sequencial: "0099999",
      digito: "00",
      ano: "2020",
      ramo: "8",
      tribunal: "19",
      origem: "0203",
      mascarado: "0099999-00.2020.8.19.0203",
    });
    expect(camposCnjPje("1012345-67.2025.8.26.0100")).toBeNull();
  });
});

describe("sigilo e documentos", () => {
  it("lê o segredo de justiça do cabeçalho", () => {
    expect(emSegredoPje("Valor da causa R$ 1,00 Segredo de justiça? NÃO Prioridade")).toBe(false);
    expect(emSegredoPje("Segredo de justiça: SIM")).toBe(true);
    expect(emSegredoPje("Processo sigiloso")).toBe(true);
    expect(emSegredoPje("Classe judicial: Procedimento Comum Cível")).toBe(false);
  });

  it("acha o id do documento no link", () => {
    expect(idDoDocumentoPje("https://tjrj.pje.jus.br/1g/Processo/ConsultaDocumento/listView.seam?idProcessoDocumento=12345&ca=x")).toBe(12345);
    expect(idDoDocumentoPje("https://tjrj.pje.jus.br/1g/documento/download/678")).toBe(678);
    expect(idDoDocumentoPje("https://tjrj.pje.jus.br/1g/Painel/painel_usuario/advogado.seam")).toBeNull();
  });

  it("download incremental a partir do maior id já baixado", () => {
    expect(chaveDaPecaPje(10)).toBe("pje:10");
    expect(idInicialDoIncremental(["pje:10", "pje:250", "pje:99"])).toBe(251);
    expect(idInicialDoIncremental(["12:PET1"])).toBeNull();
    expect(idInicialDoIncremental(undefined)).toBeNull();
  });

  it("reconhece o aviso de PDF montado em segundo plano", () => {
    expect(downloadEmSegundoPlano("O arquivo estará disponível na área de download")).toBe(true);
    expect(downloadEmSegundoPlano("Solicitação de download registrada")).toBe(true);
    expect(downloadEmSegundoPlano("Autos digitais")).toBe(false);
  });
});
