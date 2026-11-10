import { ConviteClient } from "@/components/festa-10-anos/convite-client";

export const dynamic = "force-dynamic";

/** Convite pessoal do cliente (sem login). ?previa=1: alguém do escritório vê sem gravar nem contar a abertura. */
export default async function ConvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ previa?: string }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  return <ConviteClient token={token} preview={query.previa === "1"} />;
}
