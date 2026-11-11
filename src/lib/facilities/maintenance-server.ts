import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { isOneOff, MAINTENANCE_PERIODICITIES, MAINTENANCE_TYPES, nextDueAfter, type MaintenancePeriodicity } from "./maintenance";
import {
  createFacilitiesAdminClient,
  FacilitiesHttpError,
  listFacilitiesPeople,
  money,
  optionalInt,
  optionalIsoDate,
  optionalText,
  parse,
  requireFacilitiesUser,
  safeFileName,
  SIGNED_URL_SECONDS,
} from "./server";
import {
  ASSET_CATEGORIES,
  FACILITIES_BUCKET,
  FACILITIES_FILE_MAX_BYTES,
  facilitiesFileType,
  MAINTENANCE_DOCUMENT_KINDS,
  type FacilityAsset,
  type MaintenanceData,
  type MaintenanceDocument,
  type MaintenancePlan,
  type MaintenanceRecord,
  type MaintenanceSupplierOption,
} from "./types";

const ASSET_COLUMNS =
  "id, name, category, location, manufacturer, model, asset_tag, installed_on, warranty_until, criticality, notes, active";
const PLAN_COLUMNS =
  "id, asset_id, title, maintenance_type, periodicity, custom_interval_days, supplier_id, contract_id, responsible_user_id, estimated_cost, last_done_on, next_due_on, status, notes";
const RECORD_COLUMNS = "id, plan_id, done_on, cost, supplier_id, notes, created_at";
const DOCUMENT_COLUMNS = "id, plan_id, record_id, kind, title, storage_path, file_name, external_url, created_at";

const toNumber = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));

function fail(label: string, error: { message: string } | null): never {
  console.error(`[manutencao] ${label}:`, error);
  throw new FacilitiesHttpError(`Falha ao ${label}.`, 500, "QUERY_FAILED");
}

/* ------------------------------------------------------------ leitura */

async function loadPlans(db: SupabaseClient, ids?: string[]): Promise<MaintenancePlan[]> {
  const scoped = (table: string, columns: string, column: string) => {
    const query = db.from(table).select(columns);
    return ids ? query.in(column, ids) : query;
  };
  const [plans, records, documents] = await Promise.all([
    scoped("maintenance_plans", PLAN_COLUMNS, "id").order("next_due_on", { nullsFirst: false }),
    scoped("maintenance_records", RECORD_COLUMNS, "plan_id").order("done_on", { ascending: false }),
    scoped("maintenance_documents", DOCUMENT_COLUMNS, "plan_id").order("created_at", { ascending: false }),
  ]);
  if (plans.error) fail("carregar os planos", plans.error);
  if (records.error) fail("carregar as execuções", records.error);
  if (documents.error) fail("carregar os documentos", documents.error);

  const recordsBy = new Map<string, MaintenanceRecord[]>();
  for (const row of (records.data ?? []) as unknown as MaintenanceRecord[]) {
    recordsBy.set(row.plan_id, [...(recordsBy.get(row.plan_id) ?? []), { ...row, cost: toNumber(row.cost) }]);
  }
  const documentsBy = new Map<string, MaintenanceDocument[]>();
  for (const row of (documents.data ?? []) as unknown as Array<Omit<MaintenanceDocument, "has_file"> & { storage_path: string | null }>) {
    const { storage_path, ...rest } = row;
    documentsBy.set(row.plan_id, [...(documentsBy.get(row.plan_id) ?? []), { ...rest, has_file: Boolean(storage_path) }]);
  }
  return ((plans.data ?? []) as unknown as Omit<MaintenancePlan, "records" | "documents">[]).map((plan) => ({
    ...plan,
    estimated_cost: toNumber(plan.estimated_cost),
    records: recordsBy.get(plan.id) ?? [],
    documents: documentsBy.get(plan.id) ?? [],
  }));
}

async function loadPlan(db: SupabaseClient, id: string): Promise<MaintenancePlan> {
  const [plan] = await loadPlans(db, [id]);
  if (!plan) throw new FacilitiesHttpError("Plano de manutenção não encontrado.", 404, "NOT_FOUND");
  return plan;
}

