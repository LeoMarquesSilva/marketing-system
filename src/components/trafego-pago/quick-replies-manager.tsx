"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, MessageSquareText, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import {
  fillQuickReply,
  groupQuickReplies,
  matchQuickReplies,
  QUICK_REPLY_CATEGORIES,
  QUICK_REPLY_VARIABLES,
  type QuickReply,
  type QuickReplyCategory,
} from "@/lib/whatsapp-quick-replies";
import { QuickReplyCategoryIcon } from "./quick-reply-category-icon";
import { withPlaceholders } from "./quick-reply-picker";
import { friendlyError } from "./whatsapp-inbox-view";

interface QuickRepliesManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  replies: QuickReply[];
  contactName?: string | null;
  attendantName?: string | null;
  onSaved: (reply: QuickReply) => void;
  onRemoved: (id: string) => void;
}

interface FormState {
  title: string;
  shortcut: string;
  category: QuickReplyCategory;
  body: string;
}

const EMPTY_FORM: FormState = { title: "", shortcut: "", category: "primeiro_contato", body: "" };

/** Enquanto digita: minúsculas, sem acento e sem espaço (o servidor termina de limpar). */
function typingShortcut(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^\/+/, "")
    .replace(/[^a-z0-9_-]/g, "-")
    .slice(0, 30);
}

