/** Destino interno seguro para `?next=`. Rejeita URL absoluta, protocol-relative e /login. */
export function sanitizeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  const trimmed = next.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  const pathOnly = trimmed.split("?")[0] ?? "";
  if (pathOnly === "/login" || pathOnly.startsWith("/login/")) return null;
  return trimmed;
}

/** Login com retorno para a página que a pessoa tentou abrir. */
export function loginPathWithReturn(pathname: string, search = ""): string {
  if (pathname === "/login" || pathname.startsWith("/login/")) return "/login";
  const safe = sanitizeNextPath(`${pathname}${search}`);
  return safe ? `/login?next=${encodeURIComponent(safe)}` : "/login";
}

/** `?next=` da URL atual, com fallback para o hook do App Router. */
export function resolveRequestedNext(searchParamsNext?: string | null): string | null {
  const fromParams = sanitizeNextPath(searchParamsNext);
  if (fromParams) return fromParams;
  if (typeof window === "undefined") return null;
  return sanitizeNextPath(new URLSearchParams(window.location.search).get("next"));
}
