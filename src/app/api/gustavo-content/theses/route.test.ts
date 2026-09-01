import { beforeEach, describe, expect, it, vi } from "vitest";

const requireGustavoContentAccess = vi.hoisted(() => vi.fn());
const listTheses = vi.hoisted(() => vi.fn());

vi.mock("@/lib/gustavo-content/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gustavo-content/server")>();
  return { ...actual, requireGustavoContentAccess };
});

vi.mock("@/lib/gustavo-content/theses-server", () => ({
  listTheses,
}));

import { GET } from "./route";
import { GustavoContentError } from "@/lib/gustavo-content/server";

describe("GET /api/gustavo-content/theses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bloqueia quem não tem acesso", async () => {
    requireGustavoContentAccess.mockRejectedValueOnce(
      new GustavoContentError("Sem permissão para o módulo de posicionamento.", 403)
    );
    const response = await GET();
    expect(response.status).toBe(403);
    expect(listTheses).not.toHaveBeenCalled();
  });

  it("lista teses para membro autorizado", async () => {
    requireGustavoContentAccess.mockResolvedValueOnce({
      id: "g1",
      isAdmin: false,
      memberRole: "owner",
    });
    listTheses.mockResolvedValueOnce([]);
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([]);
  });
});
