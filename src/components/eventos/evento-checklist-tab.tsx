"use client";

import { useId, useMemo, useState } from "react";
import { CheckCheck, ChevronDown, ListChecks, Plus, Search, SlidersHorizontal, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EventoTaskEditor } from "./evento-task-editor";
import { EventChecklistItem } from "./event-checklist-item";
import { EventChecklistProgress } from "./event-checklist-progress";
import type { EventTaskContext } from "./event-task-detail-sections";
import { availableChecklistBudget, checklistCategoryLabel, filterChecklistTasks, groupChecklistTasks, nextChecklistFollowUp, type ChecklistFilters } from "@/lib/event-checklist";
import { taskAssigneeIds, type EventTaskDraft } from "@/lib/event-task-list";
import { formatBrl, type EventAttachment, type EventBudgetItem, type EventTask } from "@/lib/eventos";
import type { User } from "@/lib/users";
import { cn } from "@/lib/utils";

const externalAssigneeKey = (name: string) => `external:${name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()}`;

export function EventoChecklistTab({ eventId, tasks, budgetItems, users, attachments = [], isBusy, onAddTask, onUpdateTask, onDeleteTask, onImportBudget, onOpenBudget, taskContext }: {
  taskContext?: EventTaskContext;
  eventId: string;
  tasks: EventTask[];
  budgetItems: EventBudgetItem[];
  users: User[];
  attachments?: EventAttachment[];
  isBusy: boolean;
  onAddTask: (draft: EventTaskDraft) => Promise<boolean>;
  onUpdateTask: (id: string, partial: Partial<EventTaskDraft>) => Promise<boolean>;
  onDeleteTask: (id: string) => Promise<boolean>;
  onImportBudget: (ids: string[]) => Promise<boolean>;
  onOpenBudget: (item: EventBudgetItem) => void;
}) {
  const [filters, setFilters] = useState<ChecklistFilters>({ search: "", status: "pending", category: "all", assignee: "all" });
  const [editor, setEditor] = useState<{ task: EventTask | null; category?: string } | null>(null);
  const [deleting, setDeleting] = useState<EventTask | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [today] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }));
  const filterId = useId();
  const sectionId = useId();
  const disabled = isBusy || working;
  const resolved = useMemo(() => {
    const people = new Map(users.map(user => [user.id, user]));
    return tasks.map(task => ({ ...task, assignees: taskAssigneeIds(task).map(id => {
      const person = people.get(id);
      const known = task.assignees?.find(person => person.id === id);
      return { id, name: person?.name ?? known?.name ?? (id === task.assigneeId ? task.assigneeName : null) ?? "Pessoa indisponível", avatar: person?.avatar_url ?? known?.avatar ?? (id === task.assigneeId ? task.assigneeAvatar : null) ?? null };
    }) }));
  }, [tasks, users]);
  const allGroups = groupChecklistTasks(resolved);
  const visible = filterChecklistTasks(resolved, filters);
  const groups = groupChecklistTasks(visible);
  const available = availableChecklistBudget(eventId, budgetItems, tasks);
  const selectedAvailable = available.filter(item => selected.includes(item.id));
  const completed = tasks.filter(task => task.status === "concluida").length;
  const pending = tasks.length - completed;
  const activeFilters = Number(filters.category !== "all") + Number(filters.assignee !== "all");
  const groupTotals = new Map(allGroups.map(group => [group.key, group]));
  const expenses = new Map(budgetItems.map(item => [item.id, item]));
  const assignees = Array.from(new Map(resolved.flatMap(task => task.assignees).map(person => [person.id, person])).values());
  const externalAssignees = Array.from(new Set(resolved.map(task => task.externalResponsibleName?.trim()).filter((name): name is string => Boolean(name)))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const selectClass = "h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15";

  async function perform(action: () => Promise<boolean>, message: string, onSuccess?: () => void) {
    if (disabled) return;
    setWorking(true); setError("");
    try { if (await action()) onSuccess?.(); else setError(message); }
    catch { setError(message); }
    finally { setWorking(false); }
  }
  function create(category?: string) { setError(""); setEditor({ task: null, category }); }

  return <div className="space-y-5 font-sans" aria-busy={disabled}>
    <EventChecklistProgress completed={completed} total={tasks.length} actions={
      <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
        <Button variant="outline" className="h-11 min-w-0 rounded-lg bg-card px-3 shadow-none" aria-label="Trazer do orçamento" disabled={disabled || !available.length} onClick={() => { setSelected([]); setError(""); setImportOpen(true); }}><Wallet className="size-4 shrink-0" /><span className="sm:hidden">Do orçamento</span><span className="hidden sm:inline">Trazer do orçamento</span></Button>
        <Button className="h-11 min-w-0 rounded-lg px-3 shadow-none" disabled={disabled} onClick={() => create(allGroups.find(group => group.key === filters.category)?.label)}><Plus className="size-4 shrink-0" />Adicionar item</Button>
      </div>
    } />

    <div className="space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:grid-cols-[minmax(0,1fr)_160px_190px_210px]">
        <div className="relative min-w-0">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground/70" />
          <Input className="h-11 rounded-xl border-border/60 bg-card pl-9 text-sm shadow-[0_2px_6px_rgba(24,56,77,0.025)]" aria-label="Buscar itens do checklist" placeholder="Buscar item, categoria ou responsável…" value={filters.search} onChange={event => setFilters(current => ({ ...current, search: event.target.value }))} />
        </div>
        <Button variant="outline" className={cn("h-11 rounded-xl border-border/60 bg-card px-3 shadow-none lg:hidden", (showFilters || activeFilters > 0) && "border-primary/30 bg-primary/5 text-primary")} aria-expanded={showFilters} aria-controls={filterId} onClick={() => setShowFilters(value => !value)}><SlidersHorizontal className="size-4" />Filtros{activeFilters > 0 && <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{activeFilters}</span>}</Button>
        <select aria-label="Filtrar situação do checklist" className={cn(selectClass, "hidden h-11 rounded-xl lg:block")} value={filters.status} onChange={event => setFilters(current => ({ ...current, status: event.target.value as ChecklistFilters["status"] }))}><option value="pending">Pendentes ({pending})</option><option value="done">Concluídos ({completed})</option><option value="all">Todos os itens ({tasks.length})</option></select>
        <select aria-label="Filtrar categoria do checklist" className={cn(selectClass, "hidden h-11 rounded-xl lg:block")} value={filters.category} onChange={event => setFilters(current => ({ ...current, category: event.target.value }))}><option value="all">Todas as categorias</option>{allGroups.map(group => <option key={group.key} value={group.key}>{group.label}</option>)}</select>
        <select aria-label="Filtrar responsável do checklist" className={cn(selectClass, "hidden h-11 rounded-xl lg:block")} value={filters.assignee} onChange={event => setFilters(current => ({ ...current, assignee: event.target.value }))}><option value="all">Todos os responsáveis</option><option value="unassigned">Sem responsável</option>{assignees.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}{externalAssignees.map(name => <option key={externalAssigneeKey(name)} value={externalAssigneeKey(name)}>{name} · externo</option>)}</select>
      </div>
      {showFilters && <div id={filterId} className="grid gap-3 rounded-xl border border-border/60 bg-card p-3 sm:grid-cols-3 lg:hidden">
        <label className="space-y-1.5"><span className="text-xs font-medium text-muted-foreground">Situação</span><select aria-label="Situação no celular" className={selectClass} value={filters.status} onChange={event => setFilters(current => ({ ...current, status: event.target.value as ChecklistFilters["status"] }))}><option value="pending">Pendentes ({pending})</option><option value="done">Concluídos ({completed})</option><option value="all">Todos os itens ({tasks.length})</option></select></label>
        <label className="space-y-1.5"><span className="text-xs font-medium text-muted-foreground">Categoria</span><select aria-label="Categoria no celular" className={selectClass} value={filters.category} onChange={event => setFilters(current => ({ ...current, category: event.target.value }))}><option value="all">Todas as categorias</option>{allGroups.map(group => <option key={group.key} value={group.key}>{group.label}</option>)}</select></label>
        <label className="space-y-1.5"><span className="text-xs font-medium text-muted-foreground">Responsável</span><select aria-label="Responsável no celular" className={selectClass} value={filters.assignee} onChange={event => setFilters(current => ({ ...current, assignee: event.target.value }))}><option value="all">Todos os responsáveis</option><option value="unassigned">Sem responsável</option>{assignees.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}{externalAssignees.map(name => <option key={externalAssigneeKey(name)} value={externalAssigneeKey(name)}>{name} · externo</option>)}</select></label>
      </div>}
      {activeFilters > 0 && <div className="flex flex-wrap items-center gap-2">
        {filters.category !== "all" && <button type="button" className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-foreground hover:bg-muted/70" aria-label="Remover filtro de categoria" onClick={() => setFilters(current => ({ ...current, category: "all" }))}>{groupTotals.get(filters.category)?.label ?? "Categoria"}<X className="size-3" /></button>}
        {filters.assignee !== "all" && <button type="button" className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-foreground hover:bg-muted/70" aria-label="Remover filtro de responsável" onClick={() => setFilters(current => ({ ...current, assignee: "all" }))}>{filters.assignee === "unassigned" ? "Sem responsável" : filters.assignee.startsWith("external:") ? externalAssignees.find(name => externalAssigneeKey(name) === filters.assignee) ?? "Responsável externo" : assignees.find(person => person.id === filters.assignee)?.name ?? "Responsável"}<X className="size-3" /></button>}
      </div>}
      <p className="text-xs text-muted-foreground lg:hidden">{visible.length} {visible.length === 1 ? "item" : "itens"} · {filters.status === "pending" ? "Pendentes" : filters.status === "done" ? "Concluídos" : "Todos"}</p>
    </div>

    {error && !importOpen && !deleting && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    {groups.map((group, index) => {
      const overall = groupTotals.get(group.key)!;
      const isCollapsed = collapsed.includes(group.key);
      const groupId = `${sectionId}-${index}`;
      return <section key={group.key} aria-label={group.label} className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-[0_2px_8px_rgba(24,56,77,0.025)]">
        <div className="flex items-center justify-between gap-2 border-b border-border/50 px-3 py-3 sm:px-5">
          <button type="button" aria-expanded={!isCollapsed} aria-controls={groupId} aria-label={`${isCollapsed ? "Expandir" : "Recolher"} categoria ${group.label}`} onClick={() => setCollapsed(current => isCollapsed ? current.filter(key => key !== group.key) : [...current, group.key])} className="flex min-h-9 min-w-0 items-center gap-2 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-primary">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary"><ListChecks aria-hidden className="size-4" /></span>
            <h3 className="truncate text-sm font-semibold">{group.label}</h3>
            <span className="rounded-md bg-muted/60 px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">{group.tasks.length}</span>
            <ChevronDown aria-hidden className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", isCollapsed && "-rotate-90")} />
          </button>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-xs tabular-nums text-muted-foreground xl:inline">{overall.completed} de {overall.tasks.length} concluídos</span>
            <Button variant="ghost" size="sm" className="size-9 p-0 text-primary sm:w-auto sm:px-2" disabled={disabled} aria-label={`Adicionar item em ${group.label}`} onClick={() => create(group.key === "sem categoria" ? undefined : group.label)}><Plus className="size-4" /><span className="hidden sm:inline">Adicionar item</span></Button>
          </div>
        </div>
        <div id={groupId} hidden={isCollapsed} className="divide-y divide-border/50">
          {group.tasks.map(task => <EventChecklistItem key={task.id} task={task} expense={task.budgetItemId ? expenses.get(task.budgetItemId) : undefined} nextFollowUp={nextChecklistFollowUp(task, taskContext?.history ?? [])} today={today} disabled={disabled} onToggle={() => void perform(() => onUpdateTask(task.id, { status: task.status === "concluida" ? "pendente" : "concluida" }), "Não foi possível atualizar o item. Tente novamente.")} onEdit={() => { setError(""); setEditor({ task }); }} onDelete={() => { setError(""); setDeleting(task); }} onOpenBudget={onOpenBudget} />)}
        </div>
      </section>;
    })}
    {!visible.length && <div className="flex flex-col items-center rounded-xl border border-border/60 bg-card px-5 py-12 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/8 text-primary">{!tasks.length ? <ListChecks className="size-6" /> : <CheckCheck className="size-6" />}</span>
      <p className="text-sm font-semibold">{!tasks.length ? "Monte o checklist deste evento" : pending === 0 && filters.status === "pending" && !filters.search && filters.category === "all" && filters.assignee === "all" ? "Tudo concluído por aqui!" : "Nenhum item encontrado"}</p>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{!tasks.length ? "Cadastre as entregas por categoria ou aproveite os itens do orçamento." : "Consulte os concluídos ou ajuste os filtros para encontrar o que procura."}</p>
      {tasks.length > 0 ? <Button variant="outline" className="mt-5 rounded-lg shadow-none" onClick={() => setFilters({ search: "", status: "all", category: "all", assignee: "all" })}>Ver todos os itens</Button> : <Button className="mt-5 rounded-lg" onClick={() => create()} disabled={disabled}><Plus className="size-4" />Criar primeiro item</Button>}
    </div>}

    {editor && <EventoTaskEditor key={editor.task?.id ?? `new-${editor.category ?? ""}`} context="checklist" task={editor.task ? resolved.find(task => task.id === editor.task?.id) ?? editor.task : null} taskContext={{ ...taskContext, budgetItems, isBusy }} onDuplicate={editor.task ? onAddTask : undefined} onRequestDelete={editor.task ? () => { setDeleting(editor.task); setEditor(null); } : undefined} initialCategory={editor.category} categories={allGroups.filter(group => group.key !== "sem categoria").map(group => group.label)} users={users} attachments={attachments} onClose={() => setEditor(null)} onSave={draft => editor.task ? onUpdateTask(editor.task.id, draft) : onAddTask(draft)} />}
    <Dialog open={importOpen} onOpenChange={open => { if (!disabled) { setImportOpen(open); setError(""); } }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto font-sans sm:max-w-2xl" showCloseButton={!disabled}>
        <DialogHeader><DialogTitle>Trazer itens do orçamento</DialogTitle><DialogDescription>Selecione as despesas que precisam de acompanhamento. Depois, atribua os responsáveis e marque o que foi concluído.</DialogDescription></DialogHeader>
        <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" className="size-4 accent-primary" disabled={disabled || !available.length} checked={available.length > 0 && selectedAvailable.length === available.length} onChange={event => setSelected(event.target.checked ? available.map(item => item.id) : [])} />Selecionar todos ({available.length})</label>
        <div className="max-h-[45dvh] divide-y overflow-y-auto rounded-lg border">{available.map(item => <label key={item.id} className="flex cursor-pointer items-start gap-3 p-3 hover:bg-muted/40"><input type="checkbox" className="mt-1 size-4 shrink-0 accent-primary" disabled={disabled} checked={selected.includes(item.id)} onChange={event => setSelected(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} /><span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium">{item.description?.trim() || item.vendorName || "Despesa sem descrição"}</span><span className="mt-1 block text-xs text-muted-foreground">{checklistCategoryLabel(item.category)}{item.vendorName && ` · ${item.vendorName}`} · {formatBrl(item.amountPlanned)}</span></span></label>)}{!available.length && <p className="p-4 text-sm text-muted-foreground">Todos os itens disponíveis já estão no checklist.</p>}</div>
        <p className="text-xs text-muted-foreground">Itens já vinculados ao checklist não aparecem nesta lista.</p>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <DialogFooter><Button variant="outline" disabled={disabled} onClick={() => { setImportOpen(false); setError(""); }}>Cancelar</Button><Button disabled={disabled || !selectedAvailable.length} onClick={() => void perform(() => onImportBudget(selectedAvailable.map(item => item.id)), "Não foi possível trazer os itens. Sua seleção foi mantida; tente novamente.", () => { setImportOpen(false); setSelected([]); })}>Adicionar {selectedAvailable.length} {selectedAvailable.length === 1 ? "item" : "itens"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(deleting)} onOpenChange={open => { if (!open && !disabled) { setDeleting(null); setError(""); } }}><DialogContent className="font-sans" showCloseButton={!disabled}><DialogHeader><DialogTitle>Excluir item do checklist?</DialogTitle><DialogDescription>“{deleting?.title}” será removido também do Planner do evento.</DialogDescription></DialogHeader>{error && <p role="alert" className="text-sm text-red-600">{error}</p>}<DialogFooter><Button variant="outline" disabled={disabled} onClick={() => { setDeleting(null); setError(""); }}>Cancelar</Button><Button variant="destructive" disabled={disabled} onClick={() => deleting && void perform(() => onDeleteTask(deleting.id), "Não foi possível excluir o item. Tente novamente.", () => setDeleting(null))}>Excluir item</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
