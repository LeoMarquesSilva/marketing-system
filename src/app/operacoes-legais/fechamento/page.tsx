import { Wallet } from "lucide-react";
import { requireOperacoesLegaisAccess, OperacoesLegaisHttpError } from "@/lib/operacoes-legais/server";
import { OperacoesLegaisAcessoNegado } from "@/components/operacoes-legais/acesso-negado";
import { OpsFunctionPage } from "@/components/operacoes-legais/ops-function-page";

export const dynamic = "force-dynamic";

export default async function FechamentoPage() {
  try {
    await requireOperacoesLegaisAccess();
  } catch (error) {
    if (error instanceof OperacoesLegaisHttpError && error.status === 403) {
      return <OperacoesLegaisAcessoNegado />;
    }
    throw error;
  }
  return (
    <OpsFunctionPage
      title="Fechamento Legal Ops"
      description="Rateio das horas da equipe Ops para as áreas jurídicas."
      icon={Wallet}
    >
      <p>
        Rateio das horas da equipe Ops para as áreas jurídicas. Intimação tácita não entra. No
        arquivo final não resta hora em Operações Legais.
      </p>
      <p>
        Áreas seguem o de-para SIOE/Orquestra (Insolvência e Cível | Insolvência → Reestruturação).
        Tipo ou área que o agente não souber interpretar: perguntar, não chutar. Equipe Ops lida
        de <code>colaboradores</code> no mês, sem lista fixa de nomes.
      </p>
    </OpsFunctionPage>
  );
}
