import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireStudioUser } = vi.hoisted(() => ({ requireStudioUser: vi.fn() }));
vi.mock("@/lib/estudio/server", () => ({ requireStudioUser }));

import { GET as search } from "./route";
import { GET as icon } from "./[prefixo]/[nome]/route";

const fetchMock = vi.fn();

describe("rotas de ícones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    requireStudioUser.mockResolvedValue({ profile: { id: "u1" } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("busca só nos conjuntos liberados", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ icons: ["lucide:scale", "fa:scale"] })));
    const res = await search(new Request("http://localhost/api/estudio/icones?q=Scale"));
    expect(await res.json()).toEqual({ icons: ["lucide:scale"] });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("query=scale");
    expect(url).toContain("prefixes=lucide,tabler");
  });

  it("recusa busca curta", async () => {
    const res = await search(new Request("http://localhost/api/estudio/icones?q=a"));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("devolve o desenho limpo", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ width: 24, height: 24, icons: { scale: { body: '<path d="M1 1" onclick="x"/>' } } })));
    const res = await icon(new Request("http://localhost"), { params: Promise.resolve({ prefixo: "lucide", nome: "scale" }) });
    expect(await res.json()).toEqual({ body: '<path d="M1 1"/>', width: 24, height: 24 });
  });

  it("recusa conjunto fora da lista sem chamar a Iconify", async () => {
    const res = await icon(new Request("http://localhost"), { params: Promise.resolve({ prefixo: "fa", nome: "scale" }) });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("recusa quem não é do Marketing", async () => {
    requireStudioUser.mockResolvedValue({ error: new Response(null, { status: 403 }) });
    const res = await search(new Request("http://localhost/api/estudio/icones?q=scale"));
    expect(res.status).toBe(403);
  });
});
