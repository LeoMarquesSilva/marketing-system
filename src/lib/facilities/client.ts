"use client";

import { supabase } from "@/utils/supabase/client";
import {
  FACILITIES_BUCKET,
  FACILITIES_FILE_MAX_BYTES,
  facilitiesFileType,
  type ContractExtraction,
  type ContractInput,
  type DocumentKind,
  type FacilitiesSupplier,
  type AssetInput,
  type FacilityAsset,
  type MaintenanceDocumentKind,
  type MaintenancePlan,
  type PlanInput,
  type RecordInput,
  type ServiceInput,
  type SupplierInput,
} from "./types";

/** Nome de fornecedor no OPEX, com o total pago em 12 meses (para ligar ao cadastro). */
export interface OpexNameRow {
  fornecedor: string;
  total: number;
  mainAccount: string;
  departments: string[];
  linkedTo: { id: string; name: string } | null;
}

/** Erro da API de Facilities, com o código e o que mais a resposta trouxer. */
export class FacilitiesApiError extends Error {
  constructor(
    message: string,
    public code: string | null,
    /** Em DUPLICATE_NAME: o cadastro que já tem o nome. */
    public existing: FacilitiesSupplier | null
  ) {
    super(message);
    this.name = "FacilitiesApiError";
  }
}

/** Cadastro com o mesmo nome que a API recusou criar (ou null se o erro for outro). */
export function duplicateNameOf(error: unknown): FacilitiesSupplier | null {
  return error instanceof FacilitiesApiError && error.code === "DUPLICATE_NAME" ? error.existing : null;
}

async function call<T>(url: string, init?: { method: string; body?: unknown }): Promise<T> {
  const response = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    code?: string;
    existing?: FacilitiesSupplier;
  };
  if (!response.ok) {
    throw new FacilitiesApiError(
      data.error ?? "Não foi possível concluir. Tente de novo.",
      data.code ?? null,
      data.existing ?? null
    );
  }
  return data;
}

type SupplierResponse = { supplier: FacilitiesSupplier };

export const facilitiesApi = {
  createSupplier: (input: SupplierInput) =>
    call<SupplierResponse>("/api/facilities/fornecedores", { method: "POST", body: input }).then((r) => r.supplier),
  updateSupplier: (id: string, input: SupplierInput) =>
    call<SupplierResponse>(`/api/facilities/fornecedores/${id}`, { method: "PATCH", body: input }).then((r) => r.supplier),
  deleteSupplier: (id: string) => call<{ ok: true }>(`/api/facilities/fornecedores/${id}`, { method: "DELETE" }),

  createService: (supplierId: string, input: ServiceInput) =>
    call<SupplierResponse>(`/api/facilities/fornecedores/${supplierId}/servicos`, { method: "POST", body: input }).then(
      (r) => r.supplier
    ),
  updateService: (id: string, input: ServiceInput) =>
    call<SupplierResponse>(`/api/facilities/servicos/${id}`, { method: "PATCH", body: input }).then((r) => r.supplier),
  deleteService: (id: string) =>
    call<SupplierResponse>(`/api/facilities/servicos/${id}`, { method: "DELETE" }).then((r) => r.supplier),

  createContract: (supplierId: string, contract: ContractInput, attachDocumentIds: string[]) =>
    call<SupplierResponse>(`/api/facilities/fornecedores/${supplierId}/contratos`, {
      method: "POST",
      body: { contract, attach_document_ids: attachDocumentIds },
    }).then((r) => r.supplier),
  updateContract: (id: string, contract: ContractInput, attachDocumentIds: string[]) =>
    call<SupplierResponse>(`/api/facilities/contratos/${id}`, {
      method: "PATCH",
      body: { contract, attach_document_ids: attachDocumentIds },
    }).then((r) => r.supplier),
  deleteContract: (id: string) =>
    call<SupplierResponse>(`/api/facilities/contratos/${id}`, { method: "DELETE" }).then((r) => r.supplier),

  addLink: (input: {
    supplier_id: string;
    contract_id: string | null;
    kind: DocumentKind;
    title: string;
    valid_until: string;
    external_url: string;
  }) => call<{ supplier: FacilitiesSupplier; documentId: string }>("/api/facilities/documentos", { method: "POST", body: input }),
  deleteDocument: (id: string) =>
    call<SupplierResponse>(`/api/facilities/documentos/${id}`, { method: "DELETE" }).then((r) => r.supplier),
  documentUrl: (id: string, download = false) =>
    call<{ url: string }>(`/api/facilities/documentos/${id}${download ? "?download=1" : ""}`).then((r) => r.url),
  readContract: (documentId: string) =>
    call<{ extraction: ContractExtraction }>(`/api/facilities/documentos/${documentId}/ler`, { method: "POST" }).then(
      (r) => r.extraction
    ),
};

