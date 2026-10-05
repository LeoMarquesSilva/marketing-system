"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  Link2,
  Loader2,
  MessageCircle,
  Pencil,
  RefreshCw,
  Undo2,
  Unlink,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { RegistrationAnswersView } from "@/components/rh/registration/registration-answers-view";
import { RegistrationFormFields } from "@/components/rh/registration/registration-form-fields";
import { RegistrationStatusBadge } from "@/components/rh/registration/registration-status-badge";
import {
  buildRegistrationMessage,
  fetchRegistrationRequest,
  registrationActionRequest,
  registrationPublicUrl,
  whatsappUrl,
} from "@/lib/rh/registration/client";
import {
  isRegistrationExpired,
  REGISTRATION_KIND_LABEL,
  REGISTRATION_KINDS,
  type RegistrationAnswers,
  type RegistrationDetail,
  type RegistrationEmployeeRef,
  type RegistrationField,
  type RegistrationKind,
} from "@/lib/rh/registration/types";
import type { RegistrationErrors } from "@/lib/rh/registration/validation";

function formatDate(iso: string | null, withTime = false): string {
  if (!iso) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = useCallback(async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1800);
    } catch {
      setCopied(null);
    }
  }, []);
  return { copied, copy };
}

export function RegistrationReviewSheet({
  formId,
  employees,
  onOpenChange,
  onChanged,
}: {
  formId: string | null;
  employees: RegistrationEmployeeRef[];
  onOpenChange: (open: boolean) => void;
  onChanged: (form: RegistrationDetail) => void;
}) {
  const [form, setForm] = useState<RegistrationDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<RegistrationAnswers | null>(null);
  const [draftKind, setDraftKind] = useState<RegistrationKind>("clt");
  const [fieldErrors, setFieldErrors] = useState<RegistrationErrors>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenNote, setReopenNote] = useState("");
  const [manualEmployeeId, setManualEmployeeId] = useState("");
  const { copied, copy } = useCopy();

  useEffect(() => {
    if (!formId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reseta o painel ao abrir outra ficha.
    setForm(null);
    setLoadError(null);
    setEditing(false);
    setActionError(null);
    setManualEmployeeId("");
    fetchRegistrationRequest(formId).then((result) => {
      if (cancelled) return;
      if (result.form) setForm(result.form);
      else setLoadError(result.error ?? "Ficha não encontrada.");
    });
    return () => {
      cancelled = true;
    };
  }, [formId]);

  const handleDraftChange = useCallback(
    <K extends RegistrationField>(field: K, value: RegistrationAnswers[K]) => {
      setDraft((current) => (current ? { ...current, [field]: value } : current));
      setFieldErrors((current) => {
        if (!current[field]) return current;
        const next = { ...current };
        delete next[field];
        return next;
      });
    },
    []
  );

  async function run(key: string, body: Record<string, unknown> & { action: string }) {
    if (!form) return false;
    setBusy(key);
    setActionError(null);
    const result = await registrationActionRequest(form.id, body);
    setBusy(null);
    if (!result.form) {
      setActionError(result.error ?? "Não foi possível concluir.");
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      return false;
    }
    setForm(result.form);
    onChanged(result.form);
    return true;
  }

  const startEditing = () => {
    if (!form) return;
    setDraft(form.answers);
    setDraftKind(form.employment_kind);
    setFieldErrors({});
    setEditing(true);
  };

  const submitted = form?.status === "recebida" || form?.status === "aprovada";
  const expired = form ? isRegistrationExpired(form.expires_at) : false;
  const otherEmployees = employees.filter(
    (employee) => !form?.suggestions.some((suggestion) => suggestion.employeeId === employee.id)
  );

  return (
    <Sheet open={!!formId} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-[760px]">
        {!form ? (
          <>
            <SheetHeader>
              <SheetTitle>Ficha cadastral</SheetTitle>
              <SheetDescription>{loadError ?? "Carregando…"}</SheetDescription>
            </SheetHeader>
            {!loadError && (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </>
        ) : (
          <>
            <SheetHeader>
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle>{form.declared_name ?? form.invitee_name}</SheetTitle>
                <RegistrationStatusBadge status={form.status} expired={expired} />
              </div>
              <SheetDescription>
                {REGISTRATION_KIND_LABEL[form.employment_kind]} · convite de {formatDate(form.created_at)}
                {form.expected_admission_date && ` · admissão prevista ${formatDate(form.expected_admission_date)}`}
                {form.submitted_at && ` · enviada ${formatDate(form.submitted_at, true)}`}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {form.status === "pendente" && (
                <section className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Link da ficha</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {expired
                        ? "O link expirou. Gere um novo para reenviar."
                        : `Válido até ${formatDate(form.expires_at)}. Qualquer pessoa com o link consegue preencher; envie só para ${form.invitee_name.split(" ")[0]}.`}
                    </p>
                  </div>
                  {form.reopen_note && (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      Devolvida para correção: “{form.reopen_note}”
                    </p>
                  )}
                  {!expired && (
                    <>
                      <div className="flex gap-2">
                        <Input readOnly value={registrationPublicUrl(form)} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                        <Button type="button" variant="outline" className="shrink-0 gap-1.5" onClick={() => copy("link", registrationPublicUrl(form))}>
                          {copied === "link" ? <Check className="size-4" /> : <Copy className="size-4" />}
                          {copied === "link" ? "Copiado" : "Copiar"}
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={() => copy("msg", buildRegistrationMessage(form))}>
                          {copied === "msg" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                          {copied === "msg" ? "Mensagem copiada" : "Copiar mensagem pronta"}
                        </Button>
                        <Button type="button" variant="secondary" size="sm" className="gap-1.5" asChild>
                          <a href={whatsappUrl(form.invitee_phone, buildRegistrationMessage(form))} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="size-3.5" />
                            Enviar pelo WhatsApp
                          </a>
                        </Button>
                      </div>
                    </>
                  )}
                </section>
              )}

              {form.status === "cancelada" && (
                <p className="rounded-xl border border-border/70 bg-muted/50 p-4 text-sm text-muted-foreground">
                  Ficha cancelada. O link não funciona mais. Se precisar, reative com um novo link.
                </p>
              )}

              {submitted && (
                <section className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Colaborador no VIOS</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {form.employee
                          ? form.applied_at
                            ? `Dados enviados para a ficha do colaborador em ${formatDate(form.applied_at, true)}.`
                            : "Os dados vão para a ficha do colaborador assim que a ficha for aprovada."
                          : "Quando o VIOS sincronizar a admissão, vincule a ficha ao colaborador. Os dados só vão para a ficha dele depois do vínculo e da aprovação."}
                      </p>
                    </div>
                    {form.employee && (
                      <Button type="button" variant="ghost" size="sm" className="shrink-0 gap-1.5" disabled={!!busy} onClick={() => run("unlink", { action: "unlink" })}>
                        <Unlink className="size-3.5" />
                        Desvincular
                      </Button>
                    )}
                  </div>

                  {form.employee ? (
                    <div className="flex items-center gap-3 rounded-lg bg-emerald-50 px-3 py-2.5">
                      <UserRoundCheck className="size-4 text-emerald-700" />
                      <div className="min-w-0 text-sm">
                        <p className="font-medium text-emerald-950">{form.employee.full_name}</p>
                        <p className="text-xs text-emerald-800">
                          {[form.employee.position, form.employee.department].filter(Boolean).join(" · ") || "Sem cargo/área"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {form.suggestions.map((suggestion) => (
                        <div key={suggestion.employeeId} className="flex items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-2.5">
                          <div className="min-w-0 text-sm">
                            <p className="font-medium text-foreground">{suggestion.fullName}</p>
                            <p className="text-xs text-muted-foreground">
                              {suggestion.reason === "cpf" ? "Mesmo CPF" : "Nome parecido"}
                              {suggestion.department ? ` · ${suggestion.department}` : ""}
                            </p>
                          </div>
                          <Button type="button" size="sm" className="shrink-0 gap-1.5" disabled={!!busy} onClick={() => run(`link-${suggestion.employeeId}`, { action: "link", employeeId: suggestion.employeeId })}>
                            {busy === `link-${suggestion.employeeId}` ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
                            Vincular
                          </Button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Select value={manualEmployeeId || undefined} onValueChange={setManualEmployeeId}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={form.suggestions.length ? "Ou escolha outro colaborador" : "Escolha o colaborador"} />
                          </SelectTrigger>
                          <SelectContent>
                            {otherEmployees.map((employee) => (
                              <SelectItem key={employee.id} value={employee.id}>
                                {employee.full_name}
                                {employee.department ? ` — ${employee.department}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="outline" className="shrink-0" disabled={!manualEmployeeId || !!busy} onClick={() => run("link-manual", { action: "link", employeeId: manualEmployeeId })}>
                          Vincular
                        </Button>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {submitted &&
                (editing && draft ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/60 px-4 py-3">
                      <p className="text-sm text-foreground">Corrigindo a ficha</p>
                      <Select value={draftKind} onValueChange={(value) => setDraftKind(value as RegistrationKind)}>
                        <SelectTrigger className="w-48 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {REGISTRATION_KINDS.map((kind) => (
                            <SelectItem key={kind} value={kind}>
                              {REGISTRATION_KIND_LABEL[kind]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <RegistrationFormFields
                      kind={draftKind}
                      answers={draft}
                      errors={fieldErrors}
                      disabled={busy === "save"}
                      onChange={handleDraftChange}
                    />
                  </div>
                ) : (
                  <RegistrationAnswersView kind={form.employment_kind} answers={form.answers} />
                ))}

              {form.consent_at && !editing && (
                <p className="text-xs text-muted-foreground">
                  Declaração de veracidade e autorização LGPD aceita em {formatDate(form.consent_at, true)}.
                </p>
              )}
            </div>

            <div className="space-y-2 border-t border-black/[0.07] bg-[#fbfaf7] px-6 py-4">
              {actionError && <p className="text-sm text-destructive">{actionError}</p>}
              <div className="flex flex-wrap justify-end gap-2">
                {form.status === "pendente" && (
                  <>
                    <Button type="button" variant="ghost" className="gap-1.5" disabled={!!busy} onClick={() => run("cancel", { action: "cancel" })}>
                      <XCircle className="size-4" />
                      Cancelar ficha
                    </Button>
                    <Button type="button" variant="outline" className="gap-1.5" disabled={!!busy} onClick={() => run("regenerate", { action: "regenerate" })}>
                      {busy === "regenerate" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                      Gerar novo link
                    </Button>
                  </>
                )}
                {form.status === "cancelada" && (
                  <Button type="button" variant="outline" className="gap-1.5" disabled={!!busy} onClick={() => run("regenerate", { action: "regenerate" })}>
                    <RefreshCw className="size-4" />
                    Reativar com novo link
                  </Button>
                )}
                {submitted && editing && (
                  <>
                    <Button type="button" variant="ghost" disabled={busy === "save"} onClick={() => setEditing(false)}>
                      Descartar
                    </Button>
                    <Button
                      type="button"
                      className="gap-1.5"
                      disabled={busy === "save"}
                      onClick={async () => {
                        const ok = await run("save", { action: "save", answers: draft, employmentKind: draftKind });
                        if (ok) setEditing(false);
                      }}
                    >
                      {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                      Salvar correções
                    </Button>
                  </>
                )}
                {submitted && !editing && (
                  <>
                    <Button type="button" variant="ghost" className="gap-1.5" disabled={!!busy} onClick={() => run("cancel", { action: "cancel" })}>
                      <XCircle className="size-4" />
                      Cancelar
                    </Button>
                    <Button type="button" variant="outline" className="gap-1.5" disabled={!!busy} onClick={() => { setReopenNote(""); setReopenOpen(true); }}>
                      <Undo2 className="size-4" />
                      Devolver para a pessoa
                    </Button>
                    <Button type="button" variant="outline" className="gap-1.5" disabled={!!busy} onClick={startEditing}>
                      <Pencil className="size-4" />
                      Corrigir
                    </Button>
                    {form.status === "recebida" && (
                      <Button type="button" className="gap-1.5" disabled={!!busy} onClick={() => run("approve", { action: "approve" })}>
                        {busy === "approve" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                        Aprovar ficha
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Devolver para correção</DialogTitle>
                  <DialogDescription>
                    O mesmo link volta a funcionar com as respostas preenchidas. Diga o que precisa ser ajustado; a
                    pessoa verá este recado no topo da ficha.
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  rows={4}
                  value={reopenNote}
                  placeholder="Ex.: o número da conta está incompleto, falta o dígito."
                  onChange={(event) => setReopenNote(event.target.value)}
                />
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setReopenOpen(false)}>
                    Voltar
                  </Button>
                  <Button
                    type="button"
                    disabled={!reopenNote.trim() || busy === "reopen"}
                    onClick={async () => {
                      const ok = await run("reopen", { action: "reopen", note: reopenNote });
                      if (ok) setReopenOpen(false);
                    }}
                  >
                    {busy === "reopen" && <Loader2 className="size-4 animate-spin" />}
                    Devolver
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
