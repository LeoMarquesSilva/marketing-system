"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Check, CheckCheck, CircleSlash, FileText, ListChecks, Pencil, Plus, RotateCcw, SlidersHorizontal, Stamp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PersonFace } from "@/components/pesquisas/shared";
import { formatBrl, type EventAttachment, type EventTask } from "@/lib/eventos";
import { APPROVAL_STATUS_LABEL, approvalLinkHref, groupApprovals, type ApprovalStatus, type EventApproval } from "@/lib/eventos-orcamento";
import { decideEventApproval, deleteEventApproval, saveEventApproval, type ApprovalInput } from "@/lib/eventos-orcamento-db";
import { resolveEmployeeAvatarUrl } from "@/lib/ferias/filters";
import { parseBrlInput } from "@/lib/money-br";
import type { User } from "@/lib/users";
import { cn } from "@/lib/utils";

const CARD = "rounded-lg border border-[#dce9eb] bg-card shadow-[0_1px_2px_rgba(3,32,47,0.05)]";
const IMAGE = /\.(png|jpe?g|webp|gif)(?:[?#]|$)/i;

type Decision = Exclude<ApprovalStatus, "pendente">;

const DECISION_STYLE: Record<Decision, string> = {
  aprovado: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  ajustar: "bg-amber-50 text-amber-800 ring-amber-200",
  reprovado: "bg-rose-50 text-rose-800 ring-rose-200",
};

const DECISION_OPTIONS: { value: Decision; label: string; icon: typeof Check }[] = [
  { value: "aprovado", label: "Aprovado", icon: Check },
  { value: "ajustar", label: "Aprovado com ajuste", icon: SlidersHorizontal },
  { value: "reprovado", label: "Não segue", icon: CircleSlash },
];

function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function formatDay(iso: string | null): string {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year.slice(2)}`;
}

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : name.trim();
}

/** Atalho do cartão: tela do sistema abre na mesma aba; endereço de fora, em outra. */
function ApprovalLink({ approval, compact }: { approval: EventApproval; compact?: boolean }) {
  const href = approvalLinkHref(approval.linkUrl);
  if (!href) return null;
  const external = href.startsWith("https://");
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-md font-medium text-[#285f7a] outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/40",
        compact ? "text-xs hover:underline" : "border border-[#dce9eb] bg-[#f3fafb] px-3 py-2 text-sm hover:border-[#47cdd0]/70 hover:bg-[#47cdd0]/10"
      )}
    >
      <span className="truncate">{approval.linkLabel?.trim() || "Abrir no sistema"}</span>
      <ArrowUpRight className={cn("shrink-0", compact ? "size-3.5" : "size-4")} aria-hidden />
    </a>
  );
}

/** Anexos da tarefa ligada: imagens em miniatura (clicar abre) e os demais como arquivo. */
function Attachments({ files }: { files: EventAttachment[] }) {
  if (files.length === 0) return null;
  const images = files.filter((file) => IMAGE.test(file.url));
  const others = files.filter((file) => !IMAGE.test(file.url));
  return (
    <div className="mt-3 space-y-2">
      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((file) => (
            <li key={file.id}>
              <a href={file.url} target="_blank" rel="noreferrer" title={file.title} className="group block overflow-hidden rounded-md border border-[#dce9eb] bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={file.url} alt={file.title} loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-[1.03]" />
                <span className="block truncate bg-white px-2 py-1 text-xs text-muted-foreground">{file.title}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {others.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {others.map((file) => (
            <li key={file.id}>
              <a href={file.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-[#dce9eb] bg-white px-2.5 py-1.5 text-xs font-medium text-[#285f7a] hover:border-[#47cdd0]/70 hover:bg-[#47cdd0]/10">
                <FileText className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{file.title}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DecisionDialog({
  approval,
  initial,
  busy,
  onClose,
  onSave,
}: {
  approval: EventApproval;
  initial: Decision;
  busy: boolean;
  onClose: () => void;
  onSave: (status: Decision, note: string | null, decidedOn: string) => void;
}) {
  const [status, setStatus] = useState<Decision>(initial);
  const [note, setNote] = useState(approval.decisionNote ?? "");
  const [date, setDate] = useState(approval.decidedOn ?? today());
  const needsNote = status !== "aprovado";
  const valid = Boolean(date) && (!needsNote || note.trim().length > 2);
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-lg">
        <div className="border-b border-[#e6eef0] px-5 py-4 pr-12">
          <DialogTitle className="text-base">Registrar decisão</DialogTitle>
          <DialogDescription className="text-sm">
            {approval.title} · quem decide: {shortName(approval.approverName)}
          </DialogDescription>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div role="radiogroup" aria-label="Decisão" className="grid gap-2 sm:grid-cols-3">
            {DECISION_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={status === option.value}
                onClick={() => setStatus(option.value)}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2.5 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/40",
                  status === option.value ? "border-[#347796] bg-[#f3fafb] text-foreground" : "border-[#dce9eb] text-muted-foreground hover:border-[#47cdd0]/70"
                )}
              >
                <option.icon className="size-4 shrink-0" aria-hidden />
                {option.label}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="decisao-obs">{status === "aprovado" ? "Observação (opcional)" : status === "ajustar" ? "Qual é o ajuste?" : "Por que não segue?"}</Label>
            <Textarea id="decisao-obs" rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex.: opção 5; trocar a frase do rodapé" />
          </div>
          <div className="space-y-1.5">
            <Label>Decidido em</Label>
            <DatePickerField value={date} onChange={setDate} className="w-44" />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e6eef0] px-5 py-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" disabled={busy || !valid} onClick={() => onSave(status, note.trim() || null, date)}>
            Salvar decisão
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ApprovalFormDialog({
  approval,
  users,
  tasks,
  approverNames,
  busy,
  onClose,
  onSave,
  onDelete,
}: {
  approval: EventApproval | null;
  users: User[];
  tasks: EventTask[];
  approverNames: string[];
  busy: boolean;
  onClose: () => void;
  onSave: (input: ApprovalInput) => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(approval?.title ?? "");
  const [context, setContext] = useState(approval?.context ?? "");
  const [approverId, setApproverId] = useState(approval?.approverUserId ?? "");
  const [taskId, setTaskId] = useState(approval?.taskId ?? "");
  const [amount, setAmount] = useState(approval?.amount != null ? String(approval.amount) : "");
  const [linkUrl, setLinkUrl] = useState(approval?.linkUrl ?? "");
  const [linkLabel, setLinkLabel] = useState(approval?.linkLabel ?? "");
  const linkValid = !linkUrl.trim() || approvalLinkHref(linkUrl) != null;
  const people = useMemo(() => {
    const known = new Set(approverNames.map((name) => name.toLowerCase()));
    return users
      .filter((user) => user.is_active)
      .sort((a, b) => Number(known.has(b.name.toLowerCase())) - Number(known.has(a.name.toLowerCase())) || a.name.localeCompare(b.name, "pt-BR"));
  }, [users, approverNames]);
  const approver = people.find((user) => user.id === approverId);
  const approverName = approver?.name ?? (approval && !approverId ? approval.approverName : "");
  const valid = title.trim().length > 2 && Boolean(approverName) && linkValid;
  const select = "h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/40";
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-xl">
        <div className="border-b border-[#e6eef0] px-5 py-4 pr-12">
          <DialogTitle className="text-base">{approval ? "Editar aprovação" : "Nova aprovação"}</DialogTitle>
          <DialogDescription className="text-sm">O que precisa de decisão e quem decide. Ligue a uma tarefa para mostrar os anexos dela.</DialogDescription>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="aprov-titulo">O que aprovar</Label>
            <Input id="aprov-titulo" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Backdrop de fotos" autoFocus />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="aprov-quem">Quem decide</Label>
              <select id="aprov-quem" className={select} value={approverId} onChange={(event) => setApproverId(event.target.value)}>
                <option value="">{approval && !approval.approverUserId ? approval.approverName : "Escolha a pessoa"}</option>
                {people.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aprov-valor">Valor (opcional)</Label>
              <CurrencyInput id="aprov-valor" value={amount} onChange={setAmount} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="aprov-contexto">Contexto</Label>
            <Textarea id="aprov-contexto" rows={5} value={context} onChange={(event) => setContext(event.target.value)} placeholder="O que a pessoa precisa saber para decidir" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="aprov-tarefa">Tarefa do checklist (anexos)</Label>
            <select id="aprov-tarefa" className={select} value={taskId} onChange={(event) => setTaskId(event.target.value)}>
              <option value="">Sem tarefa ligada</option>
              {[...tasks].sort((a, b) => a.title.localeCompare(b.title, "pt-BR")).map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="aprov-link">Atalho (opcional)</Label>
              <Input id="aprov-link" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="/convites-festa ou https://…" aria-invalid={!linkValid} />
              {!linkValid && <p className="text-xs text-rose-700">Use uma tela do sistema (começa com /) ou um endereço https.</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aprov-link-nome">Texto do atalho</Label>
              <Input id="aprov-link-nome" value={linkLabel} onChange={(event) => setLinkLabel(event.target.value)} placeholder="Ex.: Abrir Convites dos clientes" />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e6eef0] px-5 py-3">
          {onDelete && (
            <Button variant="ghost" size="sm" className="mr-auto text-rose-700" disabled={busy} onClick={onDelete}>
              Excluir
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={busy || !valid}
            onClick={() =>
              onSave({
                title: title.trim(),
                context: context.trim() || null,
                approverName,
                approverUserId: approver?.id ?? null,
                taskId: taskId || null,
                amount: amount ? parseBrlInput(amount) : null,
                linkUrl: approvalLinkHref(linkUrl),
                linkLabel: approvalLinkHref(linkUrl) ? linkLabel.trim() || null : null,
              })
            }
          >
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EventoAprovacoesTab({
  eventId,
  approvals,
  onChange,
  tasks,
  attachments,
  users,
  currentUserId,
  onHistory,
}: {
  eventId: string;
  approvals: EventApproval[];
  onChange: (next: EventApproval[]) => void;
  tasks: EventTask[];
  attachments: EventAttachment[];
  users: User[];
  currentUserId: string | null;
  onHistory: (label: string, payload: Record<string, unknown>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [deciding, setDeciding] = useState<{ approval: EventApproval; initial: Decision } | null>(null);
  const [form, setForm] = useState<{ approval: EventApproval | null } | null>(null);
  const groups = useMemo(() => groupApprovals(approvals), [approvals]);
  const pendingTotal = approvals.filter((approval) => approval.status === "pendente").length;

  const filesOf = (approval: EventApproval) => (approval.taskId ? attachments.filter((file) => file.relatedId === approval.taskId) : []);
  const taskOf = (approval: EventApproval) => tasks.find((task) => task.id === approval.taskId);
  const userOf = (id: string | null) => users.find((user) => user.id === id);

  const decide = async (approval: EventApproval, status: ApprovalStatus, note: string | null, decidedOn: string | null) => {
    setBusy(true);
    const saved = await decideEventApproval(approval.id, { status, note, decidedOn, decidedByUserId: currentUserId });
    setBusy(false);
    if (!saved) return false;
    onChange(approvals.map((item) => (item.id === saved.id ? saved : item)));
    onHistory(
      status === "pendente" ? `Aprovação reaberta: ${approval.title}` : `Decisão registrada: ${approval.title} — ${APPROVAL_STATUS_LABEL[status]}`,
      { approvalId: approval.id, status, note, decidedOn, approver: approval.approverName }
    );
    return true;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Aprovações</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            O que precisa de decisão, de quem, e o que já foi decidido.
            {pendingTotal > 0 ? ` ${pendingTotal} ${pendingTotal === 1 ? "item espera" : "itens esperam"} decisão.` : ""}
          </p>
        </div>
        <Button onClick={() => setForm({ approval: null })}>
          <Plus className="size-4" />
          Nova aprovação
        </Button>
      </div>

      {groups.length === 0 && (
        <div className={cn(CARD, "flex flex-col items-center gap-2 px-6 py-12 text-center")}>
          <Stamp className="size-6 text-[#3e84a8]" aria-hidden />
          <p className="text-sm font-medium text-foreground">Nenhuma aprovação cadastrada</p>
          <p className="max-w-sm text-sm text-muted-foreground">Cadastre o que depende de decisão e de quem, para levar tudo de uma vez à reunião.</p>
        </div>
      )}

      {groups.map((group) => {
        const person = userOf(group.approverUserId);
        return (
          <section key={group.approverName} aria-label={`Aprovações de ${group.approverName}`} className="space-y-3">
            <div className="flex items-center gap-3">
              <PersonFace
                size="md"
                person={{ short_name: group.approverName, avatar_url: person ? resolveEmployeeAvatarUrl(person.avatar_url, person.photo_onedrive_url ?? null) : null }}
              />
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-foreground">{shortName(group.approverName)}</h3>
                <p className="text-xs text-muted-foreground">
                  {group.pending.length} para decidir · {group.decided.length} {group.decided.length === 1 ? "decidida" : "decididas"}
                </p>
              </div>
            </div>

            {group.pending.length > 0 && (
              <ul className="grid gap-3 xl:grid-cols-2">
                {group.pending.map((approval) => {
                  const task = taskOf(approval);
                  return (
                    <li key={approval.id} className={cn(CARD, "flex flex-col p-4")}>
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-semibold leading-5 text-foreground">{approval.title}</h4>
                          {approval.amount != null && <p className="mt-0.5 text-sm font-semibold tabular-nums text-[#285f7a]">{formatBrl(approval.amount)}</p>}
                        </div>
                        <Button size="icon-sm" variant="ghost" aria-label={`Editar ${approval.title}`} onClick={() => setForm({ approval })}>
                          <Pencil className="size-4" />
                        </Button>
                      </div>
                      {approval.context && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/80">{approval.context}</p>}
                      {approvalLinkHref(approval.linkUrl) && (
                        <div className="mt-3">
                          <ApprovalLink approval={approval} />
                        </div>
                      )}
                      <Attachments files={filesOf(approval)} />
                      {task && (
                        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <ListChecks className="size-3.5 shrink-0" aria-hidden />
                          <span className="truncate">No checklist: {task.title}</span>
                        </p>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-[#eef3f4] pt-3">
                        <Button size="sm" disabled={busy} onClick={() => setDeciding({ approval, initial: "aprovado" })}>
                          <Check className="size-4" />
                          Aprovar
                        </Button>
                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => setDeciding({ approval, initial: "ajustar" })}>
                          <SlidersHorizontal className="size-4" />
                          Aprovar com ajuste
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setDeciding({ approval, initial: "reprovado" })}>
                          Não segue
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {group.decided.length > 0 && (
              <div className={cn(CARD, "overflow-hidden")}>
                <p className="flex items-center gap-2 border-b border-[#e6eef0] px-4 py-2.5 text-sm font-semibold text-foreground">
                  <CheckCheck className="size-4 text-[#3e84a8]" aria-hidden />
                  Decididas
                </p>
                <ul className="divide-y divide-[#eef3f4]">
                  {group.decided.map((approval) => {
                    const status = approval.status as Decision;
                    return (
                      <li key={approval.id} className="flex flex-wrap items-start gap-x-3 gap-y-1.5 px-4 py-2.5">
                        <span className={cn("mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", DECISION_STYLE[status])}>
                          {APPROVAL_STATUS_LABEL[status]}
                        </span>
                        <div className="min-w-48 flex-1">
                          <p className="text-sm font-medium text-foreground">
                            {approval.title}
                            {approval.amount != null ? <span className="font-normal text-muted-foreground"> · {formatBrl(approval.amount)}</span> : null}
                          </p>
                          {approval.decisionNote && <p className="text-xs leading-5 text-muted-foreground">{approval.decisionNote}</p>}
                          <ApprovalLink approval={approval} compact />
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDay(approval.decidedOn)}</span>
                        <Button size="icon-sm" variant="ghost" aria-label={`Editar decisão de ${approval.title}`} onClick={() => setDeciding({ approval, initial: status })}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button size="icon-sm" variant="ghost" aria-label={`Reabrir ${approval.title}`} title="Voltar para decidir" disabled={busy} onClick={() => void decide(approval, "pendente", null, null)}>
                          <RotateCcw className="size-4" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        );
      })}

      {deciding && (
        <DecisionDialog
          approval={deciding.approval}
          initial={deciding.initial}
          busy={busy}
          onClose={() => setDeciding(null)}
          onSave={async (status, note, decidedOn) => {
            if (await decide(deciding.approval, status, note, decidedOn)) setDeciding(null);
          }}
        />
      )}
      {form && (
        <ApprovalFormDialog
          approval={form.approval}
          users={users}
          tasks={tasks}
          approverNames={groups.map((group) => group.approverName)}
          busy={busy}
          onClose={() => setForm(null)}
          onSave={async (input) => {
            setBusy(true);
            const saved = await saveEventApproval(eventId, input, form.approval?.id);
            setBusy(false);
            if (!saved) return;
            onChange(form.approval ? approvals.map((item) => (item.id === saved.id ? saved : item)) : [...approvals, saved]);
            onHistory(form.approval ? `Aprovação atualizada: ${saved.title}` : `Aprovação criada: ${saved.title}`, { approvalId: saved.id, approver: saved.approverName });
            setForm(null);
          }}
          onDelete={
            form.approval
              ? async () => {
                  const target = form.approval;
                  if (!target) return;
                  setBusy(true);
                  const ok = await deleteEventApproval(target.id);
                  setBusy(false);
                  if (!ok) return;
                  onChange(approvals.filter((item) => item.id !== target.id));
                  onHistory(`Aprovação removida: ${target.title}`, { approvalId: target.id });
                  setForm(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
