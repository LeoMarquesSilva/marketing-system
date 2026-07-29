/**
 * Schemas de entrada do domínio de perfis profissionais.
 *
 * Privacidade por construção: `profileImportRowSchema` é um objeto Zod fechado,
 * então qualquer coluna extra da planilha (data de nascimento, CPF, salário) é
 * descartada na fronteira, antes de chegar ao banco. Nada além do que está
 * declarado aqui atravessa a importação.
 */

import { z } from "zod";
import { PROFILE_LOCALES, PROFILE_SECTION_KEYS } from "@/lib/profiles/types";

/**
 * URL externa segura. `z.url()` do Zod 4 aceita `javascript:`, `data:` e
 * `file:` — por isso o protocolo é validado explicitamente com allowlist.
 */
export const externalUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === "https:" || parsed.protocol === "http:";
      } catch {
        return false;
      }
    },
    { message: "Informe uma URL http(s) válida." }
  );

const optionalExternalUrl = externalUrlSchema.nullish().or(z.literal(""));

/** Slug público: só minúsculas, dígitos e hífen. Entra na URL do cartão. */
export const profileSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use apenas letras minúsculas, números e hífen.");

export const profileStatusSchema = z.enum(["draft", "published", "archived"]);

export const profileLocaleSchema = z.enum(
  PROFILE_LOCALES as unknown as [string, ...string[]]
);

export const profileSectionKeySchema = z.enum(
  PROFILE_SECTION_KEYS as unknown as [string, ...string[]]
);

const shortText = z.string().trim().max(240);
const longText = z.string().trim().max(4000);

// ---------------------------------------------------------------------------
// Importação
// ---------------------------------------------------------------------------

/**
 * Uma linha da planilha de colaboradores já normalizada.
 *
 * Deliberadamente ausentes: data de nascimento, CPF, salário e qualquer sinal
 * de atividade/papel/permissão do usuário — a importação nunca os altera.
 */
export const profileImportRowSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Informe um e-mail corporativo válido.")),
  name: shortText.nullish().transform((v) => v || null),
  role: shortText.nullish().transform((v) => v || null),
  area: shortText.nullish().transform((v) => v || null),
  phone: z
    .string()
    .trim()
    .max(40)
    .nullish()
    .transform((v) => v || null),
  joinedOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD.")
    .nullish()
    .transform((v) => v || null),
  slug: profileSlugSchema.nullish().transform((v) => v || null),
  overwrite: z.boolean().optional(),
});

export const profileImportApplySchema = z.object({
  /** E-mails normalizados selecionados pelo administrador no preview. */
  emails: z.array(z.string().trim().toLowerCase()).min(1).max(500),
  overwrite: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Edição do perfil
// ---------------------------------------------------------------------------

export const profileLocalizationInputSchema = z.object({
  locale: profileLocaleSchema,
  isApproved: z.boolean().optional(),
  displayName: shortText.nullish(),
  role: shortText.nullish(),
  practiceArea: shortText.nullish(),
  tagline: z.string().trim().max(2000).nullish(),
  bio: longText.nullish(),
});

export const profileEntryInputSchema = z.object({
  id: z.uuid().optional(),
  entryType: z.string().trim().min(1).max(60),
  linkUrl: optionalExternalUrl,
  imageUrl: optionalExternalUrl,
  occurredOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  isVisible: z.boolean().optional(),
  localizations: z
    .array(
      z.object({
        locale: profileLocaleSchema,
        title: z
          .string()
          .trim()
          .min(1, "Informe o título da entrada.")
          .max(240, "O título da entrada pode ter no máximo 240 caracteres."),
        subtitle: shortText.nullish(),
        description: longText.nullish(),
      })
    )
    .max(2)
    .optional(),
});

export const profileSectionInputSchema = z.object({
  key: profileSectionKeySchema,
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(99).optional(),
  entries: z.array(profileEntryInputSchema).max(60).optional(),
  /** Entradas removidas explicitamente pelo editor. */
  deletedEntryIds: z.array(z.uuid()).max(60).optional(),
});

export const profileUpdateSchema = z.object({
  slug: profileSlugSchema.optional(),
  photoUrl: optionalExternalUrl,
  oab: z.string().trim().max(40).nullish(),
  joinedOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
  professionalEmail: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email())
    .nullish()
    .or(z.literal("")),
  professionalPhone: z.string().trim().max(40).nullish(),
  linkedinUrl: optionalExternalUrl,
  websiteUrl: optionalExternalUrl,
  showTenure: z.boolean().optional(),
  showEmail: z.boolean().optional(),
  showWhatsapp: z.boolean().optional(),
  showLinkedin: z.boolean().optional(),
  showWebsite: z.boolean().optional(),
  localizations: z.array(profileLocalizationInputSchema).max(2).optional(),
  sections: z.array(profileSectionInputSchema).max(10).optional(),
});

export const profileStatusUpdateSchema = z.object({
  status: profileStatusSchema,
});

export const profileContentOverrideSchema = z.object({
  sourceType: z.enum(["instagram", "linkedin", "reel_studio"]),
  sourceId: z.string().trim().min(1).max(200),
  hidden: z.boolean(),
});

// ---------------------------------------------------------------------------
// Campanha
// ---------------------------------------------------------------------------

export const profileCampaignUpdateSchema = z
  .object({
    enabled: z.boolean(),
    startsAt: z.string().trim().nullish(),
    endsAt: z.string().trim().nullish(),
    titlePt: z.string().trim().min(1).max(160),
    titleEn: z.string().trim().min(1).max(160),
    messagePt: z.string().trim().min(1).max(600),
    messageEn: z.string().trim().min(1).max(600),
    callToActionPt: z.string().trim().max(160).nullish(),
    callToActionEn: z.string().trim().max(160).nullish(),
  })
  .refine(
    (value) => {
      if (!value.startsAt || !value.endsAt) return true;
      const start = new Date(value.startsAt).getTime();
      const end = new Date(value.endsAt).getTime();
      if (Number.isNaN(start) || Number.isNaN(end)) return true;
      return start <= end;
    },
    { message: "A data final precisa ser posterior à inicial.", path: ["endsAt"] }
  );

// ---------------------------------------------------------------------------
// Métricas (entrada pública)
// ---------------------------------------------------------------------------

export const profileEventInputSchema = z.object({
  eventType: z.enum([
    "profile_view",
    "nfc_scan",
    "qr_scan",
    "contact_download",
    "share",
    "whatsapp_click",
    "email_click",
    "linkedin_click",
    "website_click",
  ]),
  source: z.enum(["direct", "nfc", "qr", "share"]).default("direct"),
  locale: profileLocaleSchema.default("pt-BR"),
  cardId: z.uuid().optional(),
});

export type ProfileImportRowInput = z.infer<typeof profileImportRowSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type ProfileEntryInput = z.infer<typeof profileEntryInputSchema>;
export type ProfileSectionInput = z.infer<typeof profileSectionInputSchema>;
export type ProfileCampaignUpdateInput = z.infer<typeof profileCampaignUpdateSchema>;
export type ProfileEventInput = z.infer<typeof profileEventInputSchema>;
