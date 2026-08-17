import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuthenticatedUser = vi.hoisted(() => vi.fn());
const requireAdminUser = vi.hoisted(() => vi.fn());
const createAdminClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-auth", () => ({ requireAuthenticatedUser, requireAdminUser }));
vi.mock("@supabase/supabase-js", () => ({ createClient: createAdminClient }));

interface UpdateRecord {
  values?: Record<string, unknown>;
  slug?: string;
}

function adminClient(record: UpdateRecord) {
  return {
    from() {
      return {
        update(values: Record<string, unknown>) {
          record.values = values;
          return {
            eq(_column: string, slug: string) {
              record.slug = slug;
              return {
                select() {
                  return {
                    single: async () => ({
                      data: { id: "consumer-1", slug, name: "Responsum" },
                      error: null,
                    }),
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

describe("POST rotate official photo consumer key", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-only-service-key");
  });

  it("gera a chave uma vez e persiste somente hash e prefixo", async () => {
    const record: UpdateRecord = {};
    requireAuthenticatedUser.mockResolvedValueOnce({ id: "auth-admin" });
    requireAdminUser.mockResolvedValueOnce(undefined);
    createAdminClient.mockReturnValue(adminClient(record));
    vi.resetModules();
    const { POST } = await import("./route");

    const response = await POST(
      new Request("https://example.com/api/admin/official-photo-consumers/responsum/rotate-key", {
        method: "POST",
      }),
      { params: Promise.resolve({ slug: "responsum" }) }
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.apiKey).toMatch(/^ofp_responsum_[A-Za-z0-9_-]{43}$/);
    expect(record.slug).toBe("responsum");
    expect(record.values).toMatchObject({
      key_prefix: payload.apiKey.slice(0, 16),
      key_hash: createHash("sha256").update(payload.apiKey).digest("hex"),
    });
    expect(JSON.stringify(record.values)).not.toContain(payload.apiKey);
  });

  it("retorna 403 sem permissão administrativa", async () => {
    requireAuthenticatedUser.mockResolvedValueOnce({ id: "auth-user" });
    requireAdminUser.mockRejectedValueOnce(
      new Error("Apenas administradores podem executar esta ação.")
    );
    vi.resetModules();
    const { POST } = await import("./route");

    const response = await POST(
      new Request("https://example.com/api/admin/official-photo-consumers/sioe/rotate-key", {
        method: "POST",
      }),
      { params: Promise.resolve({ slug: "sioe" }) }
    );

    expect(response.status).toBe(403);
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});
