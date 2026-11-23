import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CHAVES_VALEM_MS, chavesPublicas, comUsuarioPeloToken, esquecerChavesPublicas, usuarioDosClaims } from "./usuario-da-sessao";

const JWKS = { keys: [{ kid: "4072e935", kty: "EC", alg: "ES256" }] };
const respostaJwks = (corpo: unknown, ok = true) => ({ ok, json: async () => corpo }) as Response;

beforeEach(() => {
  esquecerChavesPublicas();
  // A troca busca a chave pública antes do getClaims: aqui ela vem pronta, sem rede.
  vi.stubGlobal("fetch", vi.fn(async () => respostaJwks(JWKS)));
});

const CLAIMS = {
  sub: "8d1c0f7e-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "pessoa@bismarchipires.com.br",
  app_metadata: { provider: "email" },
  user_metadata: { nome: "Pessoa" },
};

/** Cliente falso: só o que a troca usa (`getUser` e `getClaims`). */
function cliente(claims: () => Promise<unknown>) {
  const getUser = vi.fn(async (jwt?: string) => ({ data: { user: { id: jwt ? "do-jwt" : "do-auth" } }, error: null }));
  const getClaims = vi.fn(claims);
  const fake = { auth: { getUser, getClaims } } as unknown as Pick<SupabaseClient, "auth">;
  return { fake: comUsuarioPeloToken(fake, "https://projeto.supabase.co"), getUser, getClaims };
}

describe("usuário da sessão pelo token (sem ir ao Supabase Auth)", () => {
  it("sem argumento: o usuário vem dos claims verificados, sem chamar o getUser original", async () => {
    const { fake, getUser } = cliente(async () => ({ data: { claims: CLAIMS }, error: null }));
    const { data, error } = await fake.auth.getUser();
    expect(error).toBeNull();
    expect(data.user).toMatchObject({ id: CLAIMS.sub, email: CLAIMS.email, role: "authenticated", user_metadata: { nome: "Pessoa" } });
    expect(getUser).not.toHaveBeenCalled();
  });

  it("com o token como argumento: segue o getUser original", async () => {
    const { fake, getUser } = cliente(async () => ({ data: { claims: CLAIMS }, error: null }));
    const { data } = await fake.auth.getUser("um.jwt.qualquer");
    expect(data.user?.id).toBe("do-jwt");
    expect(getUser).toHaveBeenCalledWith("um.jwt.qualquer");
  });

  it("token inválido, vencido, ausente ou falha na verificação: confere no Supabase Auth, como antes", async () => {
    for (const claims of [
      async () => ({ data: null, error: new Error("Invalid JWT signature") }),
      async () => ({ data: null, error: null }),
      async () => ({ data: { claims: { ...CLAIMS, sub: undefined } }, error: null }),
      async () => {
        throw new Error("crypto indisponível");
      },
    ]) {
      const { fake, getUser } = cliente(claims);
      const { data } = await fake.auth.getUser();
      expect(data.user?.id).toBe("do-auth");
      expect(getUser).toHaveBeenCalledTimes(1);
    }
  });

  it("monta o usuário com o que o token traz", () => {
    expect(usuarioDosClaims({ ...CLAIMS, aud: ["authenticated", "outro"] })).toMatchObject({ id: CLAIMS.sub, aud: "authenticated" });
    expect(usuarioDosClaims({ sub: "x" })).toMatchObject({ id: "x", aud: "authenticated", app_metadata: {}, user_metadata: {} });
    expect(usuarioDosClaims({})).toBeNull();
  });

  it("entrega a chave pública pronta ao getClaims (o supabase-js não busca o JWKS)", async () => {
    const { fake, getClaims } = cliente(async () => ({ data: { claims: CLAIMS }, error: null }));
    await fake.auth.getUser();
    expect(getClaims).toHaveBeenCalledWith(undefined, { keys: JWKS.keys });
  });

  it("sem a chave pública (falha ao buscar): o getClaims busca sozinho", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respostaJwks(null, false)));
    const { fake, getClaims } = cliente(async () => ({ data: { claims: CLAIMS }, error: null }));
    const { data } = await fake.auth.getUser();
    expect(data.user?.id).toBe(CLAIMS.sub);
    expect(getClaims).toHaveBeenCalledWith(undefined, undefined);
  });
});

describe("chave pública guardada no processo", () => {
  it("busca uma vez e reaproveita por 10 minutos, inclusive em chamadas ao mesmo tempo", async () => {
    const buscar = vi.fn(async () => respostaJwks(JWKS));
    const agora = Date.UTC(2026, 10, 12, 18, 0);
    const [a, b] = await Promise.all([chavesPublicas("https://p.supabase.co/", agora, buscar), chavesPublicas("https://p.supabase.co", agora, buscar)]);
    expect(a).toEqual(JWKS);
    expect(b).toEqual(JWKS);
    expect(await chavesPublicas("https://p.supabase.co", agora + CHAVES_VALEM_MS - 1, buscar)).toEqual(JWKS);
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(buscar).toHaveBeenCalledWith("https://p.supabase.co/auth/v1/.well-known/jwks.json");
    await chavesPublicas("https://p.supabase.co", agora + CHAVES_VALEM_MS, buscar);
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  it("falha ou lista vazia não fica guardada: tenta de novo na próxima", async () => {
    const buscar = vi
      .fn()
      .mockRejectedValueOnce(new Error("rede"))
      .mockResolvedValueOnce(respostaJwks({ keys: [] }))
      .mockResolvedValueOnce(respostaJwks(JWKS));
    const agora = Date.UTC(2026, 10, 12, 18, 0);
    expect(await chavesPublicas("https://p.supabase.co", agora, buscar)).toBeNull();
    expect(await chavesPublicas("https://p.supabase.co", agora, buscar)).toBeNull();
    expect(await chavesPublicas("https://p.supabase.co", agora, buscar)).toEqual(JWKS);
  });
});
