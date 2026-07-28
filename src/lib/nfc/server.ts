import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createSsrClient } from "@/utils/supabase/server";
import type {
  NfcActionConfig,
  NfcActionType,
  NfcAssetAdminData,
  NfcDashboardData,
  NfcPublicResolution,
  NfcTag,
  NfcTagInput,
  NfcTemplate,
} from "@/lib/nfc/types";
import {
  appendSafeParams,
  generateIdempotencyKey,
  generatePublicToken,
  hashIpAddress,
  isSensitiveAction,
  isValidPublicToken,
  sanitizePublicUrl,
  sanitizeTechnicalError,
  signN8nPayload,
} from "@/lib/nfc/security";
import {
  nfcAssetAdminReturnSchema,
  nfcAssetCreateSchema,
  nfcAssetUpdateSchema,
  nfcTagInputSchema,
} from "@/lib/nfc/validation";
import { parseNfcScanSource } from "@/lib/nfc/public-url";
import {
  buildProfessionalProfilePublicAction,
  buildProfileRedirectPath,
  canRedirectProfileCard,
  findProfileCardByTagId,
  loadProfessionalProfilePublicHint,
} from "@/lib/profiles/cards";
export { getNfcPublicUrl } from "@/lib/nfc/public-url";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export interface NfcManager {
  authUserId: string;
  profileId: string;
  role: string | null;
  name: string;
}

interface PublicIdentity {
  authUserId: string | null;
  profileId: string | null;
  role: string | null;
}

interface ResolvePublicInput {
  token: string;
  request: Request;
  anonymousSessionId: string;
}

interface ExecutePublicInput extends ResolvePublicInput {
  scanId: string;
  confirmed: true;
  menuItemId?: string;
  formData?: Record<string, unknown>;
  phone?: string;
  loanOperation?: "checkout" | "return";
  assetNumber?: string;
  borrowerUserId?: string;
  source?: "nfc" | "qr";
}

export class NfcHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
  }
}

interface NfcQueryError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

function isMissingNfcSchemaError(errors: Array<NfcQueryError | null>): boolean {
  return errors.some((error) => {
    if (!error) return false;
    const description = [error.message, error.details, error.hint].filter(Boolean).join(" ");
    return error.code === "PGRST205" || /schema cache|relation .* does not exist|could not find the table/i.test(description);
  });
}

export function createNfcAdminClient(): SupabaseClient {
  if (!serviceKey) {
    throw new NfcHttpError("SUPABASE_SERVICE_ROLE_KEY não configurada.", 503, "SERVICE_UNAVAILABLE");
  }
  return createSupabaseClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function getPublicIdentity(admin: SupabaseClient): Promise<PublicIdentity> {
  const ssr = await createSsrClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();

  if (!user) return { authUserId: null, profileId: null, role: null };

  const { data } = await admin
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .maybeSingle();

  return {
    authUserId: user.id,
    profileId: (data?.id as string | undefined) ?? null,
    role: (data?.role as string | undefined) ?? null,
  };
}

export async function requireNfcManager(): Promise<NfcManager> {
  const ssr = await createSsrClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) throw new NfcHttpError("Não autenticado.", 401, "UNAUTHENTICATED");

  const admin = createNfcAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id, name, role, permissions")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (error) throw new NfcHttpError("Não foi possível validar o acesso.", 500, "ACCESS_LOOKUP_FAILED");
  const role = ((data?.role as string | null | undefined) ?? "").toLowerCase();
  const permissions = ((data?.permissions as string[] | null | undefined) ?? []);
  if (!data || (role !== "admin" && !permissions.includes("/nfc"))) {
    throw new NfcHttpError("Você não tem acesso ao NFC Hub.", 403, "FORBIDDEN");
  }

  return {
    authUserId: user.id,
    profileId: data.id as string,
    role: (data.role as string | null) ?? null,
    name: data.name as string,
  };
}

