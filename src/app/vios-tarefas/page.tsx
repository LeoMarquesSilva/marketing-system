import { fetchViosTaskEtiquetas, fetchViosTaskAreas } from "@/lib/vios-tasks";
import { fetchActiveUsers, fetchDesigners } from "@/lib/users";
import { ViosTarefasTable } from "@/components/vios/vios-tarefas-table";

export default async function ViosTarefasPage() {
  const [etiquetas, areas, users, designers] = await Promise.all([
    fetchViosTaskEtiquetas(),
    fetchViosTaskAreas(),
    fetchActiveUsers(),
    fetchDesigners(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Tarefas VIOS
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Fluxo: <strong>PROTOCOLO</strong> = prazo do colaborador entregar · <strong>REVISAR</strong> = gestor revisa · envie ao Planner quando REVISAR estiver concluída.
          <strong>PROVIDÊNCIA</strong> = ciência de agendamento (registros antigos).
        </p>
      </div>

      <ViosTarefasTable etiquetas={etiquetas} areas={areas} users={users} designers={designers} />
    </div>
  );
}
