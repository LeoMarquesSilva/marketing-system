import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient as createSsrClient } from "@/utils/supabase/server";
import { hasFacilitiesAccess } from "@/lib/access-control";
import { onlyDigits } from "@/lib/masks-br";
import {
  ADJUSTMENT_INDEXES,
  CONTRACT_STATUSES,
  DOCUMENT_KINDS,
  FACILITIES_BUCKET,
  FACILITIES_FILE_MAX_BYTES,
  facilitiesFileType,
  FISCAL_DOCUMENTS,
  FORMALIZATIONS,
  PAYMENT_METHODS,
  PERIODICITIES,
  VALUE_PERIODS,
  type FacilitiesPerson,
  type FacilitiesSupplier,
  type SupplierContract,
  type SupplierDocument,
  type SupplierService,
} from "./types";

export class FacilitiesHttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string
  ) {
    super(message);
    this.name = "FacilitiesHttpError";
  }
}

export function toFacilitiesApiError(error: unknown): { status: number; body: { error: string; code: string } } {
  if (error instanceof FacilitiesHttpError) {
    return { status: error.status, body: { error: error.message, code: error.code } };
  }
  console.error("[facilities]", error);
  return { status: 500, body: { error: "Erro interno.", code: "INTERNAL" } };
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SIGNED_URL_SECONDS = 10 * 60;

export function createFacilitiesAdminClient(): SupabaseClient {
  if (!serviceKey) {
    throw new FacilitiesHttpError("SUPABASE_SERVICE_ROLE_KEY não configurada.", 503, "SERVICE_UNAVAILABLE");
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export interface FacilitiesUser {
  profileId: string;
  name: string;
}

/** Sessão + permissão /facilities (admin ou liberação manual em Usuários). */
export async function requireFacilitiesUser(): Promise<FacilitiesUser> {
  const ssr = await createSsrClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) throw new FacilitiesHttpError("Não autenticado.", 401, "UNAUTHENTICATED");

  const { data, error } = await createFacilitiesAdminClient()
    .from("users")
    .select("id, name, role, permissions")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (error || !data) throw new FacilitiesHttpError("Não foi possível validar o acesso.", 500, "ACCESS_LOOKUP_FAILED");
  if (!hasFacilitiesAccess({ role: data.role as string | null, permissions: data.permissions as string[] | null })) {
    throw new FacilitiesHttpError("Você não tem acesso a Fornecedores e contratos.", 403, "FORBIDDEN");
  }
  return { profileId: data.id as string, name: data.name as string };
}

/* ------------------------------------------------------------------ leitura */

const SUPPLIER_COLUMNS =
  "id, name, legal_name, document, person_type, category, areas, contact_name, phone, email, website_link, whatsapp_link, city, rating, notes, active, responsible_user_id, source, created_at, updated_at";
const SERVICE_COLUMNS =
  "id, supplier_id, description, area, shared_cost, payer, periodicity, due_day, amount, payment_method, payment_details, fiscal_document, notes, active";
const CONTRACT_COLUMNS =
  "id, supplier_id, title, object, status, formalization, contracting_party, start_date, end_date, auto_renew, renewal_months, notice_days, adjustment_index, adjustment_month, value, value_period, responsible_user_id, sharepoint_url, notes, created_at, updated_at";
const DOCUMENT_COLUMNS =
  "id, supplier_id, contract_id, kind, title, storage_path, file_name, content_type, size_bytes, external_url, valid_until, created_at";

type SupplierRow = Omit<FacilitiesSupplier, "services" | "contracts" | "documents" | "events_count">;
type DocumentRow = Omit<SupplierDocument, "has_file"> & { storage_path: string | null };

const toNumber = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));

function toDocument(row: DocumentRow): SupplierDocument {
  const { storage_path, ...rest } = row;
  return { ...rest, size_bytes: toNumber(rest.size_bytes), has_file: Boolean(storage_path) };
}

function groupBy<T extends { supplier_id: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) map.set(row.supplier_id, [...(map.get(row.supplier_id) ?? []), row]);
  return map;
}

