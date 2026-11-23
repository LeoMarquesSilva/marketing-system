/**
 * Chamadas REST ao Resend usadas pelo envio por Broadcasts (Marketing).
 * O limite da API é 10 chamadas por segundo por conta: o helper espera e tenta de novo no 429.
 * Server-only (usa RESEND_API_KEY).
 */

const RESEND_API = "https://api.resend.com";
const MAX_ATTEMPTS = 5;

export class ResendApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null
  ) {
    super(message);
    this.name = "ResendApiError";
  }
}

function apiKey(): string {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) throw new Error("RESEND_API_KEY não configurada.");
  return key;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function resendApi<T = Record<string, unknown>>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${RESEND_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });

    if (res.status === 429 && attempt < MAX_ATTEMPTS) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 400 * attempt);
      continue;
    }

    const text = await res.text();
    const json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    if (!res.ok) {
      const message = typeof json.message === "string" ? json.message : `Resend respondeu ${res.status}.`;
      throw new ResendApiError(message, res.status, typeof json.name === "string" ? json.name : null);
    }
    return json as T;
  }
}

/** Executa tarefas com no máximo `limit` em paralelo (o 429 do Resend é absorvido no helper). */
export async function runPool<T>(items: T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++];
      await task(item);
    }
  });
  await Promise.all(workers);
}

// --- Domínio ---

export interface ResendDomainRecord {
  record: string;
  name: string;
  type: string;
  value: string;
  priority?: number;
  status: string;
  ttl?: string;
}

export interface ResendDomainDetail {
  id: string;
  name: string;
  status: string;
  region: string;
  open_tracking: boolean;
  click_tracking: boolean;
  tracking_subdomain?: string | null;
  records: ResendDomainRecord[];
}

export async function listResendDomainsDetailed(): Promise<ResendDomainDetail[]> {
  const list = await resendApi<{ data: { id: string }[] }>("GET", "/domains");
  return Promise.all(list.data.map((d) => resendApi<ResendDomainDetail>("GET", `/domains/${d.id}`)));
}

export async function verifyResendDomain(domainId: string): Promise<void> {
  await resendApi("POST", `/domains/${domainId}/verify`);
}

export async function listResendWebhooks(): Promise<{ id: string; endpoint: string; status: string; events: string[] }[]> {
  const list = await resendApi<{ data: { id: string; endpoint: string; status: string; events: string[] }[] }>(
    "GET",
    "/webhooks"
  );
  return list.data;
}
