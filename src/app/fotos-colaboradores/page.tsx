import { fetchUsersServer } from "@/lib/users-server";
import { CollaboratorPhotosGrid } from "@/components/usuarios/collaborator-photos-grid";
import { PhotoUsageTypesPanel } from "@/components/collaborator-photos/usage-types-panel";
import { StorageUsageBar } from "@/components/collaborator-photos/storage-usage-bar";

export const dynamic = "force-dynamic";

export default async function FotosColaboradoresPage() {
  const users = await fetchUsersServer();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Fotos dos Colaboradores</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Checklist da figurinha da Copa e galeria da sessão corporativa: suba várias fotos por
          pessoa. O colaborador escolhe os usos em Minhas fotos.
        </p>
      </div>

      <StorageUsageBar />

      <PhotoUsageTypesPanel />

      <CollaboratorPhotosGrid initialUsers={users} />
    </div>
  );
}