function normalizeNullable(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function assertSafeActionConfig(actionType: NfcActionType, config: NfcActionConfig): void {
  if (actionType === "url") {
    const safe = sanitizePublicUrl(config.destinationUrl);
    if (!safe) throw new NfcHttpError("A URL de destino deve usar HTTP ou HTTPS.", 400, "UNSAFE_URL");
  }
  if (config.imageUrl && !sanitizePublicUrl(config.imageUrl)) {
    throw new NfcHttpError("A URL da imagem não é segura.", 400, "UNSAFE_IMAGE_URL");
  }
  for (const button of config.buttons ?? []) {
    if (!sanitizePublicUrl(button.url)) {
      throw new NfcHttpError(`A URL do botão "${button.label}" não é segura.`, 400, "UNSAFE_BUTTON_URL");
    }
  }
  for (const item of config.menuItems ?? []) {
    const destination = item.config.destinationUrl;
    if (item.actionType === "url" && (typeof destination !== "string" || !sanitizePublicUrl(destination))) {
      throw new NfcHttpError(`A URL da ação "${item.label}" não é segura.`, 400, "UNSAFE_MENU_URL");
    }
  }
  const serialized = JSON.stringify(config).toLowerCase();
  if (
    serialized.includes("authorization") ||
    serialized.includes("api_key") ||
    serialized.includes("apikey") ||
    serialized.includes("secret") ||
    serialized.includes("webhookurl")
  ) {
    throw new NfcHttpError(
      "Credenciais e URLs privadas não podem ser salvas na configuração da etiqueta.",
      400,
      "SECRET_IN_CONFIG"
    );
  }
}

function actionRequiresDirectory(tag: NfcTag): boolean {
  return (
    tag.action_type === "asset_loan" ||
    (tag.action_type === "form" &&
      Boolean(tag.action_config.fields?.some((field) => field.type === "user_select")))
  );
}

async function nextNfcCode(admin: SupabaseClient): Promise<string> {
  const { data } = await admin
    .from("nfc_tags")
    .select("code")
    .like("code", "NFC-%")
    .order("created_at", { ascending: false })
    .limit(500);
  const largest = (data ?? []).reduce((max, row) => {
    const match = /^NFC-(\d+)$/.exec(String(row.code));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `NFC-${String(largest + 1).padStart(4, "0")}`;
}

function tagInsert(input: NfcTagInput, managerId: string, code: string, publicToken: string) {
  return {
    code,
    public_token: publicToken,
    name: input.name.trim(),
    description: normalizeNullable(input.description),
    environment: normalizeNullable(input.environment),
    location: normalizeNullable(input.location),
    category: normalizeNullable(input.category),
    responsible_user_id: input.responsibleUserId ?? null,
    status: input.status,
    access_mode: input.accessMode,
    action_type: input.actionType,
    action_config: input.actionConfig,
    cooldown_seconds: input.cooldownSeconds,
    notes: normalizeNullable(input.notes),
    created_by: managerId,
  };
}

async function replaceAllowedUsers(
  admin: SupabaseClient,
  tagId: string,
  userIds: string[] | undefined
): Promise<void> {
  await admin.from("nfc_tag_allowed_users").delete().eq("tag_id", tagId);
  if (!userIds?.length) return;
  const { error } = await admin
    .from("nfc_tag_allowed_users")
    .insert([...new Set(userIds)].map((userId) => ({ tag_id: tagId, user_id: userId })));
  if (error) throw new NfcHttpError("Não foi possível salvar os usuários selecionados.", 500, "ALLOWED_USERS_FAILED");
}

export async function createNfcTag(rawInput: unknown): Promise<NfcTag> {
  const manager = await requireNfcManager();
  const parsed = nfcTagInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new NfcHttpError(parsed.error.issues[0]?.message ?? "Dados inválidos.", 400, "VALIDATION_ERROR");
  }
  const input = parsed.data as NfcTagInput;
  assertSafeActionConfig(input.actionType, input.actionConfig);
  const admin = createNfcAdminClient();
  const code = input.code || (await nextNfcCode(admin));

  let created: NfcTag | null = null;
  for (let attempt = 0; attempt < 3 && !created; attempt += 1) {
    const { data, error } = await admin
      .from("nfc_tags")
      .insert(tagInsert(input, manager.profileId, code, generatePublicToken()))
      .select("*")
      .single();
    if (!error) created = data as NfcTag;
    else if (error.code !== "23505") {
      throw new NfcHttpError(error.message, 500, "TAG_CREATE_FAILED");
    }
  }
  if (!created) throw new NfcHttpError("Não foi possível gerar um token único.", 409, "TOKEN_COLLISION");

  await replaceAllowedUsers(admin, created.id, input.allowedUserIds);
  await admin.from("nfc_tag_audit_logs").insert({
    tag_id: created.id,
    actor_user_id: manager.profileId,
    event_type: "created",
    metadata: { status: created.status, actionType: created.action_type },
  });
  return created;
}

export async function listNfcTags(): Promise<NfcTag[]> {
  await requireNfcManager();
  const admin = createNfcAdminClient();
  const { data, error } = await admin
    .from("nfc_tags")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new NfcHttpError("Não foi possível carregar as etiquetas.", 500, "TAGS_LIST_FAILED");
  return (data ?? []) as NfcTag[];
}

export async function getNfcTag(id: string): Promise<{
  tag: NfcTag;
  allowedUserIds: string[];
  scans: Array<Record<string, unknown>>;
  audit: Array<Record<string, unknown>>;
}> {
  await requireNfcManager();
  const admin = createNfcAdminClient();
  const [tagResult, allowedResult, scansResult, auditResult] = await Promise.all([
    admin.from("nfc_tags").select("*").eq("id", id).is("deleted_at", null).maybeSingle(),
    admin.from("nfc_tag_allowed_users").select("user_id").eq("tag_id", id),
    admin.from("nfc_tag_scans").select("*").eq("tag_id", id).order("scanned_at", { ascending: false }).limit(50),
    admin.from("nfc_tag_audit_logs").select("*").eq("tag_id", id).order("created_at", { ascending: false }).limit(50),
  ]);
  if (!tagResult.data) throw new NfcHttpError("Etiqueta não encontrada.", 404, "TAG_NOT_FOUND");
  return {
    tag: tagResult.data as NfcTag,
    allowedUserIds: (allowedResult.data ?? []).map((row) => row.user_id as string),
    scans: scansResult.data ?? [],
    audit: auditResult.data ?? [],
  };
}

export async function updateNfcTag(id: string, rawInput: unknown): Promise<NfcTag> {
  const manager = await requireNfcManager();
  const parsed = nfcTagInputSchema.omit({ code: true }).safeParse(rawInput);
  if (!parsed.success) {
    throw new NfcHttpError(parsed.error.issues[0]?.message ?? "Dados inválidos.", 400, "VALIDATION_ERROR");
  }
  const input = parsed.data as NfcTagInput;
  assertSafeActionConfig(input.actionType, input.actionConfig);
  const admin = createNfcAdminClient();
  const { data: previous } = await admin
    .from("nfc_tags")
    .select("status, action_type")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!previous) throw new NfcHttpError("Etiqueta não encontrada.", 404, "TAG_NOT_FOUND");

  const { data, error } = await admin
    .from("nfc_tags")
    .update({
      name: input.name.trim(),
      description: normalizeNullable(input.description),
      environment: normalizeNullable(input.environment),
      location: normalizeNullable(input.location),
      category: normalizeNullable(input.category),
      responsible_user_id: input.responsibleUserId ?? null,
      status: input.status,
      access_mode: input.accessMode,
      action_type: input.actionType,
      action_config: input.actionConfig,
      cooldown_seconds: input.cooldownSeconds,
      notes: normalizeNullable(input.notes),
    })
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .single();
  if (error) throw new NfcHttpError("Não foi possível atualizar a etiqueta.", 500, "TAG_UPDATE_FAILED");

  if (Object.prototype.hasOwnProperty.call(input, "allowedUserIds")) {
    await replaceAllowedUsers(admin, id, input.allowedUserIds);
  }
  const eventType =
    previous.status !== input.status
      ? input.status === "active"
        ? "activated"
        : "deactivated"
      : "updated";
  await admin.from("nfc_tag_audit_logs").insert({
    tag_id: id,
    actor_user_id: manager.profileId,
    event_type: eventType,
    metadata: {
      previousActionType: previous.action_type,
      actionType: input.actionType,
    },
  });
  return data as NfcTag;
}

export async function deleteNfcTag(id: string): Promise<void> {
  const manager = await requireNfcManager();
  const admin = createNfcAdminClient();
  const { error } = await admin
    .from("nfc_tags")
    .update({ deleted_at: new Date().toISOString(), status: "inactive" })
    .eq("id", id)
    .is("deleted_at", null);
  if (error) throw new NfcHttpError("Não foi possível excluir a etiqueta.", 500, "TAG_DELETE_FAILED");
  await admin.from("nfc_tag_audit_logs").insert({
    tag_id: id,
    actor_user_id: manager.profileId,
    event_type: "deleted",
    metadata: {},
  });
}

export async function duplicateNfcTag(id: string): Promise<NfcTag> {
  const current = await getNfcTag(id);
  return createNfcTag({
    name: `${current.tag.name} — cópia`,
    description: current.tag.description,
    environment: current.tag.environment,
    location: current.tag.location,
    category: current.tag.category,
    responsibleUserId: current.tag.responsible_user_id,
    status: "inactive",
    accessMode: current.tag.access_mode,
    actionType: current.tag.action_type,
    actionConfig: current.tag.action_config,
    cooldownSeconds: current.tag.cooldown_seconds,
    notes: current.tag.notes,
    allowedUserIds: current.allowedUserIds,
  });
}

export async function listNfcTemplates(): Promise<NfcTemplate[]> {
  await requireNfcManager();
  const admin = createNfcAdminClient();
  const { data, error } = await admin
    .from("nfc_templates")
    .select("id, name, description, category, action_type, action_config, is_system")
    .order("is_system", { ascending: false })
    .order("name");
  if (error) throw new NfcHttpError("Não foi possível carregar os modelos.", 500, "TEMPLATES_LIST_FAILED");
  return (data ?? []) as NfcTemplate[];
}

function getAssetRpcCode(error: NfcQueryError | null): string | null {
  if (!error) return null;
  const message = [error.message, error.details, error.hint].filter(Boolean).join(" ");
  return [
    "ASSET_NOT_REGISTERED",
    "ASSET_ALREADY_CHECKED_OUT",
    "ASSET_IN_MAINTENANCE",
    "ASSET_INACTIVE",
    "ASSET_NOT_CHECKED_OUT",
    "ASSET_HAS_OPEN_LOAN",
    "ASSET_NOT_FOUND",
    "ASSET_STATUS_INVALID",
  ].find((code) => message.includes(code)) ?? null;
}

function assetRpcError(
  error: NfcQueryError | null,
  assetLabel = "Item"
): NfcHttpError {
  const code = getAssetRpcCode(error);
  const messages: Record<string, string> = {
    ASSET_NOT_REGISTERED: `${assetLabel} não cadastrado no inventário.`,
    ASSET_ALREADY_CHECKED_OUT: `${assetLabel} já está com outra pessoa.`,
    ASSET_IN_MAINTENANCE: `${assetLabel} está em manutenção.`,
    ASSET_INACTIVE: `${assetLabel} está inativo.`,
    ASSET_NOT_CHECKED_OUT: `${assetLabel} não possui retirada em aberto.`,
    ASSET_HAS_OPEN_LOAN: "Registre a devolução antes de alterar a situação deste item.",
    ASSET_NOT_FOUND: "Item não encontrado.",
    ASSET_STATUS_INVALID: "Situação do item inválida.",
  };
  if (code) {
    return new NfcHttpError(
      messages[code],
      code === "ASSET_NOT_FOUND" ? 404 : 409,
      code
    );
  }
  return new NfcHttpError(
    "Não foi possível atualizar o inventário.",
    500,
    "ASSET_INVENTORY_FAILED"
  );
}

export async function listNfcAssetInventory(): Promise<NfcAssetAdminData> {
  await requireNfcManager();
  const admin = createNfcAdminClient();
  const [assetsResult, loansResult, tagsResult, usersResult] = await Promise.all([
    admin
      .from("nfc_assets")
      .select("id, tag_id, asset_number, label, status, notes, created_at, updated_at")
      .order("asset_number"),
    admin
      .from("nfc_asset_loans")
      .select(
        "id, asset_id, tag_id, asset_number, borrower_user_id, checked_out_by, checked_out_at, returned_at, returned_by, return_notes"
      )
      .order("checked_out_at", { ascending: false })
      .limit(1000),
    admin
      .from("nfc_tags")
      .select("id, code, name, action_config")
      .eq("action_type", "asset_loan")
      .is("deleted_at", null)
      .order("name"),
    admin.from("users").select("id, name, department, avatar_url"),
  ]);
  if (
    assetsResult.error ||
    loansResult.error ||
    tagsResult.error ||
    usersResult.error
  ) {
    throw new NfcHttpError(
      "Não foi possível carregar o controle de itens.",
      500,
      "ASSET_INVENTORY_LIST_FAILED"
    );
  }

  const tags = (tagsResult.data ?? []).map((tag) => {
    const config = (tag.action_config ?? {}) as NfcActionConfig;
    return {
      id: String(tag.id),
      code: String(tag.code),
      name: String(tag.name),
      assetLabel: config.assetLabel || "Item",
    };
  });
  const tagById = new Map(tags.map((tag) => [tag.id, tag]));
  const users = (usersResult.data ?? []).map((user) => ({
    id: String(user.id),
    name: String(user.name),
    department: user.department ? String(user.department) : null,
    avatarUrl: user.avatar_url ? String(user.avatar_url) : null,
  }));
  const userById = new Map(users.map((user) => [user.id, user]));
  const assets = (assetsResult.data ?? []).map((asset) => {
    const tag = tagById.get(String(asset.tag_id));
    return {
      id: String(asset.id),
      tagId: String(asset.tag_id),
      tagName: tag?.name ?? "Etiqueta removida",
      tagCode: tag?.code ?? "NFC",
      assetNumber: String(asset.asset_number),
      label: String(asset.label),
      status: asset.status as NfcAssetAdminData["assets"][number]["status"],
      notes: asset.notes ? String(asset.notes) : null,
      createdAt: String(asset.created_at),
      updatedAt: String(asset.updated_at),
    };
  });
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const fallbackUser = {
    id: "",
    name: "Colaborador removido",
    department: null,
    avatarUrl: null,
  };
  const loans = (loansResult.data ?? []).map((loan) => {
    const tag = tagById.get(String(loan.tag_id));
    const asset = assetById.get(String(loan.asset_id));
    return {
      id: String(loan.id),
      assetId: String(loan.asset_id),
      tagId: String(loan.tag_id),
      tagName: tag?.name ?? "Etiqueta removida",
      tagCode: tag?.code ?? "NFC",
      assetNumber: String(loan.asset_number),
      assetLabel: asset?.label ?? tag?.assetLabel ?? "Item",
      borrower: userById.get(String(loan.borrower_user_id)) ?? fallbackUser,
      checkedOutByName:
        userById.get(String(loan.checked_out_by))?.name ?? "Colaborador removido",
      checkedOutAt: String(loan.checked_out_at),
      returnedAt: loan.returned_at ? String(loan.returned_at) : null,
      returnedByName: loan.returned_by
        ? userById.get(String(loan.returned_by))?.name ?? "Colaborador removido"
        : null,
      returnNotes: loan.return_notes ? String(loan.return_notes) : null,
    };
  });

  return {
    assets,
    openLoans: loans.filter((loan) => !loan.returnedAt),
    history: loans.filter((loan) => Boolean(loan.returnedAt)),
    tags,
  };
}

export async function createNfcAssets(
  rawInput: unknown
): Promise<{ created: number }> {
  const manager = await requireNfcManager();
  const parsed = nfcAssetCreateSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new NfcHttpError(
      parsed.error.issues[0]?.message ?? "Dados inválidos.",
      400,
      "VALIDATION_ERROR"
    );
  }
  const admin = createNfcAdminClient();
  const { data: tag } = await admin
    .from("nfc_tags")
    .select("id")
    .eq("id", parsed.data.tagId)
    .eq("action_type", "asset_loan")
    .is("deleted_at", null)
    .maybeSingle();
  if (!tag) {
    throw new NfcHttpError(
      "Selecione uma etiqueta de empréstimo válida.",
      400,
      "ASSET_TAG_INVALID"
    );
  }
  const { error } = await admin.from("nfc_assets").insert(
    parsed.data.assetNumbers.map((assetNumber) => ({
      tag_id: parsed.data.tagId,
      asset_number: assetNumber,
      label: parsed.data.label,
      notes: normalizeNullable(parsed.data.notes),
      created_by: manager.profileId,
      updated_by: manager.profileId,
    }))
  );
  if (error?.code === "23505") {
    throw new NfcHttpError(
      "Um ou mais números já estão cadastrados nesta etiqueta.",
      409,
      "ASSET_NUMBER_DUPLICATE"
    );
  }
  if (error) {
    throw new NfcHttpError(
      "Não foi possível cadastrar os itens.",
      500,
      "ASSET_CREATE_FAILED"
    );
  }
  await admin.from("nfc_tag_audit_logs").insert({
    tag_id: parsed.data.tagId,
    actor_user_id: manager.profileId,
    event_type: "assets_created",
    metadata: {
      count: parsed.data.assetNumbers.length,
      assetNumbers: parsed.data.assetNumbers,
    },
  });
  return { created: parsed.data.assetNumbers.length };
}

