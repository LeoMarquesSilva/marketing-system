import { fetchPhotoRosterServer } from "@/lib/collaborator-photos/roster-server";
import { CollaboratorPhotosGrid } from "@/components/usuarios/collaborator-photos-grid";
import { PhotoUsageTypesPanel } from "@/components/collaborator-photos/usage-types-panel";
import { PhotoSessionsPanel } from "@/components/collaborator-photos/photo-sessions-panel";
import { StorageUsageBar } from "@/components/collaborator-photos/storage-usage-bar";

export const dynamic = "force-dynamic";

export default async function FotosColaboradoresPage() {
  const people = await fetchPhotoRosterServer();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Fotos dos Colaboradores</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Mesma lista de colaboradores de Férias (RH / VIOS). Suba as fotos por sessão (ex.: Fotos
          Corporativas 2026); cada pessoa escolhe os usos em Minhas fotos.
        </p>
      </div>

      <StorageUsageBar />

      <PhotoSessionsPanel />

      <PhotoUsageTypesPanel />

      <CollaboratorPhotosGrid initialPeople={people} />
    </div>
  );
}
