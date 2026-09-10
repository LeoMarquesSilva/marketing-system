export type ContentScheduleFormat = "post" | "reel";
export type ContentScheduleLinkReason = "no_slot" | "ambiguous" | "race_lost";

export interface ContentSchedulePublication {
  id: string;
  ig_media_id: string;
  permalink: string | null;
  published_at: string | null;
  caption: string | null;
  likes: number | null;
  comments: number | null;
  reach: number | null;
  views: number | null;
}

export interface ContentScheduleSlot {
  id: string;
  area: string;
  due_date: string;
  format: ContentScheduleFormat;
  collaborator_id: string | null;
  collaborator_name: string | null;
  collaborator_avatar_url: string | null;
  source_key: string;
  source_name: string | null;
  source_status: string | null;
  source_notes: string | null;
  cancelled: boolean;
  content_roteiro_id: string | null;
  content_title: string | null;
  reel_studio_id: string | null;
  reel_title: string | null;
  instagram_post_id: string | null;
  publication: ContentSchedulePublication | null;
  created_at: string;
  updated_at: string;
}

export interface ContentScheduleCollaborator {
  id: string;
  name: string;
  department: string | null;
  avatar_url: string | null;
}

export interface ContentSchedulePendingLink {
  id: string;
  collaborator_id: string;
  collaborator_name: string | null;
  area: string;
  format: ContentScheduleFormat;
  event_date: string;
  content_roteiro_id: string | null;
  reel_studio_id: string | null;
  source_title: string | null;
  reason: ContentScheduleLinkReason;
  created_at: string;
}

export interface ContentScheduleAccess {
  canManage: boolean;
  assignableAreas: string[] | null;
  userId: string;
}

export type ContentScheduleAssigneeIssueReason =
  | "inactive"
  | "abbreviated"
  | "moved_area"
  | "placeholder"
  | "ambiguous"
  | "unmatched";

export interface ContentScheduleAssigneeIssue {
  key: string;
  area: string;
  sourceName: string;
  reason: ContentScheduleAssigneeIssueReason;
  mode: "identity" | "future_replacement";
  slotCount: number;
  pastSlotCount: number;
  futureSlotCount: number;
  affectedSlotCount: number;
  dates: string[];
  suggestedCollaboratorId: string | null;
  suggestedCollaboratorName: string | null;
  suggestedCollaboratorAvatarUrl: string | null;
}

export interface ContentScheduleAssigneeReviewResponse {
  issues: ContentScheduleAssigneeIssue[];
  collaborators: ContentScheduleCollaborator[];
  access: ContentScheduleAccess;
  year: number;
}

export interface ContentScheduleResponse {
  slots: ContentScheduleSlot[];
  collaborators: ContentScheduleCollaborator[];
  areas: string[];
  access: ContentScheduleAccess;
  pendingLinks: ContentSchedulePendingLink[];
}

export interface ContentScheduleWarning {
  id: string;
  title: string;
  kind: "exact_source" | "similar_topic";
  evidence: string[];
  status: string;
  publishedAt?: string;
  url?: string;
  collaboratorName?: string;
}
