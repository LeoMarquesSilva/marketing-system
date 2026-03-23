import { AdminGate } from "@/components/conteudo/admin-gate";
import { ConteudoTemasClient } from "@/components/conteudo/conteudo-temas-client";

export const dynamic = "force-dynamic";

export default function ConteudoTemasPage() {
  return (
    <AdminGate>
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Temas RSS
        </h2>
        <p className="text-muted-foreground mt-1">
          Configure os temas de notícias para gerar conteúdo de post em formato carrossel
        </p>
      </div>
      <ConteudoTemasClient />
    </div>
    </AdminGate>
  );
}
