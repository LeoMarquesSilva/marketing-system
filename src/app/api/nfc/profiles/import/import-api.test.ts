import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  buildImportPayload,
  buildImportPreview,
  parseCollaboratorWorkbook,
} from "@/lib/profiles/import";
import type { ImportUserCandidate } from "@/lib/profiles/types";

const HEADER = ["Colaborador Ativo?", "NOME", "ÁREA", "CARGO", "DT. ADMISSÃO", "TELEFONE", "DATA DE NASC.", "E-MAIL"];

function workbook(rows: unknown[][]): ArrayBuffer {
  const sheet = XLSX.utils.aoa_to_sheet([HEADER, ...rows], { cellDates: true });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Sheet1");
  return XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

const users: ImportUserCandidate[] = [
  { id: "u-ativo", email: "ativo@bismarchipires.com.br", name: "Colaborador Ativo" },
  { id: "u-inativo", email: "inativo@bismarchipires.com.br", name: "Colaborador Inativo" },
];

const fixture = workbook([
  [
    "SIM",
    "Colaborador Ativo",
    "Tributário",
    "Sócia",
    new Date(Date.UTC(2019, 2, 1)),
    "(19) 99999-9999",
    new Date(Date.UTC(1985, 3, 2)),
    "ativo@bismarchipires.com.br",
  ],
  [
    "NÃO",
    "Colaborador Inativo",
    "Cível",
    "Advogado",
    new Date(Date.UTC(2018, 0, 15)),
    "(19) 98888-8888",
    new Date(Date.UTC(1990, 5, 10)),
    "inativo@bismarchipires.com.br",
  ],
  [
    "SIM",
    "Sem Cadastro",
    "Trabalhista",
    "Estagiário",
    null,
    null,
    new Date(Date.UTC(2000, 1, 1)),
    "ninguem@bismarchipires.com.br",
  ],
]);

describe("payload enviado ao banco", () => {
  const preview = buildImportPreview(parseCollaboratorWorkbook(fixture), users, []);

  it("inclui telefone e admissão apenas das linhas selecionadas", () => {
    const payload = buildImportPayload(preview, ["ativo@bismarchipires.com.br"], false);
    expect(payload).toHaveLength(1);
    expect(payload[0].phone).toBe("(19) 99999-9999");
    expect(payload[0].joinedOn).toBe("2019-03-01");
  });

  it("nunca envia data de nascimento", () => {
    const payload = buildImportPayload(preview, ["ativo@bismarchipires.com.br"], false);
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("1985");
    expect(payload[0]).not.toHaveProperty("birthDate");
  });

  it("descarta linha sem correspondência mesmo se selecionada", () => {
    const payload = buildImportPayload(preview, ["ninguem@bismarchipires.com.br"], false);
    expect(payload).toHaveLength(0);
  });

  it("ignora e-mail selecionado que não está na planilha", () => {
    const payload = buildImportPayload(preview, ["inexistente@bismarchipires.com.br"], false);
    expect(payload).toHaveLength(0);
  });

  it("permite importar linha inativa quando escolhida explicitamente", () => {
    const payload = buildImportPayload(preview, ["inativo@bismarchipires.com.br"], false);
    expect(payload).toHaveLength(1);
    expect(payload[0].email).toBe("inativo@bismarchipires.com.br");
  });

  it("propaga overwrite=false por padrão", () => {
    const payload = buildImportPayload(preview, ["ativo@bismarchipires.com.br"], false);
    expect(payload[0].overwrite).toBe(false);
  });

  it("normaliza o e-mail selecionado antes de casar", () => {
    const payload = buildImportPayload(preview, ["  ATIVO@BismarchiPires.com.br "], false);
    expect(payload).toHaveLength(1);
  });

  it("nunca envia campo de atividade, papel ou permissão do usuário", () => {
    const payload = buildImportPayload(preview, ["ativo@bismarchipires.com.br"], false);
    expect(Object.keys(payload[0]).sort()).toEqual(
      ["area", "email", "joinedOn", "name", "overwrite", "phone", "role", "slug"].sort()
    );
  });
});

describe("preview devolvido ao navegador", () => {
  it("não carrega telefone das linhas de origem", () => {
    const preview = buildImportPreview(parseCollaboratorWorkbook(fixture), users, []);
    // Mesma projeção que a rota de preview devolve ao navegador.
    const serialized = JSON.stringify({ rows: preview.rows, counts: preview.counts });
    expect(serialized).not.toContain("99999-9999");
    expect(serialized).not.toContain("98888-8888");
  });

  it("mantém as contagens necessárias para a revisão", () => {
    const preview = buildImportPreview(parseCollaboratorWorkbook(fixture), users, []);
    expect(preview.counts.total).toBe(3);
    expect(preview.counts.create).toBe(1);
    expect(preview.counts.inactiveSource).toBe(1);
    expect(preview.counts.unmatched).toBe(1);
  });
});
