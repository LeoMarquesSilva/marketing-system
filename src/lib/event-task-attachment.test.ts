import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/utils/supabase/client", () => ({ supabase: { from: mocks.from } }));
import { linkEventAttachmentToTask } from "./eventos";

describe("vínculo de arquivo à tarefa", () => {
  beforeEach(() => vi.clearAllMocks());
  it("restringe ao evento e a arquivos sem vínculo, preservando metadados e visibilidade", async () => {
    const chain = { update: vi.fn(), eq: vi.fn(), is: vi.fn(), select: vi.fn(), single: vi.fn().mockResolvedValue({ data: { id: "f1", event_id: "e1", related_entity: "tarefa", related_id: "t1", title: "Contrato", url: "https://example.test/contrato.pdf", is_public: false }, error: null }) };
    for (const name of ["update", "eq", "is", "select"] as const) chain[name].mockReturnValue(chain);
    mocks.from.mockReturnValue(chain);
    const result = await linkEventAttachmentToTask("e1", "t1", "f1");
    expect(mocks.from).toHaveBeenCalledWith("event_attachments");
    expect(chain.update).toHaveBeenCalledWith({ related_entity: "tarefa", related_id: "t1" });
    expect(chain.eq).toHaveBeenCalledWith("event_id", "e1");
    expect(chain.eq).toHaveBeenCalledWith("id", "f1");
    expect(chain.is).toHaveBeenCalledWith("related_id", null);
    expect(result).toMatchObject({ relatedId: "t1", isPublic: false });
  });
  it("não confirma um vínculo recusado ou já ocupado", async () => {
    const chain = { update: vi.fn(), eq: vi.fn(), is: vi.fn(), select: vi.fn(), single: vi.fn().mockResolvedValue({ data: null, error: { message: "no rows" } }) };
    for (const name of ["update", "eq", "is", "select"] as const) chain[name].mockReturnValue(chain);
    mocks.from.mockReturnValue(chain);
    expect(await linkEventAttachmentToTask("e1", "t1", "f1")).toBeNull();
  });
});
