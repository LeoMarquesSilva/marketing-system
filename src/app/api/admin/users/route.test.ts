import { beforeEach, describe, expect, it, vi } from "vitest";

const createServerClient = vi.hoisted(() => vi.fn());
const createAdminClient = vi.hoisted(() => vi.fn());

vi.mock("@/utils/supabase/server", () => ({ createClient: createServerClient }));
vi.mock("@supabase/supabase-js", () => ({ createClient: createAdminClient }));

function sessionClient(role: string | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "auth-user" } } }),
    },
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({ data: { role }, error: null }),
              };
            },
          };
        },
      };
    },
  };
}

function adminClient(record: Record<string, unknown>) {
  const row = {
    id: "u-created",
    name: "Nova Pessoa",
    email: null,
    department: "Marketing",
    avatar_url: null,
    is_active: true,
  };
  return {
    from(table: string) {
      record.table = table;
      return {
        insert(values: Record<string, unknown>) {
          record.values = values;
          return {
            select() {
              return { single: async () => ({ data: row, error: null }) };
            },
          };
        },
      };
    },
  };
}

async function loadPost() {
  vi.resetModules();
  return (await import("./route")).POST;
}

describe("POST /api/admin/users create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-only-service-key");
  });

  it("retorna 403 para usuário não administrador", async () => {
    createServerClient.mockResolvedValue(sessionClient("designer"));
    const POST = await loadPost();

    const response = await POST(
      new Request("https://example.com/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ name: "Nova Pessoa", department: "Marketing" }),
      })
    );

    expect(response.status).toBe(403);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("cria usuário com campos normalizados pelo backend", async () => {
    const record: Record<string, unknown> = {};
    createServerClient.mockResolvedValue(sessionClient("admin"));
    createAdminClient.mockReturnValue(adminClient(record));
    const POST = await loadPost();

    const response = await POST(
      new Request("https://example.com/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          name: " Nova Pessoa ",
          email: " ",
          department: " Marketing ",
          avatar_url: null,
        }),
      })
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      user: { id: "u-created", name: "Nova Pessoa" },
    });
    expect(record.table).toBe("users");
    expect(record.values).toMatchObject({
      name: "Nova Pessoa",
      email: null,
      department: "Marketing",
      avatar_url: null,
      is_active: true,
    });
    expect(record.values).toHaveProperty("id");
  });
});
