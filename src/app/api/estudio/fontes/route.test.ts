import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireStudioUser, upload, remove, insert, existing } = vi.hoisted(() => ({
  requireStudioUser: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  insert: vi.fn(),
  existing: { value: null as null | { id: string; arquivo: string } },
}));

vi.mock("@/lib/estudio/server", () => ({ requireStudioUser, listStudioFonts: async () => [], diskFontSlots: async () => new Set(["gobold"]) }));

function query() {
  const q = {
    select: () => q,
    eq: () => q,
    delete: () => q,
    maybeSingle: async () => ({ data: existing.value }),
    insert: (row: unknown) => {
      insert(row);
      return { select: () => ({ single: async () => ({ data: { id: "f1", ...(row as object), created_at: "agora" }, error: null }) }) };
    },
  };
  return q;
}
vi.mock("@/lib/users-server", () => ({ getServerDb: async () => ({ from: () => query(), storage: { from: () => ({ upload, remove }) } }) }));

import { GET, POST } from "./route";

function send(fields: Record<string, string | Blob>) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return POST(new Request("http://localhost/api/estudio/fontes", { method: "POST", body: form }));
}

const otf = () => new File([new Uint8Array([79, 84, 84, 79, 0, 0])], "Gotham-Book.otf");

describe("/api/estudio/fontes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    existing.value = null;
    requireStudioUser.mockResolvedValue({ profile: { id: "u1" } });
    upload.mockResolvedValue({ error: null });
    remove.mockResolvedValue({ error: null });
  });

  it("lista os lugares dos modelos com a origem", async () => {
    const body = await (await GET()).json();
    expect(body.slots.find((s: { key: string }) => s.key === "gobold").origem).toBe("pasta");
    expect(body.slots.find((s: { key: string }) => s.key === "gotham-book").origem).toBeNull();
  });

  it("guarda a fonte e devolve o @font-face", async () => {
    const res = await send({ arquivo: otf(), familia: "Estudio Gotham", peso: "400", estilo: "normal", postscript: "Gotham-Book" });
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(upload.mock.calls[0][0]).toMatch(/^fontes\/[0-9a-f-]{36}\.otf$/);
    expect(upload.mock.calls[0][2].contentType).toBe("font/otf");
    expect(insert.mock.calls[0][0]).toMatchObject({ familia: "Estudio Gotham", peso: 400, formato: "otf", postscript: "Gotham-Book" });
    expect(body.css).toContain('font-family:"Estudio Gotham"');
  });

  it("substitui a fonte com a mesma família e peso", async () => {
    existing.value = { id: "velha", arquivo: "fontes/velha.otf" };
    await send({ arquivo: otf(), familia: "Estudio Gotham", peso: "400" });
    expect(remove).toHaveBeenCalledWith(["fontes/velha.otf"]);
  });

  it("recusa arquivo que não é fonte e nome perigoso", async () => {
    expect((await send({ arquivo: new File(["<svg/>"], "x.otf"), familia: "Teste", peso: "400" })).status).toBe(400);
    expect((await send({ arquivo: otf(), familia: 'x";}body{', peso: "400" })).status).toBe(400);
    expect((await send({ arquivo: otf(), familia: "Teste", peso: "450" })).status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });
});
