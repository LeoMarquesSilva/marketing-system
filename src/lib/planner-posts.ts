import type { MarketingRequest } from "@/lib/marketing-requests";
import type { CompletionType } from "@/lib/constants";

export const POST_REQUEST_TYPE = "Post Redes Sociais";
export const REEL_REQUEST_TYPE = "Reel Redes Sociais";

export const CONTENT_BANK_REQUEST_TYPES = [POST_REQUEST_TYPE, REEL_REQUEST_TYPE] as const;

export type ContentBankRequestType = (typeof CONTENT_BANK_REQUEST_TYPES)[number];

export function isContentBankRequestType(requestType: string | null | undefined): boolean {
  return CONTENT_BANK_REQUEST_TYPES.includes(requestType as ContentBankRequestType);
}

function isAwaitingPublication(request: MarketingRequest): boolean {
  return (
    request.workflow_stage === "concluido" &&
    (request.completion_type === "design_concluido" || request.completion_type == null)
  );
}

/** Item concluído aguardando data de publicação no calendário (post ou reel). */
export function isInContentBank(request: MarketingRequest): boolean {
  return isContentBankRequestType(request.request_type) && isAwaitingPublication(request);
}

/** Item publicado no calendário principal (com data). */
export function isPostedOnCalendar(request: MarketingRequest): boolean {
  return (
    isContentBankRequestType(request.request_type) &&
    request.workflow_stage === "concluido" &&
    request.completion_type === "postagem_feita" &&
    Boolean(request.posted_at)
  );
}

export function isReelRequest(request: MarketingRequest): boolean {
  return request.request_type === REEL_REQUEST_TYPE;
}

/** Título curto para exibição (sem observações/transcrição do description). */
export function getReelDisplayTitle(request: MarketingRequest): string {
  const fromTitle = request.title.replace(/^Reel\s*[—–-]\s*/i, "").trim();
  if (fromTitle) return fromTitle;
  const fromDesc = request.description?.match(/^Reel gravado:\s*(.+?)\./s)?.[1]?.trim();
  return fromDesc || request.title;
}

/** Título para cards e modais do banco de conteúdo. */
export function getContentBankDisplayTitle(request: MarketingRequest): string {
  if (isReelRequest(request)) return getReelDisplayTitle(request);
  return request.description || request.title;
}

/** Post/reel concluído fora do calendário (ex.: outro perfil/canal). */
export function isExternalPostCompletion(completionType: CompletionType | null | undefined): boolean {
  return completionType === "postagem_externa" || completionType === "conteudo_entregue";
}

export function captionToPostTitle(caption: string | null | undefined): string {
  if (!caption?.trim()) return "Post Instagram";
  const firstLine = caption.trim().split("\n")[0].trim();
  if (firstLine.length <= 120) return firstLine;
  return `${firstLine.slice(0, 117)}...`;
}
