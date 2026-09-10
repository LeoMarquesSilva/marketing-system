import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => vi.fn());
const dbFactory = vi.hoisted(() => vi.fn());
const updateStatus = vi.hoisted(() => vi.fn());
const autoLink = vi.hoisted(() => vi.fn());
const sendMkt = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content-access", () => ({
  getAuthenticatedContentUser: auth,
  resolveAreaFilter: vi.fn(),
}));
vi.mock("@/lib/users-server", () => ({ getServerDb: dbFactory }));
vi.mock("@/lib/content-areas", () => ({ canSeeContentRoteiro: () => true }));
vi.mock("@/lib/content-schedule/server", () => ({ autoLinkContentSchedule: autoLink }));
vi.mock("@/lib/content-roteiros", () => ({
  fetchContentRoteiros: vi.fn(),
  updateRoteiroStatus: updateStatus,
  saveRoteiroEdit: vi.fn(),
  sendRoteiroToMarketing: sendMkt,
  linkRoteiroViosTask: vi.fn(),
  updateRoteiroBoletimScore: vi.fn(),
}));

import { PATCH } from "./route";

const profile = { id: "approver-2", name: "Segundo", department: "Cível", role: null };
const originalApproval = {
  approved_by_id: "approver-1",
  approved_by_name: "Primeiro",
  approved_at: "2026-09-01T10:00:00.000Z",
};

function database() {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => table === "users"
            ? { data: { is_active: true }, error: null }
            : {
                data: {
                  id: "content-1",
                  area: "Cível",
                  created_by_id: "author",
                  status: "aprovado",
                  ...originalApproval,
                },
                error: null,
              },
        }),
      }),
    }),
  };
}

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/content-roteiros", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH content-roteiros approval scheduling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.mockResolvedValue({ profile });
    dbFactory.mockResolvedValue(database());
    updateStatus.mockResolvedValue(originalApproval);
    autoLink.mockResolvedValue({ status: "already_linked", slotId: "slot-1" });
  });

  it("reaprovação usa a identidade e data persistidas no vínculo automático", async () => {
    expect((await PATCH(request({ id: "content-1", status: "aprovado" }))).status).toBe(200);
    expect(updateStatus).toHaveBeenCalledWith(
      "content-1",
      "aprovado",
      expect.objectContaining({ approved_by_id: "approver-1", approved_by_name: "Primeiro" }),
      undefined
    );
    expect(autoLink).toHaveBeenCalledWith(expect.objectContaining({
      collaboratorId: "approver-1",
      eventDate: originalApproval.approved_at,
    }));
  });

  it("usa o vencedor persistido em corrida, não o aprovador da requisição", async () => {
    updateStatus.mockResolvedValue({
      approved_by_id: "race-winner",
      approved_by_name: "Vencedor",
      approved_at: "2026-09-02T09:00:00.000Z",
    });
    await PATCH(request({ id: "content-1", status: "em_revisao" }));
    expect(autoLink).toHaveBeenCalledWith(expect.objectContaining({ collaboratorId: "race-winner" }));
  });

  it("mantém o fluxo send_mkt sem atualizar aprovação nem agendar novamente", async () => {
    sendMkt.mockResolvedValue({ marketing_request_id: "request-1" });
    const response = await PATCH(request({ id: "content-1", action: "send_mkt" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, marketing_request_id: "request-1" });
    expect(updateStatus).not.toHaveBeenCalled();
    expect(autoLink).not.toHaveBeenCalled();
  });
});
