"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { isContentCollaborator } from "@/lib/content-areas";
import { resolveAllowedSections, canAccessPath, firstAllowedPath } from "@/lib/access-control";

const PUBLIC_PATHS = ["/login"];

/** Rotas acessíveis por colaboradores de conteúdo (advogados por área). */
const COLLABORATOR_PATHS = ["/conteudo", "/perfil"];

/** Rotas que o servidor já protege (redirect se não autenticado/admin). */
const SERVER_PROTECTED_PATHS = ["/admin"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isServerProtected = SERVER_PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  const isCollaboratorRoute = COLLABORATOR_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  useEffect(() => {
    if (loading) return;

    if (!user && !isPublic) {
      router.replace("/login");
      return;
    }

    // Troca de senha obrigatória (primeiro acesso).
    if (
      user &&
      profile?.must_change_password &&
      pathname !== "/alterar-senha" &&
      !isPublic
    ) {
      router.replace("/alterar-senha");
      return;
    }

    if (pathname === "/admin" || pathname.startsWith("/admin/")) return;

    if (user && pathname === "/login") {
      router.replace(
        profile ? firstAllowedPath(profile) : isContentCollaborator(profile) ? "/conteudo/roteiros" : "/"
      );
      return;
    }

    // Permissões explícitas definidas pelo admin.
    const allowed = resolveAllowedSections(profile);
    if (user && profile && allowed && !isPublic && pathname !== "/alterar-senha") {
      if (!canAccessPath(profile, pathname)) {
        router.replace(firstAllowedPath(profile));
      }
      return;
    }

    // Comportamento legado (colaborador de conteúdo).
    if (user && profile && isContentCollaborator(profile) && !isPublic && !isCollaboratorRoute) {
      router.replace("/conteudo/roteiros");
    }
  }, [user, profile, loading, pathname, router, isPublic, isCollaboratorRoute]);

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
