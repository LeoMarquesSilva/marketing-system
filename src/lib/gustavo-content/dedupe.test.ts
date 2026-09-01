import { describe, expect, it } from "vitest";
import { findSameFact, isSameFact } from "@/lib/gustavo-content/dedupe";

describe("isSameFact", () => {
  it("trata o mesmo link como o mesmo fato", () => {
    expect(
      isSameFact(
        { title: "GPA anuncia reestruturação", link: "https://valor.com/gpa" },
        { title: "Outro título", link: "https://valor.com/gpa" }
      )
    ).toBe(true);
  });

  it("trata o mesmo título normalizado como o mesmo fato", () => {
    expect(
      isSameFact(
        { title: "GPA anuncia reestruturação - Valor Econômico", link: "https://a.com/1" },
        { title: "GPA anuncia reestruturação | Estadão", link: "https://b.com/2" }
      )
    ).toBe(true);
  });

  it("não rejeita a mesma empresa em acontecimentos diferentes", () => {
    expect(
      isSameFact(
        { title: "GPA anuncia reestruturação", link: "https://a.com/1" },
        { title: "GPA consegue adesão de novos credores", link: "https://b.com/2" }
      )
    ).toBe(false);
  });
});

describe("findSameFact", () => {
  it("não duplica o mesmo fato na janela", () => {
    const existing = [
      { title: "GPA anuncia reestruturação", link: "https://valor.com/gpa" },
    ];
    expect(
      findSameFact(existing, {
        title: "GPA anuncia reestruturação | Folha",
        link: "https://folha.com/gpa",
      })
    ).toBeTruthy();
    expect(
      findSameFact(existing, {
        title: "Americanas entra em recuperação judicial",
        link: "https://outro.com/am",
      })
    ).toBeNull();
  });
});
