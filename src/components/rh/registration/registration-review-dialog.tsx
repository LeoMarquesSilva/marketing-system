"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
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
import { RegistrationAnswersView } from "@/components/rh/registration/registration-answers-view";
import { RegistrationFormFields } from "@/components/rh/registration/registration-form-fields";
import { RegistrationStatusBadge } from "@/components/rh/registration/registration-status-badge";
import { RegistrationTimeline } from "@/components/rh/registration/registration-timeline";
import {
  buildRegistrationMessage,
  buildReopenMessage,
  buildSelfUpdateMessage,
  fetchRegistrationRequest,
  registrationActionRequest,
  registrationPublicUrl,
  selfRegistrationUrl,
  whatsappUrl,
} from "@/lib/rh/registration/client";
import {
  isRegistrationExpired,
  REGISTRATION_KIND_LABEL,
  REGISTRATION_KINDS,
  SELF_REGISTRATION_PATH,
  type RegistrationAnswers,
  type RegistrationDetail,
  type RegistrationEmployeeRef,
  type RegistrationField,
  type RegistrationKind,
} from "@/lib/rh/registration/types";
import { flaggedItems } from "@/lib/rh/registration/history";
import type { QualificationSyncPreview } from "@/lib/rh/registration/qualification-sync";
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

/** Antes de aprovar: o que a ficha muda na qualificação jurídica (fonte dos documentos). */
function QualificationSyncNotice({
  preview,
  kind,
  firstName,
}: {
  preview: QualificationSyncPreview;
  kind: RegistrationKind;
  firstName: string;
}) {
  if (!preview.exists) {
    if (kind !== "socio_servico") return null;
    return (
      <p className="rounded-lg border border-border/70 bg-card px-4 py-3 text-xs text-muted-foreground">
        {firstName} ainda não tem qualificação jurídica. Ao aprovar, ela é criada com os dados da ficha; estado
        civil e profissão ficam pendentes.
      </p>
    );
  }
  if (preview.changes.length === 0) {
    return (
      <p className="rounded-lg border border-border/70 bg-card px-4 py-3 text-xs text-muted-foreground">
        A qualificação jurídica de {firstName} já tem o mesmo endereço, contato e RG da ficha. Aprovar não muda nada
        nela.
      </p>
    );
  }
  return (
    <section className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/60 p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Muda na qualificação jurídica</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Ao aprovar, {preview.changes.length === 1 ? "este dado" : "estes dados"} da qualificação de {firstName},
          usada nos documentos, {preview.changes.length === 1 ? "passa" : "passam"} a ser o que veio na ficha. Confira
          antes; se algo estiver errado, corrija a ficha ou devolva para a pessoa.
        </p>
      </div>
      <dl className="divide-y divide-amber-200/70 overflow-hidden rounded-lg border border-amber-200/70 bg-background">
        {preview.changes.map((change) => (
          <div key={change.column} className="grid gap-1 px-3 py-2 sm:grid-cols-[170px_1fr] sm:gap-3">
            <dt className="text-xs text-muted-foreground sm:pt-0.5">{change.label}</dt>
            <dd className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
              {change.current ? (
                <span className="break-words text-muted-foreground line-through">{change.current}</span>
              ) : (
                <span className="text-xs italic text-muted-foreground">vazio</span>
              )}
              <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-label="passa a ser" />
              {change.next ? (
                <span className="break-words font-medium text-foreground">{change.next}</span>
              ) : (
                <span className="text-xs italic text-muted-foreground">vazio</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
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

export function RegistrationReviewDialog({
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
  // Devolver: a RH clica nos campos errados e escreve o recado, no próprio modal.
  const [returning, setReturning] = useState(false);
  const [returnFields, setReturnFields] = useState<Set<RegistrationField>>(new Set());
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
    setReturning(false);
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

  const startReturning = () => {
    if (!form) return;
    // Ajustando um pedido já feito: começa com os campos e o recado de antes.
    const again = form.status === "pendente";
    setReturnFields(new Set(again ? form.reopen_fields : []));
    setReopenNote(again ? form.reopen_note ?? "" : "");
    setEditing(false);
    setReturning(true);
  };

  const toggleReturnFields = (fields: RegistrationField[]) => {
    setReturnFields((current) => {
      const next = new Set(current);
      const allSelected = fields.every((field) => next.has(field));
      for (const field of fields) {
        if (allSelected) next.delete(field);
        else next.add(field);
      }
      return next;
    });
  };

  const returnItems = flaggedItems([...returnFields]);
  const submitted = form?.status === "recebida" || form?.status === "aprovada";
  // Devolvida: voltou a pendente, mas a pessoa já tinha enviado. As respostas continuam visíveis.
  const returned = form?.status === "pendente" && !!form?.submitted_at;
  const hasAnswers = submitted || returned;
  const expired = form ? isRegistrationExpired(form.expires_at) : false;
  // Sem link público: a própria pessoa atualiza em /minha-ficha, com login.
  const selfService = form ? !form.public_path : false;
  const firstName = form?.invitee_name.split(" ")[0] ?? "";
  const kindOptions =
    form && !REGISTRATION_KINDS.includes(form.employment_kind)
      ? [...REGISTRATION_KINDS, form.employment_kind]
      : REGISTRATION_KINDS;
  const otherEmployees = employees.filter(
    (employee) => !form?.suggestions.some((suggestion) => suggestion.employeeId === employee.id)
  );

  return (
    <Dialog open={!!formId} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl">
        {!form ? (
          <>
            <DialogHeader className="border-b border-[#eef4f5] px-6 pb-4 pr-12 pt-6 text-left">
              <DialogTitle>Ficha cadastral</DialogTitle>
              <DialogDescription>{loadError ?? "Carregando…"}</DialogDescription>
            </DialogHeader>
            {!loadError && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </>
        ) : (
          <>
            <DialogHeader className="border-b border-[#eef4f5] px-6 pb-4 pr-12 pt-6 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle>{form.declared_name ?? form.invitee_name}</DialogTitle>
                <RegistrationStatusBadge status={form.status} expired={expired} />
              </div>
              <DialogDescription>
                {REGISTRATION_KIND_LABEL[form.employment_kind]} ·{" "}
                {form.origin === "atualizacao"
                  ? "atualização feita pelo colaborador, com login"
                  : `convite de ${formatDate(form.created_at)}`}
                {form.expected_admission_date && ` · admissão prevista ${formatDate(form.expected_admission_date)}`}
                {form.submitted_at && ` · enviada ${formatDate(form.submitted_at, true)}`}
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {returning && (
                <section className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/60 p-4">
                  <div>
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <Undo2 className="size-4 text-amber-700" />
                      Devolver para {firstName}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Clique nos campos que precisam de ajuste, na ficha abaixo. {firstName} abre a ficha direto no
                      primeiro deles, com o recado no topo.
                    </p>
                  </div>
                  <Textarea
                    rows={3}
                    value={reopenNote}
                    className="bg-background"
                    placeholder="Recado para a pessoa. Ex.: o número da conta está sem o dígito."
                    onChange={(event) => setReopenNote(event.target.value)}
                  />
                  <p className="text-xs font-medium text-amber-900">
                    {returnItems.length === 0
                      ? "Nenhum campo marcado ainda."
                      : `${returnItems.length === 1 ? "1 campo marcado" : `${returnItems.length} campos marcados`}: ${returnItems
                          .map((item) => item.label)
                          .join(", ")}`}
                  </p>
                </section>
              )}

              {!returning && returned && (
                <section className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/60 p-4">
                  <div>
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <Undo2 className="size-4 text-amber-700" />
                      Devolvida, aguardando {firstName}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {selfService
                        ? `${firstName} corrige entrando com o próprio login em ${SELF_REGISTRATION_PATH}; a ficha abre direto no primeiro campo marcado.`
                        : expired
                          ? "O link expirou. Gere um novo para reenviar."
                          : `${firstName} corrige pelo mesmo link, válido até ${formatDate(form.expires_at)}; a ficha abre direto no primeiro campo marcado.`}
                    </p>
                  </div>
                  {form.reopen_note && (
                    <p className="whitespace-pre-line rounded-md bg-background px-3 py-2 text-sm text-foreground">
                      “{form.reopen_note}”
                    </p>
                  )}
                  {form.reopen_fields.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {flaggedItems(form.reopen_fields).map((item) => (
                        <span key={item.field} className="rounded-full bg-background px-2 py-0.5 text-xs text-amber-900 ring-1 ring-amber-200">
                          {item.label}
                        </span>
                      ))}
                    </div>
                  )}
                  {(selfService || !expired) && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="gap-1.5"
                        onClick={() =>
                          copy(
                            "reopen-msg",
                            buildReopenMessage({
                              name: form.invitee_name,
                              fields: form.reopen_fields,
                              note: form.reopen_note,
                              url: selfService ? selfRegistrationUrl() : registrationPublicUrl(form),
                            })
                          )
                        }
                      >
                        {copied === "reopen-msg" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                        {copied === "reopen-msg" ? "Mensagem copiada" : "Copiar mensagem do ajuste"}
                      </Button>
                      {form.invitee_phone && (
                        <Button type="button" variant="secondary" size="sm" className="gap-1.5" asChild>
                          <a
                            href={whatsappUrl(
                              form.invitee_phone,
                              buildReopenMessage({
                                name: form.invitee_name,
                                fields: form.reopen_fields,
                                note: form.reopen_note,
                                url: selfService ? selfRegistrationUrl() : registrationPublicUrl(form),
                              })
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MessageCircle className="size-3.5" />
                            Enviar pelo WhatsApp
                          </a>
                        </Button>
                      )}
                    </div>
                  )}
                </section>
              )}

              {form.status === "pendente" && !returned && selfService && (
                <section className="space-y-3 rounded-lg border border-border/70 bg-card p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Aguardando {firstName}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Esta ficha não tem link público. {firstName} corrige entrando com o próprio login em{" "}
                      <span className="font-mono">{SELF_REGISTRATION_PATH}</span>; o envio volta para cá.
                    </p>
                  </div>
                  {form.reopen_note && (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      Devolvida para correção: “{form.reopen_note}”
                    </p>
                  )}
                  <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={() => copy("self-msg", buildSelfUpdateMessage(form.invitee_name))}>
                    {copied === "self-msg" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copied === "self-msg" ? "Mensagem copiada" : "Copiar mensagem com o link"}
                  </Button>
                </section>
              )}

              {form.status === "pendente" && !returned && !selfService && (
                <section className="space-y-3 rounded-lg border border-border/70 bg-card p-4">
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
                <p className="rounded-lg border border-border/70 bg-muted/50 p-4 text-sm text-muted-foreground">
                  {selfService
                    ? `Ficha cancelada. Se ${firstName} enviar de novo por ${SELF_REGISTRATION_PATH}, uma nova ficha aparece aqui.`
                    : "Ficha cancelada. O link não funciona mais. Se precisar, reative com um novo link."}
                </p>
              )}

              {hasAnswers && (
                <section className="space-y-3 rounded-lg border border-border/70 bg-card p-4">
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
                    {form.employee && !selfService && (
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
                          {[form.employee.position, form.employee.department, form.employee.employment_type]
                            .filter(Boolean)
                            .join(" · ") || "Sem cargo/área"}
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

              {form.status === "recebida" && !editing && form.qualification_sync && (
                <QualificationSyncNotice
                  preview={form.qualification_sync}
                  kind={form.employment_kind}
                  firstName={firstName}
                />
              )}

              {hasAnswers &&
                (editing && draft ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/60 px-4 py-3">
                      <p className="text-sm text-foreground">Corrigindo a ficha</p>
                      <Select value={draftKind} onValueChange={(value) => setDraftKind(value as RegistrationKind)}>
                        <SelectTrigger className="w-48 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {kindOptions.map((kind) => (
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
                  <RegistrationAnswersView
                    kind={form.employment_kind}
                    answers={form.answers}
                    personalBank={form.personal_bank}
                    flaggedFields={returned ? form.reopen_fields : undefined}
                    selection={returning ? { selected: returnFields, onToggle: toggleReturnFields } : null}
                  />
                ))}

              {form.consent_at && !editing && !returning && (
                <p className="text-xs text-muted-foreground">
                  Declaração de veracidade e autorização LGPD aceita em {formatDate(form.consent_at, true)}.
                </p>
              )}

              {!editing && !returning && (
                <RegistrationTimeline events={form.events} personName={form.declared_name ?? form.invitee_name} />
              )}
            </div>

            <div className="space-y-2 border-t border-black/[0.07] bg-[#fbfaf7] px-6 py-4">
              {actionError && <p className="text-sm text-destructive">{actionError}</p>}
              <div className="flex flex-wrap justify-end gap-2">
                {returning ? (
                  <>
                    <Button type="button" variant="ghost" disabled={busy === "reopen"} onClick={() => setReturning(false)}>
                      Voltar
                    </Button>
                    <Button
                      type="button"
                      className="gap-1.5"
                      disabled={(!reopenNote.trim() && returnFields.size === 0) || busy === "reopen"}
                      onClick={async () => {
                        const ok = await run("reopen", { action: "reopen", note: reopenNote, fields: [...returnFields] });
                        if (ok) setReturning(false);
                      }}
                    >
                      {busy === "reopen" ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
                      {returned ? "Salvar pedido" : "Devolver"}
                    </Button>
                  </>
                ) : (
                  <>
                    {form.status === "pendente" && !editing && (
                      <>
                        <Button type="button" variant="ghost" className="gap-1.5" disabled={!!busy} onClick={() => run("cancel", { action: "cancel" })}>
                          <XCircle className="size-4" />
                          Cancelar ficha
                        </Button>
                        {!selfService && (
                          <Button type="button" variant="outline" className="gap-1.5" disabled={!!busy} onClick={() => run("regenerate", { action: "regenerate" })}>
                            {busy === "regenerate" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                            Gerar novo link
                          </Button>
                        )}
                      </>
                    )}
                    {form.status === "cancelada" && !selfService && (
                      <Button type="button" variant="outline" className="gap-1.5" disabled={!!busy} onClick={() => run("regenerate", { action: "regenerate" })}>
                        <RefreshCw className="size-4" />
                        Reativar com novo link
                      </Button>
                    )}
                    {hasAnswers && editing && (
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
                    {returned && !editing && (
                      <>
                        <Button type="button" variant="outline" className="gap-1.5" disabled={!!busy} onClick={startReturning}>
                          <Undo2 className="size-4" />
                          Alterar pedido
                        </Button>
                        <Button type="button" variant="outline" className="gap-1.5" disabled={!!busy} onClick={startEditing}>
                          <Pencil className="size-4" />
                          Corrigir
                        </Button>
                      </>
                    )}
                    {submitted && !editing && (
                      <>
                        <Button type="button" variant="ghost" className="gap-1.5" disabled={!!busy} onClick={() => run("cancel", { action: "cancel" })}>
                          <XCircle className="size-4" />
                          Cancelar
                        </Button>
                        <Button type="button" variant="outline" className="gap-1.5" disabled={!!busy} onClick={startReturning}>
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
                            {form.qualification_sync?.changes.length ? "Aprovar e atualizar qualificação" : "Aprovar ficha"}
                          </Button>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
