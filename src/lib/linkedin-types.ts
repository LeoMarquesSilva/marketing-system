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

export type LinkedinReportType = "content" | "followers" | "visitors" | "competitors";

export interface LinkedinFollowerDailyMetric {
  id: string;
  metric_date: string;
  sponsored_followers: number;
  organic_followers: number;
  auto_invited_followers: number;
  total_followers: number;
  source_import_id: string | null;
  updated_at: string;
}

export interface LinkedinVisitorDailyMetric {
  id: string;
  metric_date: string;
  overview_views_desktop: number;
  overview_views_mobile: number;
  overview_views_total: number;
  overview_unique_desktop: number;
  overview_unique_mobile: number;
  overview_unique_total: number;
  life_views_desktop: number;
  life_views_mobile: number;
  life_views_total: number;
  life_unique_desktop: number;
  life_unique_mobile: number;
  life_unique_total: number;
  jobs_views_desktop: number;
  jobs_views_mobile: number;
  jobs_views_total: number;
  jobs_unique_desktop: number;
  jobs_unique_mobile: number;
  jobs_unique_total: number;
  total_views_desktop: number;
  total_views_mobile: number;
  total_views_total: number;
  total_unique_desktop: number;
  total_unique_mobile: number;
  total_unique_total: number;
  source_import_id: string | null;
  updated_at: string;
}

export type LinkedinDemographicDimension =
  | "location"
  | "function"
  | "seniority"
  | "industry"
  | "company_size";

export interface LinkedinDemographicSnapshot {
  id: string;
  import_id: string;
  report_type: "followers" | "visitors";
  dimension: LinkedinDemographicDimension;
  label: string;
  metric_value: number;
  captured_at: string;
  created_at: string;
}

export interface LinkedinCompetitorSnapshot {
  id: string;
  import_id: string;
  page_name: string;
  new_followers: number;
  publications: number;
  comments: number;
  comments_per_day: number;
  reactions: number;
  period_from: string;
  period_to: string;
  captured_at: string;
  created_at: string;
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
  report_type: LinkedinReportType;
  demographic_rows: number;
  competitor_rows: number;
  date_from: string | null;
  date_to: string | null;
  warnings: string[];
  imported_by: string | null;
  imported_at: string;
}

export interface LinkedinDashboardData {
  dailyMetrics: LinkedinDailyMetric[];
  followerDailyMetrics: LinkedinFollowerDailyMetric[];
  visitorDailyMetrics: LinkedinVisitorDailyMetric[];
  demographics: LinkedinDemographicSnapshot[];
  competitorSnapshots: LinkedinCompetitorSnapshot[];
  posts: LinkedinPost[];
  imports: LinkedinImportRecord[];
  instagramCandidates: InstagramPost[];
  unavailableReason?: string | null;
}

export type ParsedLinkedinDailyMetric = Omit<
  LinkedinDailyMetric,
  "id" | "source_import_id" | "updated_at"
>;

export type ParsedLinkedinFollowerDailyMetric = Omit<
  LinkedinFollowerDailyMetric,
  "id" | "source_import_id" | "updated_at"
>;

export type ParsedLinkedinVisitorDailyMetric = Omit<
  LinkedinVisitorDailyMetric,
  "id" | "source_import_id" | "updated_at"
>;

export type ParsedLinkedinDemographic = Omit<
  LinkedinDemographicSnapshot,
  "id" | "import_id" | "report_type" | "captured_at" | "created_at"
>;

export type ParsedLinkedinCompetitorSnapshot = Omit<
  LinkedinCompetitorSnapshot,
  "id" | "import_id" | "period_from" | "period_to" | "captured_at" | "created_at"
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
  reportType: LinkedinReportType;
  dailyMetrics: ParsedLinkedinDailyMetric[];
  followerDailyMetrics: ParsedLinkedinFollowerDailyMetric[];
  visitorDailyMetrics: ParsedLinkedinVisitorDailyMetric[];
  demographics: ParsedLinkedinDemographic[];
  competitors: ParsedLinkedinCompetitorSnapshot[];
  posts: ParsedLinkedinPost[];
  warnings: string[];
  dateFrom: string | null;
  dateTo: string | null;
}
