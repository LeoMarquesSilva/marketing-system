/**
 * API interna do dashboard Supabase (/platform/...).
 * O PAT (Management API) não funciona aqui — use SUPABASE_BILLING_SESSION_TOKEN
 * (JWT da sessão do dashboard, copiado do DevTools ao navegar no billing).
 */

const PLATFORM_BASE = "https://api.supabase.com";

interface PlatformError {
  message?: string;
}

export function getBillingSessionToken(): string | null {
  return process.env.SUPABASE_BILLING_SESSION_TOKEN?.trim() || null;
}

export function hasDedicatedBillingSessionToken(): boolean {
  return Boolean(process.env.SUPABASE_BILLING_SESSION_TOKEN?.trim());
}

export async function platformFetch<T>(
  path: string,
  searchParams?: Record<string, string>
): Promise<{ data: T | null; status: number; error?: string }> {
  const token = getBillingSessionToken();
  if (!token) {
    return { data: null, status: 503, error: "Token não configurado." };
  }

  const url = new URL(`${PLATFORM_BASE}${path}`);
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (v) url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      Version: "2",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `Erro ${res.status}`;
    try {
      const body = (await res.json()) as PlatformError;
      if (body.message) message = body.message;
    } catch {
      // ignore
    }
    return { data: null, status: res.status, error: message };
  }

  return { data: (await res.json()) as T, status: res.status };
}
