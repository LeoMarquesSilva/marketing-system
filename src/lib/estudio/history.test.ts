import { describe, expect, it } from "vitest";
import { createHistory, historyReducer } from "./history";

describe("histórico do editor", () => {
  it("agrupa digitação seguida no mesmo campo e separa campos diferentes", () => {
    let h = createHistory("a");
    h = historyReducer(h, { type: "set", next: "ab", key: "titulo", at: 1000 });
    h = historyReducer(h, { type: "set", next: "abc", key: "titulo", at: 1300 });
    expect(h.past).toEqual(["a"]);
    h = historyReducer(h, { type: "set", next: "abcd", key: "legenda", at: 1400 });
    expect(h.past).toEqual(["a", "abc"]);
  });

  it("depois de uma pausa, o mesmo campo abre um passo novo", () => {
    let h = createHistory(1);
    h = historyReducer(h, { type: "set", next: 2, key: "y", at: 0 });
    h = historyReducer(h, { type: "set", next: 3, key: "y", at: 5000 });
    expect(h.past).toEqual([1, 2]);
  });

  it("desfaz e refaz, e uma edição nova apaga o que dava para refazer", () => {
    let h = createHistory("v1");
    h = historyReducer(h, { type: "set", next: "v2", at: 0 });
    h = historyReducer(h, { type: "set", next: "v3", at: 1 });
    h = historyReducer(h, { type: "undo" });
    expect(h.present).toBe("v2");
    h = historyReducer(h, { type: "redo" });
    expect(h.present).toBe("v3");
    h = historyReducer(h, { type: "undo" });
    h = historyReducer(h, { type: "set", next: "v4", at: 2 });
    expect(h.future).toEqual([]);
    expect(historyReducer(h, { type: "redo" })).toBe(h);
  });

  it("não quebra sem passos para desfazer", () => {
    const h = createHistory("só");
    expect(historyReducer(h, { type: "undo" })).toBe(h);
  });
});
