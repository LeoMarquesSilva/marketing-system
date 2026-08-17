import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuthenticatedUser = vi.hoisted(() => vi.fn());
const requireAdminUser = vi.hoisted(() => vi.fn());
const createAdminClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-auth", () => ({ requireAuthenticatedUser, requireAdminUser }));
vi.mock("@supabase/supabase-js", () => ({ createClient: createAdminClient }));

interface MutationRecord {
  operation?: "update" | "delete";
  values?: Record<string, unknown>;
  id?: string;
}

function adminClient(record: MutationRecord) {
  const row = {
    id: "u1",
    name: "Valentina",
    email: "valentina@example.com",
    department: "Marketing",
    avatar_url: null,
    photo_onedrive_url: null,
    photo_collected: false,
    photo_collected_at: null,
    is_active: true,
  };

  return {
    from() {
      return {
        update(values: Record<string, unknown>) {
          record.operation = "update";
          record.values = values;
          return {
            eq(_column: string, id: string) {
              record.id = id;
              return {
                select() {
                  return { single: async () => ({ data: row, error: null }) };
                },
              };
            },
          };
        },
        delete() {
          record.operation = "delete";
          return {
            async eq(_column: string, id: string) {
              record.id = id;
              return { error: null };
            },
          };
        },
      };
    },
  };
}

async function loadRoute() {
  vi.resetModules();
  return import("./route");
}

const context = { params: Promise.resolve({ id: "u1" }) };

describe("/api/admin/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-only-service-key");
  });

  it("retorna 401 sem sessão", async () => {
    requireAuthenticatedUser.mockRejectedValueOnce(new Error("Não autenticado."));
    const { PATCH } = await loadRoute();

    const response = await PATCH(
      new Request("https://example.com/api/admin/users/u1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Valentina" }),
      }),
      context
    );

    expect(response.status).toBe(401);
    expect(requireAdminUser).not.toHaveBeenCalled();
  });

  it("retorna 403 para usuário que não é administrador", async () => {
    requireAuthenticatedUser.mockResolvedValueOnce({ id: "auth-1" });
    requireAdminUser.mockRejectedValueOnce(
      new Error("Apenas administradores podem executar esta ação.")
    );
    const { DELETE } = await loadRoute();

    const response = await DELETE(
      new Request("https://example.com/api/admin/users/u1", { method: "DELETE" }),
      context
    );

    expect(response.status).toBe(403);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("atualiza somente campos administrativos permitidos", async () => {
    const record: MutationRecord = {};
    requireAuthenticatedUser.mockResolvedValueOnce({ id: "auth-admin" });
    requireAdminUser.mockResolvedValueOnce(undefined);
    createAdminClient.mockReturnValue(adminClient(record));
    const { PATCH } = await loadRoute();

    const response = await PATCH(
      new Request("https://example.com/api/admin/users/u1", {
        method: "PATCH",
        body: JSON.stringify({ name: " Valentina ", is_active: false }),
      }),
      context
    );

    expect(response.status).toBe(200);
    expect(record).toEqual({
      operation: "update",
      values: { name: "Valentina", is_active: false },
      id: "u1",
    });
  });

  it("exclui o usuário pelo backend administrativo", async () => {
    const record: MutationRecord = {};
    requireAuthenticatedUser.mockResolvedValueOnce({ id: "auth-admin" });
    requireAdminUser.mockResolvedValueOnce(undefined);
    createAdminClient.mockReturnValue(adminClient(record));
    const { DELETE } = await loadRoute();

    const response = await DELETE(
      new Request("https://example.com/api/admin/users/u1", { method: "DELETE" }),
      context
    );

    expect(response.status).toBe(200);
    expect(record).toEqual({ operation: "delete", id: "u1" });
  });
});
