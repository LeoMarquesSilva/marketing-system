import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ clients: vi.fn(), admin: vi.fn(), active: vi.fn() }));
vi.mock("./email-marketing-server", () => ({ getAdminClient: mocks.admin }));
vi.mock("./meus-clientes-server", () => ({ fetchMeusClientesPayload: mocks.clients }));
import { fetchGuestCandidates, guestImportId } from "./event-guest-import-server";

beforeEach(() => vi.clearAllMocks());
describe("guest source integration", () => {
  it("uses the scoped Meus Clientes service and only party selections", async () => {
    mocks.clients.mockResolvedValue({ people: [{ id: "1", name: "Ana", partyInvite: true }, { id: "2", name: "NPS only", partyInvite: false }], contacts: [] });
    expect(await fetchGuestCandidates("clients", "auth-id")).toEqual([expect.objectContaining({ name: "Ana", key: "person:1" })]);
    expect(mocks.clients).toHaveBeenCalledWith({ authUserId: "auth-id", viewAll: true });
  });
  it("includes active employees without a system account and uses linked portraits", async () => {
    mocks.active.mockReturnValue({ order: async () => ({ data: [
      { id: "employee1", user_id: null, full_name: "Ana", email: null, department: "Jurídico" },
      { id: "employee2", user_id: "user2", full_name: "Bruno", email: "b@example.com", department: "Marketing" },
    ], error: null }) });
    mocks.admin.mockReturnValue({ from: (table: string) => ({ select: () => table === "hr_employees" ? { eq: mocks.active } : { in: async () => ({ data: [{ id: "user2", avatar_url: "/portrait.jpg" }], error: null }) } }) });
    const result = await fetchGuestCandidates("office", "auth-id");
    expect(mocks.active).toHaveBeenCalledWith("is_active", true);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ name: "Ana", email: null });
    expect(result[1]).toMatchObject({ name: "Bruno", avatarUrl: "/portrait.jpg" });
  });
  it("creates stable event-specific UUIDs for retry-safe insertions", () => {
    const id = guestImportId("event-a", "employee:1");
    expect(id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/);
    expect(guestImportId("event-a", "employee:1")).toBe(id);
    expect(guestImportId("event-b", "employee:1")).not.toBe(id);
  });
});
