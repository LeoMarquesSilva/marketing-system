import type { ReactNode } from "react";
import { OperacoesLegaisAcessoNegado } from "@/components/operacoes-legais/acesso-negado";
import { OperacoesLegaisHttpError, requireOperacoesLegaisAccess } from "@/lib/operacoes-legais/server";

export const dynamic = "force-dynamic";

export default async function VistagemLayout({ children }: { children: ReactNode }) {
  try {
    await requireOperacoesLegaisAccess();
  } catch (error) {
    if (error instanceof OperacoesLegaisHttpError && (error.status === 403 || error.status === 401)) {
      return <OperacoesLegaisAcessoNegado />;
    }
    throw error;
  }
  return children;
}