export async function updateNfcAsset(
  id: string,
  rawInput: unknown
): Promise<void> {
  const manager = await requireNfcManager();
  const parsed = nfcAssetUpdateSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new NfcHttpError(
      parsed.error.issues[0]?.message ?? "Dados inválidos.",
      400,
      "VALIDATION_ERROR"
    );
  }
  const admin = createNfcAdminClient();
  const { data: asset } = await admin
    .from("nfc_assets")
    .select("id, tag_id, asset_number, status")
    .eq("id", id)
    .maybeSingle();
  if (!asset) {
    throw new NfcHttpError("Item não encontrado.", 404, "ASSET_NOT_FOUND");
  }
  const { error } = await admin.rpc("nfc_update_asset", {
    p_asset_id: id,
    p_label: parsed.data.label,
    p_status: parsed.data.status ?? null,
    p_notes: normalizeNullable(parsed.data.notes),
    p_updated_by: manager.profileId,
  });
  if (error) throw assetRpcError(error);
  await admin.from("nfc_tag_audit_logs").insert({
    tag_id: asset.tag_id,
    actor_user_id: manager.profileId,
    event_type: "asset_updated",
    metadata: {
      assetId: id,
      assetNumber: asset.asset_number,
      status: parsed.data.status ?? asset.status,
    },
  });
}

