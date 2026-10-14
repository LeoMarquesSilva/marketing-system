import { splitCargaHoraria, type CardPrefill } from "@/lib/certificados/card-prefill";
import {
  CERTIFICATE_PARTNERS,
  DEFAULT_CERTIFICATE_TEXT,
  type CertificateConfig,
  type PartnerId,
  type SignatureImage,
} from "@/lib/certificados/model";

export interface FacilitatorDraft {
  id: string;
  nome: string;
  cargo: string;
  assinatura: { image: SignatureImage; previewUrl: string; fileName: string } | null;
}

/** Estado da tela; vira `CertificateConfig` na hora de gerar. */
export interface CertificateDraft {
  tipo: string;
  curso: string;
  dataInicio: string;
  variosDias: boolean;
  dataFim: string;
  horas: string;
  minutos: string;
  texto: string;
  nomeEmMaiusculas: boolean;
  facilitadores: FacilitatorDraft[];
  socios: PartnerId[];
}

let sequence = 0;
export const newDraftId = () => `f${Date.now().toString(36)}${(sequence++).toString(36)}`;

export const emptyFacilitator = (): FacilitatorDraft => ({
  id: newDraftId(),
  nome: "",
  cargo: "Facilitador",
  assinatura: null,
});

export function createDefaultDraft(): CertificateDraft {
  return {
    tipo: "Workshop",
    curso: "",
    dataInicio: "",
    variosDias: false,
    dataFim: "",
    horas: "1",
    minutos: "0",
    texto: DEFAULT_CERTIFICATE_TEXT,
    nomeEmMaiusculas: true,
    facilitadores: [emptyFacilitator()],
    socios: CERTIFICATE_PARTNERS.map((p) => p.id),
  };
}

/**
 * Troca os dados do evento pelos do card do Planner. Texto, sócios e
 * maiúsculas continuam como a pessoa deixou; o que o card não traz fica em
 * branco para a tela pedir.
 */
export function applyCardPrefill(draft: CertificateDraft, prefill: CardPrefill): CertificateDraft {
  const carga = prefill.cargaHorariaMinutos ? splitCargaHoraria(prefill.cargaHorariaMinutos) : { horas: "", minutos: "" };
  return {
    ...draft,
    tipo: prefill.tipo,
    curso: prefill.curso,
    dataInicio: prefill.dataInicio ?? "",
    variosDias: false,
    dataFim: "",
    ...carga,
    facilitadores:
      prefill.facilitadores.length > 0
        ? prefill.facilitadores.map((nome) => ({ ...emptyFacilitator(), nome }))
        : [emptyFacilitator()],
  };
}

export function draftMinutes(draft: CertificateDraft): number {
  const horas = Number(draft.horas.replace(",", ".")) || 0;
  const minutos = Number(draft.minutos) || 0;
  return Math.round(horas * 60 + minutos);
}

export function draftToConfig(draft: CertificateDraft): CertificateConfig {
  return {
    tipo: draft.tipo,
    curso: draft.curso,
    dataInicio: draft.dataInicio,
    dataFim: draft.variosDias ? draft.dataFim || null : null,
    cargaHorariaMinutos: draftMinutes(draft),
    texto: draft.texto,
    nomeEmMaiusculas: draft.nomeEmMaiusculas,
    facilitadores: draft.facilitadores.map((f) => ({
      nome: f.nome,
      cargo: f.cargo,
      assinatura: f.assinatura?.image ?? null,
    })),
    socios: draft.socios,
  };
}

const STORAGE_KEY = "certificados:rascunho:v1";

/** Rascunho salvo no navegador (sem as imagens de assinatura enviadas). */
export function loadStoredDraft(): CertificateDraft | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<CertificateDraft>;
    const base = createDefaultDraft();
    const partnerIds = new Set<string>(CERTIFICATE_PARTNERS.map((p) => p.id));
    return {
      ...base,
      ...stored,
      facilitadores: Array.isArray(stored.facilitadores)
        ? stored.facilitadores.map((f) => ({
            id: newDraftId(),
            nome: String(f?.nome ?? ""),
            cargo: String(f?.cargo ?? ""),
            assinatura: null,
          }))
        : base.facilitadores,
      socios: Array.isArray(stored.socios)
        ? (stored.socios.filter((id) => partnerIds.has(id)) as PartnerId[])
        : base.socios,
    };
  } catch {
    return null;
  }
}

export function storeDraft(draft: CertificateDraft) {
  try {
    const { facilitadores, ...rest } = draft;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...rest, facilitadores: facilitadores.map(({ nome, cargo }) => ({ nome, cargo })) })
    );
  } catch {
    // navegador sem armazenamento: segue sem rascunho
  }
}
