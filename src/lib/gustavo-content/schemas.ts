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
  linkedinPost: z.string(),
  alternativeHooks: z.array(z.string()).max(3),
  reel: z.object({
    duration: z.string(),
    hook: z.string(),
    talkingPoints: z.array(z.string()),
    closing: z.string(),
    recordingNote: z.string(),
  }),
});

export const complianceObjectSchema = z.object({
  safe: z.boolean(),
  flags: z.array(z.enum(COMPLIANCE_FLAGS)),
  requiresHumanReview: z.boolean(),
  notes: z.array(z.string()).optional(),
});
