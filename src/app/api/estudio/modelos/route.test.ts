import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireStudioUser, invalidate, insert, piecesUsing, remove } = vi.hoisted(() => ({
  requireStudioUser: vi.fn(),
  invalidate: vi.fn(),
  insert: vi.fn(),
  piecesUsing: { count: 0 },
  remove: vi.fn(),
}));

vi.mock("@/lib/estudio/server", () => ({
  requireStudioUser,
  invalidateDynamicTemplates: invalidate,
  TEMPLATE_COLUMNS: "*",
  COLLECTION_COLUMNS: "*",
}));

function query(table: string) {
  const q: Record<string, unknown> = {};
  Object.assign(q, {
    select: () => q,
    eq: () => q,
    order: () => q,
    delete: () => q,
    contains: async () => ({ count: piecesUsing.count, error: null }),
    maybeSingle: async () => ({ data: { fundo: "BP/modelos/x.png" }, error: null }),
    insert: (row: Record<string, unknown>) => {
      insert(table, row);
      return { select: () => ({ single: async () => ({ data: { ...row, ativo: true }, error: null }) }) };
    },
  });
  return q;
}
vi.mock("@/lib/users-server", () => ({ getServerDb: async () => ({ from: query, storage: { from: () => ({ remove }) } }) }));

import { POST } from "./route";
import { DELETE } from "./[id]/route";
import { POST as createCollection } from "../colecoes/route";

const modelo = {
  tag: "BP",
  nome: "Slide de dúvida",
  descricao: "Pergunta e resposta",
  formato: "feed",
  uso: ["carrossel"],
  fundo: "BP/modelos/1-slide.png",
  caixas: [
    { key: "titulo", tipo: "texto", label: "Título", x: 100, y: 300, w: 800, h: 100, exemplo: "TÍTULO", max: 60, linhas: 1, fonte: { familia: "Estudio Gobold", peso: 400, estilo: "normal" }, tamanho: 60 },
  ],
};

const post = (body: unknown) => POST(new Request("http://localhost/api/estudio/modelos", { method: "POST", body: JSON.stringify(body) }));

describe("rotas de modelos criados na tela", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    piecesUsing.count = 0;
    requireStudioUser.mockResolvedValue({ profile: { id: "u1" } });
  });

  it("salva o modelo com id da coleção e recarrega o registro", async () => {
    const res = await post(modelo);
    expect(res.status).toBe(201);
    const [table, row] = insert.mock.calls[0];
    expect(table).toBe("studio_templates");
    expect(row.id).toMatch(/^m-bp-slide-de-duvida-[0-9a-f]{4}$/);
    expect(row.created_by_id).toBe("u1");
    expect(invalidate).toHaveBeenCalled();
  });

  it("recusa modelo incompleto, coleção desconhecida e fundo de outra coleção", async () => {
    expect((await post({ ...modelo, caixas: [] })).status).toBe(400);
    expect((await post({ ...modelo, tag: "XYZ" })).status).toBe(400);
    expect((await post({ ...modelo, fundo: "OAB/modelos/1-slide.png" })).status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("não exclui modelo que alguma peça usa", async () => {
    piecesUsing.count = 2;
    const res = await DELETE(new Request("http://localhost"), { params: Promise.resolve({ id: "m-bp-slide-ab12" }) });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("2 peças usam");
    expect(remove).not.toHaveBeenCalled();
  });

  it("exclui modelo sem uso e o fundo dele", async () => {
    const res = await DELETE(new Request("http://localhost"), { params: Promise.resolve({ id: "m-bp-slide-ab12" }) });
    expect(res.status).toBe(200);
    expect(remove).toHaveBeenCalledWith(["BP/modelos/x.png"]);
  });

  it("coleção nova não repete tag existente", async () => {
    const create = (body: unknown) => createCollection(new Request("http://localhost", { method: "POST", body: JSON.stringify(body) }));
    expect((await create({ tag: "BP", nome: "Outra", contexto: "", planner: "tag" })).status).toBe(409);
    expect((await create({ tag: "agro", nome: "Agro", contexto: "", planner: "tag" })).status).toBe(400);
    const res = await create({ tag: "AGRO", nome: "Campanha do Agro", contexto: "Feira em março", planner: "tag" });
    expect(res.status).toBe(201);
    expect(insert.mock.calls[0][0]).toBe("studio_collections");
  });
});
