"use client";

import { useMemo, useState } from "react";
import { Check, CircleSlash, History, Lock, Pencil, Plus, RotateCcw, SlidersHorizontal, Stamp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  STAGE_LABELS,
  currentDecision,
  currentStatus,
  itemStatus,
  todayInSaoPaulo,
  type ApprovalStage,
  type DecisionStatus,
  type DocApprovalItem,
  type DocBoard,
  type DocPerson,
} from "@/lib/documentario/types";
import { CARD, DecisionBadge, EmptyState, Face, Feedback, SELECT, docRequest, formatDateBr, formatDateTimeShort, personOf } from "./shared";

const STAGES: ApprovalStage[] = ["validacao", "editorial", "producao"];

const OPTIONS: { value: Exclude<DecisionStatus, "pendente">; label: string; icon: typeof Check; hint: string }[] = [
  { value: "aprovado", label: "Aprovado", icon: Check, hint: "Segue como está." },
  { value: "ajustar", label: "Aprovado com ajuste", icon: SlidersHorizontal, hint: "Segue, com a mudança anotada." },
  { value: "recusado", label: "Recusado", icon: CircleSlash, hint: "Não entra no filme." },
];

/** Contagem no cartão de cada sócio: singular e plural. */
const COUNT_LABELS: Record<DecisionStatus, [string, string]> = {
  pendente: ["pendente", "pendentes"],
  aprovado: ["aprovado", "aprovados"],
  ajustar: ["aprovado com ajuste", "aprovados com ajuste"],
  recusado: ["recusado", "recusados"],
};

function canRecordFor(board: DocBoard, personKey: string): boolean {
  return board.viewer.can_edit || board.viewer.person_key === personKey;
}

/* ------------------------------------------------------------------ decisão */

