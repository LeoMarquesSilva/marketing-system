import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  duplicateSupplierNameMessage,
  findSupplierNameConflict,
  normalizeSupplierName,
  supplierUniqueViolation,
} from "./unique-name";

const rows = [
  { id: "pao", name: "Pão de Açúcar Cambuí", document: null, created_at: "2026-10-27" },
  { id: "sky", name: "SKY Bartenders", document: "12345678000190", created_at: "2026-09-01" },
];

describe("findSupplierNameConflict", () => {
  it("acha o cadastro com o mesmo nome, sem diferenciar maiúscula, acento e espaços", () => {
    expect(findSupplierNameConflict(rows, "  pao de  acucar CAMBUI ")?.id).toBe("pao");
    expect(findSupplierNameConflict(rows, "Sky bartenders")?.id).toBe("sky");
  });

  it("nome diferente (outra unidade) passa", () => {
    expect(findSupplierNameConflict(rows, "Pão de Açúcar Taquaral")).toBeNull();
    expect(findSupplierNameConflict(rows, "Pão de Açúcar")).toBeNull();
  });

  it("bloqueia mesmo quando o cadastro existente tem CNPJ", () => {
    expect(findSupplierNameConflict(rows, "SKY BARTENDERS")?.id).toBe("sky");
  });

  it("na edição, o próprio cadastro não conta", () => {
    expect(findSupplierNameConflict(rows, "Pão de Açúcar Cambuí", "pao")).toBeNull();
    expect(findSupplierNameConflict(rows, "Sky Bartenders", "pao")?.id).toBe("sky");
  });

  it("nome vazio não bloqueia (a validação do formulário cuida)", () => {
    expect(findSupplierNameConflict(rows, "   ")).toBeNull();
  });

  it("a mensagem diz qual cadastro já existe", () => {
    expect(duplicateSupplierNameMessage(rows[0])).toContain("Pão de Açúcar Cambuí");
  });
});

describe("supplierUniqueViolation", () => {
  it("separa o índice do nome do índice do CNPJ", () => {
    expect(
      supplierUniqueViolation({
        code: "23505",
        message: 'duplicate key value violates unique constraint "event_suppliers_name_unique"',
      })
    ).toBe("name");
    expect(
      supplierUniqueViolation({
        code: "23505",
        message: 'duplicate key value violates unique constraint "event_suppliers_document_key"',
      })
    ).toBe("document");
  });

  it("outros erros não são tratados como repetição", () => {
    expect(supplierUniqueViolation({ code: "23502", message: "null value in column" })).toBeNull();
    expect(supplierUniqueViolation({ code: "23505", message: 'unique constraint "outra_tabela_key"' })).toBeNull();
    expect(supplierUniqueViolation(null)).toBeNull();
  });
});

describe("supplier_name_key (migration) x normalizeSupplierName", () => {
  const sql = readFileSync(
    path.resolve(__dirname, "../../../supabase/migrations/20261110205215_event_suppliers_nome_unico.sql"),
    "utf8"
  );
  const [, from, to] = sql.match(/translate\(\s*name,\s*'([^']+)',\s*'([^']+)'/) ?? [];

  it("o banco tira dos acentos exatamente o que o código tira", () => {
    expect(from).toBeTruthy();
    expect([...from].length).toBe([...to].length);
    [...from].forEach((char, index) => {
      expect(normalizeSupplierName(char), `${char} → ${[...to][index]}`).toBe([...to][index]);
    });
  });

  it("o índice usa a função e não depende de CNPJ", () => {
    expect(sql).toMatch(/create unique index if not exists event_suppliers_name_unique\s+on public\.event_suppliers \(public\.supplier_name_key\(name\)\);/);
  });
});
