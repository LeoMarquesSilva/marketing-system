import { describe, expect, it } from "vitest";
import {
  FACE_SELFTEST_DESCRIPTOR,
  FACE_SELFTEST_LANDMARKS,
  FACE_SELFTEST_SIZE,
  faceSelfTestPixels,
  landmarkError,
} from "@/lib/event-photos/face-selftest";

describe("faceSelfTestPixels", () => {
  it("gera sempre a mesma imagem RGB de 112x112", () => {
    const a = faceSelfTestPixels();
    expect(a).toHaveLength(FACE_SELFTEST_SIZE * FACE_SELFTEST_SIZE * 3);
    expect(Array.from(a.slice(0, 6))).toEqual(Array.from(faceSelfTestPixels().slice(0, 6)));
    expect(a.every((v) => v >= 0 && v <= 255)).toBe(true);
    // Valores fixos: se mudar a fórmula, os esperados abaixo precisam ser recalculados.
    expect(Array.from(a.slice(0, 6))).toEqual([16, 192, 112, 9, 180, 95]);
  });
});

describe("valores esperados", () => {
  it("têm o tamanho do modelo (128 números e 68 pontos)", () => {
    expect(FACE_SELFTEST_DESCRIPTOR).toHaveLength(128);
    expect(FACE_SELFTEST_LANDMARKS).toHaveLength(136);
  });
});

describe("landmarkError", () => {
  it("é zero para os próprios pontos esperados", () => {
    expect(landmarkError(FACE_SELFTEST_LANDMARKS)).toBe(0);
  });

  it("mede o deslocamento médio em fração do lado da imagem", () => {
    const shifted = FACE_SELFTEST_LANDMARKS.map((v, i) => (i % 2 === 0 ? v + 11.2 : v));
    expect(landmarkError(shifted)).toBeCloseTo(0.1);
  });

  it("tamanho errado nunca passa", () => {
    expect(landmarkError([1, 2])).toBe(Number.POSITIVE_INFINITY);
  });
});
