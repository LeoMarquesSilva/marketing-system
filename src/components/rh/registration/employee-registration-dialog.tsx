"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Loader2, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmployeeAvatar } from "@/components/ferias/employee-avatar";
import { RegistrationAnswersView } from "@/components/rh/registration/registration-answers-view";
import { EmployeeFichaBadge, FichaProgress } from "@/components/rh/registration/employee-ficha-badge";
import { buildSelfUpdateMessage, whatsappUrl } from "@/lib/rh/registration/client";
import { AreaIcon, getAreaIconStyle } from "@/lib/area-icons";
import { REGISTRATION_FIELD_LABEL, type EmployeeRegistrationDetail } from "@/lib/rh/registration/types";
import { cn } from "@/lib/utils";

/**
 * Painel do colaborador que ainda não enviou a ficha: o que o escritório já
 * sabe (qualificação e VIOS), o que falta e o convite para atualizar.
 */
export function EmployeeRegistrationDialog({
  employeeId,
  onOpenChange,
}: {
  employeeId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [detail, setDetail] = useState<EmployeeRegistrationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;
    fetch(`/api/rh/fichas-cadastrais/colaboradores/${employeeId}`, { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as { detail?: EmployeeRegistrationDetail; error?: string };
        if (cancelled) return;
        if (data.detail) {
          setDetail(data.detail);
          setError(null);
        } else {
          setError(data.error ?? "Não foi possível carregar a ficha.");
        }
      })
      .catch(() => !cancelled && setError("Sem conexão."));
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  const current = detail && detail.row.employeeId === employeeId ? detail : null;
  const message = current ? buildSelfUpdateMessage(current.row.fullName) : "";

  const copyMessage = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }, [message]);

  return (
    <Dialog open={!!employeeId} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl">
        {!current ? (
          <>
            <DialogHeader className="border-b border-[#eef4f5] px-6 pb-4 pr-12 pt-6 text-left">
              <DialogTitle>Ficha do colaborador</DialogTitle>
              <DialogDescription>{error ?? "Carregando…"}</DialogDescription>
            </DialogHeader>
            {!error && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </>
        ) : (
          <>
            <DialogHeader className="border-b border-[#eef4f5] px-6 pb-4 pr-12 pt-6 text-left">
              <div className="flex items-center gap-3">
                <EmployeeAvatar
                  name={current.row.fullName}
                  avatarUrl={current.row.avatarUrl}
                  className="h-11 w-11"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <DialogTitle>{current.row.fullName}</DialogTitle>
                    <EmployeeFichaBadge status={current.row.status} />
                  </div>
                  <DialogDescription className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    {current.row.department && (
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded ring-1",
                          getAreaIconStyle(current.row.department)
                        )}
                      >
                        <AreaIcon area={current.row.department} className="h-2.5 w-2.5" />
                      </span>
                    )}
                    {[current.row.vinculoLabel, current.row.position, current.row.department].filter(Boolean).join(" · ")}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <section className="space-y-3 rounded-lg border border-border/70 bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-foreground">Preenchimento</h3>
                  <FichaProgress filled={current.row.filledCount} required={current.row.requiredCount} />
                </div>
                {current.row.missingFields.length > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Falta: </span>
                    {current.row.missingFields.map((field) => REGISTRATION_FIELD_LABEL[field]).join(", ")}.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Todos os dados obrigatórios estão preenchidos.</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Ainda não há ficha enviada: o que aparece abaixo vem da qualificação jurídica e do cadastro do VIOS.
                </p>
              </section>

              <RegistrationAnswersView kind={current.row.kind} answers={current.answers} personalBank={current.personalBank} />
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-black/[0.07] bg-[#fbfaf7] px-6 py-4">
              {current.row.email && (
                <Button type="button" variant="outline" className="gap-1.5" asChild>
                  <a
                    href={`mailto:${current.row.email}?subject=${encodeURIComponent("Atualização da ficha cadastral")}&body=${encodeURIComponent(message)}`}
                  >
                    <Mail className="size-4" />
                    Enviar por e-mail
                  </a>
                </Button>
              )}
              {current.answers.personalPhone && (
                <Button type="button" variant="outline" className="gap-1.5" asChild>
                  <a href={whatsappUrl(current.answers.personalPhone, message)} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="size-4" />
                    WhatsApp
                  </a>
                </Button>
              )}
              <Button type="button" className="gap-1.5" onClick={() => void copyMessage()}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Mensagem copiada" : "Copiar mensagem com o link"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
