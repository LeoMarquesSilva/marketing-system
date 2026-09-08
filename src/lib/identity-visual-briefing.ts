import { z } from "zod";

export const IDENTITY_VISUAL_REQUEST_TYPE = "Identidade Visual";

export const IDENTITY_VISUAL_PERSONALITY_OPTIONS = [
  "Moderna",
  "Clássica",
  "Sofisticada",
  "Minimalista",
  "Criativa",
  "Ousada",
  "Elegante",
  "Descontraída",
  "Acolhedora",
  "Profissional",
  "Confiável",
  "Tecnológica",
  "Tradicional",
  "Exclusiva",
] as const;

export const IDENTITY_VISUAL_APPLICATION_OPTIONS = [
  "Instagram / redes sociais",
  "Site",
  "Papelaria",
  "Cartão de visita",
  "Apresentações",
  "Documentos",
  "Embalagens",
  "Etiquetas",
  "Uniformes",
  "Materiais impressos",
  "Fachada / sinalização",
  "Materiais digitais",
  "Publicidade",
] as const;

export const identityVisualBriefingSchema = z
  .object({
    brandName: z.string(),
    nameStory: z.string(),
    offer: z.string(),
    brandEssence: z.string(),
    audienceType: z.enum(["", "pessoas_fisicas", "empresas", "ambos", "outro"]),
    audienceOther: z.string(),
    desiredFeeling: z.string(),
    personality: z.array(z.string()).max(5, "Escolha no máximo 5 características"),
    personalityOther: z.string(),
    avoidTraits: z.string(),
    slogan: z.string(),
    admiredBrands: z.string(),
    desiredColors: z.string(),
    applications: z.array(z.string()),
    applicationsOther: z.string(),
    requiredElements: z.string(),
    forbiddenElements: z.string(),
    hasPreviousMaterial: z.enum(["", "sim", "nao"]),
    previousMaterialLinks: z.string(),
    ideasToExplore: z.string(),
    finalComments: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.audienceType === "outro" && !value.audienceOther.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["audienceOther"],
        message: "Descreva o outro tipo de público",
      });
    }
  });

export type IdentityVisualBriefingAnswers = z.infer<typeof identityVisualBriefingSchema>;

export const EMPTY_IDENTITY_VISUAL_BRIEFING: IdentityVisualBriefingAnswers = {
  brandName: "",
  nameStory: "",
  offer: "",
  brandEssence: "",
  audienceType: "",
  audienceOther: "",
  desiredFeeling: "",
  personality: [],
  personalityOther: "",
  avoidTraits: "",
  slogan: "",
  admiredBrands: "",
  desiredColors: "",
  applications: [],
  applicationsOther: "",
  requiredElements: "",
  forbiddenElements: "",
  hasPreviousMaterial: "",
  previousMaterialLinks: "",
  ideasToExplore: "",
  finalComments: "",
};

export function isIdentityVisualRequest(requestType: string | null | undefined): boolean {
  return requestType?.trim().toLocaleLowerCase("pt-BR") === "identidade visual";
}

export type IdentityVisualBriefingStatus = "pending" | "submitted";

export interface IdentityVisualBriefingRecord {
  request_id: string;
  respondent_user_id: string;
  status: IdentityVisualBriefingStatus;
  answers: IdentityVisualBriefingAnswers;
  submitted_at: string | null;
  updated_at: string;
}
