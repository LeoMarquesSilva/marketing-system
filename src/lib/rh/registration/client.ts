import {
  REGISTRATION_KIND_LABEL,
  SELF_REGISTRATION_PATH,
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

function absoluteUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

/** Link público da ficha de admissão ("" quando a ficha é atualizada com login). */
export function registrationPublicUrl(item: Pick<RegistrationListItem, "public_path">): string {
  return item.public_path ? absoluteUrl(item.public_path) : "";
}

/** Link único (com login) da atualização cadastral — o mesmo para todo mundo. */
export function selfRegistrationUrl(): string {
  return absoluteUrl(SELF_REGISTRATION_PATH);
}

/** Mensagem pronta para a RH colar no WhatsApp/e-mail. */
export function buildRegistrationMessage(
  item: Pick<RegistrationListItem, "invitee_name" | "employment_kind" | "expires_at" | "public_path">
): string {
  const first = item.invitee_name.trim().split(/\s+/)[0] ?? "";
  const until = item.expires_at
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(item.expires_at))
    : null;
  return [
    `Olá, ${first}! Que bom ter você no Bismarchi | Pires.`,
    `Para fazermos seu cadastro (${REGISTRATION_KIND_LABEL[item.employment_kind]}), preencha sua ficha neste link: ${registrationPublicUrl(item)}`,
    `Leva uns 5 minutos${until ? ` e o link vale até ${until}` : ""}. Qualquer dúvida, é só chamar a equipe de Pessoas e Cultura.`,
  ].join("\n\n");
}

/** Mensagem da campanha de atualização (um link para todos, cada um entra com o próprio login). */
export function buildSelfUpdateMessage(name?: string | null): string {
  const raw = (name ?? "").trim().split(/\s+/)[0] ?? "";
  // O VIOS às vezes traz o nome em caixa alta.
  const first = raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : "";
  return [
    first ? `Olá, ${first}! Tudo bem?` : "Olá! Tudo bem?",
    `Estamos atualizando as fichas cadastrais do escritório. Entre com seu login do sistema neste link: ${selfRegistrationUrl()}`,
    "Sua ficha já vem com o que temos; é só conferir e completar o que falta (leva poucos minutos). Qualquer dúvida, fale com a equipe de Pessoas e Cultura.",
  ].join("\n\n");
}

export function whatsappUrl(phone: string | null, message: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  const target = digits.length >= 10 ? (digits.length <= 11 ? `55${digits}` : digits) : "";
  return `https://wa.me/${target}?text=${encodeURIComponent(message)}`;
}
