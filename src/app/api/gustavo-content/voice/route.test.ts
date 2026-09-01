import { beforeEach, describe, expect, it, vi } from "vitest";

const requireGustavoContentAccess = vi.hoisted(() => vi.fn());
const listVoiceSamples = vi.hoisted(() => vi.fn());

vi.mock("@/lib/gustavo-content/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gustavo-content/server")>();
  return { ...actual, requireGustavoContentAccess };
});

vi.mock("@/lib/gustavo-content/voice-server", () => ({
  listVoiceSamples,
}));

import { GET } from "./route";
import { GustavoContentError } from "@/lib/gustavo-content/server";

describe("GET /api/gustavo-content/voice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bloqueia Marketing sem membership", async () => {
    requireGustavoContentAccess.mockRejectedValueOnce(
      new GustavoContentError("Sem permissão para o módulo de posicionamento.", 403)
    );
    const response = await GET();
    expect(response.status).toBe(403);
    expect(listVoiceSamples).not.toHaveBeenCalled();
  });
});
