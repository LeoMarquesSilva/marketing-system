import {
  GUSTAVO_CONTENT_STATUSES,
  GUSTAVO_OWNER_USER_ID,
  type GustavoContentStatus,
} from "@/lib/gustavo-content/constants";
import type { GustavoMemberRole } from "@/lib/gustavo-content/access";

export type OpinionStatus = "validated" | "needs_gustavo";
export type ApprovalKind = "gustavo" | "admin_exception";

export function canGenerateDraft(input: { opinionStatus: OpinionStatus | null | undefined }): boolean {
  return input.opinionStatus === "validated";
}

export function nextStatusAfterThesisMatch(input: {
  opinionStatus: OpinionStatus | null | undefined;
}): GustavoContentStatus {
  return canGenerateDraft(input) ? "rascunho" : "aguardando_opiniao";
}

export function approvalKindForActor(actor: {
  id: string;
  isAdmin: boolean;
  memberRole: GustavoMemberRole | null;
}): ApprovalKind {
  if (actor.memberRole === "owner" || actor.id === GUSTAVO_OWNER_USER_ID) {
    return "gustavo";
  }
  return "admin_exception";
}

export function resolveOutputEdit(input: {
  current: string | null | undefined;
  incoming: string;
  original: string | null | undefined;
}): { value: string; original: string | null; hasAlterations: boolean } {
  const incoming = input.incoming;
  const current = input.current ?? "";
  if (input.original == null || input.original === "") {
    if (incoming === current) {
      return { value: incoming, original: null, hasAlterations: false };
    }
    return {
      value: incoming,
      original: current || incoming,
      hasAlterations: incoming !== current,
    };
  }
  return {
    value: incoming,
    original: input.original,
    hasAlterations: incoming !== input.original,
  };
}

const TRANSITIONS: Record<GustavoContentStatus, GustavoContentStatus[]> = {
  radar: ["sugestao", "rejeitado", "arquivado"],
  sugestao: ["aguardando_opiniao", "rascunho", "rejeitado", "arquivado"],
  aguardando_opiniao: ["rascunho", "rejeitado", "arquivado"],
  rascunho: ["aguardando_aprovacao", "rejeitado", "arquivado"],
  aguardando_aprovacao: ["aprovado", "rascunho", "rejeitado"],
  aprovado: ["enviado_mkt", "publicado", "rejeitado"],
  enviado_mkt: ["publicado", "rejeitado"],
  publicado: ["arquivado"],
  rejeitado: ["arquivado", "rascunho"],
  arquivado: [],
};

export function canTransition(
  from: GustavoContentStatus,
  to: GustavoContentStatus
): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isGustavoContentStatus(value: string): value is GustavoContentStatus {
  return (GUSTAVO_CONTENT_STATUSES as readonly string[]).includes(value);
}

export const PRODUCTION_STATUSES: GustavoContentStatus[] = [
  "sugestao",
  "aguardando_opiniao",
  "rascunho",
  "aguardando_aprovacao",
  "aprovado",
];

export const HISTORY_STATUSES: GustavoContentStatus[] = [
  "enviado_mkt",
  "publicado",
  "rejeitado",
  "arquivado",
];

export const RADAR_STATUSES: GustavoContentStatus[] = [
  "radar",
  "sugestao",
  "aguardando_opiniao",
];
