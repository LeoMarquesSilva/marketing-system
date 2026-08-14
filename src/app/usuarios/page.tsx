import { fetchAreas } from "@/lib/areas";
import { fetchUsersAuthActivity, fetchUsersServer } from "@/lib/users-server";
import { UsersTable } from "@/components/usuarios/users-table";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const [users, areas, authActivity] = await Promise.all([
    fetchUsersServer(),
    fetchAreas(),
    fetchUsersAuthActivity(),
  ]);

  const usersWithAuthActivity = users.map((user) => ({
    ...user,
    auth_activity: user.auth_id ? authActivity[user.id] ?? null : null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Usuários</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie os usuários do sistema. A galeria corporativa fica em{" "}
          <Link href="/fotos-colaboradores" className="text-primary underline-offset-4 hover:underline">
            Fotos Colaboradores
          </Link>
          .
        </p>
      </div>

      <UsersTable initialUsers={usersWithAuthActivity} initialAreas={areas} />
    </div>
  );
}
