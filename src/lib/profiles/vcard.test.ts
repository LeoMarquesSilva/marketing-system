import { describe, expect, it } from "vitest";
import { buildVCard, escapeVCardValue, makeVCardFilename } from "@/lib/profiles/vcard";

describe("escapeVCardValue", () => {
  it("escapa vírgula, ponto e vírgula, barra e quebras de linha", () => {
    expect(escapeVCardValue("A, B; C\\D\nE")).toBe("A\\, B\\; C\\\\D\\nE");
  });
});

describe("buildVCard", () => {
  it("usa CRLF e inclui organização Bismarchi | Pires", () => {
    const vcard = buildVCard({
      displayName: "Letícia Rodrigues",
      role: "Sócia",
      email: "leticia@bismarchipires.com.br",
      phone: "+5519999999999",
      linkedinUrl: "https://linkedin.com/in/leticia",
      websiteUrl: "https://bismarchipires.com.br",
    });

    expect(vcard.includes("\r\n")).toBe(true);
    expect(vcard.endsWith("\r\n")).toBe(true);
    expect(vcard).toContain("BEGIN:VCARD");
    expect(vcard).toContain("VERSION:3.0");
    expect(vcard).toContain("FN;CHARSET=UTF-8:Letícia Rodrigues");
    expect(vcard).toContain("ORG;CHARSET=UTF-8:Bismarchi | Pires");
    expect(vcard).toContain("TITLE;CHARSET=UTF-8:Sócia");
    expect(vcard).toContain("EMAIL;CHARSET=UTF-8:leticia@bismarchipires.com.br");
    expect(vcard).toContain("TEL;TYPE=CELL:+5519999999999");
    expect(vcard).toContain("URL;TYPE=LinkedIn:https://linkedin.com/in/leticia");
    expect(vcard).toContain("URL:https://bismarchipires.com.br");
    expect(vcard).toContain("END:VCARD");
  });

  it("omite e-mail e telefone ausentes", () => {
    const vcard = buildVCard({
      displayName: "Ana Silva",
      role: "Associada",
      linkedinUrl: "https://linkedin.com/in/ana",
    });
    expect(vcard).not.toContain("EMAIL");
    expect(vcard).not.toContain("TEL");
    expect(vcard).toContain("URL;TYPE=LinkedIn:https://linkedin.com/in/ana");
  });

  it("escapa caracteres especiais nos valores", () => {
    const vcard = buildVCard({
      displayName: "Nome, Com; Barra\\Nova",
      role: "Linha1\nLinha2",
    });
    expect(vcard).toContain("FN;CHARSET=UTF-8:Nome\\, Com\\; Barra\\\\Nova");
    expect(vcard).toContain("TITLE;CHARSET=UTF-8:Linha1\\nLinha2");
  });

  it("monta N a partir do nome de exibição", () => {
    const vcard = buildVCard({ displayName: "Letícia Rodrigues" });
    expect(vcard).toContain("N;CHARSET=UTF-8:Rodrigues;Letícia;;;");
  });
});

describe("makeVCardFilename", () => {
  it("gera nome determinístico e seguro", () => {
    expect(makeVCardFilename("Letícia Rodrigues")).toBe("leticia-rodrigues.vcf");
    expect(makeVCardFilename("Ana / Silva")).toBe("ana-silva.vcf");
    expect(makeVCardFilename("!!!")).toBe("contato.vcf");
  });
});