/** Fornecedores e prestadores ativos, com os contratos vigentes (para vincular ao plano). */
async function loadSupplierOptions(db: SupabaseClient): Promise<MaintenanceSupplierOption[]> {
  const [suppliers, contracts] = await Promise.all([
    db.from("event_suppliers").select("id, name, category, party_type").eq("active", true).order("name"),
    db.from("supplier_contracts").select("id, supplier_id, title").neq("status", "encerrado").order("title"),
  ]);
  if (suppliers.error) fail("carregar os prestadores", suppliers.error);
  const contractsBy = new Map<string, Array<{ id: string; title: string }>>();
  for (const c of (contracts.data ?? []) as Array<{ id: string; supplier_id: string; title: string }>) {
    contractsBy.set(c.supplier_id, [...(contractsBy.get(c.supplier_id) ?? []), { id: c.id, title: c.title }]);
  }
  return ((suppliers.data ?? []) as Array<Omit<MaintenanceSupplierOption, "contracts">>).map((s) => ({
    ...s,
    contracts: contractsBy.get(s.id) ?? [],
  }));
}

export async function loadMaintenanceData(): Promise<MaintenanceData> {
  await requireFacilitiesUser();
  const db = createFacilitiesAdminClient();
  const [assets, plans, suppliers, people] = await Promise.all([
    db.from("facility_assets").select(ASSET_COLUMNS).order("name"),
    loadPlans(db),
    loadSupplierOptions(db),
    listFacilitiesPeople(),
  ]);
  if (assets.error) fail("carregar os ativos", assets.error);
  return { assets: (assets.data ?? []) as unknown as FacilityAsset[], plans, suppliers, people };
}

/* ------------------------------------------------------------ ativos */

const assetSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao equipamento ou instalação.").max(160),
  category: z.enum(ASSET_CATEGORIES),
  location: optionalText(160),
  manufacturer: optionalText(120),
  model: optionalText(120),
  asset_tag: optionalText(80),
  installed_on: optionalIsoDate,
  warranty_until: optionalIsoDate,
  criticality: z.enum(["alta", "media", "baixa"]),
  notes: optionalText(4000),
  active: z.boolean(),
});

async function loadAsset(db: SupabaseClient, id: string): Promise<FacilityAsset> {
  const { data, error } = await db.from("facility_assets").select(ASSET_COLUMNS).eq("id", id).maybeSingle();
  if (error || !data) throw new FacilitiesHttpError("Ativo não encontrado.", 404, "NOT_FOUND");
  return data as unknown as FacilityAsset;
}

export async function createAsset(input: unknown): Promise<FacilityAsset> {
  const user = await requireFacilitiesUser();
  const db = createFacilitiesAdminClient();
  const row = parse(assetSchema, input);
  const { data, error } = await db.from("facility_assets").insert({ ...row, created_by: user.profileId }).select("id").single();
  if (error || !data) fail("cadastrar o ativo", error);
  return loadAsset(db, data.id as string);
}

export async function updateAsset(id: string, input: unknown): Promise<FacilityAsset> {
  await requireFacilitiesUser();
  const db = createFacilitiesAdminClient();
  const { error } = await db.from("facility_assets").update(parse(assetSchema, input)).eq("id", id);
  if (error) fail("salvar o ativo", error);
  return loadAsset(db, id);
}

export async function deleteAsset(id: string): Promise<void> {
  await requireFacilitiesUser();
  const db = createFacilitiesAdminClient();
  const { count } = await db.from("maintenance_plans").select("id", { count: "exact", head: true }).eq("asset_id", id);
  if ((count ?? 0) > 0) {
    throw new FacilitiesHttpError("O ativo tem planos de manutenção: desative em vez de excluir.", 409, "IN_USE");
  }
  const { error } = await db.from("facility_assets").delete().eq("id", id);
  if (error) fail("excluir o ativo", error);
}

/* ------------------------------------------------------------ planos */

const planSchema = z
  .object({
    asset_id: z.string().uuid().nullable(),
    title: z.string().trim().min(1, "Diga o que será feito.").max(200),
    maintenance_type: z.enum(MAINTENANCE_TYPES),
    periodicity: z.enum(MAINTENANCE_PERIODICITIES),
    custom_interval_days: optionalInt(1, 1095),
    supplier_id: z.string().uuid().nullable(),
    contract_id: z.string().uuid().nullable(),
    responsible_user_id: z.string().uuid().nullable(),
    estimated_cost: money,
    last_done_on: optionalIsoDate,
    next_due_on: optionalIsoDate,
    status: z.enum(["ativo", "pausado", "concluido"]),
    notes: optionalText(4000),
  })
  .superRefine((value, ctx) => {
    if (value.periodicity === "personalizada" && !value.custom_interval_days) {
      ctx.addIssue({ code: "custom", path: ["custom_interval_days"], message: "Informe o intervalo em dias da periodicidade personalizada." });
    }
  })
  // Sem próxima data informada, ela sai da última execução + a periodicidade.
  .transform((value) => ({
    ...value,
    custom_interval_days: value.periodicity === "personalizada" ? value.custom_interval_days : null,
    next_due_on:
      value.next_due_on ??
      (value.last_done_on ? nextDueAfter(value.last_done_on, value.periodicity, value.custom_interval_days) : null),
  }));

