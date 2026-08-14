import { describe, expect, it } from "vitest";
import { loadPhotoCountsByUserId } from "@/lib/collaborator-photos/photo-counts";

describe("loadPhotoCountsByUserId", () => {
  it("conta também as fotos depois do limite de 1.000 linhas", async () => {
    const rows = [
      ...Array.from({ length: 1_000 }, () => ({ user_id: "user-a" })),
      ...Array.from({ length: 226 }, () => ({ user_id: "user-b" })),
    ];

    const result = await loadPhotoCountsByUserId(
      async (from, to) => rows.slice(from, to + 1),
      { pageSize: 1_000 }
    );

    expect(result).toEqual({
      "user-a": 1_000,
      "user-b": 226,
    });
  });

  it("mantém contagem zero para usuários solicitados sem fotos", async () => {
    const result = await loadPhotoCountsByUserId(async () => [], {
      userIds: ["user-without-photos"],
    });

    expect(result).toEqual({ "user-without-photos": 0 });
  });
});