export function QuickRepliesManager({
  open,
  onOpenChange,
  replies,
  contactName,
  attendantName,
  onSaved,
  onRemoved,
}: QuickRepliesManagerProps) {
  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const selected = selectedId && selectedId !== "new" ? replies.find((reply) => reply.id === selectedId) ?? null : null;
  const list = useMemo(
    () => (search.trim() ? matchQuickReplies(replies, search) : groupQuickReplies(replies).flatMap((group) => group.replies)),
    [replies, search]
  );
  const grouped = !search.trim();

  const openReply = (reply: QuickReply | null) => {
    setSelectedId(reply ? reply.id : "new");
    setForm(
      reply
        ? { title: reply.title, shortcut: reply.shortcut, category: reply.category, body: reply.body }
        : EMPTY_FORM
    );
    setConfirmDelete(false);
    setError(null);
  };

  const insertVariable = (token: string) => {
    const textarea = bodyRef.current;
    const start = textarea?.selectionStart ?? form.body.length;
    const end = textarea?.selectionEnd ?? form.body.length;
    const body = `${form.body.slice(0, start)}${token}${form.body.slice(end)}`;
    setForm((current) => ({ ...current, body }));
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch(
        selected ? `/api/evolution/quick-replies/${selected.id}` : "/api/evolution/quick-replies",
        {
          method: selected ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const json = (await res.json().catch(() => ({}))) as { reply?: QuickReply; error?: string };
      if (!res.ok || !json.reply) throw new Error(json.error ?? "Não foi possível salvar a resposta.");
      onSaved(json.reply);
      openReply(json.reply);
    } catch (err) {
      setError(friendlyError(err, "Não foi possível salvar a resposta."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selected || saving) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch(`/api/evolution/quick-replies/${selected.id}`, { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Não foi possível excluir a resposta.");
      onRemoved(selected.id);
      setSelectedId(null);
    } catch (err) {
      setError(friendlyError(err, "Não foi possível excluir a resposta."));
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  const previewText = fillQuickReply(form.body, { contactName: contactName || "Mariana", attendantName });
  const editing = selectedId !== null;
  const canSave = form.title.trim() && form.shortcut.trim() && form.body.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setSelectedId(null);
          setSearch("");
          setError(null);
        }
      }}
    >
      <DialogContent className="flex h-[min(46rem,92dvh)] flex-col gap-0 p-0 sm:max-w-4xl">
        <DialogHeader className="flex-row items-start gap-3 border-b px-6 pb-4 pt-6 text-left">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#347796]/10 text-[#285f7a]">
            <MessageSquareText className="size-5" />
          </span>
          <div className="min-w-0 space-y-1">
            <DialogTitle>Respostas prontas</DialogTitle>
            <DialogDescription>
              Digite <span className="font-mono">/</span> no campo de mensagem para usar. A IA do Sugerir resposta segue
              estes mesmos textos.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 md:grid-cols-[18rem_1fr]">
          {/* Lista */}
          <div className={cn("min-h-0 flex-col border-r", editing ? "hidden md:flex" : "flex")}>
            <div className="flex items-center gap-2 border-b p-3">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar"
                  className="h-9 pl-8"
                  aria-label="Buscar resposta pronta"
                />
              </div>
              <Button type="button" size="sm" className="h-9" onClick={() => openReply(null)}>
                <Plus />
                Nova
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {list.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhuma resposta encontrada.</p>
              ) : (
                list.map((reply, index) => (
                  <div key={reply.id}>
                    {grouped && (index === 0 || list[index - 1].category !== reply.category) ? (
                      <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {QUICK_REPLY_CATEGORIES.find((category) => category.key === reply.category)?.label}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => openReply(reply)}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
                        selectedId === reply.id ? "bg-[#347796]/[0.08] dark:bg-[#47cdd0]/10" : "hover:bg-muted/60"
                      )}
                    >
                      <QuickReplyCategoryIcon category={reply.category} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{reply.title}</span>
                        <span className="block font-mono text-[11px] text-muted-foreground">/{reply.shortcut}</span>
                      </span>
                      {reply.use_count > 0 ? (
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground" title="Vezes usada">
                          {reply.use_count}×
                        </span>
                      ) : null}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Edição */}
          <div className={cn("min-h-0 flex-col", editing ? "flex" : "hidden md:flex")}>
            {!editing ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center text-sm text-muted-foreground">
                <MessageSquareText className="size-8 text-muted-foreground/50" />
                Escolha uma resposta para editar ou crie uma nova.
              </div>
            ) : (
              <>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                  <button
                    type="button"
                    className="-ml-1 inline-flex items-center gap-1 text-sm text-muted-foreground md:hidden"
                    onClick={() => setSelectedId(null)}
                  >
                    <ArrowLeft className="size-4" /> Voltar à lista
                  </button>

                  <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
                    <div className="space-y-1.5">
                      <Label htmlFor="quick-reply-title">Título</Label>
                      <Input
                        id="quick-reply-title"
                        value={form.title}
                        maxLength={80}
                        placeholder="Ex.: Quanto custa"
                        onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="quick-reply-shortcut">Atalho</Label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
                          /
                        </span>
                        <Input
                          id="quick-reply-shortcut"
                          value={form.shortcut}
                          placeholder="valor"
                          className="pl-6 font-mono"
                          onChange={(event) =>
                            setForm((current) => ({ ...current, shortcut: typingShortcut(event.target.value) }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Categoria</Label>
                    <Select
                      value={form.category}
                      onValueChange={(value) => setForm((current) => ({ ...current, category: value as QuickReplyCategory }))}
                    >
                      <SelectTrigger className="w-full" aria-label="Categoria">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {QUICK_REPLY_CATEGORIES.map((category) => (
                          <SelectItem key={category.key} value={category.key}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="quick-reply-body">Texto</Label>
                    <Textarea
                      id="quick-reply-body"
                      ref={bodyRef}
                      value={form.body}
                      rows={6}
                      maxLength={2000}
                      placeholder="Escreva como a mensagem vai sair no WhatsApp."
                      onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
                    />
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-xs text-muted-foreground">Inserir:</span>
                      {QUICK_REPLY_VARIABLES.map((variable) => (
                        <button
                          key={variable.token}
                          type="button"
                          title={variable.label}
                          onClick={() => insertVariable(variable.token)}
                          className="rounded-md border bg-white px-2 py-0.5 font-mono text-[11px] text-[#285f7a] hover:bg-muted dark:bg-background dark:text-[#47cdd0]"
                        >
                          {variable.token}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      O que estiver entre [colchetes], como [advogado], fica selecionado para completar na hora.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-sm font-medium">Como fica</p>
                    <div className="rounded-xl bg-[#efeae2] p-3 dark:bg-muted/40">
                      <p className="ml-auto w-fit max-w-[90%] whitespace-pre-line rounded-lg rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-sm leading-relaxed text-[#111b21] shadow-sm dark:bg-emerald-900/50 dark:text-foreground">
                        {previewText.trim() ? withPlaceholders(previewText) : "…"}
                      </p>
                    </div>
                    {selected && selected.use_count > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Usada {selected.use_count} {selected.use_count === 1 ? "vez" : "vezes"}.
                      </p>
                    ) : null}
                  </div>

                  {error ? (
                    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 border-t px-5 py-3">
                  {selected ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={saving}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => void remove()}
                    >
                      <Trash2 />
                      {confirmDelete ? "Confirmar exclusão" : "Excluir"}
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={() => setSelectedId(null)}>
                    Cancelar
                  </Button>
                  <Button type="button" size="sm" disabled={saving || !canSave} onClick={() => void save()}>
                    {saving ? <Loader2 className="animate-spin" /> : null}
                    Salvar
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
