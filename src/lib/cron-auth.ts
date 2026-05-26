/** Valida chamadas de cron (Vercel envia Authorization: Bearer CRON_SECRET). */
export function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const auth = request.headers.get("authorization")?.trim();
  return auth === `Bearer ${secret}`;
}
