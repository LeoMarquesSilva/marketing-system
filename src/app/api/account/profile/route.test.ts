import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuthenticatedUser = vi.hoisted(() => vi.fn());
const createAdminClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-auth", () => ({ requireAuthenticatedUser }));
vi.mock("@supabase/supabase-js", () => ({ createClient: createAdminClient }));

interface UpdateRecord {
  table?: string;
  values?: Record<string, unknown>;
  filter?: { column: string; value: string };
}

function adminClient(record: UpdateRecord) {
  const row = {
    id: "app-user-1",
    name: "Leonardo Marques",
    email: "leo@example.com",
    department: "Marketing",
    avatar_url: "https://cdn.example.com/leo.jpg",
    is_active: true,
  };

  return {
    from(table: string) {
      record.table = table;
      return {
        update(values: Record<string, unknown>) {
          record.values = values;
          return {
            eq(column: string, value: string) {
              record.filter = { column, value };
              return {
                select() {
                  return {
                    async single() {
                      return { data: row, error: null };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

async function loadPatch() {
  vi.resetModules();
  return (await import("./route")).PATCH;
}

describe("PATCH /api/account/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-only-service-key");
  });

  it("retorna 401 quando não há usuário autenticado", async () => {
    requireAuthenticatedUser.mockRejectedValueOnce(new Error("Não autenticado."));
    const PATCH = await loadPatch();

    const response = await PATCH(
      new Request("https://example.com/api/account/profile", {
        method: "PATCH",
        body: JSON.stringify({ name: "Leonardo" }),
      })
    );

    expect(response.status).toBe(401);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rejeita campos que o próprio usuário não pode alterar", async () => {
    requireAuthenticatedUser.mockResolvedValueOnce({ id: "auth-user-1" });
    const PATCH = await loadPatch();

    const response = await PATCH(
      new Request("https://example.com/api/account/profile", {
        method: "PATCH",
        body: JSON.stringify({ name: "Leonardo", role: "admin" }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Campos não permitidos: role.",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("atualiza somente o perfil ligado ao auth_id da sessão", async () => {
    const record: UpdateRecord = {};
    requireAuthenticatedUser.mockResolvedValueOnce({ id: "auth-user-1" });
    createAdminClient.mockReturnValue(adminClient(record));
    const PATCH = await loadPatch();

    const response = await PATCH(
      new Request("https://example.com/api/account/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: "  Leonardo Marques  ",
          email: "  leo@example.com ",
          department: " Marketing ",
          avatar_url: " https://cdn.example.com/leo.jpg ",
        }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      user: { id: "app-user-1", name: "Leonardo Marques" },
    });
    expect(record).toEqual({
      table: "users",
      values: {
        name: "Leonardo Marques",
        email: "leo@example.com",
        department: "Marketing",
        avatar_url: "https://cdn.example.com/leo.jpg",
      },
      filter: { column: "auth_id", value: "auth-user-1" },
    });
  });
});