export async function createPlan(input: unknown): Promise<MaintenancePlan> {
  const user = await requireFacilitiesUser();
  const db = createFacilitiesAdminClient();
  const row = parse(planSchema, input);
  const { data, error } = await db
    .from("maintenance_plans")
    .insert({ ...row, created_by: user.profileId, updated_by: user.profileId })
    .select("id")
    .single();
  if (error || !data) fail("cadastrar o plano", error);
  return loadPlan(db, data.id as string);
}

export async function updatePlan(id: string, input: unknown): Promise<MaintenancePlan> {
  const user = await requireFacilitiesUser();
  const db = createFacilitiesAdminClient();
  const { error } = await db.from("maintenance_plans").update({ ...parse(planSchema, input), updated_by: user.profileId }).eq("id", id);
  if (error) fail("salvar o plano", error);
  return loadPlan(db, id);
}

async function removeStoredFiles(db: SupabaseClient, column: "plan_id" | "record_id" | "id", id: string) {
  const { data } = await db.from("maintenance_documents").select("storage_path").eq(column, id).not("storage_path", "is", null);
  const paths = (data ?? []).map((row) => row.storage_path as string);
  // Best-effort: arquivo órfão no bucket não impede a exclusão do registro.
  if (paths.length) await db.storage.from(FACILITIES_BUCKET).remove(paths);
}

export async function deletePlan(id: string): Promise<void> {
  await requireFacilitiesUser();
  const db = createFacilitiesAdminClient();
  await removeStoredFiles(db, "plan_id", id);
  const { error } = await db.from("maintenance_plans").delete().eq("id", id);
  if (error) fail("excluir o plano", error);
}

/* ------------------------------------------------------------ execuções */

const recordSchema = z.object({
  done_on: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data em que a manutenção foi feita."),
  cost: money,
  supplier_id: z.string().uuid().nullable(),
  notes: optionalText(4000),
});

