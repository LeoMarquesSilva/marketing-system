import { beforeEach, describe, expect, it, vi } from "vitest";

const requireGustavoContentAccess = vi.hoisted(() => vi.fn());

vi.mock("@/lib/gustavo-content/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gustavo-content/server")>();
  return {
    ...actual,
    requireGustavoContentAccess,
  };
});

import { GET } from "./route";
import { GustavoContentError } from "@/lib/gustavo-content/server";

describe("GET /api/gustavo-content/access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devolve 200 para admin", async () => {
    requireGustavoContentAccess.mockResolvedValueOnce({
      id: "admin-1",
      isAdmin: true,
      memberRole: null,
    });

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      allowed: true,
      isAdmin: true,
    });
  });

  it("devolve 403 para quem não é membro", async () => {
    requireGustavoContentAccess.mockRejectedValueOnce(
      new GustavoContentError("Sem permissão para o módulo de posicionamento.", 403)
    );

    const response = await GET();
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Sem permissão para o módulo de posicionamento.",
    });
  });
});
