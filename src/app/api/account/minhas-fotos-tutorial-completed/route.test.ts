import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createServerClient = vi.hoisted(() => vi.fn());
const createAdminClient = vi.hoisted(() => vi.fn());

vi.mock("@/utils/supabase/server", () => ({ createClient: createServerClient }));
vi.mock("@supabase/supabase-js", () => ({ createClient: createAdminClient }));

interface RecordedUpdate {
  table?: string;
  values?: Record<string, unknown>;
  filter?: { column: string; value: string };
}

function authenticatedClient(userId: string | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
      }),
    },
  };
}

function adminClient(record: RecordedUpdate, databaseError: string | null = null) {
  return {
    from(table: string) {
      record.table = table;
      return {
        update(values: Record<string, unknown>) {
          record.values = values;
          return {
            async eq(column: string, value: string) {
              record.filter = { column, value };
              return { error: databaseError ? { message: databaseError } : null };
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

describe("POST /api/account/minhas-fotos-tutorial-completed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-only-service-key");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-14T17:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("retorna 401 quando não há usuário autenticado", async () => {
    createServerClient.mockResolvedValue(authenticatedClient(null));
    const POST = await loadPost();

    const response = await POST();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Não autenticado." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("persiste o timestamp somente no perfil ligado ao auth_id autenticado", async () => {
    const record: RecordedUpdate = {};
    createServerClient.mockResolvedValue(authenticatedClient("auth-user-123"));
    createAdminClient.mockReturnValue(adminClient(record));
    const POST = await loadPost();

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      minhas_fotos_tutorial_completed_at: "2026-08-14T17:00:00.000Z",
    });
    expect(record).toEqual({
      table: "users",
      values: {
        minhas_fotos_tutorial_completed_at: "2026-08-14T17:00:00.000Z",
      },
      filter: { column: "auth_id", value: "auth-user-123" },
    });
  });

  it("retorna 500 sem service role configurada", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    createServerClient.mockResolvedValue(authenticatedClient("auth-user-123"));
    const POST = await loadPost();

    const response = await POST();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Service role não configurada.",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("retorna 500 quando o banco rejeita a persistência", async () => {
    const record: RecordedUpdate = {};
    createServerClient.mockResolvedValue(authenticatedClient("auth-user-123"));
    createAdminClient.mockReturnValue(adminClient(record, "Falha ao atualizar perfil."));
    const POST = await loadPost();

    const response = await POST();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Falha ao atualizar perfil.",
    });
  });
});
