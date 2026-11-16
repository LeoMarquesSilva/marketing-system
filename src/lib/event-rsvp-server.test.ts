import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Caminho do consultor sem ficha no RH (ex.: Carlos Zamboni) na confirmação da festa:
 * reconhecido pelo convite, restrição alimentar na página e prazo próprio prorrogado.
 */
const db = vi.hoisted(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "teste";
  const state = {
    tables: {} as Record<string, Record<string, unknown>[]>,
    updates: [] as { table: string; payload: Record<string, unknown> }[],
  };
  const from = (table: string) => {
    let op: "select" | "update" | "insert" = "select";
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    Object.assign(builder, {
      select: chain,
      eq: chain,
      ilike: chain,
      limit: chain,
      in: chain,
      order: chain,
      update: (payload: Record<string, unknown>) => {
        op = "update";
        state.updates.push({ table, payload });
        return builder;
      },
      insert: (payload: Record<string, unknown>) => {
        op = "insert";
        state.updates.push({ table, payload });
        return builder;
      },
      maybeSingle: async () => ({ data: state.tables[table]?.[0] ?? null, error: null }),
      then: (resolve: (value: unknown) => unknown) =>
        resolve({ data: op === "select" ? (state.tables[table] ?? []) : null, error: null }),
    });
    return builder;
  };
  return { state, client: { from } };
});

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => db.client }));
vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "auth-zamboni" } } }) } }),
}));
vi.mock("@/lib/rh/people-directory", () => ({ loadPeopleDirectory: async () => [] }));
vi.mock("@/lib/rh/registration/server", () => ({ getDietaryByUserIds: async () => new Map() }));
vi.mock("@/lib/rh/qualifications/server", () => ({
  RhHttpError: class RhHttpError extends Error {
    constructor(
      message: string,
      public status: number,
      public code: string
    ) {
      super(message);
    }
  },
}));

import { getRsvpView, saveRsvp } from "./event-rsvp-server";
import type { RsvpAnswer } from "./event-rsvp";

const EVENT = "a4c3bb58-49c6-4d45-a161-38bdafcf1a6c";
const GERAL = "2026-11-13T23:59:59-03:00";
const TERCA = "2026-11-17T23:59:59-03:00";

function invite(overrides: Record<string, unknown> = {}) {
  return {
    id: "convite-zamboni",
    name: "Carlos Zamboni",
    email: "zamboni@example.com",
    hr_employee_id: null,
    confirmation_status: "sem_resposta",
    transport: null,
    responded_at: null,
    plus_one_allowed: false,
    plus_one: null,
    plus_one_name: null,
    dietary_info: null,
    dietary_restrictions: null,
    rsvp_closes_at: TERCA,
    ...overrides,
  };
}

const ANSWER: RsvpAnswer = {
  attending: true,
  transport: "nao",
  plusOne: false,
  plusOneName: null,
  plusOneDietary: null,
  dietary: { restrictions: ["gluten"], notes: null },
};

beforeEach(() => {
  vi.useFakeTimers();
  // Segunda-feira, 16/11: o prazo geral (13/11) já passou; o dele (17/11), não.
  vi.setSystemTime(new Date("2026-11-16T10:00:00-03:00"));
  db.state.updates = [];
  db.state.tables = {
    users: [{ id: "user-zamboni", name: "Carlos Zamboni", email: "zamboni@example.com", role: null, permissions: ["/pe27", "/pe27/editar"], is_active: true }],
    hr_employees: [],
    events: [{ id: EVENT, rsvp_closes_at: GERAL }],
    event_invites: [invite()],
  };
});

afterEach(() => {
  vi.useRealTimers();
});

describe("confirmação do consultor sem ficha no RH, com prazo prorrogado", () => {
  it("abre a página com o prazo dele e pergunta a restrição alimentar", async () => {
    const view = await getRsvpView(EVENT);
    expect(view).toMatchObject({ eligible: true, firstName: "Carlos", open: true, closesAt: TERCA, askDietary: true, plusOneAllowed: false, attending: null });
  });

  it("grava a resposta com a restrição dele mesmo depois do prazo geral", async () => {
    await saveRsvp(EVENT, ANSWER);
    const update = db.state.updates.find((entry) => entry.table === "event_invites");
    expect(update?.payload).toMatchObject({
      confirmation_status: "confirmado",
      transport: "nao",
      plus_one: false,
      plus_one_name: null,
      hr_employee_id: null,
      dietary_info: { guest: { restrictions: ["gluten"], notes: null }, plusOne: null },
      dietary_restrictions: "Sem glúten",
    });
  });

  it("sem a prorrogação, o prazo geral já fechou", async () => {
    db.state.tables.event_invites = [invite({ rsvp_closes_at: null })];
    await expect(saveRsvp(EVENT, ANSWER)).rejects.toMatchObject({ code: "CLOSED" });
  });

  it("não aceita acompanhante que não está previsto", async () => {
    await expect(saveRsvp(EVENT, { ...ANSWER, plusOne: true, plusOneName: "Ana Lima" })).rejects.toMatchObject({ code: "PLUS_ONE_NOT_ALLOWED" });
  });
});
