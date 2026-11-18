import { describe, expect, it } from "vitest";
import {
  LOGIN_PORTAL_DE_SERVICOS,
  cnjDoTjrj,
  ehAreaLogadaDcp,
  emSegredoDcp,
  etapaDoLoginDcp,
  instrucaoDoLoginDcp,
  migradoParaEproc,
  partesDoCnjTjrj,
  visualizadorDoBotao,
} from "./dcp-tjrj-urls";

// Números fictícios (dígito verificador inválido de propósito). Nenhum dado real.

describe("login do Portal de Serviços (IdServerJus)", () => {
  it("reconhece cada tela do login pelo endereço", () => {
    expect(etapaDoLoginDcp(LOGIN_PORTAL_DE_SERVICOS)).toBe("usuario-senha");
    expect(etapaDoLoginDcp("https://www3.tjrj.jus.br/idserverjus-front/#/autenticacao-mfa")).toBe("duplo-fator");
    expect(etapaDoLoginDcp("https://www3.tjrj.jus.br/idserverjus-front/#/autenticacao-certificado?x=1")).toBe("certificado");
    expect(etapaDoLoginDcp("https://www7.tjrj.jus.br/autenticadorCertDigital/AutenticadorCertDigital.aspx?URLREDIREC=x")).toBe("certificado");
    expect(etapaDoLoginDcp("https://www3.tjrj.jus.br/idserverjus-front/#/cadastro-email")).toBe("cadastro-email");
    expect(etapaDoLoginDcp("https://www3.tjrj.jus.br/idserverjus-front/#/trocar-senha")).toBe("troca-de-senha");
    expect(etapaDoLoginDcp("https://www3.tjrj.jus.br/idserverjus-front/#/selecao-sistemas")).toBe("selecao-de-sistema");
    expect(etapaDoLoginDcp("https://tjerj-sso.tjrj.jus.br/realms/local/legacy/auth")).toBe("sso");
  });

  it("não confunde o portal, outros sites ou endereço inválido com o login", () => {
    expect(etapaDoLoginDcp("https://www3.tjrj.jus.br/portalservicos/#/inicio")).toBeNull();
    expect(etapaDoLoginDcp("https://eproc-sso.tjrj.jus.br/realms/eproc/protocol/openid-connect/auth")).toBeNull();
    expect(etapaDoLoginDcp("about:blank")).toBeNull();
    expect(etapaDoLoginDcp("não é endereço")).toBeNull();
  });

  it("tem instrução para cada tela, sem pedir a senha ao robô", () => {
    expect(instrucaoDoLoginDcp("duplo-fator")).toMatch(/código/);
    expect(instrucaoDoLoginDcp("selecao-de-sistema")).toMatch(/Portal de Serviços/);
    expect(instrucaoDoLoginDcp(null)).toMatch(/janela do robô/);
  });

  it("logado é estar no Portal de Serviços, fora do login", () => {
    expect(ehAreaLogadaDcp("https://www3.tjrj.jus.br/portalservicos/#/consultas")).toBe(true);
    expect(ehAreaLogadaDcp(LOGIN_PORTAL_DE_SERVICOS)).toBe(false);
    // Sem login, o portal devolve a página inicial do tribunal.
    expect(ehAreaLogadaDcp("https://www.tjrj.jus.br/")).toBe(false);
  });
});

describe("número do processo no TJRJ", () => {
  it("aceita só J.TR 8.19", () => {
    expect(cnjDoTjrj("00123456720198190001")?.mascarado).toBe("0012345-67.2019.8.19.0001");
    expect(cnjDoTjrj("1012345-67.2025.8.26.0100")).toBeNull();
    expect(cnjDoTjrj("123")).toBeNull();
  });

  it("separa o número em volta de .8.19.", () => {
    expect(partesDoCnjTjrj("0123456-11.2018.8.19.0002")).toEqual({ mascarado: "0123456-11.2018.8.19.0002", inicio: "0123456-11.2018", origem: "0002" });
    expect(partesDoCnjTjrj("1012345-67.2025.8.26.0100")).toBeNull();
  });
});

describe("telas do processo", () => {
  it("reconhece processo migrado para o eproc (DCP e PJe)", () => {
    expect(migradoParaEproc("Este processo foi migrado para o eproc em 01/01/2026. Acessar eproc")).toBe(true);
    expect(migradoParaEproc("Processo migrado para o eproc, acesse-o através do link")).toBe(true);
    expect(migradoParaEproc("Ir para o eproc")).toBe(true);
    expect(migradoParaEproc("Processo Eletrônico – Novo Visualizador")).toBe(false);
  });

  it("decide o sigilo pelo texto, na dúvida segredo", () => {
    expect(emSegredoDcp("Segredo de Justiça: Não")).toBe(false);
    expect(emSegredoDcp("Segredo de justiça: SIM")).toBe(true);
    expect(emSegredoDcp("Processo sigiloso")).toBe(true);
    expect(emSegredoDcp("Classe: Procedimento Comum")).toBe(false);
  });

  it("diz qual visualizador o botão abre", () => {
    expect(visualizadorDoBotao("Processo Eletrônico – Novo Visualizador")).toBe("novo");
    expect(visualizadorDoBotao("Processo Eletrônico - Antigo Visualizador")).toBe("antigo");
    expect(visualizadorDoBotao("Processo Eletrônico - clique aqui para visualizar")).toBe("outro");
    expect(visualizadorDoBotao("Peticionar")).toBeNull();
  });
});
