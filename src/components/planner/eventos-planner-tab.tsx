"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EventoTarefasTab } from "@/components/eventos/evento-tarefas-tab";
import { addEventHistory, deleteEventTask, fetchEventPlannerSnapshot, insertEventTask, updateEventTask } from "@/lib/eventos";
import type { EventTaskDraft } from "@/lib/event-task-list";
import type { User } from "@/lib/users";

export function EventosPlannerTab({ users }: { users: User[] }) {
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof fetchEventPlannerSnapshot>> | null>(null);
  const [eventId, setEventId] = useState("all");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const saving = useRef(false);
  const alive = useRef(true);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    if (saving.current) return;
    const version = ++generation.current;
    try {
      const next = await fetchEventPlannerSnapshot();
      if (alive.current && version === generation.current) { setSnapshot(next); setError(""); }
    } catch {
      if (alive.current && version === generation.current) setError("Não foi possível atualizar os eventos. Tente novamente.");
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    void refresh();
    const focus = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => { alive.current = false; window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus); };
  }, [refresh]);

  async function write(operation: () => Promise<boolean>, event: string, label: string) {
    if (saving.current) return false;
    saving.current = true; generation.current++; setBusy(true); setError("");
    try {
      if (!await operation()) return false;
      // History is supplementary; a saved task must not be retried as a duplicate if history fails.
      await addEventHistory(event, "tarefa", label, null, null).catch(() => null);
      return true;
    } catch { return false; }
    finally { saving.current = false; setBusy(false); }
  }
  async function add(draft?: EventTaskDraft) {
    if (!snapshot || !snapshot.events.some(event => event.id === eventId)) return false;
    const value = draft ?? { title, description: null, assigneeId: null, dueDate: null, status: "pendente" as const, phase: "pre_evento" as const };
    if (!value.title.trim()) return false;
    const ok = await write(async () => {
      const created = await insertEventTask({ ...value, title: value.title.trim(), eventId, sortOrder: Math.max(-1, ...snapshot.tasks.filter(task => task.eventId === eventId).map(task => task.sortOrder)) + 1, marketingRequestId: null });
      if (!created) return false;
      setSnapshot(current => current && { ...current, tasks: [...current.tasks, created] });
      if (!draft) setTitle("");
      return true;
    }, eventId, "Tarefa criada no Planner do evento");
    return ok;
  }
  async function update(id: string, partial: Record<string, unknown>) {
    const task = snapshot?.tasks.find(task => task.id === id);
    if (!task) return false;
    return write(async () => {
      if (!await updateEventTask(id, partial)) return false;
      setSnapshot(current => current && { ...current, tasks: current.tasks.map(task => task.id === id ? { ...task, ...partial, assigneeName: partial.assigneeId !== undefined ? users.find(user => user.id === partial.assigneeId)?.name ?? null : task.assigneeName } : task) });
      return true;
    }, task.eventId, "Tarefa atualizada no Planner do evento");
  }
  async function remove(id: string) {
    const task = snapshot?.tasks.find(task => task.id === id);
    if (!task) return false;
    return write(async () => {
      if (!await deleteEventTask(id)) return false;
      setSnapshot(current => current && { ...current, tasks: current.tasks.filter(task => task.id !== id) });
      return true;
    }, task.eventId, "Tarefa removida no Planner do evento");
  }
  if (!snapshot) return <div className="rounded-xl border p-6"><p role={error ? "alert" : "status"}>{error || "Carregando os Planners dos eventos…"}</p>{error && <Button variant="outline" onClick={() => void refresh()}>Tentar novamente</Button>}</div>;
  const events = snapshot.events.filter(event => eventId === "all" || event.id === eventId);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-3"><label className="text-sm font-medium" htmlFor="planner-event">Evento</label><select id="planner-event" disabled={busy} value={eventId} onChange={e => { setEventId(e.target.value); setTitle(""); }} className="h-10 min-w-0 max-w-full flex-1 rounded-md border bg-background px-3 text-sm"><option value="all">Todos os eventos</option>{snapshot.events.map(event => <option key={event.id} value={event.id}>{event.name} ({event.year})</option>)}</select>{eventId !== "all" && <Link className="text-sm text-primary underline" href={"/eventos/" + eventId + "?tab=planner"}>Abrir evento</Link>}</div>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    <EventoTarefasTab key={eventId} tasks={snapshot.tasks.filter(task => events.some(event => event.id === task.eventId))} users={users} newTaskTitle={title} setNewTaskTitle={setTitle} onAddTask={add} onUpdateTask={update} onDeleteTask={remove} isBusy={busy} onRefresh={refresh} canCreate={eventId !== "all" && events.length > 0} attachments={snapshot.attachments} eventNames={Object.fromEntries(events.map(event => [event.id, `${event.name} (${event.year})`]))} eventDates={events.flatMap(event => event.eventDate ? [{ id: event.id, date: event.eventDate, name: event.name }] : [])} />
  </div>;
}