/** Sobe o arquivo direto no bucket privado (URL assinada) e registra no fornecedor. */
export async function uploadSupplierFile(input: {
  supplierId: string;
  contractId: string | null;
  kind: DocumentKind;
  title: string;
  validUntil: string;
  file: File;
}): Promise<{ supplier: FacilitiesSupplier; documentId: string }> {
  if (!facilitiesFileType(input.file.name)) throw new Error(`"${input.file.name}": envie PDF, imagem (JPG, PNG, WebP) ou Word.`);
  if (input.file.size > FACILITIES_FILE_MAX_BYTES) throw new Error(`"${input.file.name}" passa de 50 MB.`);

  const upload = await call<{ path: string; token: string; content_type: string }>("/api/facilities/documentos/upload", {
    method: "POST",
    body: { supplier_id: input.supplierId, file_name: input.file.name, size_bytes: input.file.size },
  });
  const { error } = await supabase.storage
    .from(FACILITIES_BUCKET)
    .uploadToSignedUrl(upload.path, upload.token, input.file, { contentType: upload.content_type });
  if (error) throw new Error(`Não foi possível enviar "${input.file.name}": ${error.message}`);

  return call<{ supplier: FacilitiesSupplier; documentId: string }>("/api/facilities/documentos", {
    method: "POST",
    body: {
      supplier_id: input.supplierId,
      contract_id: input.contractId,
      kind: input.kind,
      title: input.title,
      valid_until: input.validUntil,
      storage_path: upload.path,
      file_name: input.file.name,
      size_bytes: input.file.size,
    },
  });
}

/** Abre o arquivo numa aba nova (URL assinada de 10 min). */
export async function openSupplierDocument(id: string, download = false): Promise<void> {
  // A aba abre antes do await para o navegador não bloquear como pop-up.
  const tab = window.open("", "_blank");
  try {
    const url = await facilitiesApi.documentUrl(id, download);
    if (tab) tab.location.href = url;
    else window.location.href = url;
  } catch (error) {
    tab?.close();
    throw error;
  }
}

/* ------------------------------------------------------------ OPEX */

export const opexApi = {
  names: () => call<{ names: OpexNameRow[]; syncedAt: string | null }>("/api/facilities/opex/nomes"),
  /** Copia de novo os pagamentos do OPEX e devolve o cadastro já com os valores novos. */
  sync: async () => {
    const result = await call<{ rows: number; suppliers: number; finishedAt: string }>("/api/facilities/opex/sincronizar", { method: "POST" });
    const { items } = await call<{ items: FacilitiesSupplier[] }>("/api/facilities/fornecedores");
    return { ...result, suppliers: items, supplierNames: result.suppliers };
  },
  link: (supplierId: string, names: string[]) =>
    call<SupplierResponse>(`/api/facilities/fornecedores/${supplierId}/opex`, { method: "PUT", body: { names } }).then(
      (r) => r.supplier
    ),
};

/* ------------------------------------------------------------ manutenção */

type PlanResponse = { plan: MaintenancePlan };

