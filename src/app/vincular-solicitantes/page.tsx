import { fetchUnlinkedRequests } from "@/lib/marketing-requests";
import { fetchUsers } from "@/lib/users";
import { VincularSolicitantesTable } from "@/components/solicitacoes/vincular-solicitantes-table";

export default async function VincularSolicitantesPage() {
  const [unlinkedRequests, users] = await Promise.all([
    fetchUnlinkedRequests(),
    fetchUsers(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Vincular Solicitantes</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Solicitações sem vínculo com usuário. Selecione o usuário correto para cada uma.
        </p>
      </div>

      <VincularSolicitantesTable
        requests={unlinkedRequests}
        users={users}
      />
    </div>
  );
}
