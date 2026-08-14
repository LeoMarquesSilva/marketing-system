import { MinhasFotosClient } from "@/components/collaborator-photos/minhas-fotos-client";

export const dynamic = "force-dynamic";

export default function MinhasFotosPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1a6b72]">
          Sessão corporativa
        </p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground">Minhas fotos</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Escolha quais fotos o marketing pode usar. A oficial atualiza seu avatar e o perfil NFC na
          hora.
        </p>
      </div>
      <MinhasFotosClient />
    </div>
  );
}
