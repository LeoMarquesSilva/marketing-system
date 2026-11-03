// Certificados têm coluna própria no Kanban do Planner, fora das etapas normais:
// "A fazer" → "Prontos" (falta mandar para a gráfica) → "ok" de enviado, que
// conclui o card. Assim os pedidos do Responsum não se misturam com as outras tarefas.

import { parseCertificadoWorkshopDescription } from "@/lib/certificado-workshop";
import type { CompletionType, WorkflowStage } from "@/lib/constants";
import type { MarketingRequest } from "@/lib/marketing-requests";

export const CERTIFICADO_REQUEST_TYPE = "Certificados";

/** Etapa em que o certificado está pronto e só falta mandar para a gráfica. */
export const CERTIFICADO_PRONTO_STAGE: WorkflowStage = "revisado";

/** Para onde o card volta quando alguém desfaz o "pronto". */
export const CERTIFICADO_A_FAZER_STAGE: WorkflowStage = "em_producao";

export const CERTIFICADO_ENVIADO_COMPLETION: CompletionType = "enviado_grafica";

export type CertificadoSection = "a_fazer" | "pronto";

/** Ids das áreas de soltar da coluna (não podem colidir com as etapas do Kanban). */
export const CERTIFICADO_DROP_IDS: Record<CertificadoSection, string> = {
  a_fazer: "certificados:a_fazer",
  pronto: "certificados:pronto",
};

export function isCertificadoRequest(request: Pick<MarketingRequest, "request_type">): boolean {
  return request.request_type === CERTIFICADO_REQUEST_TYPE;
}

export function getCertificadoSection(request: Pick<MarketingRequest, "workflow_stage">): CertificadoSection {
  return request.workflow_stage === CERTIFICADO_PRONTO_STAGE ? "pronto" : "a_fazer";
}

export function certificadoSectionFromDropId(id: string): CertificadoSection | null {
  if (id === CERTIFICADO_DROP_IDS.a_fazer) return "a_fazer";
  if (id === CERTIFICADO_DROP_IDS.pronto) return "pronto";
  return null;
}

export interface CertificadoCardSummary {
  /** Data do evento como veio do Responsum (dd/mm/aaaa). */
  dataRealizacao: string | null;
  /** Quantos certificados imprimir; null enquanto a presença não chegou. */
  quantidade: number | null;
  presenca: "preenchida" | "nao_preenchida" | "aguardando";
}

/** Resumo para o card: data do evento e quantos certificados (pela lista de presença). */
export function summarizeCertificadoCard(description: string | null | undefined): CertificadoCardSummary | null {
  const info = parseCertificadoWorkshopDescription(description);
  if (!info) return null;
  const presenca = info.presenca?.status ?? "aguardando";
  return {
    dataRealizacao: info.dataRealizacao ?? null,
    quantidade: info.presenca?.status === "preenchida" ? info.presenca.nomes.length : null,
    presenca,
  };
}
