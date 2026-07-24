import { NfcPageHeading } from "@/components/nfc/nfc-page-heading";
import { NfcSubnav } from "@/components/nfc/nfc-subnav";
import { NfcTagForm } from "@/components/nfc/nfc-tag-form";
import { getNfcTag } from "@/lib/nfc/server";
import { fetchActiveUsers } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function EditNfcTagPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ tag, allowedUserIds }, users] = await Promise.all([
    getNfcTag(id),
    fetchActiveUsers(),
  ]);

  return (
    <div className="space-y-5">
      <NfcPageHeading
        title={`Editar ${tag.name}`}
        description="Altere a experiência da etiqueta sem modificar sua URL permanente."
        backHref={`/nfc/tags/${tag.id}`}
        primaryAction={false}
      />
      <NfcSubnav />
      <NfcTagForm initialTag={tag} allowedUserIds={allowedUserIds} users={users} />
    </div>
  );
}
