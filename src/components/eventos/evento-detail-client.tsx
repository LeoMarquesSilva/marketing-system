"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardList, CheckSquare, Wallet, Truck, Users, Megaphone, Paperclip, ChartLine, History, Pencil, Copy, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EventoFormDialog } from "@/components/eventos/evento-form-dialog";
import { EventoBudgetDialog } from "@/components/eventos/evento-budget-dialog";
import { EnviarEventoAoPlannerDialog } from "@/components/eventos/enviar-evento-ao-planner-dialog";
import { EventoResumoTab } from "@/components/eventos/evento-resumo-tab";
import { EventoTarefasTab } from "@/components/eventos/evento-tarefas-tab";
import { EventoOrcamentoTab } from "@/components/eventos/evento-orcamento-tab";
import { EventoFornecedoresTab } from "@/components/eventos/evento-fornecedores-tab";
import { EventoConvidadosTab } from "@/components/eventos/evento-convidados-tab";
import { EventoComunicacaoTab } from "@/components/eventos/evento-comunicacao-tab";
import { EventoArquivosTab } from "@/components/eventos/evento-arquivos-tab";
import {
  EVENT_FILES_BUCKET,
  removeFromBucket,
  uploadEventFile,
} from "@/lib/storage-buckets";
import { EventoPosEventoTab } from "@/components/eventos/evento-pos-evento-tab";
import { EventoHistoricoTab } from "@/components/eventos/evento-historico-tab";
import {
  EVENT_STATUS_LABEL,
  EVENT_STATUS_STYLE,
  addEventHistory,
  deleteEventAttachment,
  deleteEventBudgetItem,
  deleteEventCommunication,
  deleteEventInvite,
  deleteEventTask,
  deleteSupplierQuote,
  duplicateEventToNextYear,
  fetchEventById,
  fetchEventAttachments,
  fetchEventBudgetItems,
  fetchEventCommunications,
  fetchEventHistory,
  fetchEventInvites,
  fetchEventSupplierLinks,
  fetchEventTasks,
  fetchSuppliersCatalog,
  fetchSupplierQuotes,
  insertEventTask,
  isTaskOverdue,
  linkSupplierToEvent,
  unlinkSupplierFromEvent,
  upsertEventAttachment,
  upsertEventCommunication,
  upsertEventInvite,
  upsertEventPostmortem,
  insertSupplierQuote,
  updateEventTask,
  type EventAttachment,
  type EventBudgetItem,
  type EventCommunication,
  type EventCommunicationChannel,
  type EventHistoryItem,
  type EventInvite,
  type EventPostmortem,
  type EventSupplier,
  type EventSupplierLink,
  type EventSupplierQuote,
  type EventTask,
  type EventTemplate,
  type OrgEvent,
} from "@/lib/eventos";
import type { User } from "@/lib/users";
import { cn } from "@/lib/utils";

type TabId =
  | "resumo"
  | "tarefas"
  | "orcamento"
  | "fornecedores"
  | "convidados"
  | "comunicacao"
  | "arquivos"
  | "pos_evento"
  | "historico";

interface EventoDetailClientProps {
  initialEvent: OrgEvent;
  initialTasks: EventTask[];
  initialBudgetItems: EventBudgetItem[];
  initialLinkedSuppliers: EventSupplierLink[];
  initialCatalogSuppliers: EventSupplier[];
  initialQuotes: EventSupplierQuote[];
  initialInvites: EventInvite[];
  initialCommunications: EventCommunication[];
  initialAttachments: EventAttachment[];
  initialPostmortem: EventPostmortem | null;
  initialHistory: EventHistoryItem[];
  templates: EventTemplate[];
  users: User[];
  designers: User[];
}

