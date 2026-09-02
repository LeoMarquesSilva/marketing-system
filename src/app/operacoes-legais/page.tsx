import { requireOperacoesLegaisAccess, OperacoesLegaisHttpError } from "@/lib/operacoes-legais/server";
import { OperacoesLegaisAcessoNegado } from "@/components/operacoes-legais/acesso-negado";
import { OpsLegaisHub } from "@/components/operacoes-legais/ops-hub";

export const dynamic = "force-dynamic";

export default async function OperacoesLegaisPage() {
  try {
    await requireOperacoesLegaisAccess();
  } catch (error) {
    if (error instanceof OperacoesLegaisHttpError && error.status === 403) {
      return <OperacoesLegaisAcessoNegado />;
    }
    throw error;
  }
  return <OpsLegaisHub />;
}
