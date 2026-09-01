import { beforeEach, describe, expect, it, vi } from "vitest";

const requireGustavoContentAccess = vi.hoisted(() => vi.fn());
const listItems = vi.hoisted(() => vi.fn());

vi.mock("@/lib/gustavo-content/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gustavo-content/server")>();
  return { ...actual, requireGustavoContentAccess };
});

vi.mock("@/lib/gustavo-content/items", () => ({ listItems }));

import { GET } from "./route";
import { GustavoContentError } from "@/lib/gustavo-content/server";

describe("GET /api/gustavo-content/items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bloqueia quem não tem acesso", async () => {
    requireGustavoContentAccess.mockRejectedValueOnce(
      new GustavoContentError("Sem permissão para o módulo de posicionamento.", 403)
    );
    const response = await GET(new Request("https://example.com/api/gustavo-content/items"));
    expect(response.status).toBe(403);
    expect(listItems).not.toHaveBeenCalled();
  });

  it("lista pautas para membro autorizado", async () => {
    requireGustavoContentAccess.mockResolvedValueOnce({ id: "g1", isAdmin: false });
    listItems.mockResolvedValueOnce([]);
    const response = await GET(
      new Request("https://example.com/api/gustavo-content/items?view=radar")
    );
    expect(response.status).toBe(200);
    expect(listItems).toHaveBeenCalledWith({
      statuses: ["radar", "sugestao", "aguardando_opiniao"],
      topicId: undefined,
    });
  });
});
