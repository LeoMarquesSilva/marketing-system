"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { VISTAGEM_JURIDICO_PATH, canSeeVistagemPath, hasVistagemAccess } from "@/lib/access-control";

/**
 * Mostra as telas da Vistagem só para quem tem o painel liberado; o jurídico só abre a
 * aba Jurídico. Os dados são protegidos de novo nas rotas.
 */
export function AcessoOperacoesLegais({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const permitido = Boolean(user) && canSeeVistagemPath(profile, pathname);
  // Jurídico numa aba da controladoria vai para a própria aba.
  const destino = Boolean(user) && hasVistagemAccess(profile) ? VISTAGEM_JURIDICO_PATH : "/";

  useEffect(() => {
    if (!loading && !permitido) router.replace(destino);
  }, [loading, permitido, destino, router]);

  if (loading || !permitido) {
    return (
      <div className="flex min-h-[48vh] items-center justify-center">
        <LoaderCircle className="size-6 animate-spin text-muted-foreground" aria-label="Carregando" />
      </div>
    );
  }
  return <>{children}</>;
}
