import { describe, expect, it } from "vitest";
import {
  createKeyedSingleFlight,
  fillEmptyContactPatch,
  findOrCreateSupplier,
  normalizeSupplierName,
  pickExistingSupplier,
  SupplierNameTakenError,
  supplierRenameConflictMessage,
  type FindOrCreateResult,
} from "./eventos-fornecedor-unico";

type Row = { id: string; name: string; document?: string | null; created_at?: string | null };

/** Banco de mentira: a busca e a inserção demoram, como numa rede lenta. */
function fakeTable(initial: Row[] = []) {
  const rows = [...initial];
  let inserts = 0;
  const wait = () => new Promise((resolve) => setTimeout(resolve, 5));
  return {
    rows,
    get inserts() {
      return inserts;
    },
    findExisting: async (name: string) => {
      await wait();
      return pickExistingSupplier(rows, name);
    },
    insert: async (name: string) => {
      await wait();
      inserts++;
      const row = { id: `novo-${inserts}`, name, document: null, created_at: new Date().toISOString() };
      rows.push(row);
      return row;
    },
  };
}

describe("normalizeSupplierName", () => {
  it("ignora maiúscula, acento e espaços repetidos", () => {
    expect(normalizeSupplierName("  Pão de  Açúcar CAMBUÍ ")).toBe("pao de acucar cambui");
    expect(normalizeSupplierName("SKY Bartenders")).toBe(normalizeSupplierName("Sky Bartenders"));
  });

  it("não junta nomes diferentes", () => {
    expect(normalizeSupplierName("Pão de Açúcar Cambuí")).not.toBe(normalizeSupplierName("Pão de Açúcar"));
  });
});

describe("pickExistingSupplier", () => {
  it("acha o cadastro com o mesmo nome", () => {
    const rows: Row[] = [
      { id: "a", name: "Mercado Livre", document: "10573521000191" },
      { id: "b", name: "Buffet X" },
    ];
    expect(pickExistingSupplier(rows, "mercado livre")?.id).toBe("a");
    expect(pickExistingSupplier(rows, "Mercado")).toBeNull();
    expect(pickExistingSupplier(rows, "   ")).toBeNull();
  });

  it("entre duplicados antigos, prefere o que tem CNPJ e depois o mais antigo", () => {
    const rows: Row[] = [
      { id: "novo", name: "Sky Bartenders", document: null, created_at: "2026-10-27T13:52:50Z" },
      { id: "cnpj", name: "SKY Bartenders", document: "59076375000188", created_at: "2026-10-23T20:40:11Z" },
    ];
    expect(pickExistingSupplier(rows, "sky bartenders")?.id).toBe("cnpj");

    const semCnpj: Row[] = [
      { id: "segundo", name: "Pão de Açúcar Cambuí", created_at: "2026-10-27T14:03:40.681Z" },
      { id: "primeiro", name: "Pão de Açúcar Cambuí", created_at: "2026-10-27T14:03:40.674Z" },
    ];
    expect(pickExistingSupplier(semCnpj, "Pão de Açúcar Cambuí")?.id).toBe("primeiro");
  });
});

describe("fillEmptyContactPatch", () => {
  it("só preenche o que está vazio no cadastro existente", () => {
    const patch = fillEmptyContactPatch(
      { phone: null, email: "financeiro@sky.com.br", contact_name: "  " },
      { phone: "(19) 99602-4738", email: "contato@skybartenders.com.br", contact_name: "Ana", website_link: "" }
    );
    expect(patch).toEqual({ phone: "(19) 99602-4738", contact_name: "Ana" });
  });
});

describe("findOrCreateSupplier", () => {
  it("usa o existente em vez de criar outro", async () => {
    const table = fakeTable([{ id: "cnpj", name: "SKY Bartenders", document: "59076375000188" }]);
    const result = await findOrCreateSupplier("Sky Bartenders", {
      findExisting: table.findExisting,
      create: () => table.insert("Sky Bartenders"),
    });
    expect(result).toEqual({ supplier: expect.objectContaining({ id: "cnpj" }), reused: true });
    expect(table.inserts).toBe(0);
  });

  it("cria quando o nome é novo", async () => {
    const table = fakeTable();
    const result = await findOrCreateSupplier("Buffet Novo", {
      findExisting: table.findExisting,
      create: () => table.insert("Buffet Novo"),
    });
    expect(result?.reused).toBe(false);
    expect(table.inserts).toBe(1);
  });
});