async function loadSuppliers(db: SupabaseClient, ids?: string[]): Promise<FacilitiesSupplier[]> {
  const select = (table: string, columns: string, column: string) => {
    const query = db.from(table).select(columns);
    return ids ? query.in(column, ids) : query;
  };

  const [suppliers, services, contracts, documents, usage] = await Promise.all([
    select("event_suppliers", SUPPLIER_COLUMNS, "id").order("name"),
    select("supplier_services", SERVICE_COLUMNS, "supplier_id").order("created_at"),
    select("supplier_contracts", CONTRACT_COLUMNS, "supplier_id").order("end_date", { nullsFirst: false }),
    select("supplier_documents", DOCUMENT_COLUMNS, "supplier_id").order("created_at", { ascending: false }),
    select("event_supplier_event_usage", "supplier_id", "supplier_id"),
  ]);
  const failed = [suppliers, services, contracts, documents, usage].find((result) => result.error);
  if (failed?.error) {
    console.error("[facilities] lista:", failed.error);
    throw new FacilitiesHttpError("Falha ao carregar os fornecedores.", 500, "QUERY_FAILED");
  }

  const servicesBy = groupBy(
    ((services.data ?? []) as unknown as SupplierService[]).map((s) => ({ ...s, amount: toNumber(s.amount) }))
  );
  const contractsBy = groupBy(
    ((contracts.data ?? []) as unknown as SupplierContract[]).map((c) => ({ ...c, value: toNumber(c.value) }))
  );
  const documentsBy = groupBy(((documents.data ?? []) as unknown as DocumentRow[]).map(toDocument));
  const eventsCount = new Map<string, number>();
  for (const row of (usage.data ?? []) as unknown as Array<{ supplier_id: string }>) {
    eventsCount.set(row.supplier_id, (eventsCount.get(row.supplier_id) ?? 0) + 1);
  }

  return ((suppliers.data ?? []) as unknown as SupplierRow[]).map((row) => ({
    ...row,
    areas: row.areas ?? [],
    rating: toNumber(row.rating),
    services: servicesBy.get(row.id) ?? [],
    contracts: contractsBy.get(row.id) ?? [],
    documents: documentsBy.get(row.id) ?? [],
    events_count: eventsCount.get(row.id) ?? 0,
  }));
}

async function loadSupplier(db: SupabaseClient, id: string): Promise<FacilitiesSupplier> {
  const [supplier] = await loadSuppliers(db, [id]);
  if (!supplier) throw new FacilitiesHttpError("Fornecedor não encontrado.", 404, "NOT_FOUND");
  return supplier;
}

export async function listSuppliers(): Promise<FacilitiesSupplier[]> {
  await requireFacilitiesUser();
  return loadSuppliers(createFacilitiesAdminClient());
}

/** Pessoas que podem ser responsáveis por fornecedor/contrato (usuários ativos, com foto). */
export async function listFacilitiesPeople(): Promise<FacilitiesPerson[]> {
  await requireFacilitiesUser();
  const { data, error } = await createFacilitiesAdminClient()
    .from("users")
    .select("id, name, avatar_url")
    .eq("is_active", true)
    .order("name");
  if (error) throw new FacilitiesHttpError("Falha ao carregar as pessoas.", 500, "QUERY_FAILED");
  return (data ?? []) as FacilitiesPerson[];
}

/* -------------------------------------------------------------- validação */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "Texto muito longo.")
    .transform((value) => value || null);
const optionalIsoDate = z
  .string()
  .trim()
  .transform((value) => value || null)
  .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), "Data inválida.");