export async function returnNfcAssetByAdmin(
  loanId: string,
  rawInput: unknown
): Promise<void> {
  const manager = await requireNfcManager();
  const parsed = nfcAssetAdminReturnSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new NfcHttpError(
      parsed.error.issues[0]?.message ?? "Dados inválidos.",
      400,
      "VALIDATION_ERROR"
    );
  }
  const admin = createNfcAdminClient();
  const { data: loan } = await admin
    .from("nfc_asset_loans")
    .select("id, tag_id, asset_number, returned_at")
    .eq("id", loanId)
    .maybeSingle();
  if (!loan) {
    throw new NfcHttpError("Empréstimo não encontrado.", 404, "LOAN_NOT_FOUND");
  }
  if (loan.returned_at) {
    throw new NfcHttpError(
      "Este item já foi devolvido.",
      409,
      "ASSET_NOT_CHECKED_OUT"
    );
  }
  const { error } = await admin.rpc("nfc_return_asset", {
    p_tag_id: loan.tag_id,
    p_asset_number: loan.asset_number,
    p_returned_by: manager.profileId,
    p_return_scan_id: null,
    p_return_notes: normalizeNullable(parsed.data.notes),
  });
  if (error) throw assetRpcError(error);
  await admin.from("nfc_tag_audit_logs").insert({
    tag_id: loan.tag_id,
    actor_user_id: manager.profileId,
    event_type: "asset_returned_by_admin",
    metadata: {
      loanId,
      assetNumber: loan.asset_number,
      notes: normalizeNullable(parsed.data.notes),
    },
  });
}

function startOfUtcDay(date = new Date()): string {
  const value = new Date(date);
  value.setUTCHours(0, 0, 0, 0);
  return value.toISOString();
}

