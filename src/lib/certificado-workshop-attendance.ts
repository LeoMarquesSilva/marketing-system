import "server-only";

import { selectResponsumServiceKey } from "@/lib/cafe-cultura/responsum-domain";

// A lista de presença dos workshops de certificado é sincronizada por uma
// Edge Function que já roda no projeto do Responsum ("ticket-bp"), lendo o
// SharePoint via Microsoft Graph e gravando o resultado de volta na própria
// `description` do card (bloco "Presença:"). Este módulo só dispara essa
// function para um ticket específico, sob demanda, pelo botão do modal.
const RESPONSUM_PROJECT_REF = "jhgbrbarfpvgdaaznldj";
const PRESENCA_FUNCTION_URL = `https://${RESPONSUM_PROJECT_REF}.supabase.co/functions/v1/orquestrai-certificados-presenca`;

let cachedServiceKey: Promise<string> | null = null;

async function getResponsumServiceRoleKey(): Promise<string> {
  const fromEnv = process.env.RESPONSUM_SUPABASE_SERVICE_KEY?.trim();
  if (fromEnv) return fromEnv;
  if (cachedServiceKey) return cachedServiceKey;

  cachedServiceKey = (async () => {
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
    const serviceKey = selectResponsumServiceKey(await response.json());
    if (!serviceKey) {
      throw new Error("A chave de serviço do RESPONSUM não foi encontrada.");
    }
    return serviceKey;
  })().catch((error) => {
    cachedServiceKey = null;
    throw error;
  });
  return cachedServiceKey;
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
  const serviceKey = await getResponsumServiceRoleKey();
  const response = await fetch(PRESENCA_FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
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
