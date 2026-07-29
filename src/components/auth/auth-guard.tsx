"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { isContentCollaborator } from "@/lib/content-areas";
import { resolveAllowedSections, canAccessPath } from "@/lib/access-control";
import { resolvePostLoginPathFromProfile } from "@/lib/post-login-path";

const PUBLIC_PATHS = ["/login", "/t"];

/** Perfil profissional público NFC: /perfil/<slug> e /perfil/<slug>/contato. */
function isPublicProfessionalProfilePath(pathname: string): boolean {
  return /^\/perfil\/[^/]+(?:\/contato)?\/?$/.test(pathname);
}

/** Rotas acessíveis por colaboradores de conteúdo (advogados por área). */
const COLLABORATOR_PATHS = ["/conteudo", "/perfil"];

/** Rotas que o servidor já protege (redirect se não autenticado/admin). */
const SERVER_PROTECTED_PATHS = ["/admin"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublic =
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    isPublicProfessionalProfilePath(pathname);
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

    // Troca de senha obrigatória (primeiro acesso) — inclusive saindo de /login.
    if (profile?.must_change_password && pathname !== "/alterar-senha") {
      return "/alterar-senha";
    }

    if (pathname === "/login") {
      return profile ? resolvePostLoginPathFromProfile(profile) : null;
    }

    // Já trocou a senha: não deixa ficar em /alterar-senha (evita loop / reenvio).
    if (pathname === "/alterar-senha") {
      if (profile && !profile.must_change_password) {
        return resolvePostLoginPathFromProfile(profile);
      }
      return null;
    }

    // Permissões explícitas definidas pelo admin.
    const allowed = resolveAllowedSections(profile);
    if (profile && allowed && !isPublic) {
      return canAccessPath(profile, pathname) ? null : resolvePostLoginPathFromProfile(profile);
    }

    // Comportamento legado (colaborador de conteúdo).
    if (profile && isContentCollaborator(profile) && !isPublic && !isCollaboratorRoute) {
      return "/conteudo/inicio";
    }

    // Fotos colaboradores: só usuários autorizados (mesmo no modo legado).
    if (
      profile &&
      !isPublic &&
      (pathname === "/fotos-colaboradores" || pathname.startsWith("/fotos-colaboradores/")) &&
      !canAccessPath(profile, pathname)
    ) {
      return resolvePostLoginPathFromProfile(profile);
    }

    return null;
  })();

  useEffect(() => {
    if (!redirectTo || redirectTo === pathname) return;
    router.replace(redirectTo);
    // Fallback: router.replace pode falhar após login (App Router); reload resolve.
    // Não usa assign se pathname já mudou (evita reload em ping-pong de tours/guards).
    const fallback = window.setTimeout(() => {
      if (window.location.pathname === pathname) {
        window.location.replace(redirectTo);
      }
    }, 1500);
    return () => window.clearTimeout(fallback);
  }, [redirectTo, pathname, router]);

  // Fallback: se o perfil demorar demais, não trava a tela para sempre.
  const [timedOutUserId, setTimedOutUserId] = useState<string | null>(null);
  const profileTimedOut = Boolean(user && timedOutUserId === user.id);

  useEffect(() => {
    if (!(user && !profile && !loading)) return;
    const t = setTimeout(() => setTimedOutUserId(user.id), 4000);
    return () => clearTimeout(t);
  }, [user, profile, loading]);

  if (loading && !isPublic) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  // Aguarda o perfil carregar para decidir permissões (evita exibir conteúdo
  // indevido) — exceto na tela de troca de senha, que deve sempre renderizar.
  const waitingLoginProfile =
    pathname === "/login" && !!user && !profile && !profileTimedOut;

  const waitingProfile =
    !!user &&
    !profile &&
    !isPublic &&
    !isServerProtected &&
    pathname !== "/alterar-senha" &&
    !profileTimedOut;

  if (
    (redirectTo && redirectTo !== pathname) ||
    waitingProfile ||
    waitingLoginProfile ||
    (!user && !isPublic && !isServerProtected)
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Redirecionando...</div>
      </div>
    );
  }

  return <>{children}</>;
}
