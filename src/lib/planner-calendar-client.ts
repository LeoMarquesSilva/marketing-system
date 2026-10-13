import { updateMarketingRequest } from "@/lib/marketing-requests";
import type { CalendarItem } from "@/lib/planner-calendar";
import type { ReelDeliveryDetail } from "@/lib/reel-deliveries/types";

async function patchReel(id: string, body: Record<string, unknown>): Promise<string | null> {
  try {
    const response = await fetch(`/api/reel-deliveries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) return null;
    const json = (await response.json().catch(() => ({}))) as { error?: string };
    return json.error ?? "Não foi possível salvar o reel.";
  } catch {
    return "Sem conexão para salvar o reel.";
  }
}

/** Publica o post ou reel no dia do calendário (também serve para remarcar). Devolve a mensagem de erro, se houver. */
export async function publishCalendarItemOn(item: CalendarItem, dayKey: string): Promise<string | null> {
  if (item.kind === "reel") return patchReel(item.id, { status: "published", published_on: dayKey });
  const { error } = await updateMarketingRequest(item.id, {
    completion_type: "postagem_feita",
    posted_at: `${dayKey}T12:00:00.000Z`,
  });
  return error ? "Não foi possível salvar a data do post." : null;
}

/** Tira o reel do calendário e devolve ao banco do Planner. */
export function returnReelToBank(id: string): Promise<string | null> {
  return patchReel(id, { status: "ready" });
}

export async function fetchReelDeliveryDetail(id: string): Promise<ReelDeliveryDetail> {
  const response = await fetch(`/api/reel-deliveries/${id}`, { cache: "no-store" });
  const json = (await response.json().catch(() => ({}))) as { delivery?: ReelDeliveryDetail; error?: string };
  if (!response.ok || !json.delivery) throw new Error(json.error ?? "Não foi possível abrir o reel.");
  return json.delivery;
}
