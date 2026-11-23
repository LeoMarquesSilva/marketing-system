import type { SupabaseClient, User } from "@supabase/supabase-js";

/** O que o Orquestra usa dos claims do token (o resto vem da tabela `users`). */
type ClaimsDaSessao = {
  sub?: string;
  aud?: string | string[];
  role?: string;
  email?: string;
  phone?: string;
  is_anonymous?: boolean;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

/**
 * O usuário da sessão montado a partir dos claims do token já verificado. Traz id, e-mail, papel e metadados; não
 * traz datas da conta (`created_at`, `last_sign_in_at`), que o Orquestra só lê pela API de administração.
 */
export function usuarioDosClaims(claims: ClaimsDaSessao): User | null {
  if (!claims.sub) return null;
  return {
    id: claims.sub,
    aud: Array.isArray(claims.aud) ? claims.aud[0] ?? "authenticated" : claims.aud ?? "authenticated",
    role: claims.role,
    email: claims.email,
    phone: claims.phone,
    is_anonymous: claims.is_anonymous,
    app_metadata: claims.app_metadata ?? {},
    user_metadata: claims.user_metadata ?? {},
    created_at: "",
  } as User;
}

/** Por quanto tempo a chave pública do Supabase Auth fica guardada (o mesmo do supabase-js). */
export const CHAVES_VALEM_MS = 10 * 60 * 1000;

type ChavesPublicas = { keys: Record<string, unknown>[] };
type CacheDeChaves = { chaves: ChavesPublicas | null; em: number; buscando: Promise<ChavesPublicas | null> | null };

/**
 * Cache no `globalThis`, compartilhado por todas as cópias deste módulo no processo. O cache do próprio supabase-js
 * fica no módulo dele, que o servidor pode carregar de novo por rota: no `next dev` a chave foi buscada a cada
 * chamada (16 vezes em 16 chamadas, 12/11/2026), o que trocaria uma consulta por outra.
 */
function cacheDeChaves(): CacheDeChaves {
  const global = globalThis as { __orquestraChavesDoAuth?: CacheDeChaves };
  global.__orquestraChavesDoAuth ??= { chaves: null, em: 0, buscando: null };
  return global.__orquestraChavesDoAuth;
}

/** Chave pública do Supabase Auth (JWKS), guardada por `CHAVES_VALEM_MS`; null se não der para buscar. */
export async function chavesPublicas(urlDoSupabase: string, agora = Date.now(), buscar: typeof fetch = fetch): Promise<ChavesPublicas | null> {
  const cache = cacheDeChaves();
  if (cache.chaves && agora - cache.em < CHAVES_VALEM_MS) return cache.chaves;
  cache.buscando ??= (async () => {
    try {
      const resposta = await buscar(`${urlDoSupabase.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json`);
      const corpo = resposta.ok ? ((await resposta.json()) as Partial<ChavesPublicas>) : null;
      const chaves = Array.isArray(corpo?.keys) && corpo.keys.length ? { keys: corpo.keys } : null;
      if (chaves) {
        cache.chaves = chaves;
        cache.em = agora;
      }
      return chaves;
    } catch {
      return null;
    } finally {
      cache.buscando = null;
    }
  })();
  return cache.buscando;
}

/** Só para os testes: esquece a chave guardada. */
export function esquecerChavesPublicas(): void {
  const cache = cacheDeChaves();
  cache.chaves = null;
  cache.em = 0;
  cache.buscando = null;
}

/**
 * Faz o `auth.getUser()` sem argumento (o usuário da sessão, pelo cookie) validar o token localmente.
 *
 * O projeto assina o JWT com chave assimétrica (ES256): o `getClaims` confere a assinatura e a validade com a chave
 * pública, guardada por 10 minutos no processo (`chavesPublicas`). O `getUser` ia ao Supabase Auth em toda rota, e
 * cada consulta ao Supabase custa ~7 ms de CPU na Vercel (~7 mil rotas por dia em 12/11/2026; o plano Hobby
 * estourava). São ~70 arquivos que chamam `ssr.auth.getUser()`: a troca fica aqui, num lugar só.
 *
 * O token vale até 1 hora mesmo depois de sair; quem é desligado continua barrado pela checagem de `users.is_active`
 * das rotas. Token inválido, vencido, sem chave assimétrica ou sem a chave pública: cai no `getUser` original. Com o
 * token como argumento, o `getUser(jwt)` segue igual.
 */
export function comUsuarioPeloToken<T extends Pick<SupabaseClient, "auth">>(cliente: T, urlDoSupabase: string): T {
  const original = cliente.auth.getUser.bind(cliente.auth);
  const getUser = (async (jwt?: string) => {
    if (jwt) return original(jwt);
    try {
      const chaves = await chavesPublicas(urlDoSupabase);
      // Com a chave na mão, o supabase-js não busca o JWKS; sem ela, ele busca (e, sem chave assimétrica, usa o getUser).
      const { data, error } = await cliente.auth.getClaims(undefined, chaves ? { keys: chaves.keys as never } : undefined);
      const usuario = !error && data?.claims ? usuarioDosClaims(data.claims as ClaimsDaSessao) : null;
      if (usuario) return { data: { user: usuario }, error: null };
    } catch {
      // Falha inesperada na verificação local: confere no Supabase Auth, como antes.
    }
    return original();
  }) as typeof cliente.auth.getUser;
  cliente.auth.getUser = getUser;
  return cliente;
}
