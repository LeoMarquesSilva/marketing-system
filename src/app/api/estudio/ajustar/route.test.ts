import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateObject, requireStudioUser } = vi.hoisted(() => ({
  generateObject: vi.fn(),
  requireStudioUser: vi.fn(),
}));

vi.mock("ai", () => ({ generateObject }));
vi.mock("@/lib/estudio/server", () => ({
  requireStudioUser,
  isPieceKind: (v: unknown) => v === "feed" || v === "carrossel" || v === "stories",
}));

import { POST } from "./route";

function post(body: unknown) {
  return POST(new Request("http://localhost/api/estudio/ajustar", { method: "POST", body: JSON.stringify(body) }));
}

const slideAtual = {
  id: "slide-1",
  modelo: "oab-programacao",
  valores: { horario: "9h15 às 10h15", palcos: [{ rotulo: "Palco 1", titulo: "Crédito" }], arraste: true },
};

describe("POST /api/estudio/ajustar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_OPENAI_API_KEY", "test-key");
    requireStudioUser.mockResolvedValue({ profile: { id: "u1", name: "Leo", email: null, role: "admin", department: "Marketing" } });
  });

  it("devolve os slides ajustados, normalizados e com o id preservado", async () => {
    generateObject.mockResolvedValue({
      object: {
        slides: [
          { modelo: "oab-programacao", valores: { ...slideAtual.valores, horario: "10h30 às 11h30" } },
          { modelo: "oab-aviso-story", valores: {} },
        ],
        legenda: "Nova legenda",
        resumo: "Troquei o horário.",
      },
    });

    const res = await post({ tag: "OAB", tipo: "carrossel", slides: [slideAtual], legenda: "", pedido: "troca o horário para 10h30" });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.slides).toHaveLength(1); // o story não serve para carrossel
    expect(body.slides[0].id).toBe("slide-1");
    expect(body.slides[0].valores.horario).toBe("10h30 às 11h30");
    expect(body.resumo).toBe("Troquei o horário.");
    const call = generateObject.mock.calls[0][0];
    expect(call.prompt).toContain("troca o horário para 10h30");
    expect(call.prompt).toContain("Expo Boulevard Iguatemi");
  });

  it("recusa quem não é do Marketing", async () => {
    requireStudioUser.mockResolvedValue({ error: new Response(null, { status: 403 }) });
    const res = await post({ tag: "OAB", tipo: "feed", slides: [], pedido: "faz um post" });
    expect(res.status).toBe(403);
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("pede o texto do pedido", async () => {
    const res = await post({ tag: "OAB", tipo: "feed", slides: [], pedido: " " });
    expect(res.status).toBe(400);
  });
});
