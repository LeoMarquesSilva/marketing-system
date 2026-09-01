import { redirect } from "next/navigation";
import { GustavoContentShell } from "@/components/gustavo-content/gustavo-content-shell";
import {
  GustavoContentError,
  requireGustavoContentAccess,
} from "@/lib/gustavo-content/server";

export const dynamic = "force-dynamic";

export default async function GustavoContentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requireGustavoContentAccess().catch((err: unknown) => {
    if (err instanceof GustavoContentError && err.status === 401) {
      redirect("/login");
    }
    redirect("/");
  });

  return (
    <GustavoContentShell
      actorName={actor.name}
      isAdmin={actor.isAdmin}
      memberRole={actor.memberRole}
    >
      {children}
    </GustavoContentShell>
  );
}
