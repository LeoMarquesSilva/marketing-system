import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeSupplierName } from "@/lib/suppliers/unique-name";

type Row = Record<string, unknown>;

/** Banco de mentira: guarda as linhas por tabela e, se pedido, imita o índice único por nome. */
const db = vi.hoisted(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "teste";
  return {
    tables: {} as Record<string, Row[]>,
    nameIndex: true,
    /** Some da primeira busca por nome (outra pessoa salvou no meio do caminho). */
    hiddenOnFirstLookup: null as string | null,
    nameLookups: 0,
    inserts: 0,
  };
});

function fakeClient() {
  const nameTaken = (rows: Row[], name: unknown, exceptId?: unknown) =>
    db.nameIndex &&
    rows.some((r) => r.id !== exceptId && normalizeSupplierName(String(r.name)) === normalizeSupplierName(String(name)));
  const violation = {
    code: "23505",
    message: 'duplicate key value violates unique constraint "event_suppliers_name_unique"',
  };

  return {
    from(table: string) {
      const filters: Array<(row: Row) => boolean> = [];
      let action: "select" | "insert" | "update" = "select";
      let payload: Row = {};
      let columns = "";
      const rowsOf = () => (db.tables[table] ??= []);

      const run = (mode: "many" | "maybe" | "single") => {
        const rows = rowsOf();
        if (action === "insert") {
          if (table === "event_suppliers" && nameTaken(rows, payload.name)) return { data: null, error: violation };
          db.inserts++;
          const row = { id: `novo-${db.inserts}`, created_at: new Date().toISOString(), ...payload };
          rows.push(row);
          return { data: { id: row.id }, error: null };
        }
        if (action === "update") {
          const targets = rows.filter((r) => filters.every((f) => f(r)));
          if (table === "event_suppliers" && targets.some((t) => nameTaken(rows, payload.name ?? t.name, t.id))) {
            return { data: null, error: violation };
          }
          targets.forEach((t) => Object.assign(t, payload));
          return { data: null, error: null };
        }
        let found = rows.filter((r) => filters.every((f) => f(r)));
        if (table === "event_suppliers" && columns === "id, name, document, created_at") {
          db.nameLookups++;
          if (db.nameLookups === 1 && db.hiddenOnFirstLookup) found = found.filter((r) => r.id !== db.hiddenOnFirstLookup);
        }
        if (mode === "many") return { data: found, error: null };
        if (mode === "maybe") return { data: found[0] ?? null, error: null };
        return found[0] ? { data: found[0], error: null } : { data: null, error: { message: "não encontrado" } };
      };

      const builder = {
        select(cols: string) {
          if (action === "select") columns = cols;
          return builder;
        },
        insert(row: Row) {
          action = "insert";
          payload = row;
          return builder;
        },
        update(row: Row) {
          action = "update";
          payload = row;
          return builder;
        },
        eq(column: string, value: unknown) {
          filters.push((r) => r[column] === value);
          return builder;
        },
        neq(column: string, value: unknown) {
          filters.push((r) => r[column] !== value);
          return builder;
        },
        in(column: string, values: unknown[]) {
          filters.push((r) => values.includes(r[column]));
          return builder;
        },
        order: () => builder,
        gte: () => builder,
        range: () => builder,
        limit: () => builder,
        not: () => builder,
        maybeSingle: () => Promise.resolve(run("maybe")),
        single: () => Promise.resolve(run("single")),
        then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
          Promise.resolve(run("many")).then(resolve, reject),
      };
      return builder;
    },
  };
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/access-control", () => ({ hasFacilitiesAccess: () => true }));
vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "auth-1" } } }) } }),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => fakeClient() }));

const { createSupplier, updateSupplier, toFacilitiesApiError, FacilitiesHttpError } = await import("./server");

function input(name: string, document = "") {
  return {
    name,
    legal_name: "",
    document,
    category: "manutencao",
    party_type: "prestador",
    third_party_category: "",
    opex_names: [],
    areas: [],
    contact_name: "",
    phone: "",
    email: "",
    website_link: "",
    whatsapp_link: "",
    city: "",
    rating: null,
    notes: "",
    active: true,
    responsible_user_id: null,
  };
}

function supplierRow(id: string, name: string, document: string | null = null): Row {
  return { id, name, document, category: "outros", opex_names: [], areas: [], active: true, created_at: "2026-10-27T10:00:00Z" };
}

async function rejection(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Era para ter recusado.");
}

const suppliers = () => db.tables.event_suppliers ?? [];

beforeEach(() => {
  db.tables = {
    users: [{ id: "perfil-1", auth_id: "auth-1", name: "Facilities", role: "admin", permissions: [] }],
    event_suppliers: [supplierRow("pao", "Pão de Açúcar Cambuí"), supplierRow("sky", "SKY Bartenders", "12345678000190")],
  };
  // Sem o índice: os testes provam que a conferência do sistema, sozinha, já barra.
  db.nameIndex = false;
  db.hiddenOnFirstLookup = null;
  db.nameLookups = 0;
  db.inserts = 0;
});

describe("Facilities: um nome, um cadastro", () => {
  it("nome que já existe (outra grafia, sem CNPJ) não cria um segundo cadastro", async () => {
    const error = await rejection(createSupplier(input("  pao de  ACUCAR cambui ")));
    expect(error).toBeInstanceOf(FacilitiesHttpError);
    const { status, body } = toFacilitiesApiError(error);
    expect(status).toBe(409);
    expect(body.code).toBe("DUPLICATE_NAME");
    expect(body.error).toBe(
      "Já existe um cadastro com este nome: Pão de Açúcar Cambuí. Abra o cadastro existente em vez de criar outro."
    );
    expect((body.existing as { id: string }).id).toBe("pao");
    expect(db.inserts).toBe(0);
    expect(suppliers()).toHaveLength(2);
  });

  it("mesmo nome com CNPJ diferente também é recusado (filial entra com outro nome)", async () => {
    const error = await rejection(createSupplier(input("Sky Bartenders", "98.765.432/0001-10")));
    expect(toFacilitiesApiError(error).body.code).toBe("DUPLICATE_NAME");
    expect(db.inserts).toBe(0);
  });

  it("nome novo é cadastrado normalmente", async () => {
    const created = await createSupplier(input("Pão de Açúcar Taquaral"));
    expect(created.name).toBe("Pão de Açúcar Taquaral");
    expect(suppliers()).toHaveLength(3);
  });

  it("renomear para o nome de outro cadastro é recusado; manter o próprio nome não", async () => {
    const error = await rejection(updateSupplier("pao", input("sky bartenders")));
    expect(toFacilitiesApiError(error).body.code).toBe("DUPLICATE_NAME");
    expect(suppliers().find((s) => s.id === "pao")?.name).toBe("Pão de Açúcar Cambuí");

    const saved = await updateSupplier("pao", input("Pão de Açúcar Cambuí"));
    expect(saved.id).toBe("pao");
  });

  it("se outra pessoa salvar o mesmo nome no meio do caminho, o índice do banco barra e a resposta sai em português", async () => {
    db.nameIndex = true;
    db.hiddenOnFirstLookup = "pao";
    const error = await rejection(createSupplier(input("Pão de Açúcar Cambuí")));
    const { status, body } = toFacilitiesApiError(error);
    expect(status).toBe(409);
    expect(body.code).toBe("DUPLICATE_NAME");
    expect(body.error).toMatch(/^Já existe um cadastro com este nome/);
    expect((body.existing as { id: string }).id).toBe("pao");
    expect(suppliers()).toHaveLength(2);
  });
});
