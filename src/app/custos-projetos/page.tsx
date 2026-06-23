import { Wallet } from "lucide-react";
import { CustosProjetosClient } from "@/components/custos-projetos/custos-projetos-client";

export const dynamic = "force-dynamic";

export default function CustosProjetosPage() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <Wallet className="h-6 w-6" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Custos de Projetos</h2>
        </div>
        <p className="text-muted-foreground max-w-xl">
          Custos mensais e pagamentos por categoria.
        </p>
      </div>
      <CustosProjetosClient />
    </div>
  );
}