export function EventoDetailClient({
  initialEvent,
  initialTasks,
  initialBudgetItems,
  initialLinkedSuppliers,
  initialCatalogSuppliers,
  initialQuotes,
  initialInvites,
  initialCommunications,
  initialAttachments,
  initialPostmortem,
  initialHistory,
  templates,
  users,
  designers,
}: EventoDetailClientProps) {
  const [event, setEvent] = useState(initialEvent);
  const [tasks, setTasks] = useState(initialTasks);
  const [budgetItems, setBudgetItems] = useState(initialBudgetItems);
  const [linkedSuppliers, setLinkedSuppliers] = useState(initialLinkedSuppliers);
  const [catalogSuppliers, setCatalogSuppliers] = useState(initialCatalogSuppliers);
  const [quotes, setQuotes] = useState(initialQuotes);
  const [invites, setInvites] = useState(initialInvites);
  const [communications, setCommunications] = useState(initialCommunications);
  const [attachments, setAttachments] = useState(initialAttachments);
  const [postmortem, setPostmortem] = useState(initialPostmortem);
  const [history, setHistory] = useState(initialHistory);

  const [tab, setTab] = useState<TabId>("resumo");
  const [editOpen, setEditOpen] = useState(false);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<EventBudgetItem | null>(null);
  const [plannerTask, setPlannerTask] = useState<EventTask | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState<string>("");
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [todayIso] = useState(() => new Date().toISOString().slice(0, 10));

  const budgetTotals = useMemo(() => {
    const planned = budgetItems.reduce((s, b) => s + b.amountPlanned, 0);
    const actual = budgetItems.reduce((s, b) => s + (b.amountActual ?? 0), 0);
    return { planned, actual };
  }, [budgetItems]);
  const alertMessages = useMemo(() => {
    const messages: string[] = [];
    const hasApprovedSupplier = quotes.some((q) => q.proposalStatus === "aprovada");
    const daysToEvent =
      event.eventDate
        ? Math.floor(
            (new Date(`${event.eventDate}T12:00:00`).getTime() - new Date(`${todayIso}T12:00:00`).getTime()) /
              86400000
          )
        : null;
    if (daysToEvent != null && daysToEvent <= 15 && daysToEvent >= 0 && !hasApprovedSupplier) {
      messages.push("Evento nos próximos 15 dias sem fornecedor aprovado");
    }
    if (budgetTotals.planned <= 0) messages.push("Evento sem orçamento");
    if (budgetTotals.actual > budgetTotals.planned && budgetTotals.planned > 0) messages.push("Orçamento estourado");
    if (tasks.some((t) => isTaskOverdue(t))) messages.push("Há tarefa atrasada");
    if (budgetItems.some((b) => b.paymentStatus === "pendente" && b.paymentDueDate && b.paymentDueDate <= todayIso)) {
      messages.push("Há pagamento pendente");
    }
    if (event.stageStatus === "realizado" && !postmortem) messages.push("Evento realizado sem pós-evento preenchido");
    return messages;
  }, [event, quotes, budgetTotals, tasks, budgetItems, postmortem, todayIso]);

  async function reloadEvent() {
    const next = await fetchEventById(event.id);
    if (next) setEvent(next);
  }
  async function reloadTasks() {
    setTasks(await fetchEventTasks(event.id));
  }
  async function reloadBudget() {
    setBudgetItems(await fetchEventBudgetItems(event.id));
  }
  async function reloadSuppliers() {
    setLinkedSuppliers(await fetchEventSupplierLinks(event.id));
    setQuotes(await fetchSupplierQuotes(event.id));
  }
  async function reloadCatalogSuppliers() {
    setCatalogSuppliers(await fetchSuppliersCatalog());
  }
  async function reloadInvites() {
    setInvites(await fetchEventInvites(event.id));
  }
  async function reloadCommunications() {
    setCommunications(await fetchEventCommunications(event.id));
  }
  async function reloadAttachments() {
    setAttachments(await fetchEventAttachments(event.id));
  }
  async function reloadHistory() {
    setHistory(await fetchEventHistory(event.id));
  }
  async function registerHistory(actionType: string, actionLabel: string, payload?: Record<string, unknown>) {
    await addEventHistory(event.id, actionType, actionLabel, null, payload ?? null);
    await reloadHistory();
  }

  async function handleAddTask() {
    setIsBusy(true);
    const title = newTaskTitle.trim();
    if (!title) {
      setIsBusy(false);
      return;
    }
    const created = await insertEventTask({
      eventId: event.id,
      title,
      description: null,
      assigneeId: null,
      dueDate: null,
      status: "pendente",
      phase: null,
      sortOrder: tasks.length,
      marketingRequestId: null,
    });
    if (created) {
      setTasks((prev) => [...prev, created]);
      setNewTaskTitle("");
      await registerHistory("tarefa", `Tarefa criada: ${created.title}`);
      setActionFeedback({ type: "success", text: "Tarefa criada com sucesso." });
    }
    setIsBusy(false);
  }

  async function handleTaskFieldUpdate(taskId: string, partial: Record<string, unknown>) {
    setIsBusy(true);
    const ok = await updateEventTask(taskId, partial as Parameters<typeof updateEventTask>[1]);
    if (ok) {
      await reloadTasks();
      await registerHistory("tarefa", "Tarefa atualizada", { taskId, partial });
      setActionFeedback({ type: "success", text: "Tarefa atualizada." });
    }
    setIsBusy(false);
  }

  async function handleDeleteTask(taskId: string) {
    setIsBusy(true);
    const ok = await deleteEventTask(taskId);
    if (ok) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      await registerHistory("tarefa", "Tarefa removida", { taskId });
      setActionFeedback({ type: "success", text: "Tarefa removida." });
    }
    setIsBusy(false);
  }

  async function handleDeleteBudget(id: string) {
    setIsBusy(true);
    const ok = await deleteEventBudgetItem(id);
    if (ok) {
      setBudgetItems((prev) => prev.filter((b) => b.id !== id));
      await registerHistory("orcamento", "Linha de orçamento removida", { id });
      setActionFeedback({ type: "success", text: "Linha de orçamento removida." });
    }
    setIsBusy(false);
  }

  async function handleLinkExistingSupplier(supplierId: string) {
    setIsBusy(true);
    const ok = await linkSupplierToEvent(event.id, supplierId);
    if (ok) {
      await reloadSuppliers();
      await registerHistory("fornecedor", "Prestador vinculado ao evento", { supplierId });
      setActionFeedback({ type: "success", text: "Prestador vinculado ao evento." });
    }
    setIsBusy(false);
  }

  async function handleUnlinkSupplier(usageId: string) {
    setIsBusy(true);
    const ok = await unlinkSupplierFromEvent(usageId);
    if (ok) {
      await reloadSuppliers();
      await registerHistory("fornecedor", "Prestador desvinculado do evento", { usageId });
      setActionFeedback({ type: "success", text: "Prestador desvinculado do evento." });
    }
    setIsBusy(false);
  }

  async function handleSupplierCreated(supplier: EventSupplier) {
    setIsBusy(true);
    await linkSupplierToEvent(event.id, supplier.id);
    await reloadCatalogSuppliers();
    await reloadSuppliers();
    await registerHistory("fornecedor", "Prestador cadastrado e vinculado ao evento", { supplierId: supplier.id });
    setActionFeedback({ type: "success", text: "Prestador cadastrado e vinculado ao evento." });
    setIsBusy(false);
  }

  async function handleAddQuote(
    supplierId: string,
    category: string,
    quotedValue: number,
    attachedFileLink?: string | null
  ) {
    setIsBusy(true);
    const created = await insertSupplierQuote({
      eventId: event.id,
      supplierId,
      category,
      quotedValue,
      finalValue: null,
      includedItems: null,
      proposalStatus: "pendente",
      attachedFileLink: attachedFileLink?.trim() || null,
      decisionReason: null,
    });
    if (created) {
      await reloadSuppliers();
      await registerHistory("fornecedor", "Proposta adicionada", { quoteId: created.id });
      setActionFeedback({ type: "success", text: "Proposta adicionada." });
    }
    setIsBusy(false);
  }

  async function handleDeleteQuote(id: string) {
    setIsBusy(true);
    const ok = await deleteSupplierQuote(id);
    if (ok) {
      await reloadSuppliers();
      await registerHistory("fornecedor", "Proposta removida", { quoteId: id });
      setActionFeedback({ type: "success", text: "Proposta removida." });
    }
    setIsBusy(false);
  }

  async function handleAddInvite(input: { name: string; email?: string; guestType: "colaborador" | "cliente" | "prospect" | "parceiro" | "convidado_externo" }) {
    setIsBusy(true);
    const created = await upsertEventInvite({
      eventId: event.id,
      name: input.name,
      email: input.email ?? null,
      guestType: input.guestType,
    });
    if (created) {
      await reloadInvites();
      await registerHistory("convidado", "Convidado adicionado", { inviteId: created.id });
      setActionFeedback({ type: "success", text: "Convidado adicionado." });
    }
    setIsBusy(false);
  }

  async function handleDeleteInvite(id: string) {
    setIsBusy(true);
    const ok = await deleteEventInvite(id);
    if (ok) {
      await reloadInvites();
      await registerHistory("convidado", "Convidado removido", { inviteId: id });
      setActionFeedback({ type: "success", text: "Convidado removido." });
    }
    setIsBusy(false);
  }

  async function handleDeleteManyInvites(ids: string[]) {
    if (ids.length === 0) return;
    setIsBusy(true);
    const results = await Promise.all(ids.map((id) => deleteEventInvite(id)));
    const removed = results.filter(Boolean).length;
    if (removed > 0) {
      await reloadInvites();
      await registerHistory("convidado", "Convidados removidos em lote", { count: removed });
      setActionFeedback({ type: "success", text: `${removed} convidado(s) removido(s).` });
    }
    setIsBusy(false);
  }

  async function handleAddCommunication(input: { channel: EventCommunicationChannel; title: string; content?: string; plannedDate?: string; responsibleUserId?: string }) {
    setIsBusy(true);
    const created = await upsertEventCommunication({
      eventId: event.id,
      channel: input.channel,
      title: input.title,
      content: input.content ?? null,
      plannedDate: input.plannedDate ?? null,
      responsibleUserId: input.responsibleUserId ?? null,
      status: "planejada",
    });
    if (created) {
      await reloadCommunications();
      await registerHistory("comunicacao", "Comunicação adicionada", { communicationId: created.id });
      setActionFeedback({ type: "success", text: "Comunicação adicionada." });
    }
    setIsBusy(false);
  }

  async function handleDeleteCommunication(id: string) {
    setIsBusy(true);
    const ok = await deleteEventCommunication(id);
    if (ok) {
      await reloadCommunications();
      await registerHistory("comunicacao", "Comunicação removida", { communicationId: id });
      setActionFeedback({ type: "success", text: "Comunicação removida." });
    }
    setIsBusy(false);
  }

  async function handleAddAttachment(input: { title: string; url: string; fileType?: string }) {
    setIsBusy(true);
    const created = await upsertEventAttachment({
      eventId: event.id,
      title: input.title,
      url: input.url,
      fileType: input.fileType ?? "arquivo_geral",
      provider: "external_link",
    });
    if (created) {
      await reloadAttachments();
      await registerHistory("arquivo", "Arquivo anexado", { attachmentId: created.id });
      setActionFeedback({ type: "success", text: "Arquivo anexado." });
    }
    setIsBusy(false);
  }

  async function handleUploadAttachment(file: File, input: { title: string; fileType: string }) {
    setIsBusy(true);
    try {
      const { publicUrl, path: storagePath } = await uploadEventFile(event.id, "arquivos", file);
      const created = await upsertEventAttachment({
        eventId: event.id,
        title: input.title,
        url: publicUrl,
        fileType: input.fileType,
        provider: "supabase_storage",
        storagePath,
      });
      if (created) {
        await reloadAttachments();
        await registerHistory("arquivo", `Arquivo enviado: ${input.title}`, { attachmentId: created.id });
        setActionFeedback({ type: "success", text: "Arquivo enviado." });
      } else {
        // Registro falhou: remove o objeto órfão do storage.
        await removeFromBucket(EVENT_FILES_BUCKET, storagePath);
        setActionFeedback({ type: "error", text: "Erro ao registrar o arquivo enviado." });
      }
    } catch (err) {
      setActionFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Erro ao enviar arquivo.",
      });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDeleteAttachment(id: string) {
    setIsBusy(true);
    const attachment = attachments.find((a) => a.id === id);
    const ok = await deleteEventAttachment(id);
    if (ok) {
      // Arquivo hospedado no nosso storage: remove o objeto também (best-effort).
      if (attachment?.provider === "supabase_storage" && attachment.storagePath) {
        await removeFromBucket(EVENT_FILES_BUCKET, attachment.storagePath);
      }
      await reloadAttachments();
      await registerHistory("arquivo", "Arquivo removido", { attachmentId: id });
      setActionFeedback({ type: "success", text: "Arquivo removido." });
    }
    setIsBusy(false);
  }

  async function handleSavePostmortem(input: Omit<EventPostmortem, "id" | "createdAt" | "updatedAt">) {
    setIsBusy(true);
    const saved = await upsertEventPostmortem({ ...input, eventId: event.id });
    if (saved) {
      setPostmortem(saved);
      await registerHistory("pos_evento", "Pós-evento atualizado");
      setActionFeedback({ type: "success", text: "Pós-evento salvo com sucesso." });
    }
    setIsBusy(false);
  }

  async function handleDuplicateEvent() {
    setDuplicating(true);
    setDuplicateResult("");
    const res = await duplicateEventToNextYear(event.id);
    setDuplicating(false);
    if (res.error) {
      setDuplicateResult(res.error);
      setActionFeedback({ type: "error", text: res.error });
    } else {
      const okMsg = `Evento duplicado com sucesso. Novo ID: ${res.newEventId}`;
      setDuplicateResult(okMsg);
      setActionFeedback({ type: "success", text: okMsg });
    }
  }

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "resumo", label: "Resumo", icon: <ClipboardList className="h-4 w-4" /> },
    { id: "tarefas", label: "Tarefas", icon: <CheckSquare className="h-4 w-4" /> },
    { id: "orcamento", label: "Orçamento", icon: <Wallet className="h-4 w-4" /> },
    { id: "fornecedores", label: "Prestadores", icon: <Truck className="h-4 w-4" /> },
    { id: "convidados", label: "Convidados", icon: <Users className="h-4 w-4" /> },
    { id: "comunicacao", label: "Comunicação", icon: <Megaphone className="h-4 w-4" /> },
    { id: "arquivos", label: "Arquivos", icon: <Paperclip className="h-4 w-4" /> },
    { id: "pos_evento", label: "Pós-evento", icon: <ChartLine className="h-4 w-4" /> },
    { id: "historico", label: "Histórico", icon: <History className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/eventos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar à visão geral
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight">{event.name}</h2>
            <Badge variant="outline" className={cn(EVENT_STATUS_STYLE[event.status])}>
              {EVENT_STATUS_LABEL[event.status]}
            </Badge>
            <span className="text-sm text-muted-foreground">{event.year}</span>
            <span className="text-xs text-muted-foreground">Templates ativos: {templates.length}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-1" />
            Editar evento
          </Button>
          <Button variant="outline" onClick={handleDuplicateEvent} disabled={duplicating}>
            <Copy className="h-4 w-4 mr-1" />
            {duplicating ? "Duplicando..." : "Duplicar p/ próximo ano"}
          </Button>
        </div>
      </div>
      {duplicateResult && <p className="text-sm text-muted-foreground">{duplicateResult}</p>}
      {actionFeedback && (
        <div
          className={cn(
            "rounded-xl border p-3 text-sm",
            actionFeedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          )}
        >
          {actionFeedback.text}
        </div>
      )}
      {isBusy && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-800 inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Atualizando dados do evento...
        </div>
      )}
      {alertMessages.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-700 mb-1">Alertas</p>
          <ul className="text-sm text-amber-800 space-y-0.5">
            {alertMessages.map((msg) => (
              <li key={msg}>- {msg}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-1 border-b border-border/60 overflow-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
              tab === t.id ? "border-violet-500 text-violet-700" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border/60 bg-card p-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">Prestadores</p>
          <p>{linkedSuppliers.length} vinculado(s)</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">Convidados</p>
          <p>{invites.length} cadastrado(s)</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">Comunicações</p>
          <p>{communications.length} planejada(s)</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">Histórico</p>
          <p>{history.length} registro(s)</p>
        </div>
      </div>

      {tab === "resumo" && (
        <EventoResumoTab event={event} budgetPlannedTotal={budgetTotals.planned} budgetActualTotal={budgetTotals.actual} />
      )}
      {tab === "tarefas" && (
        <EventoTarefasTab
          tasks={tasks}
          users={users}
          newTaskTitle={newTaskTitle}
          setNewTaskTitle={setNewTaskTitle}
          onAddTask={handleAddTask}
          onUpdateTask={handleTaskFieldUpdate}
          onDeleteTask={handleDeleteTask}
          onSendPlanner={(task) => setPlannerTask(task)}
        />
      )}
      {tab === "orcamento" && (
        <EventoOrcamentoTab
          budgetItems={budgetItems}
          onCreate={() => {
            setEditingBudget(null);
            setBudgetDialogOpen(true);
          }}
          onEdit={(item) => {
            setEditingBudget(item);
            setBudgetDialogOpen(true);
          }}
          onDelete={handleDeleteBudget}
        />
      )}
      {tab === "fornecedores" && (
        <EventoFornecedoresTab
          eventId={event.id}
          linkedSuppliers={linkedSuppliers}
          catalogSuppliers={catalogSuppliers}
          quotes={quotes}
          onLinkExisting={handleLinkExistingSupplier}
          onUnlink={handleUnlinkSupplier}
          onSupplierCreated={handleSupplierCreated}
          onAddQuote={handleAddQuote}
          onDeleteQuote={handleDeleteQuote}
          isLoading={isBusy}
        />
      )}
      {tab === "convidados" && (
        <EventoConvidadosTab
          invites={invites}
          users={users}
          onAddInvite={handleAddInvite}
          onDeleteInvite={handleDeleteInvite}
          onDeleteManyInvites={handleDeleteManyInvites}
          isLoading={isBusy}
        />
      )}
      {tab === "comunicacao" && (
        <EventoComunicacaoTab
          communications={communications}
          users={users}
          onAddCommunication={handleAddCommunication}
          onDeleteCommunication={handleDeleteCommunication}
          isLoading={isBusy}
        />
      )}
      {tab === "arquivos" && (
        <EventoArquivosTab
          attachments={attachments}
          onAddAttachment={handleAddAttachment}
          onUploadFile={handleUploadAttachment}
          onDeleteAttachment={handleDeleteAttachment}
        />
      )}
      {tab === "pos_evento" && <EventoPosEventoTab postmortem={postmortem} onSave={handleSavePostmortem} />}
      {tab === "historico" && <EventoHistoricoTab items={history} />}

      <EventoFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        defaultYear={event.year}
        event={event}
        templates={templates}
        users={users}
        onSuccess={async () => {
          await reloadEvent();
          await reloadHistory();
        }}
      />

      <EventoBudgetDialog
        open={budgetDialogOpen}
        onOpenChange={setBudgetDialogOpen}
        eventId={event.id}
        users={users}
        suppliers={catalogSuppliers}
        item={editingBudget}
        onSuccess={async () => {
          await reloadBudget();
          await reloadHistory();
        }}
        onSupplierPicked={(supplier) => handleLinkExistingSupplier(supplier.id)}
        onSupplierCreated={handleSupplierCreated}
      />

      <EnviarEventoAoPlannerDialog
        open={!!plannerTask}
        onOpenChange={(open) => !open && setPlannerTask(null)}
        task={plannerTask}
        event={event}
        users={users}
        designers={designers}
        onSuccess={async () => {
          setPlannerTask(null);
          await reloadTasks();
          await registerHistory("planner", "Tarefa enviada ao Planner");
        }}
      />
    </div>
  );
}
