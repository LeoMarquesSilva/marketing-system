"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { canSeeProcessosPath } from "@/lib/access-control";

/**
 * Telas de Processos e Pessoas: admin ou liberação de Processos em Usuários; a liberação só da Carteira
 * Trabalhista abre a carteira, os acordos e a ficha (as rotas conferem de novo se o processo é trabalhista).
 */
export function AcessoProcessos({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const permitido = Boolean(user) && canSeeProcessosPath(profile, pathname);

  useEffect(() => {
    if (!loading && !permitido) router.replace("/");
  }, [loading, permitido, router]);

  if (loading || !permitido) {
    return (
      <div className="flex min-h-[48vh] items-center justify-center">
        <LoaderCircle className="size-6 animate-spin text-muted-foreground" aria-label="Carregando" />
      </div>
    );
  }
  return <>{children}</>;
}
