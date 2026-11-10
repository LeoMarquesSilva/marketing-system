import { ConvitesFestaClient } from "@/components/festa-10-anos/convites/convites-festa-client";

export const dynamic = "force-dynamic";

/** Envio dos convites da festa de 10 anos aos clientes (cada remetente vê os seus). */
export default function ConvitesFestaPage() {
  return <ConvitesFestaClient />;
}
