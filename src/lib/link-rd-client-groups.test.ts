import { describe, expect, it } from "vitest";
import { candidateGroupKeys } from "@/lib/link-rd-client-groups-server";

describe("link-rd-client-groups", () => {
  it("gera chave com prefixo Grupo", () => {
    expect(candidateGroupKeys("Americar")).toContain("grupo americar");
  });

  it("casa nome já no formato Grupo X", () => {
    expect(candidateGroupKeys("Grupo Gaspec")).toContain("grupo gaspec");
  });

  it("ignora Bismarchi interno", () => {
    expect(candidateGroupKeys("Bismarchi Pires")).toEqual([]);
  });
});
