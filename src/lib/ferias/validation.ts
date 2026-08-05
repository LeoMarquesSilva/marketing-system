import { z } from "zod";

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato AAAA-MM-DD");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null));

export const employeeCreateSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  cpf: optionalText(20),
  email: z.string().trim().email().max(160).nullable().optional().or(z.literal("").transform(() => null)),
  department: optionalText(120),
  position: optionalText(120),
  admissionDate: isoDate,
  terminationDate: isoDate.nullable().optional(),
  userId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  notes: optionalText(1000),
});

export const employeeUpdateSchema = employeeCreateSchema.partial();

export const leaveCreateSchema = z
  .object({
    employeeId: z.string().uuid(),
    startDate: isoDate,
    endDate: isoDate,
    days: z.number().int().min(1).max(365),
    kind: z.enum(["ferias", "recesso", "abono"]).default("ferias"),
    notes: optionalText(500),
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "A data final não pode ser anterior à inicial.",
    path: ["endDate"],
  });

export const leaveUpdateSchema = z
  .object({
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
    days: z.number().int().min(1).max(365).optional(),
    kind: z.enum(["ferias", "recesso", "abono"]).optional(),
    notes: optionalText(500),
  })
  .refine(
    (value) => !value.startDate || !value.endDate || value.endDate >= value.startDate,
    { message: "A data final não pode ser anterior à inicial.", path: ["endDate"] }
  );

export const recessCreateSchema = z
  .object({
    year: z.number().int().min(2000).max(2100),
    startDate: isoDate,
    endDate: isoDate,
    days: z.number().int().min(1).max(60),
    notes: optionalText(500),
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "A data final não pode ser anterior à inicial.",
    path: ["endDate"],
  });

/** Ajuste de direito por faltas (CLT art. 130): 30, 24, 18, 12 ou 0. */
export const periodUpdateSchema = z
  .object({
    entitledDays: z.number().int().min(0).max(30).optional(),
    notes: optionalText(500),
  })
  .refine((value) => value.entitledDays !== undefined || Boolean(value.notes), {
    message: "Informe os dias de direito ou uma observação.",
  });

export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>;
export type LeaveCreateInput = z.infer<typeof leaveCreateSchema>;
export type LeaveUpdateInput = z.infer<typeof leaveUpdateSchema>;
export type RecessCreateInput = z.infer<typeof recessCreateSchema>;
export type PeriodUpdateInput = z.infer<typeof periodUpdateSchema>;