/** Recalcula última e próxima data a partir das execuções que sobraram. */
async function refreshPlanDates(db: SupabaseClient, planId: string) {
  const { data: plan } = await db.from("maintenance_plans").select("periodicity, custom_interval_days, status").eq("id", planId).single();
  const { data: last } = await db
    .from("maintenance_records")
    .select("done_on")
    .eq("plan_id", planId)
    .order("done_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!plan) return;
  const periodicity = plan.periodicity as MaintenancePeriodicity;
  const lastDone = (last?.done_on as string | undefined) ?? null;
  const patch: Record<string, unknown> = { last_done_on: lastDone };
  if (lastDone) {
    patch.next_due_on = nextDueAfter(lastDone, periodicity, plan.custom_interval_days as number | null);
    if (isOneOff(periodicity)) patch.status = "concluido";
  } else if (plan.status === "concluido") {
    patch.status = "ativo";
  }
  await db.from("maintenance_plans").update(patch).eq("id", planId);
}

/** "Registrar manutenção feita": guarda a execução e avança a próxima data. */
export async function createRecord(planId: string, input: unknown): Promise<MaintenancePlan> {
  const user = await requireFacilitiesUser();
  const db = createFacilitiesAdminClient();
  const row = parse(recordSchema, input);
  const { error } = await db.from("maintenance_records").insert({ ...row, plan_id: planId, created_by: user.profileId });
  if (error) fail("registrar a manutenção", error);
  await refreshPlanDates(db, planId);
  return loadPlan(db, planId);
}

export async function deleteRecord(id: string): Promise<MaintenancePlan> {
  await requireFacilitiesUser();
  const db = createFacilitiesAdminClient();
  const { data } = await db.from("maintenance_records").select("plan_id").eq("id", id).maybeSingle();
  if (!data) throw new FacilitiesHttpError("Execução não encontrada.", 404, "NOT_FOUND");
  await removeStoredFiles(db, "record_id", id);
  const { error } = await db.from("maintenance_records").delete().eq("id", id);
  if (error) fail("excluir a execução", error);
  await refreshPlanDates(db, data.plan_id as string);
  return loadPlan(db, data.plan_id as string);
}

/* ------------------------------------------------------------ documentos */

const uploadSchema = z.object({
  plan_id: z.string().uuid(),
  file_name: z.string().trim().min(1).max(255),
  size_bytes: z.number().int().positive(),
});

/** URL assinada para subir laudo, NF, OS ou PMOC direto no bucket privado. */
export async function createMaintenanceUpload(input: unknown): Promise<{ path: string; token: string; content_type: string }> {
  await requireFacilitiesUser();
  const value = parse(uploadSchema, input);
  const contentType = facilitiesFileType(value.file_name);
  if (!contentType) throw new FacilitiesHttpError("Envie PDF, imagem (JPG, PNG, WebP) ou Word.", 415, "UNSUPPORTED_TYPE");
  if (value.size_bytes > FACILITIES_FILE_MAX_BYTES) throw new FacilitiesHttpError("O arquivo passa de 50 MB.", 413, "TOO_LARGE");
  const path = `manutencao/${value.plan_id}/${Date.now()}-${safeFileName(value.file_name)}`;
  const { data, error } = await createFacilitiesAdminClient().storage.from(FACILITIES_BUCKET).createSignedUploadUrl(path);
  if (error || !data) fail("preparar o envio do arquivo", error);
  return { path: data.path, token: data.token, content_type: contentType };
}

const documentSchema = z
  .object({
    plan_id: z.string().uuid(),
    record_id: z.string().uuid().nullable(),
    kind: z.enum(MAINTENANCE_DOCUMENT_KINDS),
    title: optionalText(200),
    storage_path: z.string().max(500).nullable(),
    file_name: z.string().trim().max(255).nullable(),
    size_bytes: z.number().int().positive().nullable(),
    external_url: z
      .string()
      .trim()
      .max(1000)
      .nullable()
      .transform((url) => url || null),
  })
  .superRefine((value, ctx) => {
    if (!value.storage_path && !value.external_url) ctx.addIssue({ code: "custom", path: ["external_url"], message: "Envie o arquivo ou cole o link." });
    if (value.storage_path && !value.storage_path.startsWith(`manutencao/${value.plan_id}/`)) {
      ctx.addIssue({ code: "custom", path: ["storage_path"], message: "Arquivo de outro plano." });
    }
    if (value.external_url && !/^https?:\/\//i.test(value.external_url)) {
      ctx.addIssue({ code: "custom", path: ["external_url"], message: "O link precisa começar com http:// ou https://." });
    }
  });

export async function createMaintenanceDocument(input: unknown): Promise<MaintenancePlan> {
  const user = await requireFacilitiesUser();
  const db = createFacilitiesAdminClient();
  const value = parse(documentSchema, input);
  const { error } = await db.from("maintenance_documents").insert({
    ...value,
    content_type: value.file_name ? facilitiesFileType(value.file_name) : null,
    uploaded_by: user.profileId,
  });
  if (error) fail("registrar o arquivo", error);
  return loadPlan(db, value.plan_id);
}

export async function deleteMaintenanceDocument(id: string): Promise<MaintenancePlan> {
  await requireFacilitiesUser();
  const db = createFacilitiesAdminClient();
  const { data } = await db.from("maintenance_documents").select("plan_id").eq("id", id).maybeSingle();
  if (!data) throw new FacilitiesHttpError("Arquivo não encontrado.", 404, "NOT_FOUND");
  await removeStoredFiles(db, "id", id);
  await db.from("maintenance_documents").delete().eq("id", id);
  return loadPlan(db, data.plan_id as string);
}

export async function maintenanceDocumentUrl(id: string, download: boolean): Promise<string> {
  await requireFacilitiesUser();
  const db = createFacilitiesAdminClient();
  const { data } = await db.from("maintenance_documents").select("storage_path, file_name, external_url").eq("id", id).maybeSingle();
  if (!data) throw new FacilitiesHttpError("Arquivo não encontrado.", 404, "NOT_FOUND");
  if (!data.storage_path) return data.external_url as string;
  const { data: signed, error } = await db.storage
    .from(FACILITIES_BUCKET)
    .createSignedUrl(data.storage_path as string, SIGNED_URL_SECONDS, download ? { download: (data.file_name as string) ?? true } : undefined);
  if (error || !signed) fail("abrir o arquivo", error);
  return signed.signedUrl;
}
