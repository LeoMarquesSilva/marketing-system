/**
 * Fontes de notícias (content_topics) editadas na tela de Configurações.
 * Uma fonte é um feed direto (URL) ou termos de busca no Google Notícias.
 */
import { z } from "zod";

export const TOPIC_AREAS = [
  "Geral",
  "Cível",
  "Trabalhista",
  "Reestruturação",
  "Recuperação de Crédito",
  "Societário e Contratos",
  "Operações Legais",
] as const;

export const topicInputSchema = z.object({
  name: z.string().trim().min(2, "Dê um nome à fonte.").max(80),
  rss_query: z
    .string()
    .trim()
    .min(3, "Informe o endereço do feed ou os termos de busca.")
    .max(1000)
    .refine((value) => !/^\w+:/i.test(value) || /^https?:\/\//i.test(value), "Use um endereço http(s) ou termos de busca."),
  legal_area: z.enum(TOPIC_AREAS),
  months_back: z.coerce.number().int().min(1).max(6).default(2),
  item_limit: z.coerce.number().int().min(3).max(40).default(15),
  is_active: z.boolean().default(true),
});

export type TopicInput = z.infer<typeof topicInputSchema>;

export function topicKind(rssQuery: string): "feed" | "google" {
  return /^https?:\/\//i.test(rssQuery.trim()) ? "feed" : "google";
}
