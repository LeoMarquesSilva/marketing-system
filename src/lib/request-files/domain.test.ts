import { describe, expect, it } from "vitest";
import { getTitleTag } from "@/lib/planner-title-tag";
import {
  extractPostingSteps,
  formatFileSize,
  plannerTagDeliveryPath,
  plannerTagDeliveryUrl,
  requestFileContentType,
  sortFilesByName,
  tagFromDeliveryParam,
} from "./domain";

describe("arquivos da arte do planner", () => {
  it("aceita imagem, PDF, vídeo e ZIP, pelo MIME ou pela extensão", () => {
    expect(requestFileContentType("feed.png", "image/png")).toBe("image/png");
    expect(requestFileContentType("STORIES.JPG", "")).toBe("image/jpeg");
    expect(requestFileContentType("slides.zip", "application/x-zip-compressed")).toBe("application/zip");
    expect(requestFileContentType("video.mov", undefined)).toBe("video/quicktime");
    expect(requestFileContentType("arte.psd", "image/vnd.adobe.photoshop")).toBeNull();
  });

  it("ordena os slides do carrossel pela numeração do nome", () => {
    const files = [{ name: "slide-10.png" }, { name: "slide-2.png" }, { name: "slide-1.png" }];
    expect(sortFilesByName(files).map((f) => f.name)).toEqual(["slide-1.png", "slide-2.png", "slide-10.png"]);
  });

  it("formata o tamanho em KB ou MB", () => {
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(3.5 * 1024 * 1024)).toBe("3,5 MB");
  });

  it("liga a tag à página de download e de volta", () => {
    expect(plannerTagDeliveryPath("OAB")).toBe("/entregas/oab");
    expect(plannerTagDeliveryUrl("DC")).toBe("https://orqestrai.com.br/entregas/dc");
    expect(tagFromDeliveryParam("oab")).toBe("OAB");
    expect(tagFromDeliveryParam(encodeURIComponent("são paulo"))).toBe("SÃO PAULO");
    expect(tagFromDeliveryParam("%E0%A4%A")).toBeNull();
    expect(tagFromDeliveryParam("x]")).toBeNull();
  });
});

describe("instruções para quem posta", () => {
  it("tira enquete, sticker e notas entre colchetes do texto de cada tela", () => {
    const steps = extractPostingSteps([
      { label: "Tela 1 · texto exato", content: "TÍTULO: Qual tema você pretende acompanhar?\n[Enquete: Recuperação judicial / Direito societário]" },
      { label: "Tela 2 · texto exato", content: "TÍTULO: A programação inclui esses e outros debates.\n[Sticker: Ver programação e inscrição]" },
      { label: "Tela 3 · texto exato", content: "TÍTULO: Ideias em discussão.\n  [Foto real autorizada]  " },
      { label: "Legenda para publicação", content: "Texto sem colchetes\n[ASSINATURA OBRIGATÓRIA: evento]" },
    ]);
    expect(steps).toEqual([
      { screen: 1, kind: "enquete", text: "Recuperação judicial / Direito societário", options: ["Recuperação judicial", "Direito societário"] },
      { screen: 2, kind: "sticker", text: "Ver programação e inscrição", options: [] },
      { screen: 3, kind: "nota", text: "Foto real autorizada", options: [] },
    ]);
  });

  it("não cria instrução para tela sem colchetes", () => {
    expect(extractPostingSteps([{ label: "Tela 1 · texto exato", content: "É HOJE.\nOs debates começam." }])).toEqual([]);
  });
});

describe("tag do título", () => {
  it("separa a tag do restante do título", () => {
    expect(getTitleTag("[OAB] F01 Feed — Convite oficial")).toEqual({ tag: "OAB", rest: "F01 Feed — Convite oficial" });
    expect(getTitleTag(" [dc]Workshop")).toEqual({ tag: "DC", rest: "Workshop" });
    expect(getTitleTag("Post normal [OAB]")).toBeNull();
    expect(getTitleTag("[ ] vazio")).toBeNull();
  });
});
