import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuthenticatedUser = vi.hoisted(() => vi.fn());
const requireAdminUser = vi.hoisted(() => vi.fn());
const createAdminClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-auth", () => ({ requireAuthenticatedUser, requireAdminUser }));
vi.mock("@supabase/supabase-js", () => ({ createClient: createAdminClient }));

function adminClient(record: { value?: boolean }) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return { single: async () => ({ data: { is_active: true }, error: null }) };
            },
          };
        },
        update(values: { is_active: boolean }) {
          record.value = values.is_active;
          return {
            eq() {
              return {
                select() {
                  return {
                    single: async () => ({
                      data: {
                        id: "u1",
                        name: "Pessoa",
                        email: null,
                        department: "Geral",
                        avatar_url: null,
                        is_active: values.is_active,
                      },
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

describe("POST /api/admin/users/[id]/toggle-active", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-only-service-key");
  });

  it("inverte o status no backend administrativo", async () => {
    const record: { value?: boolean } = {};
    requireAuthenticatedUser.mockResolvedValueOnce({ id: "auth-admin" });
    requireAdminUser.mockResolvedValueOnce(undefined);
    createAdminClient.mockReturnValue(adminClient(record));
    vi.resetModules();
    const { POST } = await import("./route");

    const response = await POST(
      new Request("https://example.com/api/admin/users/u1/toggle-active", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "u1" }) }
    );

    expect(response.status).toBe(200);
    expect(record.value).toBe(false);
  });
});
