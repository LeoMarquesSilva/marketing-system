export type ScheduleFormat = "post" | "reel";
export type ScheduleStatus = "open" | "assigned" | "linked" | "published" | "cancelled";

export type ScheduleCollaborator = {
  id: string;
  name: string;
  area?: string | null;
  avatarUrl?: string | null;
};

export type LinkedScheduleContent = { id: string; title: string; url?: string | null };

export type SchedulePublication = {
  id: string;
  permalink?: string | null;
  publishedAt?: string | null;
  likes?: number | null;
  comments?: number | null;
  reach?: number | null;
};

export type ScheduleSlotView = {
  id: string;
  area: string;
  date: string;
  format: ScheduleFormat;
  status: ScheduleStatus;
  collaboratorId?: string | null;
  collaborator?: ScheduleCollaborator | null;
  content?: LinkedScheduleContent | null;
  publication?: SchedulePublication | null;
  sourceName?: string | null;
  sourceStatus?: string | null;
  imported?: boolean;
  unmatchedAssigneeName?: string | null;
};
