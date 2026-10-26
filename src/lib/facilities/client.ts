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
  type ServiceInput,
  type SupplierInput,
} from "./types";

async function call<T>(url: string, init?: { method: string; body?: unknown }): Promise<T> {
  const response = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Não foi possível concluir. Tente de novo.");
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
