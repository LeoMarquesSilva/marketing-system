import { z } from "zod";
import { COMPLIANCE_FLAGS } from "@/lib/gustavo-content/compliance";

export const scoreObjectSchema = z.object({
  breakdown: z.object({
    icpRelevance: z.number(),
    thesisPotential: z.number(),
    businessImpact: z.number(),
    thesisFit: z.number(),
    freshness: z.number(),
    differentiation: z.number(),
    sourceQuality: z.number(),
  }),
  reason: z.string(),
  businessProblem: z.string(),
  sourceContext: z.object({
    facts: z.array(z.string()),
    numbers: z.array(z.string()),
    companies: z.array(z.string()),
    dates: z.array(z.string()),
    sourceUrls: z.array(z.string()),
  }),
  recommendedChannels: z.object({
    linkedin: z.object({
      recommended: z.boolean(),
      reason: z.string(),
    }),
    instagramReel: z.object({
      recommended: z.boolean(),
      reason: z.string(),
    }),
  }),
});

export const anglesObjectSchema = z.object({
  angles: z
    .array(
      z.object({
        type: z.enum(["diagnosis", "strategy", "opinion"]),
        title: z.string(),
        thesis: z.string(),
        whyItMatters: z.string(),
      })
    )
    .min(3)
    .max(3),
  thesisMatch: z.object({
    thesisId: z.string().nullable(),
    confidence: z.enum(["high", "medium", "low", "none"]),
    reason: z.string(),
  }),
  questions: z.array(z.string()).max(3),
});

export const contentObjectSchema = z.object({
  editorialBrief: z.object({
    centralThesis: z.string().trim().min(1),
    icp: z.string(),
    businessDecision: z.string(),
    supportingFacts: z.array(z.string()).max(3),
    practicalConsequence: z.string(),
    // OpenAI structured outputs (strict) exige toda propriedade em `required`;
    // opcionalidade se expressa com nullable, não com `.optional()`.
    limits: z.array(z.string()).nullable(),
  }),
  angleAlignment: z.object({
    aligned: z.boolean(),
    note: z.string(),
  }),
  linkedin: z.object({
    hook: z.string().trim().min(1),
    body: z.array(z.string().trim().min(1)).min(1).max(6),
    closing: z.string().nullable(),
    hashtags: z.array(z.string()).max(3).nullable(),
  }),
  alternativeHooks: z.array(z.string().trim().min(1)).length(3),
  reel: z.object({
    duration: z.string(),
    hook: z.string().trim().min(1),
    talkingPoints: z.array(z.string().trim().min(1)).min(1),
    closing: z.string(),
    recordingNote: z.string(),
  }),
});

export const complianceObjectSchema = z.object({
  safe: z.boolean(),
  flags: z.array(z.enum(COMPLIANCE_FLAGS)),
  requiresHumanReview: z.boolean(),
  notes: z.array(z.string()).nullable(),
});

export const editorialReviewObjectSchema = z.object({
  passesReview: z.boolean(),
  issues: z.array(z.string()),
  notes: z.string(),
});
