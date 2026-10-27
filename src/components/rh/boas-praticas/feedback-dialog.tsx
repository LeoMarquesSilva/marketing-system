"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CalendarClock,
  CheckCheck,
  CircleDashed,
  Eye,
  EyeOff,
  FileText,
  Hourglass,
  Loader2,
  PencilLine,
  Send,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { businessDaysToResponse, flowStatus } from "@/lib/rh/boas-praticas/metrics";
import {
  deleteFeedbackPhoto,
  imageFilesFrom,
  listFeedbackPhotos,
  uploadFeedbackPhoto,
} from "@/lib/rh/boas-praticas/photos-client";
import {
  FEEDBACK_PHOTOS_MAX,
  categoryLabel,
  chapterLabel,
  type FeedbackInput,
  type FeedbackPerson,
  type FeedbackPhoto,
  type GoodPracticeFeedback,
} from "@/lib/rh/boas-praticas/types";
import { cn } from "@/lib/utils";
import { FlowStatusBadge, formatDate, formatDayLabel, formatTimeSP, isoDateSP } from "./feedback-badges";
import {
  emptyFeedbackInput,
  FeedbackForm,
  feedbackToInput,
  missingFields,
  resolvedEmployeeName,
} from "./feedback-form";
import { PhotoField, PhotoGallery, PhotoViewer, toPendingPhotos, type PendingPhoto } from "./feedback-photos";
import { AreaChip, CategoryIcon, PersonAvatar, PersonLine, useFeedbackPeople } from "./feedback-visuals";

/* ----------------------------------------------------------- detalhe */

function TimelineStep({
  icon: Icon,
  tone,
  title,
  date,
  last = false,
  children,
}: {
  icon: LucideIcon;
  tone: "done" | "pending" | "warning" | "muted";
  title: string;
  date?: string | null;
  last?: boolean;
  children?: ReactNode;
}) {
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!last && <span className="absolute left-[15px] top-8 bottom-0 w-px bg-[#dce9eb]" aria-hidden />}
      <span
        className={cn(
          "relative grid size-8 shrink-0 place-items-center rounded-full ring-1 ring-inset",
          tone === "done" && "bg-[#e8f8f8] text-[#285f7a] ring-[#47cdd0]/40",
          tone === "pending" && "bg-white text-muted-foreground ring-[#dce9eb] [&_svg]:opacity-70",
          tone === "warning" && "bg-amber-50 text-amber-700 ring-amber-200",
          tone === "muted" && "bg-slate-50 text-slate-500 ring-slate-200"
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {date && <p className="text-xs tabular-nums text-muted-foreground">{date}</p>}
        </div>
        {children && <div className="mt-1.5 text-sm text-muted-foreground">{children}</div>}
      </div>
    </li>
  );
}

function longDate(iso: string): string {
  const { weekday } = formatDayLabel(iso);
  return `${formatDate(iso)} · ${weekday}`;
}