function DecisionDialog({
  board,
  item,
  person,
  onClose,
  onSaved,
}: {
  board: DocBoard;
  item: DocApprovalItem;
  person: DocPerson;
  onClose: () => void;
  onSaved: (approvals: DocApprovalItem[]) => void;
}) {
  const current = currentDecision(item, person.key);
  const [status, setStatus] = useState<Exclude<DecisionStatus, "pendente">>(current && current.status !== "pendente" ? current.status : "aprovado");
  const [note, setNote] = useState(current?.status !== "pendente" ? current?.note ?? "" : "");
  const [date, setDate] = useState(current?.decided_on ?? todayInSaoPaulo());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsNote = status !== "aprovado";
  const valid = Boolean(date) && (!needsNote || note.trim().length > 2);
  const self = board.viewer.person_key === person.key;

  async function save(nextStatus: DecisionStatus) {
    setBusy(true);
    setError(null);
    try {
      const result = await docRequest<{ approvals: DocApprovalItem[] }>({
        action: "approval.decide",
        itemId: item.id,
        personKey: person.key,
        status: nextStatus,
        note: nextStatus === "pendente" ? null : note.trim() || null,
        decidedOn: nextStatus === "pendente" ? null : date,
      });
      onSaved(result.approvals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível registrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-xl">
        <div className="flex items-start gap-3 border-b border-[#e6eef0] px-5 py-4 pr-12">
          <Face name={person.name} avatarUrl={person.avatar_url} size="md" />
          <div className="min-w-0">
            <DialogTitle className="text-base">{self ? "Sua decisão" : `Decisão de ${person.short_name}`}</DialogTitle>
            <DialogDescription className="text-sm">{item.title}</DialogDescription>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
          {item.context && <p className="whitespace-pre-wrap rounded-md bg-[#f6fafb] px-3 py-2.5 text-sm leading-6 text-foreground/85">{item.context}</p>}
          <div role="radiogroup" aria-label="Decisão" className="grid gap-2 sm:grid-cols-3">
            {OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={status === option.value}
                onClick={() => setStatus(option.value)}
                className={cn(
                  "flex min-h-16 flex-col items-start gap-0.5 rounded-md border px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/40",
                  status === option.value ? "border-[#347796] bg-[#f3fafb]" : "border-[#dce9eb] hover:border-[#47cdd0]/70",
                )}
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <option.icon className="size-4" aria-hidden />
                  {option.label}
                </span>
                <span className="text-xs text-muted-foreground">{option.hint}</span>
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="decisao-obs">{status === "aprovado" ? "Observação (opcional)" : status === "ajustar" ? "Qual é o ajuste?" : "Por que não entra?"}</Label>
            <Textarea id="decisao-obs" rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder={status === "ajustar" ? "Ex.: pode gravar, mas não exibir na versão da festa" : ""} />
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label>Decidido em</Label>
              <DatePickerField value={date} onChange={setDate} className="w-44" />
            </div>
            <p className="pb-2 text-xs text-muted-foreground">Fica registrado na versão {board.project.version_label} do projeto.</p>
          </div>
          {item.decisions.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <History className="size-3.5" aria-hidden />
                Histórico deste item
              </p>
              <ol className="space-y-1.5">
                {item.decisions.map((decision) => (
                  <li key={decision.id} className="flex flex-wrap items-start gap-2 text-sm">
                    <span className="w-16 shrink-0 text-xs font-medium text-foreground">{personOf(board.people, decision.person_key)?.short_name ?? decision.person_key}</span>
                    <DecisionBadge status={decision.status} label={decision.status === "pendente" ? "Reaberto" : undefined} />
                    <span className="min-w-40 flex-1 text-xs leading-5 text-muted-foreground">
                      {decision.note ? `${decision.note} · ` : ""}
                      {decision.decided_on ? formatDateBr(decision.decided_on) : formatDateTimeShort(decision.created_at)}
                      {decision.project_version ? ` · v${decision.project_version}` : ""}
                      {decision.recorded_by_name ? ` · registrado por ${decision.recorded_by_name}` : ""}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e6eef0] px-5 py-3">
          {current && current.status !== "pendente" && (
            <Button variant="ghost" size="sm" className="mr-auto" disabled={busy} onClick={() => void save("pendente")}>
              <RotateCcw className="size-4" />
              Voltar para pendente
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button size="sm" disabled={busy || !valid} onClick={() => void save(status)}>
            Registrar decisão
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ item */

function ItemDialog({
  board,
  item,
  onClose,
  onSaved,
}: {
  board: DocBoard;
  item: DocApprovalItem | null;
  onClose: () => void;
  onSaved: (approvals: DocApprovalItem[]) => void;
}) {
  const [stage, setStage] = useState<ApprovalStage>(item?.stage ?? "validacao");
  const [title, setTitle] = useState(item?.title ?? "");
  const [context, setContext] = useState(item?.context ?? "");
  const [sensitive, setSensitive] = useState(item?.sensitive ?? false);
  const [approvers, setApprovers] = useState<string[]>(item?.approvers ?? board.people.filter((person) => person.is_approver).map((person) => person.key));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const result = await docRequest<{ approvals: DocApprovalItem[] }>(payload);
      onSaved(result.approvals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-xl">
        <div className="border-b border-[#e6eef0] px-5 py-4 pr-12">
          <DialogTitle className="text-base">{item ? "Editar item" : "Novo item para aprovar"}</DialogTitle>
          <DialogDescription className="text-sm">O que os sócios precisam decidir e quem decide.</DialogDescription>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="item-titulo">O que aprovar</Label>
            <Input id="item-titulo" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="item-contexto">Contexto</Label>
            <Textarea id="item-contexto" rows={4} value={context} onChange={(event) => setContext(event.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="item-etapa">Etapa</Label>
              <select id="item-etapa" className={SELECT} value={stage} onChange={(event) => setStage(event.target.value as ApprovalStage)}>
                {STAGES.map((value) => (
                  <option key={value} value={value}>
                    {STAGE_LABELS[value].title}
                  </option>
                ))}
              </select>
            </div>
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">Quem decide</legend>
              <div className="flex flex-wrap gap-3 pt-1">
                {board.people.map((person) => (
                  <label key={person.key} className="inline-flex min-h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-[#347796]"
                      checked={approvers.includes(person.key)}
                      onChange={(event) => setApprovers(event.target.checked ? [...approvers, person.key] : approvers.filter((key) => key !== person.key))}
                    />
                    {person.short_name}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 accent-[#48466e]" checked={sensitive} onChange={(event) => setSensitive(event.target.checked)} />
            <span>
              <span className="font-medium">Tema sensível</span>
              <span className="block text-xs text-muted-foreground">História pessoal ou familiar: precisa de ok específico de quem decide.</span>
            </span>
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e6eef0] px-5 py-3">
          {item && (
            <Button variant="ghost" size="sm" className="mr-auto text-rose-700" disabled={busy} onClick={() => void send({ action: "approval.delete", id: item.id })}>
              Excluir item
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={busy || title.trim().length < 3 || approvers.length === 0}
            onClick={() =>
              void send({ action: "approval.save", id: item?.id, stage, title: title.trim(), context: context.trim() || null, sensitive, approvers })
            }
          >
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ página */

const BAR_TONE: Record<DecisionStatus, string> = {
  aprovado: "bg-emerald-500",
  ajustar: "bg-amber-400",
  recusado: "bg-rose-500",
  pendente: "bg-[#dfe8eb]",
};

function FounderPanel({ board, person, onMine }: { board: DocBoard; person: DocPerson; onMine: () => void }) {
  const mine = board.approvals.filter((item) => item.approvers.includes(person.key));
  const order: DecisionStatus[] = ["aprovado", "ajustar", "recusado", "pendente"];
  const counts = order.map((status) => ({ status, total: mine.filter((item) => currentStatus(item, person.key) === status).length }));
  const pending = counts.find((count) => count.status === "pendente")?.total ?? 0;
  const isMe = board.viewer.person_key === person.key;
  return (
    <section aria-label={`Decisões de ${person.short_name}`} className={cn(CARD, "flex gap-4 px-5 py-5")}>
      <Face name={person.name} avatarUrl={person.avatar_url} size="xl" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[17px] font-semibold leading-6 text-foreground">{person.name}</p>
          {isMe && <span className="rounded-full bg-[#47cdd0]/15 px-2 py-0.5 text-xs font-semibold text-[#1f5d63]">Você</span>}
        </div>
        <p className="text-sm text-muted-foreground">
          {mine.length - pending} de {mine.length} itens decididos
        </p>
        <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-[#eef3f5]" role="img" aria-label={counts.map((count) => `${count.total} ${COUNT_LABELS[count.status][1]}`).join(", ")}>
          {counts.map((count) =>
            count.total ? <span key={count.status} className={cn("h-full", BAR_TONE[count.status])} style={{ width: `${(count.total / Math.max(1, mine.length)) * 100}%` }} /> : null,
          )}
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
          {counts
            .filter((count) => count.total > 0 || count.status === "pendente")
            .map((count) => (
              <li key={count.status} className="flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", BAR_TONE[count.status])} aria-hidden />
                <span className="font-semibold tabular-nums text-foreground">{count.total}</span> {COUNT_LABELS[count.status][count.total === 1 ? 0 : 1]}
              </li>
            ))}
        </ul>
        {pending > 0 && (isMe || board.viewer.can_edit) && (
          <button type="button" onClick={onMine} className="mt-3 text-sm font-medium text-[#285f7a] hover:underline">
            {isMe ? "Ver o que espera a sua decisão" : `Ver o que espera ${person.short_name}`}
          </button>
        )}
      </div>
    </section>
  );
}

function DecisionSlot({
  board,
  item,
  person,
  onDecide,
}: {
  board: DocBoard;
  item: DocApprovalItem;
  person: DocPerson;
  onDecide: () => void;
}) {
  const decision = currentDecision(item, person.key);
  const status = decision?.status ?? "pendente";
  const allowed = canRecordFor(board, person.key);
  const self = board.viewer.person_key === person.key;
  const outdated = decision && status !== "pendente" && decision.project_version && decision.project_version !== board.project.version_label;

  if (status === "pendente") {
    if (!allowed) {
      return (
        <div className="flex items-center gap-2.5 rounded-md border border-dashed border-[#d5e2e6] px-3 py-2.5 text-sm text-muted-foreground">
          <Face name={person.name} avatarUrl={person.avatar_url} size="sm" />
          Aguardando {person.short_name}
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={onDecide}
        className="flex w-full items-center gap-2.5 rounded-md border border-dashed border-[#9cc3d2] bg-white px-3 py-2.5 text-left text-sm font-medium text-[#285f7a] outline-none transition-colors hover:border-[#347796] hover:bg-[#f3fafb] focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/40"
      >
        <Face name={person.name} avatarUrl={person.avatar_url} size="sm" />
        <span className="min-w-0 flex-1">{self ? "Registrar minha decisão" : `Decisão de ${person.short_name}`}</span>
        <Plus className="size-4 shrink-0" aria-hidden />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={allowed ? onDecide : undefined}
      disabled={!allowed}
      aria-label={allowed ? `Alterar decisão de ${person.short_name}` : undefined}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-md border border-[#e3ecef] bg-white px-3 py-2.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/40",
        allowed && "hover:border-[#9cc3d2]",
      )}
    >
      <Face name={person.name} avatarUrl={person.avatar_url} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <DecisionBadge status={status} />
          <span className="text-xs text-muted-foreground">
            {decision?.decided_on ? formatDateBr(decision.decided_on) : ""}
            {outdated ? ` · v${decision?.project_version}` : ""}
          </span>
        </span>
        {decision?.note && <span className="mt-1 line-clamp-3 block text-[13px] leading-5 text-foreground/80">{decision.note}</span>}
      </span>
    </button>
  );
}

function ItemRow({
  board,
  item,
  index,
  onDecide,
  onEdit,
}: {
  board: DocBoard;
  item: DocApprovalItem;
  index: number;
  onDecide: (person: DocPerson) => void;
  onEdit: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const long = (item.context?.length ?? 0) > 220;
  const approvers = item.approvers.map((key) => personOf(board.people, key)).filter(Boolean) as DocPerson[];
  const status = itemStatus(item);
  return (
    <li className={cn("grid gap-4 px-5 py-5 md:grid-cols-[minmax(0,1fr)_300px]", item.sensitive && "bg-[#f8f7fc]")}>
      <div className="flex min-w-0 gap-3.5">
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-semibold tabular-nums",
            status === "aprovado" ? "bg-emerald-100 text-emerald-800" : status === "recusado" ? "bg-rose-100 text-rose-700" : status === "ajustar" ? "bg-amber-100 text-amber-800" : "bg-[#eaf2f5] text-[#285f7a]",
          )}
          aria-hidden
        >
          {status === "aprovado" ? <Check className="size-4" /> : index + 1}
        </span>
        <div className="min-w-0 flex-1">
          {item.sensitive && (
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#48466e]">
              <Lock className="size-3.5" aria-hidden />
              Tema pessoal: precisa de ok específico
            </p>
          )}
          <div className="flex items-start gap-2">
            <h3 className="text-[15px] font-semibold leading-6 text-foreground">{item.title}</h3>
            {board.viewer.can_edit && (
              <Button size="icon-sm" variant="ghost" className="size-7 shrink-0" aria-label={`Editar ${item.title}`} onClick={onEdit}>
                <Pencil className="size-3.5" />
              </Button>
            )}
          </div>
          {item.context && (
            <p className={cn("mt-1 max-w-[68ch] text-sm leading-6 text-foreground/75", long && !expanded && "line-clamp-3")}>{item.context}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
            {item.source && <span>{item.source}</span>}
            {long && (
              <button type="button" onClick={() => setExpanded((value) => !value)} className="font-medium text-[#285f7a] hover:underline">
                {expanded ? "Mostrar menos" : "Ler tudo"}
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {approvers.map((person) => (
          <DecisionSlot key={person.key} board={board} item={item} person={person} onDecide={() => onDecide(person)} />
        ))}
      </div>
    </li>
  );
}

export function DocAprovacaoClient({ initialBoard }: { initialBoard: DocBoard }) {
  const [board, setBoard] = useState(initialBoard);
  const [stage, setStage] = useState<ApprovalStage>("validacao");
  const [onlyPending, setOnlyPending] = useState(false);
  const [onlySensitive, setOnlySensitive] = useState(false);
  const [personFilter, setPersonFilter] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<{ item: DocApprovalItem; person: DocPerson } | null>(null);
  const [editing, setEditing] = useState<{ item: DocApprovalItem | null } | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "erro"; text: string } | null>(null);
  const approvers = board.people.filter((person) => person.is_approver);
  const visible = useMemo(
    () =>
      board.approvals.filter(
        (item) =>
          item.stage === stage &&
          (!onlyPending || item.approvers.some((key) => (!personFilter || key === personFilter) && currentStatus(item, key) === "pendente")) &&
          (!onlySensitive || item.sensitive) &&
          (!personFilter || item.approvers.includes(personFilter)),
      ),
    [board.approvals, stage, onlyPending, onlySensitive, personFilter],
  );
  const setApprovals = (approvals: DocApprovalItem[]) => setBoard((current) => ({ ...current, approvals }));
  const STAGES_ORDER: ApprovalStage[] = ["validacao", "editorial", "producao"];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {approvers.map((person) => (
          <FounderPanel
            key={person.key}
            board={board}
            person={person}
            onMine={() => {
              setPersonFilter(person.key);
              setOnlyPending(true);
              const firstStage = STAGES_ORDER.find((value) => board.approvals.some((item) => item.stage === value && item.approvers.includes(person.key) && currentStatus(item, person.key) === "pendente"));
              if (firstStage) setStage(firstStage);
            }}
          />
        ))}
      </div>

      <Feedback message={message} onClose={() => setMessage(null)} />

      <section aria-label="Itens para aprovar" className={cn(CARD, "overflow-hidden")}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6eef0] px-5 pt-4">
          <div role="tablist" aria-label="Etapas" className="-mb-px flex gap-1 overflow-x-auto">
            {STAGES_ORDER.map((value) => {
              const items = board.approvals.filter((item) => item.stage === value);
              const open = items.filter((item) => item.approvers.some((key) => currentStatus(item, key) === "pendente")).length;
              return (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={stage === value}
                  onClick={() => setStage(value)}
                  className={cn(
                    "inline-flex min-h-11 shrink-0 items-center gap-2 border-b-[3px] px-3 text-sm font-medium",
                    stage === value ? "border-[#347796] text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {STAGE_LABELS[value].title}
                  <span className={cn("rounded-full px-2 py-0.5 text-xs tabular-nums", stage === value ? "bg-[#347796] text-white" : "bg-[#eaf2f5] text-[#285f7a]")}>
                    {open ? `${open} abertos` : items.length}
                  </span>
                </button>
              );
            })}
          </div>
          {board.viewer.can_edit && (
            <Button size="sm" className="mb-3" onClick={() => setEditing({ item: null })}>
              <Plus className="size-4" />
              Novo item
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-[#eef3f4] bg-[#fafcfd] px-5 py-3">
          <p className="mr-auto text-[13px] text-muted-foreground">{STAGE_LABELS[stage].hint}</p>
          {personFilter && (
            <button type="button" onClick={() => setPersonFilter(null)} className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[#347796] px-3 text-xs font-semibold text-white">
              Só {personOf(board.people, personFilter)?.short_name}
              <span aria-hidden>×</span>
            </button>
          )}
          {(
            [
              ["Esperando decisão", onlyPending, setOnlyPending],
              ["Temas pessoais", onlySensitive, setOnlySensitive],
            ] as const
          ).map(([label, on, set]) => (
            <button
              key={label}
              type="button"
              aria-pressed={on}
              onClick={() => set(!on)}
              className={cn(
                "inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-medium",
                on ? "border-[#347796] bg-[#e9f3f8] text-[#285f7a]" : "border-[#dce9eb] bg-white text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {visible.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={Stamp} title="Nada aqui" text="Nenhum item nesta etapa com esses filtros." />
          </div>
        ) : (
          <ol className="divide-y divide-[#eef3f4]">
            {visible.map((item, index) => (
              <ItemRow key={item.id} board={board} item={item} index={index} onDecide={(person) => setDeciding({ item, person })} onEdit={() => setEditing({ item })} />
            ))}
          </ol>
        )}
      </section>

      {deciding && (
        <DecisionDialog
          board={board}
          item={deciding.item}
          person={deciding.person}
          onClose={() => setDeciding(null)}
          onSaved={(approvals) => {
            setApprovals(approvals);
            setDeciding(null);
            setMessage({ type: "ok", text: `Decisão de ${deciding.person.short_name} registrada.` });
          }}
        />
      )}
      {editing && (
        <ItemDialog
          board={board}
          item={editing.item}
          onClose={() => setEditing(null)}
          onSaved={(approvals) => {
            setApprovals(approvals);
            setEditing(null);
            setMessage({ type: "ok", text: "Itens atualizados." });
          }}
        />
      )}
    </div>
  );
}
