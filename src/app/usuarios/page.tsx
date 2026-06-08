import { fetchUsers } from "@/lib/users";
import { fetchAreas } from "@/lib/areas";
import { UsersTable } from "@/components/usuarios/users-table";
import Link from "next/link";

export default async function UsuariosPage() {
  const [users, areas] = await Promise.all([
    fetchUsers(),
    fetchAreas(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Usuários</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie os usuários que podem ser solicitantes. Para cadastrar fotos preferidas, use{" "}
          <Link href="/fotos-colaboradores" className="text-primary underline-offset-4 hover:underline">
            Fotos Colaboradores
          </Link>
          .
        </p>
      </div>

      <UsersTable initialUsers={users} initialAreas={areas} />
    </div>
  );
}
