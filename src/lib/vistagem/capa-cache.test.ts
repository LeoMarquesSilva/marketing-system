import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { capaNoDataJud, SEM_PROCESSO_NO_DATAJUD, validadeDoDataJud } from "./capa-abertura-server";
import { padraoSemAcento } from "./sioe";

const achado = {
  hits: {
    hits: [{ _source: { grau: "G1", sistema: { nome: "PJe" }, dataAjuizamento: "2024-03-01", classe: { nome: "Procedimento Comum" }, assuntos: [{ nome: "Rescisão" }] } }],
  },
};

function respondeCom(status: number, corpo: unknown) {
  const fetchFalso = vi.fn(async () => new Response(JSON.stringify(corpo), { status }));
  vi.stubGlobal("fetch", fetchFalso);
  return fetchFalso;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DataJud guardado", () => {
  it("achado vale 12 h: a segunda consulta do mesmo processo não vai ao DataJud", async () => {
    const fetchFalso = respondeCom(200, achado);
    const primeira = await capaNoDataJud("1000001-56.2024.8.26.0100");
    const segunda = await capaNoDataJud("1000001-56.2024.8.26.0100");
    expect(primeira.achou).toBe(true);
    expect(segunda).toEqual(primeira);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(validadeDoDataJud(primeira)).toBe(12 * 60 * 60);
  });

  it("'Buscar de novo' (fresco) consulta mesmo guardado", async () => {
    const fetchFalso = respondeCom(200, achado);
    await capaNoDataJud("1000002-56.2024.8.26.0100");
    await capaNoDataJud("1000002-56.2024.8.26.0100", { fresco: true });
    expect(fetchFalso).toHaveBeenCalledTimes(2);
  });

  it("sobrecarga (429) não fica guardada: a próxima abertura tenta de novo", async () => {
    const fetchFalso = respondeCom(429, {});
    const primeira = await capaNoDataJud("1000003-56.2024.8.26.0100");
    await capaNoDataJud("1000003-56.2024.8.26.0100");
    expect(primeira.achou).toBe(false);
    expect(validadeDoDataJud(primeira)).toBe(0);
    expect(fetchFalso).toHaveBeenCalledTimes(2);
  });

  it("processo ainda não indexado vale 2 h", async () => {
    respondeCom(200, { hits: { hits: [] } });
    const resultado = await capaNoDataJud("1000004-56.2024.8.26.0100");
    expect(resultado.erro).toBe(SEM_PROCESSO_NO_DATAJUD);
    expect(validadeDoDataJud(resultado)).toBe(2 * 60 * 60);
  });
});

describe("padraoSemAcento", () => {
  it("troca vogal, c e letra acentuada por um caractere qualquer e os espaços por %", () => {
    expect(padraoSemAcento("Grupo São Paulo")).toBe("%Gr_p_%S__%P__l_%");
    expect(padraoSemAcento("GRUPO SAO PAULO")).toBe("%GR_P_%S__%P__L_%");
  });

  it("junta espaços repetidos, ignora caractere invisível e não deixa % ou _ do texto virar curinga a mais", () => {
    expect(padraoSemAcento("  Grupo​   Ômega  ")).toBe("%Gr_p_%_m_g_%");
    expect(padraoSemAcento("A_B%C")).toBe("%__B__%");
  });
});
