import { beforeEach, describe, expect, it, vi } from "vitest";

const requireGustavoContentAccess = vi.hoisted(() => vi.fn());
const createItemFromLink = vi.hoisted(() => vi.fn());

vi.mock("@/lib/gustavo-content/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gustavo-content/server")>();
  return { ...actual, requireGustavoContentAccess };
});

vi.mock("@/lib/gustavo-content/items", () => ({ createItemFromLink }));

import { POST } from "./route";
import { GustavoContentError } from "@/lib/gustavo-content/server";

describe("POST /api/gustavo-content/from-link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bloqueia marketing sem membership", async () => {
    requireGustavoContentAccess.mockRejectedValueOnce(
      new GustavoContentError("Sem permissão para o módulo de posicionamento.", 403)
    );
    const response = await POST(
      new Request("https://example.com/api/gustavo-content/from-link", {
        method: "POST",
        body: JSON.stringify({ url: "https://valor.com/x" }),
      })
    );
    expect(response.status).toBe(403);
    expect(createItemFromLink).not.toHaveBeenCalled();
  });
});
