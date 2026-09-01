import type { GustavoContentSource, GustavoContentStatus } from "@/lib/gustavo-content/constants";
import type { ScoreBreakdown } from "@/lib/gustavo-content/score";
import type { ComplianceResult } from "@/lib/gustavo-content/compliance";
import type { OpinionStatus, ApprovalKind } from "@/lib/gustavo-content/workflow";

export type AngleType = "diagnosis" | "strategy" | "opinion";

export interface EditorialAngle {
  type: AngleType;
  title: string;
  thesis: string;
  whyItMatters: string;
}

export interface RecommendedChannel {
  recommended: boolean;
  reason: string;
}

export interface RecommendedChannels {
  linkedin: RecommendedChannel;
  instagramReel: RecommendedChannel;
}

export interface SourceContext {
  facts: string[];
  numbers: string[];
  companies: string[];
  dates: string[];
  sourceUrls: string[];
  extractionWarning?: string | null;
  historyAlert?: string | null;
}

export interface GustavoContentItem {
  id: string;
  source: GustavoContentSource;
  topic_id: string | null;
  title: string | null;
  link: string | null;
  content_snippet: string | null;
  published_at: string | null;
  image_url: string | null;
  source_context: SourceContext | null;
  editorial_score: number | null;
  score_breakdown: ScoreBreakdown | null;
  score_reason: string | null;
  business_problem: string | null;
  angles: EditorialAngle[] | null;
  selected_angle: EditorialAngle | null;
  thesis_id: string | null;
  thesis_snapshot: string | null;
  opinion_status: OpinionStatus | null;
  gustavo_questions: string[] | null;
  gustavo_answers: string[] | null;
  recommended_channels: RecommendedChannels | null;
  linkedin_post: string | null;
  original_linkedin_post: string | null;
  reel_script: string | null;
  original_reel_script: string | null;
  alternative_hooks: string[] | null;
  compliance_flags: ComplianceResult | null;
  factual_flags: string[] | null;
  status: GustavoContentStatus;
  rejection_reason: string | null;
  has_alterations: boolean;
  created_by: string | null;
  created_by_name: string | null;
  edited_by: string | null;
  edited_by_name: string | null;
  edited_at: string | null;
  submitted_to_gustavo_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  approval_kind: ApprovalKind | null;
  marketing_request_linkedin_id: string | null;
  marketing_request_reel_id: string | null;
  linkedin_published_url: string | null;
  instagram_published_url: string | null;
  linkedin_published_at: string | null;
  instagram_published_at: string | null;
  performance: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  topic_name?: string | null;
  thesis_title?: string | null;
}

export interface GustavoContentTopic {
  id: string;
  name: string;
  rss_query: string;
  is_active: boolean;
  months_back: number;
  item_limit: number;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface GustavoFetchRun {
  id: string;
  trigger: string;
  started_at: string;
  finished_at: string | null;
  topics_count: number;
  items_seen: number;
  discarded_under_55: number;
  radar_created: number;
  suggestions_created: number;
  duplicates: number;
  error_count: number;
  errors: string[] | null;
  created_at: string;
}

export const ANGLE_LABELS: Record<AngleType, string> = {
  diagnosis: "Diagnóstico / sinal",
  strategy: "Decisão / estratégia",
  opinion: "Tese / contraponto",
};

export const ITEM_SELECT =
  "id, source, topic_id, title, link, content_snippet, published_at, image_url, source_context, editorial_score, score_breakdown, score_reason, business_problem, angles, selected_angle, thesis_id, thesis_snapshot, opinion_status, gustavo_questions, gustavo_answers, recommended_channels, linkedin_post, original_linkedin_post, reel_script, original_reel_script, alternative_hooks, compliance_flags, factual_flags, status, rejection_reason, has_alterations, created_by, created_by_name, edited_by, edited_by_name, edited_at, submitted_to_gustavo_at, approved_by, approved_at, approval_kind, marketing_request_linkedin_id, marketing_request_reel_id, linkedin_published_url, instagram_published_url, linkedin_published_at, instagram_published_at, performance, created_at, updated_at";
