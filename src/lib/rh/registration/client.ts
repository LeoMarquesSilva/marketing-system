import {
  REGISTRATION_KIND_LABEL,
  type RegistrationDetail,
  type RegistrationKind,
  type RegistrationListItem,
} from "./types";
import type { RegistrationErrors } from "./validation";

export interface RegistrationRequestResult {
  form?: RegistrationDetail;
  error?: string;
  fieldErrors?: RegistrationErrors;
}

async function parse(response: Response): Promise<RegistrationRequestResult> {
  const data = (await response.json().catch(() => ({}))) as {
    form?: RegistrationDetail;
    error?: string;
    fieldErrors?: RegistrationErrors;
  };
  if (!response.ok) {
    return { error: data.error ?? "Não foi possível concluir.", fieldErrors: data.fieldErrors };
  }
  return { form: data.form };
}

export async function fetchRegistrationRequest(id: string): Promise<RegistrationRequestResult> {
  return parse(await fetch(`/api/rh/fichas-cadastrais/${id}`, { cache: "no-store" }));
}

export async function createRegistrationRequest(input: {
  kind: RegistrationKind;
  inviteeName: string;
  personalEmail: string;
  phone: string;
  expectedAdmissionDate: string;
}): Promise<RegistrationRequestResult> {
  return parse(
    await fetch("/api/rh/fichas-cadastrais", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function registrationActionRequest(
  id: string,
  body: Record<string, unknown> & { action: string }
): Promise<RegistrationRequestResult> {
  return parse(
    await fetch(`/api/rh/fichas-cadastrais/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

export function registrationPublicUrl(item: Pick<RegistrationListItem, "public_path">): string {
  if (typeof window === "undefined") return item.public_path;
  return `${window.location.origin}${item.public_path}`;
}

/** Mensagem pronta para a RH colar no WhatsApp/e-mail. */
export function buildRegistrationMessage(
  item: Pick<RegistrationListItem, "invitee_name" | "employment_kind" | "expires_at" | "public_path">
): string {
  const first = item.invitee_name.trim().split(/\s+/)[0] ?? "";
  const until = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(item.expires_at));
  return [
    `Olá, ${first}! Que bom ter você no Bismarchi | Pires.`,
    `Para fazermos seu cadastro (${REGISTRATION_KIND_LABEL[item.employment_kind]}), preencha sua ficha neste link: ${registrationPublicUrl(item)}`,
    `Leva uns 5 minutos e o link vale até ${until}. Qualquer dúvida, é só chamar a equipe de Pessoas e Cultura.`,
  ].join("\n\n");
}

export function whatsappUrl(phone: string | null, message: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  const target = digits.length >= 10 ? (digits.length <= 11 ? `55${digits}` : digits) : "";
  return `https://wa.me/${target}?text=${encodeURIComponent(message)}`;
}