export const maintenanceApi = {
  createAsset: (input: AssetInput) =>
    call<{ asset: FacilityAsset }>("/api/facilities/ativos", { method: "POST", body: input }).then((r) => r.asset),
  updateAsset: (id: string, input: AssetInput) =>
    call<{ asset: FacilityAsset }>(`/api/facilities/ativos/${id}`, { method: "PATCH", body: input }).then((r) => r.asset),
  deleteAsset: (id: string) => call<{ ok: true }>(`/api/facilities/ativos/${id}`, { method: "DELETE" }),

  createPlan: (input: PlanInput) =>
    call<PlanResponse>("/api/facilities/manutencao", { method: "POST", body: input }).then((r) => r.plan),
  updatePlan: (id: string, input: PlanInput) =>
    call<PlanResponse>(`/api/facilities/manutencao/${id}`, { method: "PATCH", body: input }).then((r) => r.plan),
  deletePlan: (id: string) => call<{ ok: true }>(`/api/facilities/manutencao/${id}`, { method: "DELETE" }),

  createRecord: (planId: string, input: RecordInput) =>
    call<PlanResponse>(`/api/facilities/manutencao/${planId}/execucoes`, { method: "POST", body: input }).then((r) => r.plan),
  deleteRecord: (id: string) =>
    call<PlanResponse>(`/api/facilities/manutencao/execucoes/${id}`, { method: "DELETE" }).then((r) => r.plan),

  addLink: (input: { plan_id: string; record_id: string | null; kind: MaintenanceDocumentKind; title: string; external_url: string }) =>
    call<PlanResponse>("/api/facilities/manutencao/documentos", {
      method: "POST",
      body: { ...input, storage_path: null, file_name: null, size_bytes: null },
    }).then((r) => r.plan),
  deleteDocument: (id: string) =>
    call<PlanResponse>(`/api/facilities/manutencao/documentos/${id}`, { method: "DELETE" }).then((r) => r.plan),
  documentUrl: (id: string, download = false) =>
    call<{ url: string }>(`/api/facilities/manutencao/documentos/${id}${download ? "?download=1" : ""}`).then((r) => r.url),
};

/** Sobe laudo, NF, OS ou PMOC direto no bucket privado e registra no plano. */
export async function uploadMaintenanceFile(input: {
  planId: string;
  recordId: string | null;
  kind: MaintenanceDocumentKind;
  title: string;
  file: File;
}): Promise<MaintenancePlan> {
  if (!facilitiesFileType(input.file.name)) throw new Error(`"${input.file.name}": envie PDF, imagem (JPG, PNG, WebP) ou Word.`);
  if (input.file.size > FACILITIES_FILE_MAX_BYTES) throw new Error(`"${input.file.name}" passa de 50 MB.`);
  const upload = await call<{ path: string; token: string; content_type: string }>("/api/facilities/manutencao/documentos/upload", {
    method: "POST",
    body: { plan_id: input.planId, file_name: input.file.name, size_bytes: input.file.size },
  });
  const { error } = await supabase.storage
    .from(FACILITIES_BUCKET)
    .uploadToSignedUrl(upload.path, upload.token, input.file, { contentType: upload.content_type });
  if (error) throw new Error(`Não foi possível enviar "${input.file.name}": ${error.message}`);
  return call<PlanResponse>("/api/facilities/manutencao/documentos", {
    method: "POST",
    body: {
      plan_id: input.planId,
      record_id: input.recordId,
      kind: input.kind,
      title: input.title,
      storage_path: upload.path,
      file_name: input.file.name,
      size_bytes: input.file.size,
      external_url: null,
    },
  }).then((r) => r.plan);
}

/** Abre um arquivo da manutenção numa aba nova (URL assinada de 10 min). */
export async function openMaintenanceDocument(id: string, download = false): Promise<void> {
  const tab = window.open("", "_blank");
  try {
    const url = await maintenanceApi.documentUrl(id, download);
    if (tab) tab.location.href = url;
    else window.location.href = url;
  } catch (error) {
    tab?.close();
    throw error;
  }
}
