"use client";

import { useRef, useState, type ReactNode } from "react";
import { ExternalLink, FileText, Link2, Loader2, Paperclip, Plus, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  OPS_FILE_MAX_BYTES,
  OPS_FILES_BUCKET,
  OPS_PRIORITY_LABEL,
  OPS_TIPO_LABEL,
  type OpsActivity,
  type OpsAttachment,
  type OpsChecklistItem,
  type OpsComment,
  type OpsPerson,
  type OpsPriority,
  type OpsTask,
  type OpsTipo,
} from "@/lib/ops-planner/types";
import { cn } from "@/lib/utils";
import { supabase } from "@/utils/supabase/client";
import { errorMessage, OPS_API, opsApi } from "./ops-client";
import { DueLabel, firstName, formatDate, formatDateTime, PersonAvatar, StatusDot } from "./ops-ui";

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-[#e6eef0] px-6 py-4 first:border-t-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------ checklist */

export function ChecklistSection({
  taskId,
  items,
  onChange,
}: {
  taskId: string;
  items: OpsChecklistItem[];
  onChange: (items: OpsChecklistItem[]) => void;
}) {
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const done = items.filter((item) => item.done_at).length;

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Section title="Checklist" aside={items.length > 0 && <span className="text-xs tabular-nums text-muted-foreground">{done}/{items.length}</span>}>
      {items.length > 0 && (
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
          <div className="h-full rounded-full bg-[#47cdd0]" style={{ width: `${Math.round((done / items.length) * 100)}%` }} />
        </div>
      )}
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id} className="group flex items-start gap-2 rounded-md px-1 py-1 hover:bg-slate-50">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-[#347796]"
              checked={Boolean(item.done_at)}
              disabled={busy === item.id}
              aria-label={item.label}
              onChange={(event) =>
                void run(item.id, async () => {
                  const { item: saved } = await opsApi.patch<{ item: OpsChecklistItem }>(`/checklist/${item.id}`, { done: event.target.checked });
                  onChange(items.map((current) => (current.id === saved.id ? saved : current)));
                })
              }
            />
            <span className={cn("min-w-0 flex-1 text-sm", item.done_at && "text-muted-foreground line-through")}>{item.label}</span>
            <button
              type="button"
              aria-label={`Remover ${item.label}`}
              className="rounded p-0.5 text-muted-foreground opacity-0 hover:text-red-700 focus-visible:opacity-100 group-hover:opacity-100"
              onClick={() =>
                void run(item.id, async () => {
                  await opsApi.del(`/checklist/${item.id}`);
                  onChange(items.filter((current) => current.id !== item.id));
                })
              }
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const text = label.trim();
          if (!text) return;
          void run("new", async () => {
            const { item } = await opsApi.post<{ item: OpsChecklistItem }>(`/tasks/${taskId}/checklist`, { label: text });
            onChange([...items, item]);
            setLabel("");
          });
        }}
      >
        <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Novo item" aria-label="Novo item do checklist" className="h-9" />
        <Button type="submit" size="sm" variant="secondary" disabled={busy === "new" || !label.trim()}>
          {busy === "new" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Adicionar
        </Button>
      </form>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </Section>
  );
}

/* ------------------------------------------------------------ subtarefas */

