/** Segredo para jobs internos server-to-server (worker de notícias, etc.). */
export function getInternalJobSecret(): string | null {
  const cron = process.env.CRON_SECRET?.trim();
  if (cron) return cron;
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? null;
}

export function isAuthorizedInternalJobRequest(request: Request): boolean {
  const secret = getInternalJobSecret();
  if (!secret) return false;

  const auth = request.headers.get("authorization")?.trim();
  return auth === `Bearer ${secret}`;
}

/** Valida chamadas de cron (Vercel envia Authorization: Bearer CRON_SECRET). */
export function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization")?.trim();
    if (auth === `Bearer ${secret}`) return true;
  }

  // Vercel injeta este header em invocações de cron.
  return request.headers.get("x-vercel-cron") === "1";
}