export async function getNfcDashboard(filters?: {
  days?: number;
  environment?: string;
  category?: string;
  status?: string;
  actionType?: string;
}): Promise<NfcDashboardData> {
  await requireNfcManager();
  const admin = createNfcAdminClient();
  const now = Date.now();
  const days = [7, 30, 90].includes(filters?.days ?? 30) ? (filters?.days ?? 30) : 30;
  const sincePeriod = new Date(now - days * 86400000).toISOString();
  const [tagsResult, scansResult, executionsResult] = await Promise.all([
    admin.from("nfc_tags").select("id, name, code, environment, category, action_type, status, total_scans").is("deleted_at", null),
    admin.from("nfc_tag_scans").select("id, tag_id, scanned_at, result_status").gte("scanned_at", sincePeriod).order("scanned_at", { ascending: false }),
    admin.from("nfc_action_executions").select("id, tag_id, action_type, status, created_at").gte("created_at", sincePeriod).order("created_at", { ascending: false }),
  ]);
  if (tagsResult.error || scansResult.error || executionsResult.error) {
    const errors = [tagsResult.error, scansResult.error, executionsResult.error];
    console.error("[NFC Hub] Falha ao carregar dashboard.", {
      tags: tagsResult.error,
      scans: scansResult.error,
      executions: executionsResult.error,
    });
    if (isMissingNfcSchemaError(errors)) {
      throw new NfcHttpError(
        "O banco do NFC Hub ainda não foi instalado. Aplique a migration 20260720120000_nfc_hub.sql no Supabase.",
        503,
        "NFC_SCHEMA_NOT_INSTALLED"
      );
    }
    throw new NfcHttpError("Não foi possível carregar os indicadores.", 500, "DASHBOARD_FAILED");
  }
  const allTags = tagsResult.data ?? [];
  const tags = allTags.filter((tag) => {
    if (filters?.environment && tag.environment !== filters.environment) return false;
    if (filters?.category && (tag as { category?: string | null }).category !== filters.category) return false;
    if (filters?.status && tag.status !== filters.status) return false;
    if (filters?.actionType && tag.action_type !== filters.actionType) return false;
    return true;
  });
  const tagIds = new Set(tags.map((tag) => String(tag.id)));
  const scans = (scansResult.data ?? []).filter((scan) => tagIds.has(String(scan.tag_id)));
  const executions = (executionsResult.data ?? []).filter((execution) => tagIds.has(String(execution.tag_id)));
  const tagById = new Map(tags.map((tag) => [tag.id as string, tag]));
  const byDay = new Map<string, number>();
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(now - index * 86400000).toISOString().slice(0, 10);
    byDay.set(date, 0);
  }
  scans.forEach((scan) => {
    const date = String(scan.scanned_at).slice(0, 10);
    if (byDay.has(date)) byDay.set(date, (byDay.get(date) ?? 0) + 1);
  });
  const group = (field: "environment" | "action_type") => {
    const map = new Map<string, number>();
    tags.forEach((tag) => {
      const key = String(tag[field] || "Não informado");
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  };
  const errors = executions.filter((item) => item.status === "error").length;
  const successes = executions.filter((item) => item.status === "success").length;
  const finished = errors + successes;
  return {
    totals: {
      tags: tags.length,
      active: tags.filter((tag) => tag.status === "active").length,
      inactive: tags.filter((tag) => tag.status === "inactive").length,
      scansToday: scans.filter((scan) => String(scan.scanned_at) >= startOfUtcDay()).length,
      scans30Days: scans.length,
      executions: executions.length,
      errors,
      successRate: finished ? Math.round((successes / finished) * 1000) / 10 : 0,
    },
    scansByDay: [...byDay.entries()].map(([date, count]) => ({ date, scans: count })),
    topTags: [...tags]
      .sort((a, b) => Number(b.total_scans) - Number(a.total_scans))
      .slice(0, 5)
      .map((tag) => ({ id: String(tag.id), name: String(tag.name), code: String(tag.code), scans: Number(tag.total_scans) })),
    byEnvironment: group("environment"),
    byActionType: group("action_type"),
    recentActivity: executions.slice(0, 10).map((item) => ({
      id: String(item.id),
      at: String(item.created_at),
      tagName: String(tagById.get(String(item.tag_id))?.name ?? "Etiqueta removida"),
      actionType: String(item.action_type),
      status: String(item.status),
    })),
    filterOptions: {
      environments: [...new Set(allTags.map((tag) => tag.environment).filter(Boolean) as string[])].sort(),
      categories: [
        ...new Set(
          allTags
            .map((tag) => (tag as { category?: string | null }).category)
            .filter(Boolean) as string[]
        ),
      ].sort(),
    },
  };
}

export async function listNfcLogs(): Promise<Array<Record<string, unknown>>> {
  await requireNfcManager();
  const admin = createNfcAdminClient();
  const { data, error } = await admin
    .from("nfc_tag_scans")
    .select("id, scanned_at, authenticated_user_id, anonymous_session_id, platform, result_status, execution_time_ms, error_code, nfc_tags!inner(id, name, code, environment, location, action_type)")
    .order("scanned_at", { ascending: false })
    .limit(500);
  if (error) throw new NfcHttpError("Não foi possível carregar os logs.", 500, "LOGS_LIST_FAILED");
  return data ?? [];
}

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || null;
}

function getPlatform(request: Request): string | null {
  return request.headers.get("sec-ch-ua-platform")?.replaceAll('"', "") || null;
}

async function insertScan(
  admin: SupabaseClient,
  tag: NfcTag,
  request: Request,
  identity: PublicIdentity,
  anonymousSessionId: string,
  resultStatus: string,
  errorCode?: string
): Promise<string | null> {
  const secret = process.env.NFC_IP_HASH_SECRET || process.env.NFC_N8N_SIGNING_SECRET || serviceKey;
  const { data, error } = await admin
    .from("nfc_tag_scans")
    .insert({
      tag_id: tag.id,
      authenticated_user_id: identity.profileId,
      anonymous_session_id: anonymousSessionId,
      user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
      platform: getPlatform(request),
      referrer: request.headers.get("referer")?.slice(0, 1000) ?? null,
      ip_hash: hashIpAddress(getClientIp(request), secret),
      result_status: resultStatus,
      error_code: errorCode ?? null,
    })
    .select("id")
    .single();
  if (error) return null;
  await admin.rpc("increment_nfc_tag_scan_count", { p_tag_id: tag.id });
  return data.id as string;
}

async function isRateLimited(admin: SupabaseClient, request: Request): Promise<boolean> {
  const secret = process.env.NFC_IP_HASH_SECRET || process.env.NFC_N8N_SIGNING_SECRET || serviceKey;
  const ipHash = hashIpAddress(getClientIp(request), secret);
  if (!ipHash) return false;
  const since = new Date(Date.now() - 60000).toISOString();
  const { count } = await admin
    .from("nfc_tag_scans")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("scanned_at", since);
  return (count ?? 0) >= 15;
}

async function cooldownRemaining(
  admin: SupabaseClient,
  tag: NfcTag,
  anonymousSessionId: string
): Promise<number> {
  if (!tag.cooldown_seconds) return 0;
  const since = new Date(Date.now() - tag.cooldown_seconds * 1000).toISOString();
  const { data } = await admin
    .from("nfc_tag_scans")
    .select("scanned_at")
    .eq("tag_id", tag.id)
    .eq("anonymous_session_id", anonymousSessionId)
    .in("result_status", ["received", "confirmation_required", "completed"])
    .gte("scanned_at", since)
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return 0;
  const elapsed = Math.floor((Date.now() - new Date(data.scanned_at as string).getTime()) / 1000);
  return Math.max(1, tag.cooldown_seconds - elapsed);
}

async function checkAccess(
  admin: SupabaseClient,
  tag: NfcTag,
  identity: PublicIdentity
): Promise<"ok" | "login_required" | "access_denied"> {
  if (actionRequiresDirectory(tag) && !identity.profileId) return "login_required";
  if (tag.access_mode === "public" || tag.access_mode === "public_confirmation") return "ok";
  if (!identity.profileId) return "login_required";
  if (tag.access_mode === "authenticated") return "ok";
  if (tag.access_mode === "admin") {
    return identity.role?.toLowerCase() === "admin" ? "ok" : "access_denied";
  }
  const { data } = await admin
    .from("nfc_tag_allowed_users")
    .select("user_id")
    .eq("tag_id", tag.id)
    .eq("user_id", identity.profileId)
    .maybeSingle();
  return data ? "ok" : "access_denied";
}

function toPublicAction(tag: NfcTag): NfcPublicResolution["action"] {
  const config = tag.action_config ?? {};
  const safeDestination = sanitizePublicUrl(config.destinationUrl);
  const safeButtons = (config.buttons ?? [])
    .map((button) => ({ label: button.label, url: sanitizePublicUrl(button.url) }))
    .filter((button): button is { label: string; url: string } => Boolean(button.url));
  return {
    type: tag.action_type,
    requiresConfirmation:
      tag.access_mode === "public_confirmation" || isSensitiveAction(tag.action_type, config),
    destinationUrl:
      tag.action_type === "url" && safeDestination
        ? appendSafeParams(safeDestination, config.extraParams)
        : undefined,
    title: config.title,
    description: config.description,
    imageUrl: sanitizePublicUrl(config.imageUrl) ?? undefined,
    buttons: safeButtons,
    fields: tag.action_type === "form" ? config.fields : undefined,
    menuItems:
      tag.action_type === "menu"
        ? (config.menuItems ?? []).map((item) => ({ id: item.id, label: item.label }))
        : undefined,
    loadingMessage: config.loadingMessage,
    successMessage: config.successMessage,
    assetLabel: config.assetLabel,
    assetNumberLabel: config.assetNumberLabel,
  };
}

