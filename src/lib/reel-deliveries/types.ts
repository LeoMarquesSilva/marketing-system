import type { ReelDecisionValue, ReelDeliveryStatus } from "./domain";

export interface ReelPerson {
  id: string;
  name: string;
  avatarUrl: string | null;
  area?: string | null;
}

export interface ReelDecision {
  id: string;
  versionId: string;
  userId: string;
  userName: string;
  decision: ReelDecisionValue;
  comment: string | null;
  recordedByName: string | null;
  onBehalf: boolean;
  createdAt: string;
}

export interface ReelVersion {
  id: string;
  number: number;
  fileName: string;
  sizeBytes: number;
  notes: string | null;
  uploadedByName: string | null;
  createdAt: string;
}

export interface ReelDeliverySummary {
  id: string;
  slotId: string | null;
  area: string;
  dueDate: string | null;
  /** Título da capa; nulo até ser escrito ou gerado pela IA. */
  coverTitle: string | null;
  coverSubtitle: string | null;
  status: ReelDeliveryStatus;
  caption: string | null;
  aiStatus: "processing" | "done" | "failed" | null;
  aiError: string | null;
  hasCover: boolean;
  approvedAt: string | null;
  readyAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  participants: ReelPerson[];
  currentVersion: ReelVersion | null;
  /** Decisões sobre a versão atual, uma por pessoa. */
  currentDecisions: ReelDecision[];
  /** O usuário logado aparece no vídeo e ainda não decidiu sobre a versão atual. */
  awaitingMe: boolean;
}

export interface ReelCoverRequest {
  id: string;
  stage: string | null;
  stageLabel: string;
  assigneeName: string | null;
  deadline: string | null;
  hasImage: boolean;
}

export interface ReelDeliveryDetail extends ReelDeliverySummary {
  transcript: string | null;
  /** Tarefa de capa no Planner, quando pedida. */
  coverRequest: ReelCoverRequest | null;
  versions: ReelVersion[];
  decisions: ReelDecision[];
  videoUrl: string | null;
  videoDownloadUrl: string | null;
  coverUrl: string | null;
  coverDownloadUrl: string | null;
}

export interface ReelSlotOption {
  id: string;
  area: string;
  dueDate: string;
  collaborator: ReelPerson | null;
  /** Quem gravou junto, quando a vaga tem dois responsáveis. */
  coCollaborator: ReelPerson | null;
  sourceName: string | null;
}

export interface ReelDeliveriesResponse {
  viewer: { id: string; isManager: boolean };
  deliveries: ReelDeliverySummary[];
  /** Só para o Marketing: vagas de reel do cronograma ainda sem vídeo. */
  slots: ReelSlotOption[];
  people: ReelPerson[];
}
