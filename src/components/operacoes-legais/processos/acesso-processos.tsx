"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { hasOperacoesLegaisAccess } from "@/lib/access-control";

/** Telas de Processos: por enquanto, só quem tem acesso a Operações Legais (admin). As rotas conferem de novo. */
export function AcessoProcessos({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const permitido = Boolean(user) && hasOperacoesLegaisAccess(profile);

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
