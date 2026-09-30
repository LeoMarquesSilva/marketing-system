"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { UserSelectSearch } from "@/components/solicitacoes/user-select-search";
import { EVENT_TASK_STATUS_LABEL, type EventTask, type EventTaskStatus, type EventTaskPhase } from "@/lib/eventos";
import { TASK_PHASES, type EventTaskDraft } from "@/lib/event-task-list";
import type { User } from "@/lib/users";

export function EventoTaskEditor({ task, users, onClose, onSave }: {
  task: EventTask | null;
  users: User[];
  onClose: () => void;
  onSave: (draft: EventTaskDraft) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<EventTaskDraft>({ title: task?.title ?? "", description: task?.description ?? "", assigneeId: task?.assigneeId ?? null, dueDate: task?.dueDate ?? null, status: task?.status ?? "pendente", phase: task ? task.phase : "pre_evento" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  function change<K extends keyof EventTaskDraft>(key: K, value: EventTaskDraft[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim() || saving) return;
    setSaving(true); setError("");
    try {
      const ok = await onSave({ ...draft, title: draft.title.trim(), description: draft.description?.trim() || null });
      if (ok) onClose(); else setError("Não foi possível salvar. Seus dados foram mantidos; tente novamente.");
    } catch { setError("Não foi possível salvar. Seus dados foram mantidos; tente novamente."); }
    finally { setSaving(false); }
  }
  const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>{task ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
          <DialogDescription>Organize o que precisa ser feito e registre as informações para acompanhar a execução.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-5">
          <fieldset disabled={saving} className="space-y-5">
            <div className="space-y-2"><Label htmlFor="event-task-title">Título</Label><Input id="event-task-title" autoFocus required maxLength={500} value={draft.title} onChange={(e) => change("title", e.target.value)} placeholder="Ex.: Realizar degustação do buffet" /></div>
            <div className="space-y-2"><Label htmlFor="event-task-description">Detalhes e acompanhamento</Label><Textarea id="event-task-description" rows={10} value={draft.description ?? ""} onChange={(e) => change("description", e.target.value)} placeholder="Objetivo, horário, local, participantes, roteiro e resultado esperado…" /><p className="text-xs text-muted-foreground">Em visitas e degustações, registre também o horário, o local e quem participa.</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Responsável</Label><UserSelectSearch users={users} value={draft.assigneeId ?? ""} onValueChange={(v) => change("assigneeId", v || null)} allowClear disabled={saving} placeholder="Selecionar responsável" /></div>
              <div className="space-y-2"><Label htmlFor="event-task-date">Data ou prazo</Label><DatePickerField id="event-task-date" value={draft.dueDate ?? ""} onChange={(v) => change("dueDate", v || null)} disabled={saving} /></div>
              <div className="space-y-2"><Label htmlFor="event-task-phase">Etapa</Label><select id="event-task-phase" className={selectClass} value={draft.phase ?? "sem_etapa"} onChange={(e) => change("phase", e.target.value === "sem_etapa" ? null : e.target.value as EventTaskPhase)}>{TASK_PHASES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="event-task-status">Status</Label><select id="event-task-status" className={selectClass} value={draft.status} onChange={(e) => change("status", e.target.value as EventTaskStatus)}>{Object.entries(EVENT_TASK_STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            </div>
          </fieldset>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={saving || !draft.title.trim()}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Salvar tarefa</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
