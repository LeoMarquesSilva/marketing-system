import Link from "next/link";
import { Suspense } from "react";
import { fetchMarketingRequestsForAuth } from "@/lib/marketing-requests-server";
import { fetchUsers, fetchDesigners } from "@/lib/users";
import { MOCK_REQUESTS } from "@/lib/mock-data";
import { RequestsTableWithFilters } from "@/components/solicitacoes/requests-table";
import { Button } from "@/components/ui/button";
import { Columns3 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SolicitacoesPage() {
  const [requests, users, designers] = await Promise.all([
    fetchMarketingRequestsForAuth(),
    fetchUsers(),
    fetchDesigners(),
  ]);

  const displayRequests = requests.length === 0 ? MOCK_REQUESTS : requests;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Solicitações</h2>
          <p className="text-sm text-muted-foreground mt-1">Lista de todas as solicitações de marketing</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/planner">
            <Columns3 className="h-4 w-4 mr-2" />
            Abrir no Planner
          </Link>
        </Button>
      </div>

      <Suspense fallback={null}>
        <RequestsTableWithFilters
          initialRequests={displayRequests}
          users={users}
          designers={designers}
        />
      </Suspense>
    </div>
  );
}