const optionalUrl = z
  .string()
  .trim()
  .max(1000)
  .transform((value) => value || null)
  .refine((value) => value === null || /^https?:\/\//i.test(value), "O link precisa começar com http:// ou https://.");
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.union([z.enum(values), z.literal("")]).transform((value) => (value === "" ? null : value));
const optionalInt = (min: number, max: number) => z.number().int().min(min).max(max).nullable();
const money = z.number().min(0, "Valor não pode ser negativo.").max(99_999_999).nullable();

const supplierSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do fornecedor.").max(160),
  legal_name: optionalText(200),
  document: z
    .string()
    .transform(onlyDigits)
    .refine((value) => value === "" || value.length === 11 || value.length === 14, "CNPJ ou CPF incompleto.")
    .transform((value) => value || null),
  category: z.string().trim().min(1, "Escolha a categoria.").max(60),
  areas: z.array(z.string().trim().min(1).max(80)).max(20),
  contact_name: optionalText(160),
  phone: optionalText(40),
  email: optionalText(160),
  website_link: optionalUrl,
  whatsapp_link: optionalUrl,
  city: optionalText(120),
  rating: z.number().min(0).max(5).nullable(),
  notes: optionalText(4000),
  active: z.boolean(),
  responsible_user_id: z.string().uuid().nullable(),
});

const serviceSchema = z.object({
  description: z.string().trim().min(1, "Descreva o serviço.").max(300),
  area: optionalText(80),
  shared_cost: z.boolean(),
  payer: optionalText(120),
  periodicity: z.enum(PERIODICITIES),
  due_day: optionalInt(1, 31),
  amount: money,
  payment_method: optionalEnum(PAYMENT_METHODS),
  payment_details: optionalText(500),
  fiscal_document: optionalEnum(FISCAL_DOCUMENTS),
  notes: optionalText(2000),
  active: z.boolean(),
});

const contractSchema = z
  .object({
    title: z.string().trim().min(1, "Dê um título ao contrato.").max(200),
    object: optionalText(4000),
    status: z.enum(CONTRACT_STATUSES),
    formalization: z.enum(FORMALIZATIONS),
    contracting_party: optionalText(120),
    start_date: optionalIsoDate,
    end_date: optionalIsoDate,
    auto_renew: z.boolean(),
    renewal_months: optionalInt(1, 120),
    notice_days: optionalInt(0, 365),
    adjustment_index: optionalEnum(ADJUSTMENT_INDEXES),
    adjustment_month: optionalInt(1, 12),
    value: money,
    value_period: z.enum(VALUE_PERIODS),
    responsible_user_id: z.string().uuid().nullable(),
    sharepoint_url: optionalUrl,
    notes: optionalText(4000),
  })
  .superRefine((value, ctx) => {
    if (value.start_date && value.end_date && value.end_date < value.start_date) {
      ctx.addIssue({ code: "custom", path: ["end_date"], message: "O fim da vigência não pode ser antes do início." });
    }
  })
  // Renovação automática sem prazo informado renova por 12 meses (o mais comum).
  .transform((value) => ({ ...value, renewal_months: value.auto_renew ? (value.renewal_months ?? 12) : null }));

const documentBaseSchema = z.object({
  supplier_id: z.string().uuid(),
  contract_id: z.string().uuid().nullable(),
  kind: z.enum(DOCUMENT_KINDS),
  title: optionalText(200),
  valid_until: optionalIsoDate,
});

function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.output<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new FacilitiesHttpError(parsed.error.issues[0]?.message ?? "Dados inválidos.", 400, "INVALID_INPUT");
  }
  return parsed.data;
}

async function assertDocumentAvailable(db: SupabaseClient, document: string | null, exceptId?: string) {
  if (!document) return;
  let query = db.from("event_suppliers").select("id, name").eq("document", document);
  if (exceptId) query = query.neq("id", exceptId);
  const { data } = await query.maybeSingle();
  if (data) {
    throw new FacilitiesHttpError(`Já existe um fornecedor com este CNPJ/CPF: ${data.name as string}.`, 409, "DUPLICATE_DOCUMENT");
  }
}

function supplierRow(input: unknown) {
  const value = parse(supplierSchema, input);
  return { ...value, person_type: value.document ? (value.document.length === 14 ? "pj" : "pf") : null };
}

/* ------------------------------------------------------------ fornecedores */

