import type { MarketingRequest } from "@/lib/marketing-requests";
import type { CompletionType } from "@/lib/constants";

export const POST_REQUEST_TYPE = "Post Redes Sociais";

/** Post concluído aguardando data de publicação no calendário. */
export function isInContentBank(request: MarketingRequest): boolean {
  return (
    request.request_type === POST_REQUEST_TYPE &&
    request.workflow_stage === "concluido" &&
    (request.completion_type === "design_concluido" || request.completion_type == null)
  );
}

/** Post publicado no calendário principal (com data). */
export function isPostedOnCalendar(request: MarketingRequest): boolean {
  return (
    request.request_type === POST_REQUEST_TYPE &&
    request.workflow_stage === "concluido" &&
    request.completion_type === "postagem_feita" &&
    Boolean(request.posted_at)
  );
}

/** Post concluído fora do calendário (ex.: outro perfil/canal). */
export function isExternalPostCompletion(completionType: CompletionType | null | undefined): boolean {
  return completionType === "postagem_externa" || completionType === "conteudo_entregue";
}

export function captionToPostTitle(caption: string | null | undefined): string {
  if (!caption?.trim()) return "Post Instagram";
  const firstLine = caption.trim().split("\n")[0].trim();
  if (firstLine.length <= 120) return firstLine;
  return `${firstLine.slice(0, 117)}...`;
}
