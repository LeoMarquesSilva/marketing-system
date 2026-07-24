import { z } from "zod";
import { NFC_ACCESS_MODES, NFC_ACTION_TYPES } from "@/lib/nfc/types";

const nullableShortText = z.string().trim().max(240).nullable().optional();

const formFieldSchema = z.object({
  id: z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/),
  label: z.string().trim().min(1).max(120),
  type: z.enum([
    "short_text",
    "long_text",
    "number",
    "select",
    "multiple_choice",
    "user_select",
    "date",
    "image",
    "audio",
  ]),
  required: z.boolean(),
  options: z.array(z.string().trim().min(1).max(120)).max(40).optional(),
});

export const nfcActionConfigSchema = z
  .object({
    destinationUrl: z.string().trim().max(2048).optional(),
    openImmediately: z.boolean().optional(),
    extraParams: z.record(z.string(), z.string().max(500)).optional(),
    title: z.string().trim().max(120).optional(),
    description: z.string().trim().max(1200).optional(),
    imageUrl: z.string().trim().max(2048).optional(),
    icon: z.string().trim().max(50).optional(),
    buttons: z
      .array(z.object({ label: z.string().trim().min(1).max(80), url: z.string().trim().max(2048) }))
      .max(8)
      .optional(),
    successMessage: z.string().trim().max(500).optional(),
    loadingMessage: z.string().trim().max(300).optional(),
    errorMessage: z.string().trim().max(300).optional(),
    fields: z.array(formFieldSchema).max(30).optional(),
    workflowKey: z.string().trim().max(120).regex(/^[a-zA-Z0-9_-]+$/).optional(),
    method: z.enum(["POST", "PUT", "PATCH"]).optional(),
    payloadTemplate: z.record(z.string(), z.unknown()).optional(),
    requireConfirmation: z.boolean().optional(),
    phoneMode: z.enum(["fixed", "ask"]).optional(),
    fixedPhone: z.string().trim().max(30).optional(),
    messageTemplate: z.string().trim().max(1200).optional(),
    menuItems: z
      .array(
        z.object({
          id: z.string().trim().min(1).max(80),
          label: z.string().trim().min(1).max(100),
          actionType: z.enum(["url", "custom_page", "form", "webhook", "whatsapp"]),
          config: z.record(z.string(), z.unknown()),
        })
      )
      .max(12)
      .optional(),
    sequence: z
      .array(
        z.object({
          type: z.enum(["webhook", "update_scan", "success_page"]),
          config: z.record(z.string(), z.unknown()).optional(),
        })
      )
      .max(5)
      .optional(),
    timeoutMs: z.number().int().min(1000).max(30000).optional(),
    sensitive: z.boolean().optional(),
    assetLabel: z.string().trim().min(1).max(80).optional(),
    assetNumberLabel: z.string().trim().min(1).max(80).optional(),
    checkoutMessage: z.string().trim().max(500).optional(),
    returnMessage: z.string().trim().max(500).optional(),
  })
  .strict();

export const nfcTagInputSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    code: z.string().trim().max(30).regex(/^NFC-[A-Z0-9-]+$/).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    environment: nullableShortText,
    location: nullableShortText,
    category: nullableShortText,
    responsibleUserId: z.string().uuid().nullable().optional(),
    status: z.enum(["active", "inactive"]),
    accessMode: z.enum(NFC_ACCESS_MODES),
    actionType: z.enum(NFC_ACTION_TYPES),
    actionConfig: nfcActionConfigSchema,
    cooldownSeconds: z.number().int().min(0).max(86400),
    notes: z.string().trim().max(2000).nullable().optional(),
    allowedUserIds: z.array(z.string().uuid()).max(200).optional(),
  })
  .superRefine((input, ctx) => {
    if (input.actionType === "url" && !input.actionConfig.destinationUrl) {
      ctx.addIssue({ code: "custom", path: ["actionConfig", "destinationUrl"], message: "Informe a URL de destino." });
    }
    if ((input.actionType === "webhook" || input.actionType === "whatsapp") && !input.actionConfig.workflowKey) {
      ctx.addIssue({ code: "custom", path: ["actionConfig", "workflowKey"], message: "Informe a chave do workflow." });
    }
    if (input.actionType === "form" && !input.actionConfig.fields?.length) {
      ctx.addIssue({ code: "custom", path: ["actionConfig", "fields"], message: "Adicione ao menos um campo." });
    }
    const requiresDirectory =
      input.actionType === "asset_loan" ||
      input.actionConfig.fields?.some((field) => field.type === "user_select");
    if (
      requiresDirectory &&
      (input.accessMode === "public" || input.accessMode === "public_confirmation")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["accessMode"],
        message: "A seleção de colaboradores exige acesso autenticado.",
      });
    }
    if (input.accessMode === "selected_users" && !input.allowedUserIds?.length) {
      ctx.addIssue({ code: "custom", path: ["allowedUserIds"], message: "Selecione ao menos um usuário." });
    }
  });

export const nfcExecutionInputSchema = z.object({
  scanId: z.string().uuid(),
  menuItemId: z.string().trim().max(80).optional(),
  formData: z.record(z.string(), z.unknown()).optional(),
  phone: z.string().trim().max(30).optional(),
  loanOperation: z.enum(["checkout", "return"]).optional(),
  assetNumber: z.string().trim().min(1).max(80).optional(),
  borrowerUserId: z.string().uuid().optional(),
  confirmed: z.literal(true),
});

export const nfcAssetCreateSchema = z.object({
  tagId: z.string().uuid(),
  label: z.string().trim().min(1).max(80),
  assetNumbers: z
    .array(z.string().trim().min(1).max(80))
    .min(1)
    .max(200)
    .transform((numbers) => [...new Set(numbers.map((number) => number.toLocaleUpperCase("pt-BR")))]),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const nfcAssetUpdateSchema = z.object({
  label: z.string().trim().min(1).max(80),
  status: z.enum(["available", "maintenance", "inactive"]).optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const nfcAssetAdminReturnSchema = z.object({
  notes: z.string().trim().max(1000).nullable().optional(),
});

export type NfcTagInputParsed = z.infer<typeof nfcTagInputSchema>;