describe("13 envios simultâneos do mesmo nome (caso de 27/10/2026)", () => {
  it("sem a trava, cada envio cria um cadastro", async () => {
    const table = fakeTable();
    await Promise.all(
      Array.from({ length: 13 }, () =>
        findOrCreateSupplier("Pão de Açúcar Cambuí", {
          findExisting: table.findExisting,
          create: () => table.insert("Pão de Açúcar Cambuí"),
        })
      )
    );
    expect(table.inserts).toBe(13);
  });

  it("com a trava por nome, vira um cadastro só e todos recebem o mesmo", async () => {
    const table = fakeTable();
    const once = createKeyedSingleFlight<FindOrCreateResult<Row> | null>();
    const names = ["Pão de Açúcar Cambuí", "pão de açúcar cambuí", " PAO DE ACUCAR  CAMBUI "];
    const results = await Promise.all(
      Array.from({ length: 13 }, (_, i) => {
        const name = names[i % names.length];
        return once(normalizeSupplierName(name), () =>
          findOrCreateSupplier<Row>(name, {
            findExisting: table.findExisting,
            create: () => table.insert(name),
          })
        );
      })
    );
    expect(table.inserts).toBe(1);
    expect(new Set(results.map((r) => r?.supplier.id))).toEqual(new Set(["novo-1"]));
  });

  it("depois que a gravação termina, um novo envio acha o cadastro e não cria outro", async () => {
    const table = fakeTable();
    const once = createKeyedSingleFlight<FindOrCreateResult<Row> | null>();
    const save = (name: string) =>
      once(normalizeSupplierName(name), () =>
        findOrCreateSupplier<Row>(name, { findExisting: table.findExisting, create: () => table.insert(name) })
      );
    const first = await save("Pão de Açúcar Cambuí");
    const second = await save("Pão de Açúcar Cambuí");
    expect(first?.reused).toBe(false);
    expect(second).toEqual({ supplier: expect.objectContaining({ id: first?.supplier.id }), reused: true });
    expect(table.inserts).toBe(1);
  });

  it("nomes diferentes não esperam um pelo outro", async () => {
    const table = fakeTable();
    const once = createKeyedSingleFlight<FindOrCreateResult<Row> | null>();
    await Promise.all(
      ["Buffet A", "Buffet B"].map((name) =>
        once(normalizeSupplierName(name), () =>
          findOrCreateSupplier<Row>(name, { findExisting: table.findExisting, create: () => table.insert(name) })
        )
      )
    );
    expect(table.inserts).toBe(2);
  });

  it("se a gravação falhar, a trava solta e dá para tentar de novo", async () => {
    const once = createKeyedSingleFlight<string>();
    await expect(once("x", async () => { throw new Error("rede caiu"); })).rejects.toThrow("rede caiu");
    await expect(once("x", async () => "ok")).resolves.toBe("ok");
  });
});

describe("índice único de nome no banco (erro 23505)", () => {
  it("se outro servidor gravou o mesmo nome entre a busca e a gravação, usa o cadastro dele", async () => {
    const table = fakeTable();
    let lookups = 0;
    const result = await findOrCreateSupplier<Row>("Pão de Açúcar Cambuí", {
      findExisting: async (name) => {
        lookups++;
        return table.findExisting(name);
      },
      create: async () => {
        // A outra gravação chega primeiro; a nossa cai no índice.
        await table.insert("PÃO DE AÇÚCAR CAMBUÍ");
        throw new SupplierNameTakenError("Pão de Açúcar Cambuí");
      },
    });
    expect(result).toEqual({ supplier: expect.objectContaining({ id: "novo-1" }), reused: true });
    expect(lookups).toBe(2);
    expect(table.rows).toHaveLength(1);
  });

  it("conflito de nome sem cadastro achado na segunda busca vira erro, não cadastro", async () => {
    await expect(
      findOrCreateSupplier<Row>("Buffet X", {
        findExisting: async () => null,
        create: async () => {
          throw new SupplierNameTakenError("Buffet X");
        },
      })
    ).rejects.toBeInstanceOf(SupplierNameTakenError);
  });

  it("outros erros da gravação não são tratados como nome em uso", async () => {
    let lookups = 0;
    await expect(
      findOrCreateSupplier<Row>("Buffet X", {
        findExisting: async () => {
          lookups++;
          return null;
        },
        create: async () => {
          throw new Error("rede caiu");
        },
      })
    ).rejects.toThrow("rede caiu");
    expect(lookups).toBe(1);
  });

  it("aviso de renomear cita o cadastro que já usa o nome", () => {
    expect(supplierRenameConflictMessage({ name: "SKY Bartenders" })).toBe(
      "Já existe outro cadastro com este nome: SKY Bartenders. Use um nome que diferencie, como a unidade."
    );
  });
});
