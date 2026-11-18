import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { getAdminClient, loadCampaign } from "@/lib/email-marketing-server";
import { cancelScheduledBroadcast } from "@/lib/email-marketing-broadcast";

export const dynamic = "force-dynamic";

/** Cancela o agendamento: no Broadcast apaga o agendado no Resend; nos lotes só volta a rascunho. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAuthenticatedUser();
    const { id } = await context.params;
    const campaign = await loadCampaign(id);
    if (campaign.send_mode === "broadcast" && campaign.resend_broadcast_id) {
      await cancelScheduledBroadcast(id);
    } else {
      await getAdminClient()
        .from("email_campaigns")
        .update({ status: "draft", scheduled_at: null })
        .eq("id", id)
        .eq("status", "scheduled");
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao cancelar o agendamento.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
