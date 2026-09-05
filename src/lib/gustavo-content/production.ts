import type { GustavoContentItem } from "./types";
import { SKIPPED_VISION_NOTE } from "./answers";

export const PRODUCTION_ACTIONS = [
  { key: "choose", title: "Escolher leitura", action: "Escolher leitura" },
  { key: "answer", title: "Responder opinião", action: "Registrar visão ou seguir factual" },
  { key: "edit", title: "Editar conteúdo", action: "Abrir editor" },
  { key: "approve", title: "Aprovar conteúdo", action: "Revisar aprovação" },
  { key: "publish", title: "Acompanhar publicação", action: "Abrir produção" },
] as const;

export function productionAction(item: GustavoContentItem): typeof PRODUCTION_ACTIONS[number]["key"] | null {
  if (["publicado", "arquivado"].includes(item.status)) return null;
  if (["aprovado", "enviado_mkt"].includes(item.status)) return "publish";
  if (item.status === "aguardando_aprovacao") return "approve";
  if (item.linkedin_post || item.reel_script || item.status === "rejeitado") return "edit";
  if (!item.selected_angle) return "choose";
  const hasOpinion = item.opinion_status === "validated" && Boolean(
    (item.thesis_id && item.thesis_snapshot) ||
    item.gustavo_answers?.some((answer) => answer.trim() && answer.trim() !== SKIPPED_VISION_NOTE)
  );
  return hasOpinion ? "edit" : "answer";
}
