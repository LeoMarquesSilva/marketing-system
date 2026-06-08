import { fetchUsers } from "@/lib/users";
import { CollaboratorPhotosGrid } from "@/components/usuarios/collaborator-photos-grid";

export default async function FotosColaboradoresPage() {
  const users = await fetchUsers();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Fotos dos Colaboradores</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Cadastre o link do OneDrive e o link da foto de cada colaborador — centralizado aqui, sem
          upload no sistema.
        </p>
      </div>

      <CollaboratorPhotosGrid initialUsers={users} />
    </div>
  );
}
