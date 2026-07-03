/**
 * Helpers para filtros de enriquecimento de cadastro (e-mail, cargo, telefone, área).
 */

import type { EmailContact, EmailPerson } from "@/lib/email-marketing";

export type EnrichmentFilterId =
  | "all"
  | "incompleto"
  | "sem_email"
  | "sem_cargo"
  | "sem_telefone"
  | "sem_area"
  | "completo";

export const ENRICHMENT_FILTER_OPTIONS: { id: EnrichmentFilterId; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "incompleto", label: "Cadastro incompleto" },
  { id: "sem_email", label: "Sem e-mail" },
  { id: "sem_cargo", label: "Sem cargo" },
  { id: "sem_telefone", label: "Sem telefone" },
  { id: "sem_area", label: "Sem área" },
  { id: "completo", label: "Cadastro completo" },
];

export interface EnrichableFields {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  cargo?: string | null;
  area?: string | null;
  customFields?: Record<string, unknown>;
}

function pickString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

export function getProfileCargo(profile: EnrichableFields): string | null {
  return (
    pickString(profile.cargo) ??
    pickString(profile.customFields?.cargo) ??
    pickString(profile.customFields?.rd_cargo_e_book) ??
    null
  );
}

export function getProfileName(profile: EnrichableFields): string | null {
  return pickString(profile.name) ?? pickString(profile.customFields?.name) ?? null;
}

export function getProfileArea(profile: EnrichableFields): string | null {
  return (
    pickString(profile.area) ??
    pickString(profile.customFields?.area) ??
    pickString(profile.customFields?.rd_area) ??
    null
  );
}

export function profileMissingEmail(profile: EnrichableFields): boolean {
  return !pickString(profile.email);
}

export function profileMissingName(profile: EnrichableFields): boolean {
  return !getProfileName(profile);
}

export function profileMissingCargo(profile: EnrichableFields): boolean {
  return !getProfileCargo(profile);
}

export function profileMissingPhone(profile: EnrichableFields): boolean {
  return !pickString(profile.phone);
}

export function profileMissingArea(profile: EnrichableFields): boolean {
  return !getProfileArea(profile);
}

export function profileIsComplete(profile: EnrichableFields): boolean {
  return (
    !profileMissingEmail(profile) &&
    !profileMissingCargo(profile) &&
    !profileMissingPhone(profile) &&
    !profileMissingArea(profile)
  );
}

export function profileIsIncomplete(profile: EnrichableFields): boolean {
  return !profileIsComplete(profile);
}

export function matchesEnrichmentFilter(
  profile: EnrichableFields,
  filter: EnrichmentFilterId
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "sem_email":
      return profileMissingEmail(profile);
    case "sem_cargo":
      return profileMissingCargo(profile);
    case "sem_telefone":
      return profileMissingPhone(profile);
    case "sem_area":
      return profileMissingArea(profile);
    case "incompleto":
      return profileIsIncomplete(profile);
    case "completo":
      return profileIsComplete(profile);
    default:
      return true;
  }
}

export function personToEnrichable(person: EmailPerson): EnrichableFields {
  return {
    name: person.name,
    email: person.email,
    phone: person.phone,
    cargo: person.cargo,
    area: person.area,
    customFields: person.customFields,
  };
}

export function contactToEnrichable(contact: EmailContact): EnrichableFields {
  return {
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    cargo: contact.cargo,
    customFields: contact.customFields,
  };
}

export interface EnrichmentStats {
  total: number;
  semEmail: number;
  semCargo: number;
  semTelefone: number;
  semArea: number;
  incompleto: number;
  completo: number;
}

export function computeEnrichmentStats(profiles: EnrichableFields[]): EnrichmentStats {
  const stats: EnrichmentStats = {
    total: profiles.length,
    semEmail: 0,
    semCargo: 0,
    semTelefone: 0,
    semArea: 0,
    incompleto: 0,
    completo: 0,
  };
  for (const profile of profiles) {
    if (profileMissingEmail(profile)) stats.semEmail++;
    if (profileMissingCargo(profile)) stats.semCargo++;
    if (profileMissingPhone(profile)) stats.semTelefone++;
    if (profileMissingArea(profile)) stats.semArea++;
    if (profileIsIncomplete(profile)) stats.incompleto++;
    if (profileIsComplete(profile)) stats.completo++;
  }
  return stats;
}

export function listMissingFieldLabels(profile: EnrichableFields): string[] {
  const missing: string[] = [];
  if (profileMissingEmail(profile)) missing.push("e-mail");
  if (profileMissingCargo(profile)) missing.push("cargo");
  if (profileMissingPhone(profile)) missing.push("telefone");
  if (profileMissingArea(profile)) missing.push("área");
  return missing;
}

/** Campos que o gestor preenche em Meus Clientes (área jurídica vem do SIOE, não entra aqui). */
export function listClientMissingFieldLabels(profile: EnrichableFields): string[] {
  const missing: string[] = [];
  if (profileMissingName(profile)) missing.push("nome");
  if (profileMissingEmail(profile)) missing.push("e-mail");
  if (profileMissingCargo(profile)) missing.push("cargo");
  if (profileMissingPhone(profile)) missing.push("telefone");
  return missing;
}

export function clientProfileIsComplete(profile: EnrichableFields): boolean {
  return listClientMissingFieldLabels(profile).length === 0;
}

export function clientProfileIsIncomplete(profile: EnrichableFields): boolean {
  return !clientProfileIsComplete(profile);
}
