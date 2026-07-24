export const NFC_ACTION_TYPES = [
  "url",
  "custom_page",
  "form",
  "webhook",
  "whatsapp",
  "menu",
  "sequence",
  "asset_loan",
] as const;

export const NFC_ACCESS_MODES = [
  "public",
  "public_confirmation",
  "authenticated",
  "admin",
  "selected_users",
] as const;

export type NfcActionType = (typeof NFC_ACTION_TYPES)[number];
export type NfcAccessMode = (typeof NFC_ACCESS_MODES)[number];
export type NfcTagStatus = "active" | "inactive";
export type NfcAssetStatus = "available" | "loaned" | "maintenance" | "inactive";

export type NfcFormFieldType =
  | "short_text"
  | "long_text"
  | "number"
  | "select"
  | "multiple_choice"
  | "user_select"
  | "date"
  | "image"
  | "audio";

export interface NfcFormField {
  id: string;
  label: string;
  type: NfcFormFieldType;
  required: boolean;
  options?: string[];
}

export interface NfcMenuItem {
  id: string;
  label: string;
  actionType: Exclude<NfcActionType, "menu" | "sequence">;
  config: Record<string, unknown>;
}

export interface NfcActionConfig {
  destinationUrl?: string;
  openImmediately?: boolean;
  extraParams?: Record<string, string>;
  title?: string;
  description?: string;
  imageUrl?: string;
  icon?: string;
  buttons?: Array<{ label: string; url: string }>;
  successMessage?: string;
  loadingMessage?: string;
  errorMessage?: string;
  fields?: NfcFormField[];
  workflowKey?: string;
  method?: "POST" | "PUT" | "PATCH";
  payloadTemplate?: Record<string, unknown>;
  requireConfirmation?: boolean;
  phoneMode?: "fixed" | "ask";
  fixedPhone?: string;
  messageTemplate?: string;
  menuItems?: NfcMenuItem[];
  sequence?: Array<{ type: "webhook" | "update_scan" | "success_page"; config?: Record<string, unknown> }>;
  timeoutMs?: number;
  sensitive?: boolean;
  assetLabel?: string;
  assetNumberLabel?: string;
  checkoutMessage?: string;
  returnMessage?: string;
}

export interface NfcTag {
  id: string;
  code: string;
  public_token: string;
  name: string;
  description: string | null;
  environment: string | null;
  location: string | null;
  category: string | null;
  responsible_user_id: string | null;
  status: NfcTagStatus;
  access_mode: NfcAccessMode;
  action_type: NfcActionType;
  action_config: NfcActionConfig;
  cooldown_seconds: number;
  total_scans: number;
  last_scanned_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface NfcTagInput {
  name: string;
  code?: string;
  description?: string | null;
  environment?: string | null;
  location?: string | null;
  category?: string | null;
  responsibleUserId?: string | null;
  status: NfcTagStatus;
  accessMode: NfcAccessMode;
  actionType: NfcActionType;
  actionConfig: NfcActionConfig;
  cooldownSeconds: number;
  notes?: string | null;
  allowedUserIds?: string[];
}

export interface NfcTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  action_type: NfcActionType;
  action_config: NfcActionConfig;
  is_system: boolean;
}

export type NfcPublicState =
  | "ready"
  | "confirmation_required"
  | "not_found"
  | "inactive"
  | "rate_limited"
  | "cooldown"
  | "login_required"
  | "access_denied";

export interface NfcPublicResolution {
  state: NfcPublicState;
  scanId?: string;
  tag?: {
    code: string;
    name: string;
    environment: string | null;
    location: string | null;
    category: string | null;
  };
  action?: {
    type: NfcActionType;
    requiresConfirmation: boolean;
    destinationUrl?: string;
    title?: string;
    description?: string;
    imageUrl?: string;
    buttons?: Array<{ label: string; url: string }>;
    fields?: NfcFormField[];
    menuItems?: Array<{ id: string; label: string }>;
    loadingMessage?: string;
    successMessage?: string;
    assetLabel?: string;
    assetNumberLabel?: string;
  };
  directoryUsers?: NfcDirectoryUser[];
  activeLoans?: Array<{
    assetNumber: string;
    borrowerUserId: string;
    borrowerName: string;
    borrowerAvatarUrl: string | null;
    checkedOutAt: string;
  }>;
  message?: string;
  retryAfterSeconds?: number;
}

export interface NfcDirectoryUser {
  id: string;
  name: string;
  department: string | null;
  avatarUrl: string | null;
}

export interface NfcAssetInventoryItem {
  id: string;
  tagId: string;
  tagName: string;
  tagCode: string;
  assetNumber: string;
  label: string;
  status: NfcAssetStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NfcAssetLoanAdminItem {
  id: string;
  assetId: string;
  tagId: string;
  tagName: string;
  tagCode: string;
  assetNumber: string;
  assetLabel: string;
  borrower: NfcDirectoryUser;
  checkedOutByName: string;
  checkedOutAt: string;
  returnedAt: string | null;
  returnedByName: string | null;
  returnNotes: string | null;
}

export interface NfcAssetAdminData {
  assets: NfcAssetInventoryItem[];
  openLoans: NfcAssetLoanAdminItem[];
  history: NfcAssetLoanAdminItem[];
  tags: Array<{
    id: string;
    code: string;
    name: string;
    assetLabel: string;
  }>;
}

export interface NfcDashboardData {
  totals: {
    tags: number;
    active: number;
    inactive: number;
    scansToday: number;
    scans30Days: number;
    executions: number;
    errors: number;
    successRate: number;
  };
  scansByDay: Array<{ date: string; scans: number }>;
  topTags: Array<{ id: string; name: string; code: string; scans: number }>;
  byEnvironment: Array<{ name: string; value: number }>;
  byActionType: Array<{ name: string; value: number }>;
  recentActivity: Array<{
    id: string;
    at: string;
    tagName: string;
    actionType: string;
    status: string;
  }>;
  filterOptions: {
    environments: string[];
    categories: string[];
  };
}
