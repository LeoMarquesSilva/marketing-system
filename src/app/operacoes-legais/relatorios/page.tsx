import { ClipboardList } from "lucide-react";
import { requireOperacoesLegaisAccess, OperacoesLegaisHttpError } from "@/lib/operacoes-legais/server";
import { OperacoesLegaisAcessoNegado } from "@/components/operacoes-legais/acesso-negado";
import { OpsFunctionPage } from "@/components/operacoes-legais/ops-function-page";

export const dynamic = "force-dynamic";

export default async function RelatoriosPage() {
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
      title="Relatórios VIOS"
      description="Dump completo de processos e prazos, sem o corte de 500 linhas."
      icon={ClipboardList}
    >
      <p>
        Pesquisa com Relatório = CSV e limite 9999999, depois o download pelo link{" "}
        <code>download.php</code> (cookie <code>Proc</code>). Encoding latin-1, separador ponto e
        vírgula.
      </p>
      <p>
        Usar para revisão de redistribuição, conferência pós-agendamento e qualquer lista que o
        Completo/DataTables corte em 500 linhas.
      </p>
    </OpsFunctionPage>
  );
}
