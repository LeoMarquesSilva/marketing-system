import { describe, expect, it } from "vitest";
import {
  compactDescriptor,
  euclideanDistance,
  isFaceDescriptor,
  matchFacesToPeople,
} from "@/lib/event-photos/faces";

/** Vetor de 128 posições com valor `v` nas `n` primeiras e 0 no resto. */
function vec(v: number, n = 1): number[] {
  return Array.from({ length: 128 }, (_, i) => (i < n ? v : 0));
}

describe("euclideanDistance", () => {
  it("mede a distância entre dois vetores", () => {
    expect(euclideanDistance(vec(0), vec(0))).toBe(0);
    expect(euclideanDistance(vec(0.3, 4), vec(0, 4))).toBeCloseTo(0.6);
  });
});

describe("isFaceDescriptor", () => {
  it("exige 128 números finitos", () => {
    expect(isFaceDescriptor(vec(0.1))).toBe(true);
    expect(isFaceDescriptor(vec(0.1).slice(1))).toBe(false);
    expect(isFaceDescriptor([...vec(0.1).slice(1), Number.NaN])).toBe(false);
    expect(isFaceDescriptor("x")).toBe(false);
  });
});

describe("matchFacesToPeople", () => {
  const ana = { userId: "ana", descriptors: [vec(0), vec(0.05)] };
  const bia = { userId: "bia", descriptors: [vec(1)] };

  it("reconhece quem está abaixo do limite, com a menor distância", () => {
    expect(matchFacesToPeople([vec(0.04)], [ana, bia])).toEqual([{ userId: "ana", distance: 0.01 }]);
  });

  it("ignora rostos distantes de todas as referências", () => {
    expect(matchFacesToPeople([vec(-0.6)], [ana, bia])).toEqual([]);
  });

  it("reconhece várias pessoas na mesma foto, uma vez cada", () => {
    const result = matchFacesToPeople([vec(0.02), vec(0.98), vec(0.01)], [ana, bia]);
    expect(result.map((m) => m.userId).sort()).toEqual(["ana", "bia"]);
    expect(result.find((m) => m.userId === "ana")?.distance).toBe(0.01);
  });

  it("um rosto vai só para a pessoa mais próxima", () => {
    const close = { userId: "carla", descriptors: [vec(0.1)] };
    expect(matchFacesToPeople([vec(0.08)], [ana, close])).toEqual([{ userId: "carla", distance: 0.02 }]);
  });

  it("sem ninguém com consentimento, não há correspondência", () => {
    expect(matchFacesToPeople([vec(0)], [])).toEqual([]);
  });
});

describe("compactDescriptor", () => {
  it("converte Float32Array em array com 6 casas", () => {
    const out = compactDescriptor(new Float32Array([0.1234567891, -0.5]));
    expect(out).toEqual([0.123457, -0.5]);
  });
});
