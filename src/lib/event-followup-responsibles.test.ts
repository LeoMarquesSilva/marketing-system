import { describe, expect, it } from "vitest";
import { followUpResponsibleNames, normalizeFollowUpResponsibleNames } from "./event-followup-responsibles";

describe("responsáveis de follow-up", () => {
  it("lê registros antigos com um responsável", () => {
    expect(followUpResponsibleNames({ responsibleName: "Marcele" })).toEqual(["Marcele"]);
  });

  it("prioriza a lista nova e permite remover todos os responsáveis", () => {
    expect(followUpResponsibleNames({ responsibleNames: ["Marcele", "Leonardo"], responsibleName: "Marcele" })).toEqual(["Marcele", "Leonardo"]);
    expect(followUpResponsibleNames({ responsibleNames: [], responsibleName: "Marcele" })).toEqual([]);
  });

  it("remove nomes vazios e duplicados sem alterar a ordem", () => {
    expect(normalizeFollowUpResponsibleNames([" Lígia ", "Ligia", "Marcele", " ", null])).toEqual(["Lígia", "Marcele"]);
  });
});
