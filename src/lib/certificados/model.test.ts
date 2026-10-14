import { describe, expect, it } from "vitest";
import {
  buildCertificateText,
  buildSignatories,
  DEFAULT_CERTIFICATE_TEXT,
  formatCargaHoraria,
  formatPeriodo,
  parseMarkup,
  validateCertificateConfig,
  type CertificateConfig,
} from "./model";

const base: CertificateConfig = {
  tipo: "Workshop",
  curso: "Técnicas de Redação Jurídica Persuasiva para Petições",
  dataInicio: "2026-09-17",
  dataFim: null,
  cargaHorariaMinutos: 60,
  texto: DEFAULT_CERTIFICATE_TEXT,
  nomeEmMaiusculas: true,
  facilitadores: [{ nome: "Midian Barbosa", cargo: "Facilitadora" }],
  socios: ["ricardo", "gustavo"],
};

const plain = (lines: ReturnType<typeof buildCertificateText>) => lines.map((runs) => runs.map((r) => r.text).join(""));

describe("texto do certificado", () => {
  it("monta o texto do modelo com nome em maiúsculas e destaques", () => {
    const lines = buildCertificateText(base, "Ana Nunes Galvão");
    expect(plain(lines)).toEqual([
      "O Bismarchi | Pires Sociedade de Advogados certifica que ANA NUNES GALVÃO",
      "participou do Workshop “Técnicas de Redação Jurídica Persuasiva para Petições”",
      "com carga horária de 1 hora, realizado no dia 17/09/2026.",
    ]);
    expect(lines[0].at(-1)).toEqual({ text: "ANA NUNES GALVÃO", weight: "bold" });
    expect(lines[1].at(-1)?.weight).toBe("medium");
    expect(lines[2].at(-1)).toEqual({ text: "17/09/2026.", weight: "bold" });
  });

  it("concorda artigo e particípio com o tipo do evento", () => {
    const lines = plain(buildCertificateText({ ...base, tipo: "Palestra" }, "Ana"));
    expect(lines[1]).toMatch(/^participou da Palestra/);
    expect(lines[2]).toContain("realizada no dia");
  });

  it("não repete o tipo quando o nome do curso já começa com ele", () => {
    const lines = plain(
      buildCertificateText({ ...base, curso: "Workshop de fluxos de trabalho vios: Operações Legais" }, "Ana")
    );
    expect(lines[1]).toBe("participou do “Workshop de fluxos de trabalho vios: Operações Legais”");
  });

  it("não deixa asterisco do nome virar marcação", () => {
    const lines = buildCertificateText({ ...base, nomeEmMaiusculas: false }, "Ana *Teste*");
    expect(plain(lines)[0]).toMatch(/certifica que Ana Teste$/);
  });

  it("formata carga horária e períodos", () => {
    expect(formatCargaHoraria(60)).toBe("1 hora");
    expect(formatCargaHoraria(120)).toBe("2 horas");
    expect(formatCargaHoraria(90)).toBe("1 hora e 30 minutos");
    expect(formatCargaHoraria(30)).toBe("30 minutos");
    expect(formatPeriodo("2026-09-17")).toEqual({ periodo: "no dia", data: "17/09/2026" });
    expect(formatPeriodo("2026-07-01", "2026-07-03")).toEqual({ periodo: "entre os dias", data: "01 e 03/07/2026" });
    expect(formatPeriodo("2026-06-30", "2026-07-02")).toEqual({ periodo: "entre os dias", data: "30/06 e 02/07/2026" });
    expect(formatPeriodo("2026-12-30", "2027-01-02").data).toBe("30/12/2026 e 02/01/2027");
  });

  it("lê marcação de negrito e seminegrito", () => {
    expect(parseMarkup("a **b** *c* d")).toEqual([
      { text: "a ", weight: "regular" },
      { text: "b", weight: "bold" },
      { text: " ", weight: "regular" },
      { text: "c", weight: "medium" },
      { text: " d", weight: "regular" },
    ]);
  });
});

describe("assinaturas", () => {
  it("põe facilitadores antes dos sócios marcados e ignora facilitador sem nome", () => {
    const signatories = buildSignatories({
      ...base,
      facilitadores: [
        { nome: "Midian Barbosa", cargo: "Facilitadora" },
        { nome: "  ", cargo: "Facilitador" },
      ],
      socios: ["gustavo"],
    });
    expect(signatories.map((s) => s.nome)).toEqual(["Midian Barbosa", "Gustavo Bismarchi Motta"]);
  });

  it("aceita certificado sem sócios", () => {
    expect(buildSignatories({ ...base, socios: [] })).toHaveLength(1);
  });
});

describe("validação", () => {
  it("aponta o que falta preencher", () => {
    expect(validateCertificateConfig(base)).toEqual([]);
    expect(
      validateCertificateConfig({ ...base, curso: " ", dataInicio: "", cargaHorariaMinutos: 0, texto: "sem nome" })
    ).toHaveLength(4);
  });
});
