"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { hasVistagemAccess } from "@/lib/access-control";

/** Mostra as telas da Vistagem só para quem tem o painel liberado; os dados são protegidos de novo nas rotas. */
export function AcessoOperacoesLegais({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const permitido = Boolean(user) && hasVistagemAccess(profile);

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