export async function createSupplier(input: unknown): Promise<FacilitiesSupplier> {
  await requireFacilitiesUser();
  const db = createFacilitiesAdminClient();
  const row = supplierRow(input);
  await assertDocumentAvailable(db, row.document);
  const { data, error } = await db.from("event_suppliers").insert(row).select("id").single();
  if (error || !data) {
    console.error("[facilities] cria fornecedor:", error);
    throw new FacilitiesHttpError("Não foi possível cadastrar o fornecedor.", 500, "WRITE_FAILED");
  }
  return loadSupplier(db, data.id as string);
}

export async function updateSupplier(id: string, input: unknown): Promise<FacilitiesSupplier> {
  await requireFacilitiesUser();
  const db = createFacilitiesAdminClient();
  const row = supplierRow(input);
  await assertDocumentAvailable(db, row.document, id);
  const { error } = await db.from("event_suppliers").update({ ...row, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) {
    console.error("[facilities] atualiza fornecedor:", error);
    throw new FacilitiesHttpError("Não foi possível salvar o fornecedor.", 500, "WRITE_FAILED");
  }
  return loadSupplier(db, id);
}

async function removeStoredFiles(db: SupabaseClient, column: "supplier_id" | "contract_id" | "id", id: string) {
  const { data } = await db.from("supplier_documents").select("storage_path").eq(column, id).not("storage_path", "is", null);
  const paths = (data ?? []).map((row) => row.storage_path as string);
  // Best-effort: arquivo órfão no bucket não impede a exclusão do registro.
  if (paths.length) await db.storage.from(FACILITIES_BUCKET).remove(paths);
}

export async function deleteSupplier(id: string): Promise<void> {
  await requireFacilitiesUser();
  const db = createFacilitiesAdminClient();
  const [usage, quotes] = await Promise.all([
    db.from("event_supplier_event_usage").select("id", { count: "exact", head: true }).eq("supplier_id", id),
    db.from("event_supplier_quotes").select("id", { count: "exact", head: true }).eq("supplier_id", id),
  ]);
  if ((usage.count ?? 0) > 0 || (quotes.count ?? 0) > 0) {
    throw new FacilitiesHttpError("Fornecedor usado em eventos: inative em vez de excluir.", 409, "IN_USE");
  }
  await removeStoredFiles(db, "supplier_id", id);
  const { error } = await db.from("event_suppliers").delete().eq("id", id);
  if (error) throw new FacilitiesHttpError("Não foi possível excluir o fornecedor.", 500, "WRITE_FAILED");
}

/* ---------------------------------------------------------------- serviços */

export async function createService(supplierId: string, input: unknown): Promise<FacilitiesSupplier> {
  const user = await requireFacilitiesUser();
  const db = createFacilitiesAdminClient();
  const row = parse(serviceSchema, input);
  const { error } = await db.from("supplier_services").insert({ ...row, supplier_id: supplierId, created_by: user.profileId });
  if (error) {
    console.error("[facilities] cria serviço:", error);
    throw new FacilitiesHttpError("Não foi possível salvar o serviço.", 500, "WRITE_FAILED");
  }
  return loadSupplier(db, supplierId);
}

async function supplierOf(db: SupabaseClient, table: string, id: string): Promise<string> {
  const { data } = await db.from(table).select("supplier_id").eq("id", id).maybeSingle();
  if (!data) throw new FacilitiesHttpError("Registro não encontrado.", 404, "NOT_FOUND");
  return data.supplier_id as string;
}

export async function updateService(id: string, input: unknown): Promise<FacilitiesSupplier> {
  await requireFacilitiesUser();
  const db = createFacilitiesAdminClient();
  const row = parse(serviceSchema, input);
  const supplierId = await supplierOf(db, "supplier_services", id);
  const { error } = await db.from("supplier_services").update(row).eq("id", id);
  if (error) throw new FacilitiesHttpError("Não foi possível salvar o serviço.", 500, "WRITE_FAILED");
  return loadSupplier(db, supplierId);
}

export async function deleteService(id: string): Promise<FacilitiesSupplier> {
  await requireFacilitiesUser();
  const db = createFacilitiesAdminClient();
  const supplierId = await supplierOf(db, "supplier_services", id);
  const { error } = await db.from("supplier_services").delete().eq("id", id);
  if (error) throw new FacilitiesHttpError("Não foi possível excluir o serviço.", 500, "WRITE_FAILED");
  return loadSupplier(db, supplierId);
}

/* --------------------------------------------------------------- contratos */

const attachSchema = z.array(z.string().uuid()).max(20).default([]);

/** Arquivos já enviados (ex.: o PDF lido pela IA) passam a pertencer ao contrato salvo. */
async function attachDocuments(db: SupabaseClient, supplierId: string, contractId: string, ids: string[]) {
  if (!ids.length) return;
  await db.from("supplier_documents").update({ contract_id: contractId }).in("id", ids).eq("supplier_id", supplierId);
}

export async function createContract(
  supplierId: string,
  input: unknown,
  attach: unknown
): Promise<FacilitiesSupplier> {
  const user = await requireFacilitiesUser();
  const db = createFacilitiesAdminClient();
  const row = parse(contractSchema, input);
  const { data, error } = await db
    .from("supplier_contracts")
    .insert({ ...row, supplier_id: supplierId, created_by: user.profileId, updated_by: user.profileId })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[facilities] cria contrato:", error);
    throw new FacilitiesHttpError("Não foi possível salvar o contrato.", 500, "WRITE_FAILED");
  }
  await attachDocuments(db, supplierId, data.id as string, parse(attachSchema, attach));
  return loadSupplier(db, supplierId);
}

