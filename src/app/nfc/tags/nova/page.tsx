import { NfcPageHeading } from "@/components/nfc/nfc-page-heading";
import { NfcSubnav } from "@/components/nfc/nfc-subnav";
import { NfcTagForm } from "@/components/nfc/nfc-tag-form";
import { listNfcTemplates, requireNfcManager } from "@/lib/nfc/server";
import { fetchActiveUsers } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function NewNfcTagPage({
  searchParams,
}: {
  searchParams: Promise<{ modelo?: string }>;
}) {
  await requireNfcManager();
  const { modelo } = await searchParams;
  const [users, templates] = await Promise.all([fetchActiveUsers(), modelo ? listNfcTemplates() : Promise.resolve([])]);
  const template = templates.find((item) => item.id === modelo) ?? null;
  return (
    <div className="space-y-5">
      <NfcPageHeading
        title="Nova etiqueta"
        description={template ? `Modelo selecionado: ${template.name}. Revise os campos antes de criar.` : "Cadastre a etiqueta e defina a ação que será resolvida pela URL permanente."}
        backHref="/nfc/tags"
        primaryAction={false}
      />
      <NfcSubnav />
      <NfcTagForm users={users} template={template} />
    </div>
  );
}