/** Mensagem que foi ao gestor pelo Feedz, carregada só quando o RH pede. */
function FeedzMessage({ feedbackId }: { feedbackId: string }) {
  const [state, setState] = useState<{ open: boolean; loading: boolean; text: string | null; error: string | null }>({
    open: false,
    loading: false,
    text: null,
    error: null,
  });

  async function toggle() {
    if (state.open) return setState((current) => ({ ...current, open: false }));
    if (state.text !== null) return setState((current) => ({ ...current, open: true }));
    setState((current) => ({ ...current, open: true, loading: true, error: null }));
    try {
      const response = await fetch(`/api/rh/boas-praticas/${feedbackId}/feedz`);
      const data = (await response.json().catch(() => ({}))) as { message?: string | null; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar a mensagem.");
      // O Feedz exporta o texto quebrado a cada ~70 caracteres: vira um parágrafo só.
      setState({ open: true, loading: false, text: (data.message ?? "").replace(/\s*\n\s*/g, " ").trim(), error: null });
    } catch (cause) {
      setState({ open: true, loading: false, text: null, error: cause instanceof Error ? cause.message : "Não foi possível carregar a mensagem." });
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => void toggle()}
        aria-expanded={state.open}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#285f7a] hover:underline focus-visible:underline focus-visible:outline-none"
      >
        <FileText className="size-3.5" aria-hidden />
        {state.open ? "Esconder a mensagem enviada" : "Ver a mensagem enviada pelo Feedz"}
      </button>
      {state.open && (
        <div className="feedz-message mt-2 max-h-56 overflow-y-auto rounded-md bg-[#f2f8f9] px-3 py-2 text-xs leading-5 text-foreground">
          {state.loading ? "Carregando…" : state.error ?? state.text ?? ""}
        </div>
      )}
    </div>
  );
}

function FeedbackDetail({
  item,
  items,
  gallery,
  onSelect,
}: {
  item: GoodPracticeFeedback;
  items: GoodPracticeFeedback[];
  gallery: ReactNode;
  onSelect: (item: GoodPracticeFeedback) => void;
}) {
  const { employee, manager } = useFeedbackPeople(item);
  const days = businessDaysToResponse(item.sent_on, item.responded_on);
  const history = useMemo(
    () =>
      item.is_team
        ? []
        : items
            .filter(
              (entry) =>
                entry.id !== item.id &&
                (item.employee_id ? entry.employee_id === item.employee_id : entry.employee_name === item.employee_name)
            )
            .slice(0, 6),
    [items, item]
  );

  return (
    <div className="space-y-6 px-6 py-5">
      <section className="space-y-2">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-[#285f7a]">
          <CategoryIcon category={item.category} className="size-7" />
          {item.category}
          {item.subtopic && <span className="rounded-full bg-[#eef6f8] px-2 py-0.5 text-xs">{item.subtopic}</span>}
          {chapterLabel(item.category) && (
            <span className="text-xs font-normal text-muted-foreground">{chapterLabel(item.category)} do manual</span>
          )}
        </p>
        <blockquote className="rounded-md border border-[#e6eef0] bg-[#fafcfc] px-4 py-3 text-[15px] leading-6 text-foreground">
          {item.description}
        </blockquote>
        {gallery}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Linha do tempo</h3>
        <ol>
          <TimelineStep icon={CalendarClock} tone="done" title="Ocorrência" date={longDate(item.occurred_on)} />
          <TimelineStep
            icon={Send}
            tone="done"
            title={item.feedz_sent_at ? "Feedback enviado ao gestor pelo Feedz" : "Feedback enviado ao gestor"}
            date={item.feedz_sent_at ? `${longDate(item.sent_on)} · ${formatTimeSP(item.feedz_sent_at)}` : longDate(item.sent_on)}
          >
            <PersonLine person={manager} subtitle={manager.person?.position ?? undefined} size="sm" className="text-foreground" />
            {item.feedz_key && <FeedzMessage feedbackId={item.id} />}
          </TimelineStep>
          {item.viewed === true ? (
            <TimelineStep
              icon={Eye}
              tone="done"
              title="Visualizado no Feedz"
              date={
                item.viewed_on
                  ? `${longDate(item.viewed_on)}${item.feedz_viewed_at && isoDateSP(item.feedz_viewed_at) === item.viewed_on ? ` · ${formatTimeSP(item.feedz_viewed_at)}` : ""}`
                  : null
              }
            />
          ) : item.viewed === false ? (
            <TimelineStep icon={EyeOff} tone="warning" title="Não visualizado no Feedz" />
          ) : (
            <TimelineStep icon={CircleDashed} tone="muted" title="Sem dado do Feedz">
              Importe o relatório do Feedz para preencher a visualização.
            </TimelineStep>
          )}
          {item.responded_on ? (
            <TimelineStep icon={CheckCheck} tone="done" title="Retorno do gestor" date={longDate(item.responded_on)} last>
              <p className="text-xs">
                {days === null
                  ? "Data do retorno anterior ao envio — vale conferir."
                  : days === 0
                    ? "No mesmo dia útil do envio."
                    : `${days} ${days === 1 ? "dia útil" : "dias úteis"} após o envio.`}
              </p>
              {item.manager_action && (
                <p className="mt-2 rounded-md bg-[#f2f8f9] px-3 py-2 text-sm leading-5 text-foreground">{item.manager_action}</p>
              )}
            </TimelineStep>
          ) : (
            <TimelineStep icon={Hourglass} tone="pending" title="Aguardando retorno do gestor" last>
              {item.manager_action ? (
                <p className="rounded-md bg-[#f2f8f9] px-3 py-2 text-sm leading-5 text-foreground">{item.manager_action}</p>
              ) : (
                "Quando o gestor responder, registre a data e a providência."
              )}
            </TimelineStep>
          )}
        </ol>
      </section>

      {history.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Outros feedbacks de {employee.name}</h3>
          <ul className="divide-y divide-[#eef3f5] rounded-md border border-[#e6eef0]">
            {history.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => onSelect(entry)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[#f6fafb] focus-visible:bg-[#f6fafb] focus-visible:outline-none"
                >
                  <CategoryIcon category={entry.category} className="size-7" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">{entry.description}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDate(entry.sent_on)} · {categoryLabel(entry)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        {item.source === "planilha"
          ? "Importado da planilha de boas práticas."
          : `Registrado${item.created_by_name ? ` por ${item.created_by_name}` : ""} em ${formatDate(item.created_at)}.`}
      </p>
    </div>
  );
}

function DetailHeader({ item }: { item: GoodPracticeFeedback }) {
  const { employee } = useFeedbackPeople(item);
  return (
    <DialogHeader className="gap-1 border-b border-[#e6eef0] px-6 py-5 pr-14 text-left">
      <div className="flex items-start gap-4">
        <PersonAvatar name={employee.name} person={employee.person} isTeam={employee.isTeam} size="lg" />
        <div className="min-w-0 space-y-1.5">
          <DialogTitle className="truncate text-lg">{employee.name}</DialogTitle>
          <DialogDescription className="mt-0 truncate">
            {employee.person
              ? [employee.person.position, employee.person.is_active ? null : "Ex-colaborador"].filter(Boolean).join(" · ") ||
                employee.person.full_name
              : employee.isTeam
                ? "Feedback para a equipe inteira"
                : "Fora do cadastro do RH"}
          </DialogDescription>
          <div className="flex flex-wrap items-center gap-1.5">
            <AreaChip area={item.area} />
            <FlowStatusBadge status={flowStatus(item)} />
          </div>
        </div>
      </div>
    </DialogHeader>
  );
}

/* -------------------------------------------------------------- modal */

export function FeedbackDialog({
  item: initialItem,
  prefill = null,
  people,
  items,
  onClose,
  onSaved,
  onDeleted,
}: {
  /** null = novo registro. */
  item: GoodPracticeFeedback | null;
  /** Novo registro já preenchido (a partir de uma linha do Feedz). */
  prefill?: FeedbackInput | null;
  people: FeedbackPerson[];
  items: GoodPracticeFeedback[];
  onClose: () => void;
  onSaved: (item: GoodPracticeFeedback) => void;
  onDeleted: (id: string) => void;
}) {
  const [item, setItem] = useState(initialItem);
  const [mode, setMode] = useState<"view" | "edit">(initialItem ? "view" : "edit");
  const [form, setForm] = useState<FeedbackInput>(() =>
    initialItem ? feedbackToInput(initialItem) : (prefill ?? emptyFeedbackInput())
  );
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Fotos: null = carregando os links. Novas e removidas só valem ao salvar.
  const [photos, setPhotos] = useState<FeedbackPhoto[] | null>(initialItem?.photo_count ? null : []);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [viewing, setViewing] = useState<number | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const pendingRef = useRef<PendingPhoto[]>([]);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => () => pendingRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview)), []);

  useEffect(() => {
    if (photos !== null || !item) return;
    let cancelled = false;
    listFeedbackPhotos(item.id)
      .then((list) => {
        if (!cancelled) setPhotos(list);
      })
      .catch((cause) => {
        if (cancelled) return;
        setPhotos([]);
        setPhotoError(cause instanceof Error ? cause.message : "Não foi possível carregar as fotos.");
      });
    return () => {
      cancelled = true;
    };
  }, [item, photos]);

  const keptPhotos = (photos ?? []).filter((photo) => !removed.includes(photo.id));

  function clearPendingPhotos() {
    pending.forEach((photo) => URL.revokeObjectURL(photo.preview));
    setPending([]);
    setRemoved([]);
  }

  function addPhotos(files: File[]) {
    const room = FEEDBACK_PHOTOS_MAX - keptPhotos.length - pending.length;
    if (room <= 0) {
      setError(`Cada feedback aceita até ${FEEDBACK_PHOTOS_MAX} fotos.`);
      return;
    }
    setPending((current) => [...current, ...toPendingPhotos(files.slice(0, room))]);
    setError(files.length > room ? `Só cabem mais ${room} ${room === 1 ? "foto" : "fotos"} neste feedback.` : null);
  }

  function removePending(key: string) {
    setPending((current) => {
      current.filter((photo) => photo.key === key).forEach((photo) => URL.revokeObjectURL(photo.preview));
      return current.filter((photo) => photo.key !== key);
    });
  }

  function select(next: GoodPracticeFeedback) {
    setItem(next);
    setForm(feedbackToInput(next));
    setMode("view");
    setConfirmDelete(false);
    setError(null);
    setPhotos(next.photo_count ? null : []);
    setPhotoError(null);
    setViewing(null);
    clearPendingPhotos();
  }

  /** Aplica as fotos removidas e envia as novas, uma por vez. */
  async function syncPhotos(feedbackId: string): Promise<{ list: FeedbackPhoto[]; failures: string[] }> {
    let list = keptPhotos;
    const failures: string[] = [];
    for (const id of removed) {
      try {
        await deleteFeedbackPhoto(feedbackId, id);
      } catch (cause) {
        failures.push(cause instanceof Error ? cause.message : "Não foi possível remover uma foto.");
        const back = (photos ?? []).find((photo) => photo.id === id);
        if (back) list = [...list, back];
      }
    }
    for (const [index, entry] of pending.entries()) {
      setProgress(`Enviando foto ${index + 1} de ${pending.length}…`);
      try {
        list = [...list, await uploadFeedbackPhoto(feedbackId, entry.file)];
      } catch (cause) {
        failures.push(cause instanceof Error ? cause.message : `Não foi possível enviar "${entry.file.name}".`);
      }
    }
    setProgress(null);
    return { list, failures };
  }

  async function save() {
    const missing = missingFields(form);
    if (missing.length) {
      const list = missing.length > 1 ? `${missing.slice(0, -1).join(", ")} e ${missing[missing.length - 1]}` : missing[0];
      setError(`Falta informar ${list}.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: FeedbackInput = {
        ...form,
        employee_name: resolvedEmployeeName(form),
        viewed_on: form.viewed === true ? form.viewed_on : "",
      };
      const response = await fetch(item ? `/api/rh/boas-praticas/${item.id}` : "/api/rh/boas-praticas", {
        method: item ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({}))) as { item?: GoodPracticeFeedback; error?: string };
      if (!response.ok || !data.item) throw new Error(data.error ?? "Não foi possível salvar.");
      const { list, failures } = await syncPhotos(data.item.id);
      const saved = { ...data.item, photo_count: list.length };
      onSaved(saved);
      select(saved);
      setPhotos(list);
      if (failures.length) {
        setError(
          `Feedback salvo, mas ${failures.length === 1 ? "1 alteração de foto falhou" : `${failures.length} alterações de foto falharam`}: ${failures[0]}`
        );
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!item) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/rh/boas-praticas/${item.id}`, { method: "DELETE" });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível excluir.");
      onDeleted(item.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível excluir.");
      setConfirmDelete(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent
        className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl"
        showCloseButton={!saving}
        onEscapeKeyDown={(event) => {
          // No visualizador, Esc volta ao feedback em vez de fechar o modal.
          if (viewing !== null) {
            event.preventDefault();
            setViewing(null);
          }
        }}
        onPaste={(event) => {
          if (mode !== "edit" || saving) return;
          const files = imageFilesFrom(event.clipboardData?.items);
          if (!files.length) return;
          event.preventDefault();
          addPhotos(files);
        }}
      >
        {mode === "view" && item ? (
          <DetailHeader item={item} />
        ) : (
          <DialogHeader className="gap-1 border-b border-[#e6eef0] px-6 py-5 pr-14 text-left">
            <DialogTitle className="text-lg">{item ? "Editar feedback" : "Registrar feedback"}</DialogTitle>
            <DialogDescription>
              {!item && form.feedz
                ? "Preenchido com a linha do relatório do Feedz: confira o colaborador, escolha a categoria e salve."
                : "Fica só no registro do RH. Nada é enviado ao colaborador nem ao gestor a partir daqui."}
            </DialogDescription>
          </DialogHeader>
        )}

        {/* key: trocar de modo ou de registro volta a rolagem para o topo. */}
        <div key={`${mode}-${item?.id ?? "novo"}-${viewing === null ? "ver" : "foto"}`} className="min-h-0 flex-1 overflow-y-auto">
          {mode === "view" && item ? (
            viewing !== null && photos?.length ? (
              <PhotoViewer photos={photos} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} />
            ) : (
              <FeedbackDetail
                item={item}
                items={items}
                onSelect={select}
                gallery={
                  item.photo_count || photos?.length ? (
                    <PhotoGallery photos={photos} loadingCount={item.photo_count} error={photoError} onOpen={setViewing} />
                  ) : null
                }
              />
            )
          ) : (
            <FeedbackForm
              form={form}
              people={people}
              items={items}
              onChange={setForm}
              photoSlot={
                <PhotoField
                  existing={keptPhotos}
                  pending={pending}
                  loading={photos === null}
                  onAdd={addPhotos}
                  onRemoveExisting={(id) => setRemoved((current) => [...current, id])}
                  onRemovePending={removePending}
                />
              }
            />
          )}
        </div>

        {error && (
          <p role="alert" className="mx-6 mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e6eef0] bg-[#fafcfc] px-6 py-4">
          <div>
            {item &&
              (confirmDelete ? (
                <div className="flex items-center gap-2">
                  <Button type="button" variant="destructive" disabled={saving} onClick={() => void remove()}>
                    {saving && <Loader2 className="size-4 animate-spin" />}
                    Confirmar exclusão
                  </Button>
                  <Button type="button" variant="ghost" disabled={saving} onClick={() => setConfirmDelete(false)}>
                    Manter
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  aria-label="Excluir feedback"
                  className="gap-2 px-3 text-red-700 hover:bg-red-50 hover:text-red-800"
                  disabled={saving}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4" />
                  <span className="hidden sm:inline">Excluir</span>
                </Button>
              ))}
          </div>
          {mode === "view" ? (
            <Button type="button" className="gap-2" disabled={confirmDelete} onClick={() => setMode("edit")}>
              <PencilLine className="size-4" />
              Editar
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => {
                  if (!item) return onClose();
                  setForm(feedbackToInput(item));
                  setMode("view");
                  setError(null);
                  clearPendingPhotos();
                }}
              >
                Cancelar
              </Button>
              <Button type="button" disabled={saving || confirmDelete} onClick={() => void save()}>
                {saving && !confirmDelete && <Loader2 className="size-4 animate-spin" />}
                {progress ?? (item ? "Salvar alterações" : "Registrar feedback")}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
