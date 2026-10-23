import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireStudioUser, upload } = vi.hoisted(() => ({ requireStudioUser: vi.fn(), upload: vi.fn() }));
vi.mock("@/lib/estudio/server", () => ({ requireStudioUser }));
vi.mock("@/lib/users-server", () => ({ getServerDb: async () => ({ storage: { from: () => ({ upload }) } }) }));

import { GET, POST } from "./route";

const fetchMock = vi.fn();
const photo = {
  id: 42,
  url: "https://www.pexels.com/photo/42/",
  alt: "Escritório",
  photographer: "Ana Souza",
  photographer_url: "https://www.pexels.com/@ana",
  avg_color: "#334455",
  src: { original: "https://images.pexels.com/photos/42/a.jpeg", medium: "https://images.pexels.com/photos/42/a.jpeg?h=350", large: "x" },
};

describe("/api/estudio/fundos/pexels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("PEXELS_API_KEY", "chave-teste");
    requireStudioUser.mockResolvedValue({ profile: { id: "u1" } });
    upload.mockResolvedValue({ error: null });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("sem chave avisa com 501", async () => {
    vi.stubEnv("PEXELS_API_KEY", "");
    const res = await GET(new Request("http://localhost/api/estudio/fundos/pexels?q=escritorio"));
    expect(res.status).toBe(501);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("busca fotos em pé com a chave no cabeçalho", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ photos: [photo], next_page: "x" })));
    const res = await GET(new Request("http://localhost/api/estudio/fundos/pexels?q=escrit%C3%B3rio"));
    const body = await res.json();
    expect(body).toEqual({
      photos: [{ id: 42, alt: "Escritório", thumb: photo.src.medium, cor: "#334455", credito: "Foto: Ana Souza (Pexels)", pagina: photo.url, fotografo: photo.photographer_url }],
      mais: true,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("orientation=portrait");
    expect(init.headers.Authorization).toBe("chave-teste");
  });

  it("importa já recortada em 1080x1350 para a pasta de fundos", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(photo)))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
    const res = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ tag: "BP", id: 42 }) }));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.path).toMatch(/^BP\/fundos\/\d+-pexels-42-ana-souza\.jpg$/);
    expect(body.credito).toBe("Foto: Ana Souza (Pexels)");
    expect(String(fetchMock.mock.calls[1][0])).toBe("https://images.pexels.com/photos/42/a.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1080&h=1350");
    expect(upload.mock.calls[0][0]).toBe(body.path);
  });

  it("recusa foto de outra origem e coleção desconhecida", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ...photo, src: { ...photo.src, original: "https://mal.example/a.jpg" } })));
    const res = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ tag: "BP", id: 42 }) }));
    expect(res.status).toBe(502);
    expect(upload).not.toHaveBeenCalled();
    const bad = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ tag: "XX", id: 42 }) }));
    expect(bad.status).toBe(400);
  });
});
