import type { InstagramPost } from "@/lib/instagram-posts";

export interface LinkedinDailyMetric {
  id: string;
  metric_date: string;
  organic_impressions: number;
  sponsored_impressions: number;
  total_impressions: number;
  unique_organic_impressions: number;
  organic_clicks: number;
  sponsored_clicks: number;
  total_clicks: number;
  organic_reactions: number;
  sponsored_reactions: number;
  total_reactions: number;
  organic_comments: number;
  sponsored_comments: number;
  total_comments: number;
  organic_shares: number;
  sponsored_shares: number;
  total_shares: number;
  organic_engagement_rate: number;
  sponsored_engagement_rate: number;
  total_engagement_rate: number;
  source_import_id: string | null;
  updated_at: string;
}

export interface LinkedinPost {
  id: string;
  linkedin_urn: string;
  caption: string | null;
  permalink: string;
  publication_type: string | null;
  campaign_name: string | null;
  published_by: string | null;
  published_at: string | null;
  campaign_start_at: string | null;
  campaign_end_at: string | null;
  audience: string | null;
  impressions: number;
  views: number;
  offsite_views: number;
  clicks: number;
  ctr: number;
  likes: number;
  comments: number;
  shares: number;
  followers: number;
  engagement_rate: number;
  content_type: string | null;
  byline: string | null;
  instagram_post_id: string | null;
  match_confidence: number | null;
  match_strategy: string | null;
  latest_import_id: string | null;
  synced_at: string;
  inserted_at: string;
  instagram_post: InstagramPost | null;
}

export interface LinkedinImportRecord {
  id: string;
  filename: string;
  file_hash: string;
  file_size: number;
  status: "processing" | "completed" | "failed";
  daily_rows: number;
  post_rows: number;
  matched_posts: number;
  date_from: string | null;
  date_to: string | null;
  warnings: string[];
  imported_by: string | null;
  imported_at: string;
}

export interface LinkedinDashboardData {
  dailyMetrics: LinkedinDailyMetric[];
  posts: LinkedinPost[];
  imports: LinkedinImportRecord[];
  instagramCandidates: InstagramPost[];
  unavailableReason?: string | null;
}

export type ParsedLinkedinDailyMetric = Omit<
  LinkedinDailyMetric,
  "id" | "source_import_id" | "updated_at"
>;

export type ParsedLinkedinPost = Omit<
    LinkedinPost,
    | "id"
    | "instagram_post_id"
    | "match_confidence"
    | "match_strategy"
    | "latest_import_id"
    | "synced_at"
    | "inserted_at"
    | "instagram_post"
  >;

export interface LinkedinWorkbookData {
  dailyMetrics: ParsedLinkedinDailyMetric[];
  posts: ParsedLinkedinPost[];
  warnings: string[];
  dateFrom: string | null;
  dateTo: string | null;
}
