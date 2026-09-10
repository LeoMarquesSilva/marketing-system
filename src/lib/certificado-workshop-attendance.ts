import "server-only";

// A lista de presença dos workshops de certificado é sincronizada por uma
// Edge Function que já roda no projeto do Responsum ("ticket-bp"), lendo o
// SharePoint via Microsoft Graph e gravando o resultado de volta na própria
// `description` do card (bloco "Presença:"). Este módulo só dispara essa
// function para um ticket específico, sob demanda, pelo botão do modal.
//
// A function autentica o chamador comparando o header Authorization com o
// SUPABASE_ANON_KEY do PRÓPRIO projeto ticket-bp (ver isAuthorized no
// index.ts dela). Esse projeto já migrou para o novo sistema de chaves do
// Supabase, então o valor atual desse env var é a chave "publishable"
// (sb_publishable_...), não mais o JWT legado de "anon" — por isso buscamos
// especificamente a chave do tipo "publishable" via API de management.
const RESPONSUM_PROJECT_REF = "jhgbrbarfpvgdaaznldj";
const PRESENCA_FUNCTION_URL = `https://${RESPONSUM_PROJECT_REF}.supabase.co/functions/v1/orquestrai-certificados-presenca`;

interface SupabaseApiKeyRecord {
  name?: string;
  type?: string;
  api_key?: string;
  key?: string;
}

function selectPublishableKey(records: unknown): string | null {
  if (!Array.isArray(records)) return null;
  for (const candidate of records as SupabaseApiKeyRecord[]) {
    if (candidate.type !== "publishable") continue;
    const value = typeof candidate.api_key === "string" ? candidate.api_key : candidate.key;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

let cachedAuthKey: Promise<string> | null = null;

async function getResponsumFunctionAuthKey(): Promise<string> {
  const fromEnv = process.env.RESPONSUM_PRESENCA_FUNCTION_KEY?.trim();
  if (fromEnv) return fromEnv;
  if (cachedAuthKey) return cachedAuthKey;

  cachedAuthKey = (async () => {
    const managementToken = process.env.SUPABASE_MANAGEMENT_ACCESS_TOKEN?.trim();
    if (!managementToken) {
      throw new Error("A integração com o RESPONSUM ainda não está configurada.");
    }
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${RESPONSUM_PROJECT_REF}/api-keys`,
      { headers: { Authorization: `Bearer ${managementToken}` }, cache: "no-store" }
    );
    if (!response.ok) {
      throw new Error("Não foi possível autorizar a integração com o RESPONSUM.");
    }
    const key = selectPublishableKey(await response.json());
    if (!key) {
      throw new Error("A chave de autenticação do RESPONSUM não foi encontrada.");
    }
    return key;
  })().catch((error) => {
    cachedAuthKey = null;
    throw error;
  });
  return cachedAuthKey;
}

export interface TriggerPresencaResult {
  ok: boolean;
  processed: number;
  skipped: number;
  failed: number;
  details?: Array<{ id: string; status: string; names?: number }>;
}

/** Dispara a sincronização de presença do SharePoint para um ticket específico. */
export async function triggerPresencaSyncForTicket(ticketId: string): Promise<TriggerPresencaResult> {
  const authKey = await getResponsumFunctionAuthKey();
  const response = await fetch(PRESENCA_FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authKey}`,
    },
    body: JSON.stringify({ ticketId }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (body as { error?: string } | null)?.error ?? "Falha ao consultar a presença no SharePoint.";
    throw new Error(message);
  }
  return body as TriggerPresencaResult;
}
