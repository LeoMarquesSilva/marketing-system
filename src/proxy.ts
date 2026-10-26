import { NextResponse, type NextRequest } from "next/server";
import { loginPathWithReturn } from "@/lib/login-redirect";

const PUBLIC_PATHS = ["/login", "/t", "/nps", "/leituras", "/manuais", "/materiais", "/ficha-cadastral", "/dress-code"];
const PUBLIC_API_PREFIXES = ["/api/evolution/webhook"];

/** Perfil profissional público (não confundir com /perfil = conta autenticada). */
function isPublicProfessionalProfilePath(pathname: string): boolean {
  return /^\/perfil\/[^/]+(?:\/contato)?\/?$/.test(pathname);
}

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  if (isPublicProfessionalProfilePath(pathname)) {
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
    return NextResponse.redirect(
      new URL(loginPathWithReturn(pathname, request.nextUrl.search), request.url)
    );
  }

  return NextResponse.next();
}

// Cada execução do proxy conta como CPU na Vercel: só navegações de página
// passam por aqui. API, arquivos (qualquer caminho com extensão) e prefetches
// dos links ficam de fora; o AuthGuard do cliente segue protegendo as telas.
export const config = {
  matcher: [
    {
      source: "/((?!api/|_next/|.*\\..*).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
