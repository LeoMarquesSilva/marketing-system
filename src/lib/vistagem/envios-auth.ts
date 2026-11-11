import { createHmac, timingSafeEqual } from "node:crypto";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

/**
 * Chave da rota /api/cron/vistagem-envios para o pg_cron do SAMA. É derivada (HMAC) da service role do Orquestra, que
 * a Vercel deixa ler, ao contrário do CRON_SECRET (variável "Sensitive"): não exige variável nova. Quem tiver a chave
 * derivada só consegue chamar esta rota; ela não revela a service role. Se a service role mudar, a chave muda junto e
 * o SAMA passa a receber 401 (net._http_response) até trocar o segredo `orquestra_cron_secret` no vault.
 */
export function chaveDosEnvios(serviceRole: string | undefined = process.env.SUPABASE_SERVICE_ROLE_KEY): string | null {
  const segredo = serviceRole?.trim();
  if (!segredo) return null;
  return createHmac("sha256", segredo).update("orquestra:vistagem-envios:v1").digest("hex");
}

/** Aceita o cron da Vercel (CRON_SECRET) ou o pg_cron do SAMA (chave derivada). */
export function autorizadoNosEnvios(request: Request): boolean {
  if (isAuthorizedCronRequest(request)) return true;
  const chave = chaveDosEnvios();
  if (!chave) return false;
  const recebido = Buffer.from(request.headers.get("authorization")?.trim() ?? "");
  const esperado = Buffer.from(`Bearer ${chave}`);
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}
