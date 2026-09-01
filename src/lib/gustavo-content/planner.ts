import { POST_REQUEST_TYPE, REEL_REQUEST_TYPE } from "@/lib/planner-posts";

export type PlannerChannel = "linkedin" | "reel";

export interface PlannerItemInput {
  id: string;
  title?: string | null;
  link?: string | null;
  thesis_snapshot?: string | null;
  linkedin_post?: string | null;
  reel_script?: string | null;
  marketing_request_linkedin_id?: string | null;
  marketing_request_reel_id?: string | null;
}

export interface PlannerPayload {
  requestType: string;
  title: string;
  description: string;
  channel: PlannerChannel;
}

export function parseReelScript(raw: string | null | undefined): {
  duration?: string;
  hook?: string;
  talkingPoints?: string[];
  closing?: string;
  recordingNote?: string;
} | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      duration: typeof parsed.duration === "string" ? parsed.duration : undefined,
      hook: typeof parsed.hook === "string" ? parsed.hook : undefined,
      talkingPoints: Array.isArray(parsed.talkingPoints)
        ? parsed.talkingPoints.map((item) => String(item))
        : undefined,
      closing: typeof parsed.closing === "string" ? parsed.closing : undefined,
      recordingNote:
        typeof parsed.recordingNote === "string" ? parsed.recordingNote : undefined,
    };
  } catch {
    return { hook: raw };
  }
}

export function plannerChannelAlreadyCreated(
  item: Pick<PlannerItemInput, "marketing_request_linkedin_id" | "marketing_request_reel_id">,
  channel: PlannerChannel
): boolean {
  if (channel === "linkedin") return Boolean(item.marketing_request_linkedin_id);
  return Boolean(item.marketing_request_reel_id);
}

export function buildLinkedInPlannerPayload(item: PlannerItemInput): PlannerPayload {
  const title = `Posicionamento Gustavo — LinkedIn — ${item.title ?? "Pauta"}`;
  const description = [
    "PAUTA",
    item.title ?? "—",
    "",
    "LINK DA FONTE",
    item.link ?? "—",
    "",
    "TESE",
    item.thesis_snapshot ?? "—",
    "",
    "POST FINAL",
    item.linkedin_post ?? "—",
    "",
    "OBSERVAÇÕES",
    "Texto para publicação no perfil do Gustavo. Não usar Word. Não inventar opinião.",
  ].join("\n");

  return {
    requestType: POST_REQUEST_TYPE,
    title,
    description,
    channel: "linkedin",
  };
}

export function buildReelPlannerPayload(item: PlannerItemInput): PlannerPayload {
  const reel = parseReelScript(item.reel_script);
  const title = `Posicionamento Gustavo — Reel — ${item.title ?? "Pauta"}`;
  const description = [
    "PAUTA",
    item.title ?? "—",
    "",
    "LINK",
    item.link ?? "—",
    "",
    "GANCHO",
    reel?.hook ?? "—",
    "",
    "PONTOS DE FALA",
    (reel?.talkingPoints ?? []).map((point) => `- ${point}`).join("\n") || "—",
    "",
    "FECHO",
    reel?.closing ?? "—",
    "",
    "OBSERVAÇÃO DE GRAVAÇÃO",
    reel?.recordingNote ?? "Tom executivo, 45–75s, um assunto.",
  ].join("\n");

  return {
    requestType: REEL_REQUEST_TYPE,
    title,
    description,
    channel: "reel",
  };
}
