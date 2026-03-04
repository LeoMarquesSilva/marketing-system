import { fetchViosTaskEtiquetas, fetchViosTaskAreas } from "@/lib/vios-tasks";
import { fetchUsers, fetchDesigners } from "@/lib/users";
import { ViosTarefasTable } from "@/components/vios/vios-tarefas-table";

export default async function ViosTarefasPage() {
  const [etiquetas, areas, users, designers] = await Promise.all([
    fetchViosTaskEtiquetas(),
    fetchViosTaskAreas(),
    fetchUsers(),
    fetchDesigners(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Tarefas VIOS
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tarefas de material de marketing (REELS/POST/ARTIGO) lançadas no VIOS para os advogados.
          Eles não têm acesso ao sistema e enviam textos/roteiros por e-mail. Ajuste aqui os nomes dos responsáveis e vincule ao usuário do sistema quando necessário.
        </p>
      </div>

      <ViosTarefasTable etiquetas={etiquetas} areas={areas} users={users} designers={designers} />
    </div>
  );
}
