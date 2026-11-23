import { describe, expect, it } from "vitest";
import { fetchAllPages } from "./supabase-pages";

describe("leitura paginada", () => {
  it("passa do limite de 1.000 linhas lendo página a página", async () => {
    const all = Array.from({ length: 2350 }, (_, index) => index);
    const calls: Array<[number, number]> = [];
    const rows = await fetchAllPages(async (from, to) => {
      calls.push([from, to]);
      return { data: all.slice(from, to + 1), error: null };
    });
    expect(rows).toHaveLength(2350);
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("para na primeira página incompleta e repassa o erro do banco", async () => {
    await expect(fetchAllPages(async () => ({ data: null, error: { message: "falhou" } }))).rejects.toThrow("falhou");
    const rows = await fetchAllPages(async () => ({ data: [1, 2], error: null }));
    expect(rows).toEqual([1, 2]);
  });
});
