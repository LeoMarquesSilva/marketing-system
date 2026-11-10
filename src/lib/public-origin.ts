export const PUBLIC_APP_ORIGIN = "https://orqestrai.com.br";

/** Origem dos links enviados por e-mail: em produção sempre o domínio público, nunca o Host da requisição. */
export function emailLinkOrigin(request: Request): string {
  if (process.env.NODE_ENV !== "production") return new URL(request.url).origin;
  return (process.env.MARKETING_PUBLIC_URL || PUBLIC_APP_ORIGIN).replace(/\/+$/, "");
}
