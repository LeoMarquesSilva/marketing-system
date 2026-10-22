"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Loader2, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { RegistrationAnswersView } from "@/components/rh/registration/registration-answers-view";
import { EmployeeFichaBadge, FichaProgress } from "@/components/rh/registration/employee-ficha-badge";
import { buildSelfUpdateMessage, whatsappUrl } from "@/lib/rh/registration/client";
import { REGISTRATION_FIELD_LABEL, type EmployeeRegistrationDetail } from "@/lib/rh/registration/types";

/**
 * Painel do colaborador que ainda não enviou a ficha: o que o escritório já
 * sabe (qualificação e VIOS), o que falta e o convite para atualizar.
 */
export function EmployeeRegistrationSheet({
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
    <Sheet open={!!employeeId} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-[720px]">
        {!current ? (
          <>
            <SheetHeader>
              <SheetTitle>Ficha do colaborador</SheetTitle>
              <SheetDescription>{error ?? "Carregando…"}</SheetDescription>
            </SheetHeader>
            {!error && (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </>
        ) : (
          <>
            <SheetHeader>
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle>{current.row.fullName}</SheetTitle>
                <EmployeeFichaBadge status={current.row.status} />
              </div>
              <SheetDescription>
                {[current.row.vinculoLabel, current.row.position, current.row.department].filter(Boolean).join(" · ")}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <section className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
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
      </SheetContent>
    </Sheet>
  );
}
