import { describe, expect, it } from "vitest";
import { whatsappDocumentDownloadName } from "@/lib/whatsapp-media-storage";
import { whatsappMediaSrc } from "@/components/trafego-pago/whatsapp-media-bubble";

describe("whatsappDocumentDownloadName", () => {
  it("usa o nome original que veio no body", () => {
    expect(whatsappDocumentDownloadName("[documento] Contrato social.pdf", "c/m.pdf")).toBe(
      "Contrato social.pdf"
    );
  });

  it("completa a extensão quando o body traz só a legenda", () => {
    expect(whatsappDocumentDownloadName("[documento] Segue a proposta", "c/m.docx")).toBe(
      "Segue a proposta.docx"
    );
  });

  it("não deixa barra virar pasta no nome", () => {
    expect(whatsappDocumentDownloadName("[documento] NF 10/2026", "c/m.pdf")).toBe(
      "NF 10-2026.pdf"
    );
  });

  it("cai em 'documento' sem body", () => {
    expect(whatsappDocumentDownloadName(null, "c/m.pdf")).toBe("documento.pdf");
  });
});

describe("whatsappMediaSrc", () => {
  it("prefere a URL assinada do Storage", () => {
    expect(
      whatsappMediaSrc({ url: "https://x.supabase.co/sign/a.jpg", mimetype: "image/jpeg" }, "image/jpeg")
    ).toBe("https://x.supabase.co/sign/a.jpg");
  });

  it("monta data URL quando a mídia veio em base64 da Evolution", () => {
    expect(whatsappMediaSrc({ base64: "AAAA", mimetype: "audio/ogg; codecs=opus" }, "audio/ogg")).toBe(
      "data:audio/ogg; codecs=opus;base64,AAAA"
    );
    expect(whatsappMediaSrc({ base64: "AAAA" }, "image/jpeg")).toBe("data:image/jpeg;base64,AAAA");
  });
});
