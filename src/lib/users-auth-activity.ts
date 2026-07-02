import { format, formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface UserAuthActivity {
  account_created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
}

export function formatAuthDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = parseISO(iso);
  return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function formatAuthRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: ptBR });
}

export function formatLastSignIn(activity: UserAuthActivity | null | undefined): string {
  if (!activity) return "—";
  if (!activity.last_sign_in_at) return "Nunca fez login";
  return formatAuthRelative(activity.last_sign_in_at);
}

/** Último acesso ao sistema (sessão ativa), com fallback para login com senha. */
export function formatLastAccess(
  lastSeenAt: string | null | undefined,
  activity: UserAuthActivity | null | undefined,
  hasLogin = false
): string {
  if (lastSeenAt) return formatAuthRelative(lastSeenAt);
  if (activity?.last_sign_in_at) return formatAuthRelative(activity.last_sign_in_at);
  if (hasLogin) return "Sem registro";
  return "—";
}