export function SubtasksSection({
  task,
  subtasks,
  meId,
  today,
  people,
  onOpen,
  onChange,
}: {
  task: OpsTask;
  subtasks: OpsTask[];
  meId: string;
  today: string;
  people: Map<string, OpsPerson>;
  onOpen: (id: string) => void;
  onChange: (subtasks: OpsTask[]) => void;
}) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const done = subtasks.filter((item) => item.status === "concluida").length;

  async function toggle(subtask: OpsTask) {
    setBusy(subtask.id);
    setError(null);
    try {
      const { task: saved } = await opsApi.patch<{ task: OpsTask }>(`/tasks/${subtask.id}`, {
        status: subtask.status === "concluida" ? "a_fazer" : "concluida",
      });
      onChange(subtasks.map((item) => (item.id === saved.id ? saved : item)));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  }

  async function add() {
    const text = title.trim();
    if (!text) return;
    setBusy("new");
    setError(null);
    try {
      const { task: created } = await opsApi.post<{ task: OpsTask }>("/tasks", {
        space_id: task.space_id,
        list_id: task.list_id,
        parent_task_id: task.id,
        title: text,
        assignee_ids: [meId],
      });
      onChange([...subtasks, created]);
      setTitle("");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Section title="Subtarefas" aside={subtasks.length > 0 && <span className="text-xs tabular-nums text-muted-foreground">{done}/{subtasks.length}</span>}>
      <ul className="space-y-1">
        {subtasks.map((subtask) => (
          <li key={subtask.id} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-slate-50">
            <input
              type="checkbox"
              className="size-4 shrink-0 accent-[#347796]"
              checked={subtask.status === "concluida"}
              disabled={busy === subtask.id}
              aria-label={`Concluir ${subtask.title}`}
              onChange={() => void toggle(subtask)}
            />
            <button
              type="button"
              onClick={() => onOpen(subtask.id)}
              className={cn(
                "min-w-0 flex-1 truncate text-left text-sm hover:text-[#285f7a] hover:underline",
                subtask.status === "concluida" && "text-muted-foreground line-through"
              )}
            >
              {subtask.title}
            </button>
            <StatusDot status={subtask.status} />
            <DueLabel due={subtask.due_date} status={subtask.status} today={today} className="hidden sm:inline" />
            {subtask.assignee_ids[0] && <PersonAvatar person={people.get(subtask.assignee_ids[0])} />}
          </li>
        ))}
      </ul>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
      >
        <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nova subtarefa" aria-label="Nova subtarefa" className="h-9" />
        <Button type="submit" size="sm" variant="secondary" disabled={busy === "new" || !title.trim()}>
          {busy === "new" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Adicionar
        </Button>
      </form>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </Section>
  );
}

/* ------------------------------------------------------------ anexos */

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export function AttachmentsSection({
  taskId,
  attachments,
  meId,
  canManage,
  onChange,
}: {
  taskId: string;
  attachments: OpsAttachment[];
  meId: string;
  canManage: boolean;
  onChange: (attachments: OpsAttachment[]) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [addingLink, setAddingLink] = useState(false);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  }

  async function upload(files: FileList | null) {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;
    await run("upload", async () => {
      const added: OpsAttachment[] = [];
      for (const file of list) {
        if (file.size > OPS_FILE_MAX_BYTES) throw new Error(`"${file.name}" passa de 50 MB.`);
        const { path, token } = await opsApi.post<{ path: string; token: string }>(`/tasks/${taskId}/attachments/upload`, {
          file_name: file.name,
          content_type: file.type || undefined,
          size_bytes: file.size,
        });
        const { error: uploadError } = await supabase.storage
          .from(OPS_FILES_BUCKET)
          .uploadToSignedUrl(path, token, file, { contentType: file.type || undefined });
        if (uploadError) throw new Error(`Não foi possível enviar "${file.name}". Confira se o tipo de arquivo é aceito.`);
        const { attachment } = await opsApi.post<{ attachment: OpsAttachment }>(`/tasks/${taskId}/attachments`, {
          kind: "file",
          name: file.name,
          storage_path: path,
          content_type: file.type || null,
          size_bytes: file.size,
        });
        added.push(attachment);
      }
      onChange([...attachments, ...added]);
    });
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <Section
      title="Anexos"
      aside={
        <div className="flex gap-1">
          <Button type="button" size="xs" variant="ghost" onClick={() => setAddingLink((value) => !value)}>
            <Link2 className="size-3.5" />
            Link
          </Button>
          <Button type="button" size="xs" variant="ghost" disabled={busy === "upload"} onClick={() => fileInput.current?.click()}>
            {busy === "upload" ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            Arquivo
          </Button>
          <input ref={fileInput} type="file" multiple className="sr-only" tabIndex={-1} aria-hidden onChange={(event) => void upload(event.target.files)} />
        </div>
      }
    >
      {attachments.length === 0 && !addingLink && <p className="text-sm text-muted-foreground">Nenhum anexo. Suba notas, planilhas ou cole um link.</p>}
      <ul className="space-y-1">
        {attachments.map((attachment) => (
          <li key={attachment.id} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-slate-50">
            {attachment.kind === "link" ? <Link2 className="size-4 shrink-0 text-muted-foreground" /> : <FileText className="size-4 shrink-0 text-muted-foreground" />}
            <a
              href={`${OPS_API}/attachments/${attachment.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate text-sm text-[#285f7a] hover:underline"
            >
              {attachment.name}
            </a>
            <span className="text-xs text-muted-foreground">{formatSize(attachment.size_bytes)}</span>
            <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden />
            {(attachment.created_by === meId || canManage) && (
              <button
                type="button"
                aria-label={`Remover ${attachment.name}`}
                className="rounded p-0.5 text-muted-foreground opacity-0 hover:text-red-700 focus-visible:opacity-100 group-hover:opacity-100"
                disabled={busy === attachment.id}
                onClick={() =>
                  void run(attachment.id, async () => {
                    await opsApi.del(`/attachments/${attachment.id}`);
                    onChange(attachments.filter((item) => item.id !== attachment.id));
                  })
                }
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {addingLink && (
        <form
          className="mt-2 grid gap-2 sm:grid-cols-[1fr_12rem_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            void run("link", async () => {
              const { attachment } = await opsApi.post<{ attachment: OpsAttachment }>(`/tasks/${taskId}/attachments`, {
                kind: "link",
                url: url.trim(),
                name: name.trim() || undefined,
              });
              onChange([...attachments, attachment]);
              setUrl("");
              setName("");
              setAddingLink(false);
            });
          }}
        >
          <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." aria-label="Link" className="h-9" autoFocus />
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome (opcional)" aria-label="Nome do link" className="h-9" />
          <Button type="submit" size="sm" variant="secondary" disabled={busy === "link" || !url.trim()}>
            {busy === "link" ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
            Anexar
          </Button>
        </form>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </Section>
  );
}

/* ------------------------------------------------------------ comentários */

export function CommentsSection({
  taskId,
  comments,
  meId,
  canManage,
  people,
  onChange,
}: {
  taskId: string;
  comments: OpsComment[];
  meId: string;
  canManage: boolean;
  people: Map<string, OpsPerson>;
  onChange: (comments: OpsComment[]) => void;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const text = body.trim();
    if (!text) return;
    setBusy("new");
    setError(null);
    try {
      const { comment } = await opsApi.post<{ comment: OpsComment }>(`/tasks/${taskId}/comments`, { body: text });
      onChange([...comments, comment]);
      setBody("");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  }

  async function remove(comment: OpsComment) {
    setBusy(comment.id);
    setError(null);
    try {
      await opsApi.del(`/comments/${comment.id}`);
      onChange(comments.filter((item) => item.id !== comment.id));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Section title={`Comentários${comments.length ? ` (${comments.length})` : ""}`}>
      <ul className="space-y-3">
        {comments.map((comment) => {
          const author = comment.user_id ? people.get(comment.user_id) : undefined;
          return (
            <li key={comment.id} className="group flex gap-2.5">
              <PersonAvatar person={author} className="mt-0.5 size-7" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{author?.name ?? "Alguém"}</span> · {formatDateTime(comment.created_at)}
                  {(comment.user_id === meId || canManage) && (
                    <button
                      type="button"
                      className="ml-2 text-muted-foreground opacity-0 hover:text-red-700 focus-visible:opacity-100 group-hover:opacity-100"
                      disabled={busy === comment.id}
                      onClick={() => void remove(comment)}
                    >
                      Apagar
                    </button>
                  )}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{comment.body}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 space-y-2">
        <Textarea
          rows={2}
          value={body}
          maxLength={5000}
          placeholder="Escreva um comentário. Os responsáveis são avisados."
          aria-label="Novo comentário"
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <div className="flex justify-end">
          <Button type="button" size="sm" disabled={busy === "new" || !body.trim()} onClick={() => void send()}>
            {busy === "new" && <Loader2 className="size-4 animate-spin" />}
            Comentar
          </Button>
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </Section>
  );
}

/* ------------------------------------------------------------ histórico */

function names(value: string | null, people: Map<string, OpsPerson>): string {
  if (!value) return "ninguém";
  return value
    .split(",")
    .filter(Boolean)
    .map((id) => firstName(people.get(id)?.name) || "Pessoa")
    .join(", ");
}

export function describeActivity(
  entry: OpsActivity,
  lookups: { people: Map<string, OpsPerson>; listName: (id: string | null) => string; spaceName: (id: string | null) => string }
): string {
  const from = entry.from_value;
  const to = entry.to_value;
  switch (entry.action) {
    case "criada":
      return "criou a tarefa";
    case "gerada_rotina":
      return `tarefa gerada pela rotina "${to ?? ""}"`;
    case "status":
      return `mudou o status de ${from} para ${to}`;
    case "reprogramada":
      return `reprogramou o prazo de ${formatDate(from)} para ${to ? formatDate(to) : "sem prazo"}`;
    case "prazo":
      return to ? `definiu o prazo para ${formatDate(to)}` : "tirou o prazo";
    case "responsaveis":
      return `trocou os responsáveis para ${names(to, lookups.people)}`;
    case "prioridade":
      return `mudou a prioridade para ${OPS_PRIORITY_LABEL[to as OpsPriority] ?? to}`;
    case "tipo":
      return `mudou o tipo para ${OPS_TIPO_LABEL[to as OpsTipo] ?? to}`;
    case "lista":
      return `moveu para a lista ${lookups.listName(to)}`;
    case "espaco":
      return `moveu para o espaço ${lookups.spaceName(to)}`;
    case "titulo":
      return `renomeou para "${to}"`;
    case "descricao":
      return "editou a descrição";
    case "proximo_passo":
      return to ? `definiu o próximo passo: ${to}` : "tirou o próximo passo";
    case "aguardando":
      return `marcou como aguardando ${to}`;
    case "inicio":
      return to ? `definiu o início para ${formatDate(to)}` : "tirou a data de início";
    case "horario":
      return to ? `definiu o horário ${to}` : "tirou o horário";
    case "solicitante":
      return `trocou o solicitante para ${names(to, lookups.people)}`;
    case "anexo":
      return `anexou ${to}`;
    case "excluida":
      return "excluiu a tarefa";
    default:
      return entry.action;
  }
}

export function ActivitySection({
  activity,
  lookups,
}: {
  activity: OpsActivity[];
  lookups: { people: Map<string, OpsPerson>; listName: (id: string | null) => string; spaceName: (id: string | null) => string };
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? activity : activity.slice(0, 5);
  if (activity.length === 0) return null;
  return (
    <Section
      title="Histórico"
      aside={
        activity.length > 5 && (
          <Button type="button" size="xs" variant="ghost" onClick={() => setExpanded((value) => !value)}>
            {expanded ? "Ver menos" : `Ver tudo (${activity.length})`}
          </Button>
        )
      }
    >
      <ol className="space-y-1.5">
        {shown.map((entry) => (
          <li key={entry.id} className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{entry.user_id ? firstName(lookups.people.get(entry.user_id)?.name) || "Alguém" : "Sistema"}</span>{" "}
            {describeActivity(entry, lookups)}
            {entry.note && <span className="block pl-3 italic">“{entry.note}”</span>}
            <span className="ml-1 tabular-nums">· {formatDateTime(entry.created_at)}</span>
          </li>
        ))}
      </ol>
    </Section>
  );
}
