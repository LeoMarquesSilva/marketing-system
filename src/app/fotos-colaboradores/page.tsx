import { fetchUsersServer } from "@/lib/users-server";
import { CollaboratorPhotosGrid } from "@/components/usuarios/collaborator-photos-grid";

export const dynamic = "force-dynamic";

export default async function FotosColaboradoresPage() {
  const users = await fetchUsersServer();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Fotos dos Colaboradores</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Checklist para a figurinha da Copa: envie a foto para o storage do sistema (bucket Pro)
          ou cadastre link do OneDrive como referência externa.
        </p>
      </div>

      <CollaboratorPhotosGrid initialUsers={users} />
    </div>
  );
}
