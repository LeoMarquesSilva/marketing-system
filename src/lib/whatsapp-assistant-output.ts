/**
 * Formato da resposta da IA do atendimento (Sugerir resposta e Responder só
 * esta): versões do texto e ações que o atendente pode disparar com um clique.
 */

import { z } from "zod";
import { RECEPTION_CONTACT_ID, type TeamContact } from "@/lib/whatsapp-team-contacts";

export const assistantReplySchema = z.object({
  versoes: z
    .array(
      z.object({
        tipo: z.enum(["curta", "completa"]),
        texto: z.string(),
      })
    )
    .describe("Sugerir: uma curta e uma completa. Responder só esta: só a curta."),
  acoes: z
    .array(
      z.object({
        tipo: z.enum(["enviar_cartao", "encaminhar_lead"]),
        pessoa: z.string().describe('Código da lista da equipe, como "p3", ou "recepcao".'),
      })
    )
    .describe("No máximo 3. Vazio quando nenhuma ação faz sentido."),
});

export type AssistantReplyObject = z.infer<typeof assistantReplySchema>;

export interface AssistantVersion {
  kind: "curta" | "completa";
  text: string;
}

export interface AssistantAction {
  type: "send_contact" | "forward_lead";
  /** `recepcao` ou `users.id` */
  contactId: string;
  label: string;
}

/** "Henrique Franco Nascimento" → "Henrique Nascimento" */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length <= 2 ? parts.join(" ") : `${parts[0]} ${parts[parts.length - 1]}`;
}

export function cleanVersions(raw: AssistantReplyObject["versoes"], max: number): AssistantVersion[] {
  const seen = new Set<string>();
  const versions: AssistantVersion[] = [];
  for (const version of raw) {
    const text = version.texto.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    versions.push({ kind: version.tipo, text });
  }
  // Curta primeiro.
  versions.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "curta" ? -1 : 1));
  return versions.slice(0, max);
}

/**
 * Troca os códigos da IA por pessoas de verdade e descarta o que não serve:
 * código desconhecido, cartão de quem não liberou o WhatsApp, encaminhar para a
 * recepção, repetição. No máximo 3.
 */
export function resolveAssistantActions(
  raw: AssistantReplyObject["acoes"],
  context: { idByRef: Map<string, string>; team: TeamContact[] }
): AssistantAction[] {
  const byId = new Map(context.team.map((person) => [person.id, person]));
  const actions: AssistantAction[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const ref = item.pessoa.trim().toLowerCase().replace(/[[\]]/g, "");
    const type = item.tipo === "enviar_cartao" ? "send_contact" : "forward_lead";
    let contactId: string | null = null;
    let label = "";
    if (ref === RECEPTION_CONTACT_ID || ref === "recepção") {
      if (type !== "send_contact") continue;
      contactId = RECEPTION_CONTACT_ID;
      label = "Enviar contato da Recepção";
    } else {
      const id = context.idByRef.get(ref);
      const person = id ? byId.get(id) : undefined;
      if (!person) continue;
      if (type === "send_contact" && !person.cardPhone && !person.email) continue;
      contactId = person.id;
      label =
        type === "send_contact"
          ? `Enviar contato de ${shortName(person.name)}`
          : `Encaminhar para ${shortName(person.name)}`;
    }
    const key = `${type}:${contactId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    actions.push({ type, contactId, label });
    if (actions.length === 3) break;
  }
  return actions;
}
