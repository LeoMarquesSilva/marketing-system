import { RoteirosClient } from "@/components/conteudo/roteiros-client";
import { fetchActiveUsers } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function RoteirosPage() {
  const users = await fetchActiveUsers();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Conteúdo para Posts
        </h2>
        <p className="text-muted-foreground mt-1">
          Notícias convertidas em conteúdo de post em formato carrossel para advogados revisarem
        </p>
      </div>
      <RoteirosClient users={users} />
    </div>
  );
}
