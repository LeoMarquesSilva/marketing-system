import { fetchAreas } from "@/lib/areas";
import {
  fetchHrEmployeesByUserId,
  fetchUsersAuthActivity,
  fetchUsersServer,
  resolveViewerHasHrAccess,
} from "@/lib/users-server";
import { listAreaManagers } from "@/lib/email-area-managers-server";
import { listLinkableUsers } from "@/lib/ferias/server";
import { UsersTable } from "@/components/usuarios/users-table";
import type { HrEmployee, LinkableUser } from "@/lib/ferias/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const [users, areas, authActivity, areaManagers, canManageHr] = await Promise.all([
    fetchUsersServer(),
    fetchAreas(),
    fetchUsersAuthActivity(),
    listAreaManagers(),
    resolveViewerHasHrAccess(),
  ]);

  // Ficha de RH (cargo/vínculo/admissão) e a lista de usuários vinculáveis só
  // fazem sentido pra quem tem acesso ao módulo de RH — Usuários continua
  // igual pra quem só tem a permissão de /usuarios.
  const [hrByUserId, linkableUsers] = canManageHr
    ? await Promise.all([fetchHrEmployeesByUserId(), listLinkableUsers()])
    : [{} as Record<string, HrEmployee>, [] as LinkableUser[]];

  const managedAreasByUserId = new Map<string, string[]>();
  for (const manager of areaManagers) {
    const list = managedAreasByUserId.get(manager.userId) ?? [];
    list.push(manager.area);
    managedAreasByUserId.set(manager.userId, list);
  }

  const usersWithAuthActivity = users.map((user) => ({
    ...user,
    auth_activity: user.auth_id ? authActivity[user.id] ?? null : null,
    managedLegalAreas: managedAreasByUserId.get(user.id) ?? [],
    hrEmployee: hrByUserId[user.id] ?? null,
  }));

  const occupiedUserIds = Object.keys(hrByUserId);

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

      <UsersTable
        initialUsers={usersWithAuthActivity}
        initialAreas={areas}
        canManageHr={canManageHr}
        linkableUsers={linkableUsers}
        occupiedUserIds={occupiedUserIds}
      />
    </div>
  );
}
