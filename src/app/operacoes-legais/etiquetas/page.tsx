import { ShieldAlert } from "lucide-react";
import { requireOperacoesLegaisAccess, OperacoesLegaisHttpError } from "@/lib/operacoes-legais/server";
import { OperacoesLegaisAcessoNegado } from "@/components/operacoes-legais/acesso-negado";
import { OpsFunctionPage } from "@/components/operacoes-legais/ops-function-page";

export const dynamic = "force-dynamic";

export default async function EtiquetasPage() {
  try {
    await requireOperacoesLegaisAccess();
  } catch (error) {
    if (error instanceof OperacoesLegaisHttpError && error.status === 403) {
      return <OperacoesLegaisAcessoNegado />;
    }
    throw error;
  }
  return (
    <OpsFunctionPage title="Demanda de risco" skill="vios-etiqueta-demanda-risco" icon={ShieldAlert}>
      <p>
        Etiqueta de pasta <strong>Demanda de risco</strong> (id VIOS 203). Não é prazo nem etapa de
        tarefa. Inclusão aditiva a partir da coluna Demanda de Risco = Sim da base Rec. Crédito.
      </p>
    </OpsFunctionPage>
  );
}
