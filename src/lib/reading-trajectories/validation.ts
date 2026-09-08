import { z } from "zod";

const nullableText = (max: number) =>
  z.string().trim().max(max).nullish().transform((value) => value || null);

const nullableUrl = z
  .string()
  .trim()
  .max(2048)
  .nullish()
  .transform((value) => value || null)
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }, "Informe uma URL http(s) válida.");

export const readingRecommendationUpdateSchema = z.object({
  publicName: z.string().trim().min(1).max(180),
  practiceArea: z.string().trim().min(1).max(180),
  roleOverride: nullableText(180),
  photoOverrideUrl: nullableUrl,
  bookTitle: nullableText(300),
  bookAuthor: nullableText(240),
  bookCoverUrl: nullableUrl,
  recommendationText: nullableText(12000),
  trajectoryNote: nullableText(3000),
  bookLink: nullableUrl,
  displayOrder: z.coerce.number().int().min(1).max(99),
  isVisible: z.boolean(),
});

export type ReadingRecommendationUpdate = z.infer<typeof readingRecommendationUpdateSchema>;