async function toProfessionalProfilePublicAction(
  admin: SupabaseClient,
  tag: NfcTag
): Promise<
  | { ok: true; action: NonNullable<NfcPublicResolution["action"]> }
  | { ok: false; state: "inactive" | "not_found"; message: string }
> {
  const profileId = tag.action_config?.profileId;
  if (!profileId) {
    return { ok: false, state: "not_found", message: "Perfil vinculado não encontrado." };
  }

  const card = await findProfileCardByTagId(admin, tag.id);
  if (card && !canRedirectProfileCard(card.status)) {
    return {
      ok: false,
      state: "inactive",
      message: "Este cartão não está mais ativo.",
    };
  }

  const hint = await loadProfessionalProfilePublicHint(admin, profileId);
  if (!hint) {
    return {
      ok: false,
      state: "not_found",
      message: "Perfil vinculado não encontrado.",
    };
  }
  if (hint.status !== "published") {
    return {
      ok: false,
      state: "inactive",
      message: "Este perfil ainda não foi publicado.",
    };
  }

  return { ok: true, action: buildProfessionalProfilePublicAction(hint) };
}

async function getPublicDirectory(admin: SupabaseClient): Promise<
  NonNullable<NfcPublicResolution["directoryUsers"]>
> {
  const { data, error } = await admin
    .from("users")
    .select("id, name, department, avatar_url")
    .eq("is_active", true)
    .order("name");
  if (error) {
    throw new NfcHttpError(
      "Não foi possível carregar os colaboradores.",
      500,
      "USER_DIRECTORY_FAILED"
    );
  }
  return (data ?? []).map((user) => ({
    id: String(user.id),
    name: String(user.name),
    department: user.department ? String(user.department) : null,
    avatarUrl: user.avatar_url ? String(user.avatar_url) : null,
  }));
}

async function getActiveAssetLoans(
  admin: SupabaseClient,
  tagId: string,
  directoryUsers: NonNullable<NfcPublicResolution["directoryUsers"]>
): Promise<NonNullable<NfcPublicResolution["activeLoans"]>> {
  const { data, error } = await admin
    .from("nfc_asset_loans")
    .select("asset_number, borrower_user_id, checked_out_at")
    .eq("tag_id", tagId)
    .is("returned_at", null)
    .order("checked_out_at", { ascending: false });
  if (error) {
    throw new NfcHttpError(
      "Não foi possível carregar as retiradas em aberto.",
      500,
      "ASSET_LOANS_FAILED"
    );
  }
  const usersById = new Map(directoryUsers.map((user) => [user.id, user]));
  return (data ?? []).map((loan) => ({
    assetNumber: String(loan.asset_number),
    borrowerUserId: String(loan.borrower_user_id),
    borrowerName: usersById.get(String(loan.borrower_user_id))?.name ?? "Colaborador",
    borrowerAvatarUrl:
      usersById.get(String(loan.borrower_user_id))?.avatarUrl ?? null,
    checkedOutAt: String(loan.checked_out_at),
  }));
}

export async function getNfcPublicTagLabel(token: string): Promise<string | null> {
  if (!isValidPublicToken(token)) return null;
  const admin = createNfcAdminClient();
  const { data } = await admin
    .from("nfc_tags")
    .select("name")
    .eq("public_token", token)
    .is("deleted_at", null)
    .maybeSingle();
  return data?.name ? String(data.name) : null;
}

export async function resolvePublicNfcTag(input: ResolvePublicInput): Promise<NfcPublicResolution> {
  if (!isValidPublicToken(input.token)) return { state: "not_found", message: "Etiqueta não encontrada." };
  const admin = createNfcAdminClient();
  const { data } = await admin
    .from("nfc_tags")
    .select("*")
    .eq("public_token", input.token)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return { state: "not_found", message: "Etiqueta não encontrada." };
  const tag = data as NfcTag;
  const identity = await getPublicIdentity(admin);

  if (await isRateLimited(admin, input.request)) {
    await insertScan(admin, tag, input.request, identity, input.anonymousSessionId, "rate_limited", "RATE_LIMITED");
    return { state: "rate_limited", message: "Muitas leituras em pouco tempo.", retryAfterSeconds: 60 };
  }
  if (tag.status !== "active") {
    await insertScan(admin, tag, input.request, identity, input.anonymousSessionId, "inactive", "TAG_INACTIVE");
    return { state: "inactive", message: "Esta etiqueta está temporariamente inativa." };
  }
  const remaining = await cooldownRemaining(admin, tag, input.anonymousSessionId);
  if (remaining > 0) {
    await insertScan(admin, tag, input.request, identity, input.anonymousSessionId, "cooldown", "COOLDOWN_ACTIVE");
    return { state: "cooldown", message: "Aguarde antes de usar esta etiqueta novamente.", retryAfterSeconds: remaining };
  }
  const access = await checkAccess(admin, tag, identity);
  if (access !== "ok") {
    await insertScan(admin, tag, input.request, identity, input.anonymousSessionId, "access_denied", access.toUpperCase());
    return {
      state: access,
      message: access === "login_required" ? "Entre no ORQESTRAI para continuar." : "Você não tem permissão para esta etiqueta.",
    };
  }

  let action = toPublicAction(tag);
  if (tag.action_type === "professional_profile") {
    const resolved = await toProfessionalProfilePublicAction(admin, tag);
    if (!resolved.ok) {
      await insertScan(
        admin,
        tag,
        input.request,
        identity,
        input.anonymousSessionId,
        resolved.state === "inactive" ? "inactive" : "access_denied",
        resolved.state === "inactive" ? "CARD_INACTIVE" : "PROFILE_UNAVAILABLE"
      );
      return { state: resolved.state, message: resolved.message };
    }
    action = resolved.action;
  }

  const scanId = await insertScan(
    admin,
    tag,
    input.request,
    identity,
    input.anonymousSessionId,
    action?.requiresConfirmation ? "confirmation_required" : "received"
  );
  if (!scanId) throw new NfcHttpError("Não foi possível registrar a leitura.", 500, "SCAN_CREATE_FAILED");
  let directoryUsers: NfcPublicResolution["directoryUsers"];
  let activeLoans: NfcPublicResolution["activeLoans"];
  if (actionRequiresDirectory(tag)) {
    directoryUsers = await getPublicDirectory(admin);
    if (tag.action_type === "asset_loan") {
      activeLoans = await getActiveAssetLoans(admin, tag.id, directoryUsers);
    }
  }
  return {
    state: action?.requiresConfirmation ? "confirmation_required" : "ready",
    scanId,
    tag: {
      code: tag.code,
      name: tag.name,
      environment: tag.environment,
      location: tag.location,
      category: tag.category,
    },
    action,
    directoryUsers,
    activeLoans,
  };
}

