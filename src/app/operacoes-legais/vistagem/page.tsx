import { CalendarClock } from "lucide-react";
import { requireOperacoesLegaisAccess, OperacoesLegaisHttpError } from "@/lib/operacoes-legais/server";
import { OperacoesLegaisAcessoNegado } from "@/components/operacoes-legais/acesso-negado";
import { OpsFunctionPage } from "@/components/operacoes-legais/ops-function-page";

export const dynamic = "force-dynamic";

export default async function VistagemPage() {
  try {
    await requireOperacoesLegaisAccess();
  } catch (error) {
    if (error instanceof OperacoesLegaisHttpError && error.status === 403) {
      return <OperacoesLegaisAcessoNegado />;
    }
    throw error;
  }
  return (
    <OpsFunctionPage title="Vistagem e agendamento" skill="vios-vistagem-agendamento" icon={CalendarClock}>
      <p>
        Pipeline que substitui Power Apps + SharePoint: captura Kurrier, matching VIOS, vistagem
        (papéis por área e demanda de risco), motor de datas e agendamento vinculado à publicação.
      </p>
      <p>
        O app Next em <code>vistagem-bp</code> entra neste módulo. Regras canônicas ficam na skill
        do agente (FATAL, D-3, conclusão = limite, idempotência).
      </p>
    </OpsFunctionPage>
  );
}
