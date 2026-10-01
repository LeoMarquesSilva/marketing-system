import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdminUser, requireAuthenticatedUser } from "@/lib/api-auth";
import { getIcpData } from "@/lib/icp/server";
import type { IcpData } from "@/lib/icp/compute";
import { IcpClient } from "@/components/icp/icp-client";

export const metadata: Metadata = {
  title: "ICP — ORQESTRAI",
  description: "Perfil de cliente ideal do escritório calculado com dados do VIOS e do marketing.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function IcpPage() {
  try {
    const user = await requireAuthenticatedUser();
    await requireAdminUser(user.id);
  } catch {
    redirect("/");
  }

  let data: IcpData | null = null;
  let error: string | null = null;
  try {
    data = await getIcpData();
  } catch (err) {
    error = err instanceof Error ? err.message : "Não foi possível calcular o ICP.";
  }

  return <IcpClient data={data} error={error} />;
}