function validateFormData(config: NfcActionConfig, data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of config.fields ?? []) {
    const value = data[field.id];
    const missing = value === undefined || value === null || value === "";
    if (field.required && missing) {
      throw new NfcHttpError(`Preencha o campo "${field.label}".`, 400, "FORM_REQUIRED_FIELD");
    }
    if (missing) continue;
    if (typeof value === "string" && value.length > 5000) {
      throw new NfcHttpError(`O campo "${field.label}" é muito longo.`, 400, "FORM_FIELD_TOO_LONG");
    }
    result[field.id] = value;
  }
  return result;
}

async function validateDirectorySelections(
  admin: SupabaseClient,
  config: NfcActionConfig,
  formData: Record<string, unknown>
): Promise<void> {
  const userIds = (config.fields ?? [])
    .filter((field) => field.type === "user_select")
    .map((field) => formData[field.id])
    .filter((value): value is string => typeof value === "string");
  if (!userIds.length) return;
  const { data, error } = await admin
    .from("users")
    .select("id")
    .in("id", [...new Set(userIds)])
    .eq("is_active", true);
  if (error || (data ?? []).length !== new Set(userIds).size) {
    throw new NfcHttpError(
      "Selecione um colaborador ativo.",
      400,
      "FORM_USER_INVALID"
    );
  }
}

function normalizeAssetNumber(value: string | undefined): string {
  return value?.trim().toLocaleUpperCase("pt-BR") ?? "";
}

async function executeAssetLoan(
  admin: SupabaseClient,
  tag: NfcTag,
  identity: PublicIdentity,
  input: ExecutePublicInput,
  config: NfcActionConfig
): Promise<string> {
  if (!identity.profileId) {
    throw new NfcHttpError(
      "Entre no ORQESTRAI para registrar a movimentação.",
      401,
      "LOGIN_REQUIRED"
    );
  }
  const assetNumber = normalizeAssetNumber(input.assetNumber);
  if (!assetNumber) {
    throw new NfcHttpError(
      `Informe ${config.assetNumberLabel?.toLocaleLowerCase("pt-BR") || "o número do item"}.`,
      400,
      "ASSET_NUMBER_REQUIRED"
    );
  }
  if (input.loanOperation === "checkout") {
    if (!input.borrowerUserId) {
      throw new NfcHttpError(
        "Selecione quem está retirando o item.",
        400,
        "BORROWER_REQUIRED"
      );
    }
    const { data: borrower } = await admin
      .from("users")
      .select("id, name")
      .eq("id", input.borrowerUserId)
      .eq("is_active", true)
      .maybeSingle();
    if (!borrower) {
      throw new NfcHttpError(
        "O colaborador selecionado não está disponível.",
        400,
        "BORROWER_INVALID"
      );
    }
    const { error } = await admin.rpc("nfc_checkout_asset", {
      p_tag_id: tag.id,
      p_asset_number: assetNumber,
      p_borrower_user_id: input.borrowerUserId,
      p_checked_out_by: identity.profileId,
      p_checkout_scan_id: input.scanId,
    });
    if (error) throw assetRpcError(error, config.assetLabel || "Item");
    return (
      config.checkoutMessage ||
      `${config.assetLabel || "Item"} ${assetNumber} retirado por ${String(borrower.name)}.`
    );
  }
  if (input.loanOperation === "return") {
    const { error } = await admin.rpc("nfc_return_asset", {
      p_tag_id: tag.id,
      p_asset_number: assetNumber,
      p_returned_by: identity.profileId,
      p_return_scan_id: input.scanId,
      p_return_notes: null,
    });
    if (error) throw assetRpcError(error, config.assetLabel || "Item");
    return (
      config.returnMessage ||
      `${config.assetLabel || "Item"} ${assetNumber} devolvido com sucesso.`
    );
  }
  throw new NfcHttpError(
    "Escolha retirar ou devolver.",
    400,
    "ASSET_OPERATION_REQUIRED"
  );
}

async function callN8n(
  tag: NfcTag,
  scanId: string,
  identity: PublicIdentity,
  anonymousSessionId: string,
  config: NfcActionConfig,
  formData: Record<string, unknown>,
  idempotencyKey: string
): Promise<number> {
  const endpoint = process.env.NFC_N8N_WEBHOOK_URL;
  const signingSecret = process.env.NFC_N8N_SIGNING_SECRET;
  if (!endpoint || !signingSecret || !sanitizePublicUrl(endpoint)) {
    throw new NfcHttpError("A integração n8n ainda não foi configurada.", 503, "N8N_NOT_CONFIGURED");
  }
  const payload = {
    event: "nfc.tag.scanned",
    tag: {
      id: tag.id,
      code: tag.code,
      name: tag.name,
      environment: tag.environment,
      location: tag.location,
      category: tag.category,
    },
    scan: {
      id: scanId,
      timestamp: new Date().toISOString(),
      userId: identity.profileId,
      anonymousSessionId: identity.profileId ? null : anonymousSessionId,
    },
    action: {
      type: tag.action_type,
      config: { workflowKey: config.workflowKey },
    },
    formData,
    idempotencyKey,
  };
  const body = JSON.stringify(payload);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(config.timeoutMs ?? 10000, 30000));
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-ORQESTRAI-Signature": signN8nPayload(body, signingSecret),
        "X-ORQESTRAI-Event": "nfc.tag.scanned",
        "X-Idempotency-Key": idempotencyKey,
      },
      body,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new NfcHttpError("O fluxo externo retornou erro.", 502, "N8N_HTTP_ERROR");
    return response.status;
  } finally {
    clearTimeout(timer);
  }
}

