import { describe, expect, it } from "vitest";
import {
  applyAlternativeHook,
  assembleLinkedInPost,
  splitLinkedInBlocks,
} from "@/lib/gustavo-content/text";

describe("splitLinkedInBlocks", () => {
  it("separa gancho e corpo quando há parágrafo em branco", () => {
    expect(splitLinkedInBlocks("Gancho\n\nCorpo linha 1\n\nCorpo linha 2")).toEqual({
      hook: "Gancho",
      rest: "Corpo linha 1\n\nCorpo linha 2",
    });
  });

  it("não presume que o texto inteiro é gancho quando não há linha em branco", () => {
    expect(splitLinkedInBlocks("Um parágrafo único sem quebra")).toEqual({
      hook: "Um parágrafo único sem quebra",
      rest: "",
    });
  });

  it("trata texto vazio", () => {
    expect(splitLinkedInBlocks("")).toEqual({ hook: "", rest: "" });
    expect(splitLinkedInBlocks(null)).toEqual({ hook: "", rest: "" });
  });

  it("normaliza quebras de linha do Windows", () => {
    expect(splitLinkedInBlocks("Gancho\r\n\r\nCorpo")).toEqual({
      hook: "Gancho",
      rest: "Corpo",
    });
  });
});

describe("applyAlternativeHook", () => {
  it("post vazio vira só o novo gancho", () => {
    expect(applyAlternativeHook("", "Novo gancho")).toBe("Novo gancho");
    expect(applyAlternativeHook(null, "Novo gancho")).toBe("Novo gancho");
  });

  it("post de um parágrafo preserva o parágrafo como corpo em vez de apagá-lo", () => {
    expect(applyAlternativeHook("Texto original em um bloco só", "Novo gancho")).toBe(
      "Novo gancho\n\nTexto original em um bloco só"
    );
  });

  it("post de vários parágrafos troca só a abertura, preservando desenvolvimento e fechamento", () => {
    const current = "Gancho antigo\n\nDesenvolvimento\n\nFechamento";
    expect(applyAlternativeHook(current, "Novo gancho")).toBe(
      "Novo gancho\n\nDesenvolvimento\n\nFechamento"
    );
  });

  it("trocas sucessivas não acumulam aberturas indevidamente", () => {
    let post = "Texto original em um bloco só";
    post = applyAlternativeHook(post, "Gancho A");
    expect(post).toBe("Gancho A\n\nTexto original em um bloco só");
    post = applyAlternativeHook(post, "Gancho B");
    expect(post).toBe("Gancho B\n\nTexto original em um bloco só");
  });

  it("lida com quebras de linha do Windows no texto atual", () => {
    const current = "Gancho antigo\r\n\r\nDesenvolvimento";
    expect(applyAlternativeHook(current, "Novo gancho")).toBe(
      "Novo gancho\n\nDesenvolvimento"
    );
  });
});

describe("assembleLinkedInPost", () => {
  it("garante o gancho como primeira parte e junta parágrafos com linha em branco", () => {
    const post = assembleLinkedInPost({
      hook: "Gancho",
      body: ["Parágrafo 1", "Parágrafo 2"],
      closing: "Fechamento",
    });
    expect(post).toBe("Gancho\n\nParágrafo 1\n\nParágrafo 2\n\nFechamento");
  });

  it("omite fechamento e hashtags quando ausentes", () => {
    const post = assembleLinkedInPost({ hook: "Gancho", body: ["Corpo"] });
    expect(post).toBe("Gancho\n\nCorpo");
  });

  it("normaliza hashtags sem # duplicado", () => {
    const post = assembleLinkedInPost({
      hook: "Gancho",
      body: ["Corpo"],
      hashtags: ["#RecuperacaoJudicial", "DistressedAssets"],
    });
    expect(post.endsWith("#recuperacaojudicial #distressedassets")).toBe(true);
  });

  it("mantem maiusculas do texto mas normaliza hashtags inclusive no corpo", () => {
    expect(assembleLinkedInPost({
      hook: "CEOs precisam olhar o caixa",
      body: ["Foco em #Reestruturação e #GESTÃO, segundo o CFO."],
      hashtags: [" #RecuperaçãoJudicial ", "Crédito"],
    })).toBe("CEOs precisam olhar o caixa\n\nFoco em #reestruturação e #gestão, segundo o CFO.\n\n#recuperaçãojudicial #crédito");
  });
});
