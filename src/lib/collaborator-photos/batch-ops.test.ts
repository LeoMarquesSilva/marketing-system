import { describe, expect, it } from "vitest";
import {
  MAX_BATCH_PHOTO_OPS,
  assertBatchPhotoIds,
  assertBatchMoveSessionInput,
} from "@/lib/collaborator-photos/batch-ops";

describe("assertBatchPhotoIds", () => {
  it("exige ao menos uma foto com verbo da ação", () => {
    expect(() => assertBatchPhotoIds([], "excluir")).toThrow(/excluir/i);
  });

  it("limita a quantidade máxima", () => {
    const ids = Array.from({ length: MAX_BATCH_PHOTO_OPS + 1 }, (_, i) => `id-${i}`);
    expect(() => assertBatchPhotoIds(ids, "mover")).toThrow(/no máximo/i);
  });

  it("remove duplicatas e valida strings", () => {
    expect(assertBatchPhotoIds(["a", "b", "a"], "excluir")).toEqual(["a", "b"]);
    expect(() => assertBatchPhotoIds(["ok", 1], "excluir")).toThrow(/inválida/i);
  });
});

describe("assertBatchMoveSessionInput", () => {
  it("exige sessionId válido", () => {
    expect(() => assertBatchMoveSessionInput({ photoIds: ["a"], sessionId: "" })).toThrow(
      /sessão/i
    );
    expect(() =>
      assertBatchMoveSessionInput({ photoIds: ["a"], sessionId: "   " })
    ).toThrow(/sessão/i);
  });

  it("retorna ids e sessionId limpos", () => {
    expect(
      assertBatchMoveSessionInput({
        photoIds: ["p1", "p1"],
        sessionId: " sess-1 ",
      })
    ).toEqual({ photoIds: ["p1"], sessionId: "sess-1" });
  });
});
