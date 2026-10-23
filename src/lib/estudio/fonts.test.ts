import { describe, expect, it } from "vitest";
import { FONT_FAMILY_RE, fontFaceRule, sniffFontFormat, suggestSlot } from "./fonts";

const bytes = (...b: number[]) => new Uint8Array(b);
const ascii = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

describe("fontes do Estúdio", () => {
  it("reconhece o formato pelo começo do arquivo", () => {
    expect(sniffFontFormat(ascii("OTTO...."))).toBe("otf");
    expect(sniffFontFormat(bytes(0, 1, 0, 0, 9))).toBe("ttf");
    expect(sniffFontFormat(ascii("wOF2abcd"))).toBe("woff2");
    expect(sniffFontFormat(ascii("wOFFabcd"))).toBe("woff");
    expect(sniffFontFormat(ascii("<svg"))).toBeNull();
    expect(sniffFontFormat(ascii("PK"))).toBeNull();
  });

  it("sugere o lugar do modelo pelo nome e pelo peso", () => {
    expect(suggestSlot("Gotham Book Gotham-Book.otf", 300)?.key).toBe("gotham-book");
    expect(suggestSlot("Gotham Medium", 500)?.key).toBe("gotham-medium");
    expect(suggestSlot("Gotham Bold", 700)?.key).toBe("gotham-bold");
    expect(suggestSlot("Neulis Neue Bold", 700)?.key).toBe("titulo");
    expect(suggestSlot("Roboto Regular", 400)).toBeNull();
  });

  it("monta o @font-face e só aceita nome de família seguro", () => {
    expect(fontFaceRule({ family: "Estudio Gotham", weight: 400, style: "normal", url: "/api/estudio/fontes/db/x", format: "otf" })).toBe(
      '@font-face{font-family:"Estudio Gotham";src:url("/api/estudio/fontes/db/x") format("opentype");font-weight:400;font-style:normal;font-display:block;}'
    );
    expect(FONT_FAMILY_RE.test("Gotham Rounded")).toBe(true);
    expect(FONT_FAMILY_RE.test('x";}body{color:red')).toBe(false);
  });
});