export async function updateContract(id: string, input: unknown, attach: unknown): Promise<FacilitiesSupplier> {
  const user = await requireFacilitiesUser();
  const db = createFacilitiesAdminClient();
  const row = parse(contractSchema, input);
  const supplierId = await supplierOf(db, "supplier_contracts", id);
  const { error } = await db.from("supplier_contracts").update({ ...row, updated_by: user.profileId }).eq("id", id);
  if (error) {
    console.error("[facilities] atualiza contrato:", error);
    throw new FacilitiesHttpError("Não foi possível salvar o contrato.", 500, "WRITE_FAILED");
  }
  await attachDocuments(db, supplierId, id, parse(attachSchema, attach));
  return loadSupplier(db, supplierId);
}

export async function deleteContract(id: string): Promise<FacilitiesSupplier> {
  await requireFacilitiesUser();
  const db = createFacilitiesAdminClient();
  const supplierId = await supplierOf(db, "supplier_contracts", id);
  await removeStoredFiles(db, "contract_id", id);
  const { error } = await db.from("supplier_contracts").delete().eq("id", id);
  if (error) throw new FacilitiesHttpError("Não foi possível excluir o contrato.", 500, "WRITE_FAILED");
  return loadSupplier(db, supplierId);
}

/* -------------------------------------------------------------- documentos */

function safeFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  const base =
    (dot > 0 ? name.slice(0, dot) : name)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 80) || "arquivo";
  return ext ? `${base}.${ext}` : base;
}

const uploadSchema = z.object({
  supplier_id: z.string().uuid(),
  file_name: z.string().trim().min(1).max(255),
  size_bytes: z.number().int().positive(),
});

/** URL assinada para o navegador subir o arquivo direto no bucket privado. */
export async function createDocumentUpload(
  input: unknown
): Promise<{ path: string; token: string; content_type: string }> {
  await requireFacilitiesUser();
  const value = parse(uploadSchema, input);
  const contentType = facilitiesFileType(value.file_name);
  if (!contentType) throw new FacilitiesHttpError("Envie PDF, imagem (JPG, PNG, WebP) ou Word.", 415, "UNSUPPORTED_TYPE");
  if (value.size_bytes > FACILITIES_FILE_MAX_BYTES) {
    throw new FacilitiesHttpError("O arquivo passa de 50 MB.", 413, "TOO_LARGE");
  }
  const path = `${value.supplier_id}/${Date.now()}-${safeFileName(value.file_name)}`;
  const { data, error } = await createFacilitiesAdminClient().storage.from(FACILITIES_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[facilities] upload assinado:", error);
    throw new FacilitiesHttpError("Não foi possível preparar o envio do arquivo.", 500, "UPLOAD_FAILED");
  }
  return { path: data.path, token: data.token, content_type: contentType };
}

