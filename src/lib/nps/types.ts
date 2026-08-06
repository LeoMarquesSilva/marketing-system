/** Tipos do módulo NPS. */

export type NpsCampaignStatus = "draft" | "active" | "closed";

export interface NpsCampaign {
  id: string;
  name: string;
  status: NpsCampaignStatus;
  startsAt: string | null;
  endsAt: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NpsSurveyLink {
  id: string;
  campaignId: string;
  clientGroupId: string;
  token: string;
  createdByUserId: string | null;
  revokedAt: string | null;
  opensCount: number;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  sentAt: string | null;
  sentByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Estado de “NPS enviado” (primeiro clique trava). */
export interface NpsSentInfo {
  sentAt: string;
  sentBy: { id: string; name: string; avatarUrl: string | null };
}

export interface NpsResponseRow {
  id: string;
  campaignId: string;
  linkId: string;
  clientGroupId: string;
  respondentKind: "contact" | "person";
  contactId: string | null;
  personId: string | null;
  respondentName: string;
  respondentEmail: string | null;
  respondentCargo: string | null;
  scoreRecommend: number;
  reason: string | null;
  scoreAvailability: number;
  scoreCommunication: number;
  scoreInnovation: number;
  scoreTechnical: number;
  improvement: string | null;
  submittedAt: string;
}

export function mapNpsCampaign(row: Record<string, unknown>): NpsCampaign {
  return {
    id: row.id as string,
    name: row.name as string,
    status: row.status as NpsCampaignStatus,
    startsAt: (row.starts_at as string | null) ?? null,
    endsAt: (row.ends_at as string | null) ?? null,
    createdByUserId: (row.created_by_user_id as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function mapNpsSurveyLink(row: Record<string, unknown>): NpsSurveyLink {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    clientGroupId: row.client_group_id as string,
    token: row.token as string,
    createdByUserId: (row.created_by_user_id as string | null) ?? null,
    revokedAt: (row.revoked_at as string | null) ?? null,
    opensCount: Number(row.opens_count ?? 0),
    firstOpenedAt: (row.first_opened_at as string | null) ?? null,
    lastOpenedAt: (row.last_opened_at as string | null) ?? null,
    sentAt: (row.sent_at as string | null) ?? null,
    sentByUserId: (row.sent_by_user_id as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function mapNpsResponse(row: Record<string, unknown>): NpsResponseRow {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    linkId: row.link_id as string,
    clientGroupId: row.client_group_id as string,
    respondentKind: row.respondent_kind as "contact" | "person",
    contactId: (row.contact_id as string | null) ?? null,
    personId: (row.person_id as string | null) ?? null,
    respondentName: row.respondent_name as string,
    respondentEmail: (row.respondent_email as string | null) ?? null,
    respondentCargo: (row.respondent_cargo as string | null) ?? null,
    scoreRecommend: Number(row.score_recommend),
    reason: (row.reason as string | null) ?? null,
    scoreAvailability: Number(row.score_availability),
    scoreCommunication: Number(row.score_communication),
    scoreInnovation: Number(row.score_innovation),
    scoreTechnical: Number(row.score_technical),
    improvement: (row.improvement as string | null) ?? null,
    submittedAt: row.submitted_at as string,
  };
}
