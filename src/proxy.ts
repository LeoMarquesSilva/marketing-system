import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/t"];
const PUBLIC_API_PREFIXES = ["/api/evolution/webhook"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  return PUBLIC_API_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

/** Presença do cookie de sessão Supabase (sem chamada de rede). */
function hasSupabaseSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(
    (c) => c.name.startsWith("sb-") && c.name.includes("auth-token")
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthenticated = hasSupabaseSessionCookie(request);

  // Não redirecionar /login → / só pelo cookie: sessão expirada deixa cookie
  // órfão e gera loop infinito (cliente manda p/ login, proxy devolve p/ /).

  if (!isAuthenticated && !isPublicPath(pathname) && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
