import { describe, expect, it } from "vitest";
import { getNfcPublicUrl } from "@/lib/nfc/public-url";

describe("getNfcPublicUrl", () => {
  it("usa a URL oficial quando nenhuma variável está configurada", () => {
    expect(getNfcPublicUrl("token_123", {})).toBe(
      "https://marketing-system-xi.vercel.app/t/token_123"
    );
  });

  it("aceita uma origem NFC explicitamente configurada", () => {
    expect(
      getNfcPublicUrl("token com espaço", {
        NFC_PUBLIC_BASE_URL: "https://nfc.example.com/",
      })
    ).toBe("https://nfc.example.com/t/token%20com%20espa%C3%A7o");
  });

  it("não usa o host da requisição como origem permanente", () => {
    expect(
      getNfcPublicUrl("abc", {
        NEXT_PUBLIC_APP_URL: "https://marketing-system-xi.vercel.app/",
      })
    ).not.toContain("localhost");
  });
});
