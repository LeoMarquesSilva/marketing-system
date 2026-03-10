"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";

const PUBLIC_PATHS = ["/login"];

/** Rotas que o servidor já protege (redirect se não autenticado/admin). Não redirecionar para /login no cliente para evitar loop: servidor retorna 200 com sessão em cookie, cliente pode ainda não ter user na hidratação. */
const SERVER_PROTECTED_PATHS = ["/admin"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isServerProtected = SERVER_PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  useEffect(() => {
    if (loading) return;
    // Nunca redirecionar para fora de /admin no cliente; o servidor já protege essa rota.
    if (pathname === "/admin" || pathname.startsWith("/admin/")) return;
    if (!user && !isPublic) {
      router.replace("/login");
    } else if (user && pathname === "/login") {
      router.replace("/");
    }
  }, [user, loading, pathname, router, isPublic]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!user && !isPublic && !isServerProtected) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Redirecionando...</div>
      </div>
    );
  }

  return <>{children}</>;
}
