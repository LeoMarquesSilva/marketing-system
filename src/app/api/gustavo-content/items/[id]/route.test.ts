import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), select: vi.fn(), generate: vi.fn() }));
vi.mock("@/lib/gustavo-content/server", async (original) => ({
  ...await original<typeof import("@/lib/gustavo-content/server")>(), requireGustavoContentAccess: mocks.access,
}));
vi.mock("@/lib/gustavo-content/items", () => ({ selectAngle: mocks.select, generateItemContent: mocks.generate }));
import { PATCH } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.access.mockResolvedValue({ id: "editor", isAdmin: true, memberRole: null });
  mocks.select.mockResolvedValue({ id: "item" });
  mocks.generate.mockResolvedValue({ id: "item" });
});

describe("validacao de acoes da pauta", () => {
  it.each([
    null, [], { action: "select_angle" }, { action: "select_angle", angleIndex: -1 },
    { action: "select_angle", angleIndex: 1.5 }, { action: "generate", mode: "invalid" },
  ])("recusa entrada invalida: %j", async (body) => {
    const response = await PATCH(new Request("http://localhost/api/gustavo-content/items/item", {
      method: "PATCH", body: JSON.stringify(body),
    }), { params: Promise.resolve({ id: "item" }) });
    expect(response.status).toBe(400);
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
