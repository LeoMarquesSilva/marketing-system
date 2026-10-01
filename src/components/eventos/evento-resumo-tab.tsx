"use client";

import { ArrowUpRight, CalendarDays, CheckCircle2, FileText, Paperclip, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventPerson } from "./event-person";
import { EVENT_KIND_LABEL, RISK_LEVEL_LABEL, formatBrl, type OrgEvent, type EventTask, type EventAttachment } from "@/lib/eventos";
import { taskDateLabel } from "@/lib/event-task-list";
import type { User } from "@/lib/users";

export function EventoResumoTab({ event, budgetPlannedTotal, budgetActualTotal, tasks, users, attachments, supplierCount, inviteCount, onNavigate }: {
  event: OrgEvent; budgetPlannedTotal: number; budgetActualTotal: number; tasks: EventTask[];
  users: User[]; attachments: EventAttachment[]; supplierCount: number; inviteCount: number;
  onNavigate: (tab: "tarefas" | "orcamento" | "fornecedores" | "convidados" | "arquivos", taskId?: string) => void;
}) {
  const completed = tasks.filter(task => task.status === "concluida").length;
  const progress = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  const upcoming = tasks.filter(task => task.status !== "concluida").sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999") || a.sortOrder - b.sortOrder).slice(0, 5);
  const ids = new Set([event.ownerUserId, ...tasks.map(task => task.assigneeId)].filter(Boolean));
  const team = users.filter(user => ids.has(user.id));
  const panel = "rounded-xl border border-border/70 bg-card";
  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {[{ label: "Execução do evento", value: `${completed}/${tasks.length}`, detail: "tarefas concluídas", icon: CheckCircle2, tab: "tarefas" as const },
        { label: "Orçamento previsto", value: formatBrl(budgetPlannedTotal), detail: `${formatBrl(budgetActualTotal)} realizado`, icon: Wallet, tab: "orcamento" as const },
        { label: "Convidados", value: String(inviteCount), detail: event.participantsExpected != null ? `${event.participantsExpected} pessoas previstas` : "lista de convidados", icon: Users, tab: "convidados" as const },
        { label: "Prestadores", value: String(supplierCount), detail: "vinculados ao evento", icon: FileText, tab: "fornecedores" as const }].map(item => <button key={item.tab} onClick={() => onNavigate(item.tab)} className={`${panel} group p-4 text-left transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-primary`}>
          <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">{item.label}<item.icon className="size-4 text-primary" /></span><strong className="mt-3 block break-words text-xl font-semibold tracking-tight tabular-nums">{item.value}</strong><span className="mt-1 block text-xs text-muted-foreground">{item.detail}</span>
        </button>)}
    </div>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
      <div className="space-y-5">
        <section className={panel} aria-label="Próximas entregas">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4"><div><h2 className="text-sm font-semibold">Próximas entregas</h2><p className="mt-1 text-xs text-muted-foreground">O que precisa acontecer para o evento sair do papel.</p></div><Button size="sm" variant="ghost" onClick={() => onNavigate("tarefas")}>Abrir Planner<ArrowUpRight className="size-4" /></Button></div>
          <div className="divide-y divide-border/60">{upcoming.map(task => <button key={task.id} onClick={() => onNavigate("tarefas", task.id)} className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-primary"><span className="size-2 shrink-0 rounded-full bg-primary/60" /><span className="min-w-0 flex-1"><span className="block text-sm font-medium leading-5">{task.title}</span><span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="size-3" />{taskDateLabel(task.dueDate)}</span></span>{task.assigneeName && <EventPerson name={task.assigneeName} avatar={task.assigneeAvatar} compact />}</button>)}{!upcoming.length && <p className="px-5 py-8 text-sm text-muted-foreground">{tasks.length ? "Todas as tarefas foram concluídas." : "Adicione as primeiras tarefas no Planner deste evento."}</p>}</div>
          <div className="border-t border-border/60 px-5 py-3"><div className="mb-2 flex justify-between text-xs text-muted-foreground"><span>Progresso geral</span><span>{progress}%</span></div><div role="progressbar" aria-label="Progresso do evento" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{width: `${progress}%`}} /></div></div>
        </section>
        <section className={`${panel} p-5`}><h2 className="mb-3 text-sm font-semibold">Sobre o evento</h2><p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{event.objectives || "Defina o objetivo do evento em Editar evento."}</p>{event.notes && <details className="mt-4 border-t border-border/60 pt-3"><summary className="cursor-pointer text-sm font-medium">Observações e orientações</summary><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{event.notes}</p></details>}
          <details className="mt-4 border-t border-border/60 pt-3"><summary className="cursor-pointer text-sm font-medium">Informações do planejamento</summary><dl className="mt-4 grid grid-cols-2 gap-4 text-sm">{[["Tipo", event.eventType || EVENT_KIND_LABEL[event.kind]], ["Série", event.seriesName || "Evento avulso"], ["Público-alvo", event.targetAudience], ["Porte", event.eventSize], ["Área solicitante", event.requestingArea], ["Prioridade", event.priority], ["Risco", RISK_LEVEL_LABEL[event.riskLevel]], ["Brindes", event.giftsNotes], ["Data comemorativa", taskDateLabel(event.commemorativeDate)], ["Participantes reais", event.participantsActual == null ? null : String(event.participantsActual)]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 whitespace-pre-wrap">{value || "A definir"}</dd></div>)}</dl></details>
        </section>
      </div>
      <div className="space-y-5">
        <section className={`${panel} p-5`}><h2 className="mb-4 text-sm font-semibold">Equipe e responsáveis</h2><div className="space-y-3">{team.map(user => <div key={user.id} className="flex items-center justify-between gap-2"><EventPerson name={user.name} avatar={user.avatar_url} />{user.id === event.ownerUserId && <span className="text-[10px] font-medium text-primary">Organizador</span>}</div>)}{!team.length && <p className="text-sm text-muted-foreground">Atribua responsáveis nas tarefas ou na edição do evento.</p>}</div>{event.organizationTeam && <p className="mt-4 whitespace-pre-wrap border-t border-border/60 pt-3 text-xs leading-5 text-muted-foreground">{event.organizationTeam}</p>}</section>
        <section className={`${panel} p-5`}><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Documentos do evento</h2><Paperclip className="size-4 text-muted-foreground" /></div><div className="space-y-2">{attachments.slice(0, 3).map(file => <a key={file.id} href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg bg-muted/50 p-3 text-sm hover:bg-muted"><FileText className="size-4 shrink-0 text-primary" /><span className="min-w-0 flex-1 truncate">{file.title}</span><ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" /></a>)}{!attachments.length && <p className="text-sm text-muted-foreground">Reúna propostas, contratos, cardápios e fotos aqui.</p>}</div><Button variant="link" className="mt-2 h-auto px-0 py-2" onClick={() => onNavigate("arquivos")}>Ver todos os arquivos ({attachments.length})<ArrowUpRight className="size-3.5" /></Button></section>
        <section className={`${panel} p-5`}><h2 className="mb-3 text-sm font-semibold">Controle financeiro</h2><dl className="space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Verba aprovada</dt><dd className="font-medium tabular-nums">{event.budgetApproved != null ? formatBrl(event.budgetApproved) : "A definir"}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Saldo da verba</dt><dd className="font-medium tabular-nums">{event.budgetApproved != null ? formatBrl(event.budgetApproved - budgetActualTotal) : "—"}</dd></div></dl><Button variant="link" className="mt-2 h-auto px-0 py-2" onClick={() => onNavigate("orcamento")}>Detalhar orçamento<ArrowUpRight className="size-3.5" /></Button></section>
      </div>
    </div>
  </div>;
}