const registerFileSchema = documentBaseSchema.extend({
  storage_path: z.string().min(1).max(500),
  file_name: z.string().trim().min(1).max(255),
  size_bytes: z.number().int().positive().nullable(),
});

const registerLinkSchema = documentBaseSchema.extend({
  external_url: z
    .string()
    .trim()
    .max(1000)
    .refine((value) => /^https?:\/\//i.test(value), "O link precisa começar com http:// ou https://."),
});

/** Registra um arquivo já enviado ou um link do SharePoint/OneDrive. */
export async function createDocument(input: unknown): Promise<{ supplier: FacilitiesSupplier; documentId: string }> {
  const user = await requireFacilitiesUser();
  const db = createFacilitiesAdminClient();
  const isFile = typeof input === "object" && input !== null && "storage_path" in input;
  const row = isFile
    ? (() => {
        const value = parse(registerFileSchema, input);
        if (!value.storage_path.startsWith(`${value.supplier_id}/`)) {
          throw new FacilitiesHttpError("Arquivo de outro fornecedor.", 400, "INVALID_INPUT");
        }
        return { ...value, content_type: facilitiesFileType(value.file_name) };
      })()
    : parse(registerLinkSchema, input);
  const { data, error } = await db
    .from("supplier_documents")
    .insert({ ...row, uploaded_by: user.profileId })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[facilities] registra documento:", error);
    throw new FacilitiesHttpError("Não foi possível registrar o arquivo.", 500, "WRITE_FAILED");
  }
  return { supplier: await loadSupplier(db, row.supplier_id), documentId: data.id as string };
}

export async function deleteDocument(id: string): Promise<FacilitiesSupplier> {
  await requireFacilitiesUser();
  const db = createFacilitiesAdminClient();
  const supplierId = await supplierOf(db, "supplier_documents", id);
  await removeStoredFiles(db, "id", id);
  const { error } = await db.from("supplier_documents").delete().eq("id", id);
  if (error) throw new FacilitiesHttpError("Não foi possível remover o arquivo.", 500, "WRITE_FAILED");
  return loadSupplier(db, supplierId);
}

/** URL assinada (10 min) para abrir ou baixar o arquivo; link externo volta como está. */
export async function documentUrl(id: string, download: boolean): Promise<string> {
  await requireFacilitiesUser();
  const db = createFacilitiesAdminClient();
  const { data } = await db
    .from("supplier_documents")
    .select("storage_path, file_name, external_url")
    .eq("id", id)
    .maybeSingle();
  if (!data) throw new FacilitiesHttpError("Arquivo não encontrado.", 404, "NOT_FOUND");
  if (!data.storage_path) return data.external_url as string;
  const { data: signed, error } = await db.storage
    .from(FACILITIES_BUCKET)
    .createSignedUrl(data.storage_path as string, SIGNED_URL_SECONDS, download ? { download: (data.file_name as string) ?? true } : undefined);
  if (error || !signed) throw new FacilitiesHttpError("Não foi possível abrir o arquivo.", 500, "SIGN_FAILED");
  return signed.signedUrl;
}

/** Bytes de um arquivo do bucket (leitura do contrato pela IA). */
export async function downloadDocument(id: string): Promise<{ bytes: Uint8Array; contentType: string; fileName: string }> {
  await requireFacilitiesUser();
  const db = createFacilitiesAdminClient();
  const { data } = await db.from("supplier_documents").select("storage_path, file_name").eq("id", id).maybeSingle();
  if (!data?.storage_path) throw new FacilitiesHttpError("Arquivo não encontrado.", 404, "NOT_FOUND");
  const { data: blob, error } = await db.storage.from(FACILITIES_BUCKET).download(data.storage_path as string);
  if (error || !blob) throw new FacilitiesHttpError("Não foi possível ler o arquivo.", 500, "DOWNLOAD_FAILED");
  const fileName = (data.file_name as string) ?? "contrato.pdf";
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    contentType: facilitiesFileType(fileName) ?? blob.type,
    fileName,
  };
}
