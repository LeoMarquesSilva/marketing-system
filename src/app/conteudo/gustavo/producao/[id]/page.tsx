import { ItemWorkspace } from "@/components/gustavo-content/item-workspace";
import { requireGustavoContentAccess } from "@/lib/gustavo-content/server";

export const dynamic = "force-dynamic";

export default async function GustavoItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireGustavoContentAccess();
  const { id } = await params;
  return (
    <ItemWorkspace
      itemId={id}
      isAdmin={actor.isAdmin}
      isOwner={actor.memberRole === "owner"}
    />
  );
}
