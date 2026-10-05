"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Link2, Loader2, RefreshCw, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HrOnboardingNotification } from "@/lib/ferias/types";
import { registrationActionRequest } from "@/lib/rh/registration/client";
import { REGISTRATION_KIND_LABEL } from "@/lib/rh/registration/types";

export function notificationTitle(notification: HrOnboardingNotification): string {
  if (notification.event_type === "registration_submitted") {
    return notification.registration_form?.invitee_name ?? "Ficha cadastral";
  }
  return notification.employee?.full_name ?? "Colaborador";
}

export function describeHrNotification(notification: HrOnboardingNotification): string {
  const name = notificationTitle(notification);
  if (notification.event_type === "registration_submitted") {
    const kind = notification.registration_form
      ? ` (${REGISTRATION_KIND_LABEL[notification.registration_form.employment_kind]})`
      : "";
    return `${name} enviou a ficha cadastral${kind}. Revise e aprove.`;
  }
  if (notification.event_type === "new_employee") {
    return `${name} foi identificado como novo colaborador pelo VIOS. A ficha ainda precisa ser completada.`;
  }
  const status = notification.new_is_active ? "ativo" : "inativo";
  return `${name} agora está ${status} no VIOS.`;
}

export function HrNotificationsList({
  notifications,
  onAction,
  onNavigate,
  onChanged,
}: {
  notifications: HrOnboardingNotification[];
  /** Abre a ficha do colaborador (notificações do VIOS). */
  onAction: (employeeId: string) => void;
  /** Chamado antes de sair para a tela de Fichas cadastrais (fecha popover/modal). */
  onNavigate?: () => void;
  /** Depois de vincular uma ficha: recarregar a lista. */
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [linking, setLinking] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  if (notifications.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-sm text-muted-foreground">
        Nenhuma atualização pendente.
      </p>
    );
  }

  const openRegistration = (formId: string) => {
    onNavigate?.();
    router.push(`/rh/fichas-cadastrais?ficha=${formId}`);
  };

  const linkRegistration = async (notification: HrOnboardingNotification) => {
    const suggestion = notification.registration_suggestion;
    if (!suggestion || !notification.employee_id) return;
    setLinking(notification.id);
    setLinkError(null);
    const result = await registrationActionRequest(suggestion.form_id, {
      action: "link",
      employeeId: notification.employee_id,
    });
    setLinking(null);
    if (!result.form) {
      setLinkError(result.error ?? "Não foi possível vincular.");
      return;
    }
    onChanged?.();
  };

  return (
    <div className="space-y-2">
      {linkError && <p className="px-1 text-xs text-destructive">{linkError}</p>}
      {notifications.map((notification) => {
        const suggestion = notification.registration_suggestion;
        return (
          <div key={notification.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{notificationTitle(notification)}</p>
                <p className="text-xs text-muted-foreground">{describeHrNotification(notification)}</p>
              </div>
              {notification.event_type === "registration_submitted" && notification.registration_form_id ? (
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  onClick={() => openRegistration(notification.registration_form_id as string)}
                >
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  Revisar ficha
                </Button>
              ) : notification.employee_id ? (
                <Button
                  type="button"
                  size="sm"
                  variant={suggestion ? "outline" : "default"}
                  className="shrink-0 gap-1.5"
                  onClick={() => onAction(notification.employee_id as string)}
                >
                  {notification.event_type === "new_employee" ? (
                    <UserPlus className="h-3.5 w-3.5" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Atualizar informações
                </Button>
              ) : null}
            </div>
            {suggestion && (
              <div className="flex items-center justify-between gap-3 rounded-md bg-sky-50 px-2.5 py-2">
                <p className="min-w-0 text-xs text-sky-950">
                  Ficha cadastral de <span className="font-medium">{suggestion.name}</span> já recebida
                  {suggestion.reason === "cpf" ? " (mesmo CPF)" : " (nome parecido)"}. É a mesma pessoa?
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  disabled={linking === notification.id}
                  onClick={() => void linkRegistration(notification)}
                >
                  {linking === notification.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Link2 className="h-3.5 w-3.5" />
                  )}
                  Vincular ficha
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
