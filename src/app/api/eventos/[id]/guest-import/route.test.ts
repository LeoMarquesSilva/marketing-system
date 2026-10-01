import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), admin: vi.fn(), db: vi.fn(), candidates: vi.fn(), upsert: vi.fn(), history: vi.fn() }));
vi.mock("@/lib/api-auth", () => ({ requireAuthenticatedUser: mocks.auth }));
vi.mock("@/lib/email-marketing-server", () => ({ getAdminClient: mocks.admin }));
vi.mock("@/utils/supabase/server", () => ({ createClient: mocks.db }));
vi.mock("@/lib/event-guest-import-server", () => ({ fetchGuestCandidates: mocks.candidates, guestImportId: (event: string, key: string) => `${event}:${key}` }));
import { GET, POST } from "./route";

const context = { params: Promise.resolve({ id: "a4c3bb58-49c6-4d45-a161-38bdafcf1a6c" }) };
const candidate = { key: "person:one", name: "Ana", email: "ana@example.com", company: "Empresa", phone: null, detail: null, guestType: "cliente", avatarUrl: null };
let role = "admin";
let existing: Array<Record<string, unknown>> = [];
let eventExists = true;
const post = (body: unknown) => POST(new Request("https://example.com/api/guest-import", { method: "POST", body: JSON.stringify(body) }), context);

beforeEach(() => {
  vi.clearAllMocks(); role = "admin"; existing = []; eventExists = true;
  mocks.auth.mockResolvedValue({ id: "auth" });
  mocks.admin.mockReturnValue({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "user", role, permissions: role === "admin" ? null : ["/meus-clientes"] }, error: null }) }) }) }) });
  mocks.db.mockResolvedValue({ from: (table: string) => ({
    select: () => ({ eq: () => table === "events" ? { maybeSingle: async () => ({ data: eventExists ? { id: "event" } : null, error: null }) } : Promise.resolve({ data: existing, error: null }) }),
    upsert: mocks.upsert, insert: mocks.history,
  }) });
  mocks.candidates.mockResolvedValue([candidate]);
  mocks.upsert.mockReturnValue({ select: async () => ({ data: [{ id: "new" }], error: null }) });
  mocks.history.mockResolvedValue({ error: null });
});

describe("event guest import authorization and persistence", () => {
  it("rejects unauthenticated requests before loading the roster", async () => {
    mocks.auth.mockRejectedValue(new Error("Não autenticado."));
    expect((await GET(new Request("https://example.com?source=office"), context)).status).toBe(401);
    expect(mocks.candidates).not.toHaveBeenCalled();
  });
  it("requires permission to the Events module", async () => {
    role = "designer";
    expect((await post({ source: "clients", keys: [candidate.key] })).status).toBe(403);
    expect(mocks.candidates).not.toHaveBeenCalled();
  });
  it("rejects an inaccessible or missing event", async () => {
    eventExists = false;
    expect((await post({ source: "office", keys: [candidate.key] })).status).toBe(404);
  });
  it("rejects people outside the current authorized source", async () => {
    expect((await post({ source: "clients", keys: ["person:unavailable"] })).status).toBe(409);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("validates the source and empty selection", async () => {
    expect((await post({ source: "arbitrary", keys: [candidate.key] })).status).toBe(400);
    expect((await post({ source: "clients", keys: [] })).status).toBe(400);
  });
  it("skips existing guests without resetting invitation or RSVP state", async () => {
    existing = [{ name: "Ana", email: "ANA@example.com", company: "Empresa", confirmation_status: "confirmado" }];
    const response = await post({ source: "clients", keys: [candidate.key] });
    expect(await response.json()).toEqual({ imported: 0, skipped: 1 });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("takes personal details from the server, and records origin without sending invites", async () => {
    const response = await post({ source: "clients", keys: [candidate.key], name: "Forged", email: "forged@example.com" });
    expect(await response.json()).toEqual({ imported: 1, skipped: 0 });
    expect(mocks.candidates).toHaveBeenCalledWith("clients", "auth");
    expect(mocks.upsert).toHaveBeenCalledWith([expect.objectContaining({ name: "Ana", email: "ana@example.com", invite_status: "nao_enviado", confirmation_status: "sem_resposta", notes: expect.stringContaining("[event-guest-source:person:one]") })], { onConflict: "id", ignoreDuplicates: true });
    expect(mocks.history).toHaveBeenCalledWith(expect.objectContaining({ action_label: "Convidados importados", payload: { source: "clients", count: 1 } }));
  });
  it("reports a database failure instead of success", async () => {
    mocks.upsert.mockReturnValue({ select: async () => ({ data: null, error: { message: "failure" } }) });
    expect((await post({ source: "clients", keys: [candidate.key] })).status).toBe(500);
  });
});