export async function executePublicNfcAction(input: ExecutePublicInput): Promise<{
  status: "success";
  message: string;
  redirectUrl?: string;
}> {
  if (!isValidPublicToken(input.token)) throw new NfcHttpError("Etiqueta não encontrada.", 404, "TAG_NOT_FOUND");
  const started = Date.now();
  const admin = createNfcAdminClient();
  const [{ data: tagData }, { data: scanData }] = await Promise.all([
    admin.from("nfc_tags").select("*").eq("public_token", input.token).is("deleted_at", null).maybeSingle(),
    admin.from("nfc_tag_scans").select("*").eq("id", input.scanId).maybeSingle(),
  ]);
  if (!tagData || !scanData || scanData.tag_id !== tagData.id) {
    throw new NfcHttpError("Leitura inválida ou expirada.", 404, "SCAN_NOT_FOUND");
  }
  const tag = tagData as NfcTag;
  if (tag.status !== "active") throw new NfcHttpError("Esta etiqueta está inativa.", 409, "TAG_INACTIVE");
  const identity = await getPublicIdentity(admin);
  const ownsScan =
    scanData.anonymous_session_id === input.anonymousSessionId ||
    (identity.profileId && scanData.authenticated_user_id === identity.profileId);
  if (!ownsScan) throw new NfcHttpError("Leitura inválida ou expirada.", 403, "SCAN_OWNERSHIP_FAILED");
  const access = await checkAccess(admin, tag, identity);
  if (access !== "ok") {
    throw new NfcHttpError(
      access === "login_required" ? "Entre no ORQESTRAI para continuar." : "Acesso negado.",
      access === "login_required" ? 401 : 403,
      access.toUpperCase()
    );
  }

  let actionType: NfcActionType = tag.action_type;
  let config = tag.action_config;
  if (tag.action_type === "menu") {
    const item = config.menuItems?.find((candidate) => candidate.id === input.menuItemId);
    if (!item) throw new NfcHttpError("Selecione uma ação válida.", 400, "MENU_ITEM_INVALID");
    actionType = item.actionType;
    config = item.config as NfcActionConfig;
  }
  assertSafeActionConfig(actionType, config);
  const idempotencyKey = generateIdempotencyKey(input.scanId, input.menuItemId || actionType);
  const { data: existing } = await admin
    .from("nfc_action_executions")
    .select("status")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing?.status === "success") {
    return { status: "success", message: config.successMessage || "Ação já concluída com segurança." };
  }

  const { data: execution, error: executionError } = await admin
    .from("nfc_action_executions")
    .upsert(
      {
        tag_id: tag.id,
        scan_id: input.scanId,
        action_type: actionType,
        status: "running",
        idempotency_key: idempotencyKey,
        request_metadata: { workflowKey: config.workflowKey ?? null, menuItemId: input.menuItemId ?? null },
      },
      { onConflict: "idempotency_key" }
    )
    .select("id")
    .single();
  if (executionError) throw new NfcHttpError("Não foi possível iniciar a ação.", 500, "EXECUTION_CREATE_FAILED");

  try {
    let redirectUrl: string | undefined;
    let responseStatus: number | null = null;
    let formData: Record<string, unknown> = {};
    let successMessage = config.successMessage || "Ação concluída com sucesso.";
    if (actionType === "url") {
      const destination = sanitizePublicUrl(config.destinationUrl);
      if (!destination) throw new NfcHttpError("Destino inválido.", 400, "UNSAFE_URL");
      redirectUrl = appendSafeParams(destination, config.extraParams);
    } else if (actionType === "professional_profile") {
      const resolved = await toProfessionalProfilePublicAction(admin, tag);
      if (!resolved.ok) {
        throw new NfcHttpError(
          resolved.message,
          resolved.state === "inactive" ? 409 : 404,
          resolved.state === "inactive" ? "CARD_INACTIVE" : "PROFILE_UNAVAILABLE"
        );
      }
      const source = parseNfcScanSource(
        input.source ?? new URL(input.request.url).searchParams.get("source")
      );
      redirectUrl = buildProfileRedirectPath(resolved.action.profile!.slug, source);
      successMessage = resolved.action.loadingMessage || successMessage;

      const profileId = tag.action_config?.profileId ?? config.profileId;
      if (profileId) {
        const card = await findProfileCardByTagId(admin, tag.id);
        const { recordProfileEvent } = await import("@/lib/profiles/metrics-record");
        void recordProfileEvent({
          profileId,
          cardId: card?.id ?? null,
          eventType: source === "qr" ? "qr_scan" : "nfc_scan",
          source,
          locale: resolved.action.profile?.locale ?? "pt-BR",
        });
      }
    } else if (actionType === "form") {
      formData = validateFormData(config, input.formData ?? {});
      await validateDirectorySelections(admin, config, formData);
      const { error } = await admin.from("nfc_form_submissions").insert({
        tag_id: tag.id,
        scan_id: input.scanId,
        submitted_by: identity.profileId,
        data: formData,
      });
      if (error) throw new NfcHttpError("Não foi possível salvar a resposta.", 500, "FORM_SAVE_FAILED");
      if (config.workflowKey) responseStatus = await callN8n(tag, input.scanId, identity, input.anonymousSessionId, config, formData, idempotencyKey);
    } else if (actionType === "webhook" || actionType === "whatsapp") {
      formData = actionType === "whatsapp" ? { phone: input.phone ?? config.fixedPhone ?? null } : {};
      responseStatus = await callN8n(tag, input.scanId, identity, input.anonymousSessionId, config, formData, idempotencyKey);
    } else if (actionType === "sequence") {
      for (const step of config.sequence ?? []) {
        if (step.type === "webhook") {
          const stepConfig = { ...config, ...(step.config ?? {}) } as NfcActionConfig;
          responseStatus = await callN8n(tag, input.scanId, identity, input.anonymousSessionId, stepConfig, input.formData ?? {}, idempotencyKey);
        }
      }
    } else if (actionType === "asset_loan") {
      successMessage = await executeAssetLoan(admin, tag, identity, input, config);
    }

    const duration = Date.now() - started;
    await Promise.all([
      admin
        .from("nfc_action_executions")
        .update({ status: "success", response_status: responseStatus, execution_time_ms: duration })
        .eq("id", execution.id),
      admin
        .from("nfc_tag_scans")
        .update({ result_status: "completed", execution_time_ms: duration, error_code: null })
        .eq("id", input.scanId),
    ]);
    return {
      status: "success",
      message: successMessage,
      redirectUrl,
    };
  } catch (error) {
    const sanitized =
      error instanceof NfcHttpError
        ? { code: error.code, message: error.message }
        : sanitizeTechnicalError(error);
    const duration = Date.now() - started;
    await Promise.all([
      admin
        .from("nfc_action_executions")
        .update({
          status: "error",
          execution_time_ms: duration,
          error_code: sanitized.code,
          error_message_sanitized: sanitized.message,
        })
        .eq("id", execution.id),
      admin
        .from("nfc_tag_scans")
        .update({ result_status: "error", execution_time_ms: duration, error_code: sanitized.code })
        .eq("id", input.scanId),
    ]);
    if (error instanceof NfcHttpError) throw error;
    throw new NfcHttpError(sanitized.message, 502, sanitized.code);
  }
}

export function toApiError(error: unknown): { status: number; body: { error: string; code: string } } {
  if (error instanceof NfcHttpError) {
    return { status: error.status, body: { error: error.message, code: error.code } };
  }
  return {
    status: 500,
    body: { error: "Ocorreu um erro inesperado.", code: "INTERNAL_ERROR" },
  };
}
