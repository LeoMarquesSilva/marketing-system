import { beforeEach, describe, expect, it, vi } from "vitest";

const requireGustavoContentAccess = vi.hoisted(() => vi.fn());
const getStrategy = vi.hoisted(() => vi.fn());
const updateStrategy = vi.hoisted(() => vi.fn());

vi.mock("@/lib/gustavo-content/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gustavo-content/server")>();
  return { ...actual, requireGustavoContentAccess };
});

vi.mock("@/lib/gustavo-content/strategy-server", () => ({
  getStrategy,
  updateStrategy,
}));

import { GET, PATCH } from "./route";
import { GustavoContentError } from "@/lib/gustavo-content/server";

describe("/api/gustavo-content/strategy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("não expõe o documento estratégico sem acesso ao módulo", async () => {
    requireGustavoContentAccess.mockRejectedValueOnce(
      new GustavoContentError("Sem permissão para o módulo de posicionamento.", 403)
    );

    const response = await GET();

    expect(response.status).toBe(403);
    expect(getStrategy).not.toHaveBeenCalled();
  });

  it("salva a estratégia com autoria do usuário autenticado", async () => {
    const actor = { id: "user-1", isAdmin: false, memberRole: "editor" };
    const body = { positioning: "Posicionamento" };
    requireGustavoContentAccess.mockResolvedValueOnce(actor);
    updateStrategy.mockResolvedValueOnce({ id: "main", ...body });

    const response = await PATCH(
      new Request("http://localhost/api/gustavo-content/strategy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    );

    expect(response.status).toBe(200);
    expect(updateStrategy).toHaveBeenCalledWith(body, "user-1");
  });
});
