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

  // Decide de forma síncrona para onde (se for o caso) o usuário deve ir.
  const redirectTo = (() => {
    if (loading) return null;
    if (!user && !isPublic) return "/login";
    if (!user) return null;

    // Rotas protegidas pelo servidor (admin): não interferir aqui.
    if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;

    // Troca de senha obrigatória (primeiro acesso).
    if (profile?.must_change_password && pathname !== "/alterar-senha" && !isPublic) {
      return "/alterar-senha";
    }

    if (pathname === "/login") {
      return profile ? firstAllowedPath(profile) : "/";
    }

    if (pathname === "/alterar-senha") return null;

    // Permissões explícitas definidas pelo admin.
    const allowed = resolveAllowedSections(profile);
    if (profile && allowed && !isPublic) {
      return canAccessPath(profile, pathname) ? null : firstAllowedPath(profile);
    }

    // Comportamento legado (colaborador de conteúdo).
    if (profile && isContentCollaborator(profile) && !isPublic && !isCollaboratorRoute) {
      return "/conteudo/roteiros";
    }
    return null;
  })();

  useEffect(() => {
    if (redirectTo && redirectTo !== pathname) {
      router.replace(redirectTo);
    }
  }, [redirectTo, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  // Aguardando o perfil carregar para decidir permissões (evita exibir conteúdo indevido).
  const waitingProfile = !!user && !profile && !isPublic && !isServerProtected;

  if ((redirectTo && redirectTo !== pathname) || waitingProfile || (!user && !isPublic && !isServerProtected)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Redirecionando...</div>
      </div>
    );
  }

  return <>{children}</>;
}
