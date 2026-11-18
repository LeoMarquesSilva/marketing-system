"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Flame,
  Maximize2,
  Minimize2,
  NotebookPen,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Star,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DECISION_LABELS,
  formatClock,
  formatHour,
  formatWeekdayDate,
  timerSeconds,
  todayInSaoPaulo,
  type DocApprovalItem,
  type DocBoard,
  type DocQuestion,
  type DocShoot,
  type DocShootCheck,
  type DocTake,
  type QuestionAudience,
} from "@/lib/documentario/types";
import { Face, Markdown, docRequest, useNow } from "./shared";
import { SHOOT_ICONS } from "./gravacoes-client";

type Tab = Exclude<QuestionAudience, "aprofundamento">;
const PRIORITY_MIN = 8;
const PRIORITY_MAX = 12;

function pickShoot(shoots: DocShoot[], requested: string | null): DocShoot | null {
  const usable = shoots.filter((shoot) => shoot.status !== "cancelada");
  if (requested) {
    const found = usable.find((shoot) => shoot.id === requested);
    if (found) return found;
  }
  const today = todayInSaoPaulo();
  const interviews = usable.filter((shoot) => shoot.kind !== "broll");
  return (
    interviews.find((shoot) => shoot.scheduled_date === today) ??
    interviews
      .filter((shoot) => shoot.scheduled_date && shoot.scheduled_date >= today)
      .sort((a, b) => `${a.scheduled_date}${a.start_time ?? ""}`.localeCompare(`${b.scheduled_date}${b.start_time ?? ""}`))[0] ??
    interviews.find((shoot) => shoot.kind === "entrevista") ??
    usable[0] ??
    null
  );
}

/** Situação do ok dos sócios para uma pergunta sensível. */
function consentOf(question: DocQuestion, approvals: DocApprovalItem[], board: DocBoard) {
  if (!question.approval_item_id) return null;
  const item = approvals.find((approval) => approval.id === question.approval_item_id);
  if (!item) return null;
  const decisions = item.approvers.map((key) => ({ key, decision: item.decisions.find((decision) => decision.person_key === key) ?? null }));
  const names = item.approvers.map((key) => board.people.find((person) => person.key === key)?.short_name ?? key).join(" e ");
  if (decisions.some(({ decision }) => !decision || decision.status === "pendente")) return { tone: "pending" as const, text: `Esperando ok de ${names}`, note: null };
  if (decisions.some(({ decision }) => decision?.status === "recusado")) {
    return { tone: "refused" as const, text: `${names}: não fazer`, note: decisions.find(({ decision }) => decision?.status === "recusado")?.decision?.note ?? null };
  }
  if (decisions.some(({ decision }) => decision?.status === "ajustar")) {
    return { tone: "adjust" as const, text: `${DECISION_LABELS.ajustar} (${names})`, note: decisions.find(({ decision }) => decision?.status === "ajustar")?.decision?.note ?? null };
  }
  return { tone: "ok" as const, text: `Liberada por ${names}`, note: null };
}

/** Parágrafo "**Condução:** …" da seção 9, para lembrar na hora. */
function paragraphOf(body: string, label: string): string | null {
  const line = body.split("\n").find((item) => item.startsWith(`**${label}:**`));
  return line ?? null;
}

function QuestionCard({
  question,
  number,
  take,
  canEdit,
  consent,
  clock,
  onTake,
  onPriority,
  onMove,
}: {
  question: DocQuestion;
  number: number;
  take: DocTake | undefined;
  canEdit: boolean;
  consent: ReturnType<typeof consentOf>;
  clock: () => string | null;
  onTake: (patch: Partial<Pick<DocTake, "asked" | "time_mark" | "strong" | "note">>) => void;
  onPriority: (priority: boolean) => void;
  onMove: (direction: "up" | "down") => void;
}) {
  const [noteOpen, setNoteOpen] = useState(Boolean(take?.note));
  const [note, setNote] = useState(take?.note ?? "");
  // Rascunho do tempo enquanto a pessoa digita; fora disso, vale o que está salvo.
  const [markDraft, setMarkDraft] = useState<string | null>(null);
  const mark = markDraft ?? take?.time_mark ?? "";
  const asked = Boolean(take?.asked);
  const refused = consent?.tone === "refused";

  return (
    <li
      className={cn(
        "rounded-lg border px-4 py-3.5 transition-colors",
        asked ? "border-white/5 bg-white/[0.03]" : "border-white/10 bg-white/[0.06]",
        take?.strong && "border-[#E1B16D]/60",
      )}
    >
      <div className="flex gap-3">
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => onTake(asked ? { asked: false } : { asked: true, time_mark: take?.time_mark || clock() })}
          aria-pressed={asked}
          aria-label={asked ? "Desmarcar pergunta feita" : "Marcar pergunta como feita"}
          className={cn(
            "mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full border-2 outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/60",
            asked ? "border-[#47cdd0] bg-[#47cdd0] text-[#06121c]" : "border-white/30 text-white/40 hover:border-[#47cdd0] hover:text-[#47cdd0]",
          )}
        >
          <Check className="size-5" strokeWidth={3} />
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn("text-[19px] leading-8 text-white", asked && "text-white/55", refused && "line-through decoration-rose-400/70")}>
            <span className="mr-2 text-base font-semibold tabular-nums text-[#8fdfe1]">{number}.</span>
            {question.text}
          </p>
          {question.note && <p className="mt-1 text-sm leading-6 text-[#f1d3a4]">{question.note}</p>}
          {consent && (
            <p
              className={cn(
                "mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                consent.tone === "ok" && "bg-emerald-400/15 text-emerald-200",
                consent.tone === "pending" && "bg-amber-400/15 text-amber-200",
                consent.tone === "adjust" && "bg-amber-400/15 text-amber-100",
                consent.tone === "refused" && "bg-rose-400/15 text-rose-200",
              )}
            >
              {consent.tone === "ok" ? <ShieldCheck className="size-3.5" aria-hidden /> : <ShieldAlert className="size-3.5" aria-hidden />}
              {consent.text}
              {consent.note ? ` · ${consent.note}` : ""}
            </p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {canEdit && (
              <button
                type="button"
                onClick={() => onPriority(!question.priority)}
                aria-pressed={question.priority}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium",
                  question.priority ? "bg-[#47cdd0]/15 text-[#8fdfe1]" : "text-white/55 hover:bg-white/10 hover:text-white",
                )}
              >
                <Star className={cn("size-4", question.priority && "fill-current")} aria-hidden />
                {question.priority ? "Prioritária" : "Priorizar"}
              </button>
            )}
            {(asked || take?.strong) && (
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => onTake({ strong: !take?.strong })}
                aria-pressed={Boolean(take?.strong)}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium",
                  take?.strong ? "bg-[#E1B16D]/20 text-[#f1d3a4]" : "text-white/55 hover:bg-white/10 hover:text-white",
                )}
              >
                <Flame className={cn("size-4", take?.strong && "fill-current")} aria-hidden />
                Trecho forte
              </button>
            )}
            {asked && (
              <label className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-white/[0.06] px-2 text-sm text-white/80">
                <Timer className="size-4 text-white/50" aria-hidden />
                <span className="sr-only">Tempo na gravação</span>
                <input
                  value={mark}
                  disabled={!canEdit}
                  onChange={(event) => setMarkDraft(event.target.value)}
                  onBlur={() => {
                    if (markDraft !== null && markDraft !== (take?.time_mark ?? "")) onTake({ time_mark: markDraft.trim() || null });
                    setMarkDraft(null);
                  }}
                  placeholder="mm:ss"
                  className="w-20 bg-transparent font-mono outline-none placeholder:text-white/30"
                />
              </label>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => setNoteOpen((open) => !open)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-white/55 hover:bg-white/10 hover:text-white"
              >
                <NotebookPen className="size-4" aria-hidden />
                Anotar
              </button>
            )}
            {canEdit && (
              <span className="ml-auto flex">
                <button type="button" onClick={() => onMove("up")} aria-label="Subir pergunta" className="flex size-9 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white">
                  <ArrowUp className="size-4" />
                </button>
                <button type="button" onClick={() => onMove("down")} aria-label="Descer pergunta" className="flex size-9 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white">
                  <ArrowDown className="size-4" />
                </button>
              </span>
            )}
          </div>
          {noteOpen && (
            <textarea
              value={note}
              disabled={!canEdit}
              onChange={(event) => setNote(event.target.value)}
              onBlur={() => note !== (take?.note ?? "") && onTake({ note: note.trim() || null })}
              rows={2}
              placeholder="Frase forte, reação, o que aprofundar depois…"
              className="mt-2 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-white/30 focus:border-[#47cdd0]/60"
            />
          )}
          {!noteOpen && take?.note && <p className="mt-2 text-sm leading-6 text-white/70">{take.note}</p>}
        </div>
      </div>
    </li>
  );
}

export function DocDiaClient({ initialBoard }: { initialBoard: DocBoard }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [board, setBoard] = useState(initialBoard);
  const [shootId, setShootId] = useState<string | null>(() => pickShoot(initialBoard.shoots, searchParams.get("gravacao"))?.id ?? null);
  const shoot = board.shoots.find((item) => item.id === shootId) ?? null;
  const [tab, setTab] = useState<Tab>(() => {
    const first = shoot?.person_keys[0];
    return first === "gustavo" ? "gustavo" : "ricardo";
  });
  const [onlyPriority, setOnlyPriority] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const now = useNow(500);
  const canEdit = board.viewer.can_edit;

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const section9 = board.sections.find((section) => section.slug === "entrevistas")?.body ?? "";
  const reminders = [paragraphOf(section9, "Condução"), paragraphOf(section9, "Evitar perguntas indutivas")].filter(Boolean) as string[];
  const followUps = board.questions.filter((question) => question.audience === "aprofundamento");
  const takesOfShoot = useMemo(() => new Map(board.takes.filter((take) => take.shoot_id === shootId).map((take) => [take.question_id, take])), [board.takes, shootId]);
  const list = board.questions.filter((question) => question.audience === tab && (!onlyPriority || question.priority));
  const priorityFor = (person: "ricardo" | "gustavo") => board.questions.filter((question) => (question.audience === person || question.audience === "comum") && question.priority).length;
  const focusPerson = tab === "comum" ? (shoot?.person_keys[0] === "gustavo" ? "gustavo" : "ricardo") : tab;
  const priorityCount = priorityFor(focusPerson);
  const priorityAsked = board.questions.filter((question) => (question.audience === focusPerson || question.audience === "comum") && question.priority && takesOfShoot.get(question.id)?.asked).length;
  const elapsed = shoot ? timerSeconds(shoot, now) : 0;
  const running = Boolean(shoot?.timer_started_at);
  const checklistDay = board.checklist.filter((item) => item.phase === "dia");
  const strongTakes = board.questions.filter((question) => takesOfShoot.get(question.id)?.strong);

  async function call<T>(payload: Record<string, unknown>): Promise<T | null> {
    setError(null);
    try {
      return await docRequest<T>(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar. Confira a conexão.");
      return null;
    }
  }

  function selectShoot(id: string) {
    setShootId(id);
    const next = board.shoots.find((item) => item.id === id);
    if (next?.person_keys[0] === "gustavo") setTab("gustavo");
    else if (next?.person_keys[0] === "ricardo") setTab("ricardo");
    const params = new URLSearchParams(searchParams.toString());
    params.set("gravacao", id);
    router.replace(`/documentario/dia?${params.toString()}`, { scroll: false });
  }

  async function saveTake(questionId: string, patch: Partial<Pick<DocTake, "asked" | "time_mark" | "strong" | "note">>) {
    if (!shootId) return;
    const previous = board.takes;
    const existing = previous.find((take) => take.question_id === questionId && take.shoot_id === shootId);
    const optimistic: DocTake = {
      question_id: questionId,
      shoot_id: shootId,
      asked: patch.asked ?? existing?.asked ?? false,
      asked_at: existing?.asked_at ?? null,
      time_mark: patch.time_mark !== undefined ? patch.time_mark : existing?.time_mark ?? null,
      strong: patch.strong ?? existing?.strong ?? false,
      note: patch.note !== undefined ? patch.note : existing?.note ?? null,
    };
    setBoard((current) => ({ ...current, takes: [...current.takes.filter((take) => !(take.question_id === questionId && take.shoot_id === shootId)), optimistic] }));
    const result = await call<{ take: DocTake }>({ action: "take.save", questionId, shootId, ...patch });
    if (!result) setBoard((current) => ({ ...current, takes: previous }));
    else setBoard((current) => ({ ...current, takes: [...current.takes.filter((take) => !(take.question_id === questionId && take.shoot_id === shootId)), result.take] }));
  }

  async function setPriority(question: DocQuestion, priority: boolean) {
    setBoard((current) => ({ ...current, questions: current.questions.map((item) => (item.id === question.id ? { ...item, priority } : item)) }));
    const result = await call<{ question: DocQuestion }>({ action: "question.priority", id: question.id, priority });
    if (!result) setBoard((current) => ({ ...current, questions: current.questions.map((item) => (item.id === question.id ? { ...item, priority: !priority } : item)) }));
  }

  async function move(question: DocQuestion, direction: "up" | "down") {
    const result = await call<{ questions: DocQuestion[] }>({ action: "question.move", id: question.id, direction });
    if (result) {
      setBoard((current) => ({
        ...current,
        questions: [...current.questions.filter((item) => item.audience !== question.audience), ...result.questions.filter((item) => item.audience === question.audience)],
      }));
    }
  }

  async function timer(op: "start" | "pause" | "reset") {
    if (!shoot) return;
    const result = await call<{ shoots: DocShoot[] }>({ action: "shoot.timer", id: shoot.id, op });
    if (result) setBoard((current) => ({ ...current, shoots: result.shoots }));
  }

  async function toggleCheck(itemId: string, done: boolean) {
    if (!shootId) return;
    const previous = board.shootChecks;
    const optimistic: DocShootCheck[] = done
      ? [...previous, { shoot_id: shootId, item_id: itemId, done_at: new Date().toISOString() }]
      : previous.filter((check) => !(check.shoot_id === shootId && check.item_id === itemId));
    setBoard((current) => ({ ...current, shootChecks: optimistic }));
    const result = await call<{ shootChecks: DocShootCheck[] }>({ action: "shootCheck.toggle", shootId, itemId, done });
    setBoard((current) => ({ ...current, shootChecks: result ? result.shootChecks : previous }));
  }

  async function addQuestion() {
    const text = newQuestion.trim();
    if (text.length < 3) return;
    const result = await call<{ question: DocQuestion }>({
      action: "question.save",
      audience: tab,
      text,
      note: null,
      sensitive: false,
      approval_item_id: null,
      added_on_day: true,
    });
    if (result) {
      setBoard((current) => ({ ...current, questions: [...current.questions, result.question] }));
      setNewQuestion("");
    }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void containerRef.current?.requestFullscreen?.();
  }

  const shootOptions = board.shoots.filter((item) => item.status !== "cancelada");
  const ShootIcon = shoot ? SHOOT_ICONS[shoot.kind] : Timer;
  const persons = shoot ? shoot.person_keys.map((key) => board.people.find((person) => person.key === key)).filter(Boolean) : [];

  return (
    <div
      ref={containerRef}
      className={cn(
        "rounded-lg bg-[#06121c] text-[#e8eef2] shadow-[0_8px_24px_-12px_rgba(3,7,12,0.6)] [color-scheme:dark] selection:bg-[#47cdd0]/30",
        fullscreen && "h-full overflow-y-auto rounded-none",
      )}
    >
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-white/10 bg-[#06121c]/95 px-4 py-3 backdrop-blur sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-white/[0.08] text-[#8fdfe1]">
            <ShootIcon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <label htmlFor="dia-gravacao" className="sr-only">
              Gravação
            </label>
            <select
              id="dia-gravacao"
              value={shootId ?? ""}
              onChange={(event) => selectShoot(event.target.value)}
              className="w-full max-w-md truncate rounded-md bg-transparent py-1 text-base font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60 [&>option]:bg-[#06121c]"
            >
              {shootOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                  {item.scheduled_date ? ` · ${formatWeekdayDate(item.scheduled_date)}` : " · sem data"}
                </option>
              ))}
            </select>
            <p className="truncate text-xs text-white/55">
              {shoot?.scheduled_date
                ? [formatWeekdayDate(shoot.scheduled_date), shoot.start_time ? formatHour(shoot.start_time) : null, shoot.location].filter(Boolean).join(" · ")
                : "Gravação sem data marcada"}
            </p>
          </div>
          <div className="hidden -space-x-2 sm:flex">
            {persons.map((person) => (person ? <Face key={person.key} name={person.name} avatarUrl={person.avatar_url} size="md" className="ring-2 ring-[#06121c]" /> : null))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={cn("font-mono text-[32px] font-semibold leading-none tabular-nums", running ? "text-[#47cdd0]" : "text-white")} aria-live="off" aria-label="Tempo de gravação">
            {formatClock(elapsed)}
          </span>
          {canEdit && shoot && (
            <>
              <button
                type="button"
                onClick={() => void timer(running ? "pause" : "start")}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-md px-4 text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/60",
                  running ? "bg-white/10 text-white hover:bg-white/15" : "bg-[#47cdd0] text-[#06121c] hover:bg-[#6ad8da]",
                )}
              >
                {running ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
                {running ? "Pausar" : elapsed > 0 ? "Continuar" : "Iniciar"}
              </button>
              {elapsed > 0 && !running && (
                <button type="button" onClick={() => void timer("reset")} aria-label="Zerar cronômetro" className="flex size-11 items-center justify-center rounded-md text-white/60 hover:bg-white/10 hover:text-white">
                  <RotateCcw className="size-4" />
                </button>
              )}
            </>
          )}
          <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? "Sair da tela cheia" : "Tela cheia"} className="flex size-11 items-center justify-center rounded-md text-white/60 hover:bg-white/10 hover:text-white">
            {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        </div>
      </header>

      {error && <p className="mx-4 mt-3 rounded-md bg-rose-500/15 px-3 py-2 text-sm text-rose-100 sm:mx-5">{error}</p>}
      {!shoot && <p className="px-5 py-10 text-center text-white/70">Nenhuma gravação cadastrada. Cadastre na aba Gravações.</p>}

      {shoot && (
        <div className="grid gap-6 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <div role="tablist" aria-label="Perguntas" className="inline-flex rounded-md bg-white/[0.06] p-1">
                {(["ricardo", "gustavo", "comum"] as Tab[]).map((id) => {
                  const person = board.people.find((item) => item.key === id);
                  return (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={tab === id}
                      onClick={() => setTab(id)}
                      className={cn(
                        "inline-flex min-h-10 items-center gap-2 rounded px-3 text-sm font-semibold",
                        tab === id ? "bg-white text-[#06121c]" : "text-white/65 hover:text-white",
                      )}
                    >
                      {person && <Face name={person.name} avatarUrl={person.avatar_url} size="xs" />}
                      {person ? person.short_name : "Comuns"}
                    </button>
                  );
                })}
              </div>
              <label className="inline-flex min-h-10 items-center gap-2 text-sm text-white/75">
                <input type="checkbox" className="size-4 accent-[#47cdd0]" checked={onlyPriority} onChange={(event) => setOnlyPriority(event.target.checked)} />
                Só prioritárias
              </label>
              <p className={cn("ml-auto text-sm", priorityCount >= PRIORITY_MIN && priorityCount <= PRIORITY_MAX ? "text-white/65" : "text-amber-200")}>
                {board.people.find((person) => person.key === focusPerson)?.short_name}: {priorityAsked} de {priorityCount} prioritárias feitas
                <span className="text-white/45"> · meta {PRIORITY_MIN} a {PRIORITY_MAX}</span>
              </p>
            </div>

            <ol className="mt-4 space-y-3">
              {list.map((question) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  number={board.questions.filter((item) => item.audience === question.audience).findIndex((item) => item.id === question.id) + 1}
                  take={takesOfShoot.get(question.id)}
                  canEdit={canEdit}
                  consent={question.sensitive ? consentOf(question, board.approvals, board) : null}
                  clock={() => (elapsed > 0 ? formatClock(elapsed) : null)}
                  onTake={(patch) => void saveTake(question.id, patch)}
                  onPriority={(priority) => void setPriority(question, priority)}
                  onMove={(direction) => void move(question, direction)}
                />
              ))}
              {list.length === 0 && <li className="rounded-lg border border-dashed border-white/15 px-4 py-8 text-center text-white/60">Nenhuma pergunta prioritária aqui. Desmarque o filtro e use a estrela para escolher.</li>}
            </ol>

            {canEdit && (
              <form
                className="mt-3 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void addQuestion();
                }}
              >
                <input
                  value={newQuestion}
                  onChange={(event) => setNewQuestion(event.target.value)}
                  placeholder="Pergunta complementar que surgiu na conversa"
                  aria-label="Nova pergunta complementar"
                  className="h-11 min-w-0 flex-1 rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#47cdd0]/60"
                />
                <button type="submit" disabled={newQuestion.trim().length < 3} className="inline-flex h-11 items-center gap-2 rounded-md bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-40">
                  <Plus className="size-4" aria-hidden />
                  Incluir
                </button>
              </form>
            )}
          </div>

          <aside className="space-y-5" aria-label="Apoio para a gravação">
            <section aria-labelledby="dia-checklist" className="rounded-lg bg-white/[0.05] p-4">
              <h2 id="dia-checklist" className="text-sm font-semibold text-white">
                No dia da captação
              </h2>
              <p className="text-xs text-white/50">Vale para esta gravação.</p>
              <ul className="mt-2 space-y-1">
                {checklistDay.map((item) => {
                  const done = board.shootChecks.some((check) => check.shoot_id === shootId && check.item_id === item.id);
                  return (
                    <li key={item.id}>
                      <label className={cn("flex min-h-11 cursor-pointer items-start gap-3 rounded-md px-1 py-2 text-sm leading-5 hover:bg-white/[0.04]", done ? "text-white/45 line-through" : "text-white/90")}>
                        <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[#47cdd0]" checked={done} disabled={!canEdit} onChange={(event) => void toggleCheck(item.id, event.target.checked)} />
                        {item.text}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section aria-labelledby="dia-aprofundar" className="rounded-lg bg-white/[0.05] p-4">
              <h2 id="dia-aprofundar" className="text-sm font-semibold text-white">
                Para aprofundar
              </h2>
              <ul className="mt-2 space-y-1.5 text-[15px] leading-6 text-white/85">
                {followUps.map((question) => (
                  <li key={question.id}>“{question.text}”</li>
                ))}
              </ul>
            </section>

            {reminders.length > 0 && (
              <section aria-label="Lembretes de condução" className="rounded-lg bg-white/[0.05] p-4">
                <Markdown source={reminders.join("\n\n")} className="text-white/75 [&_strong]:text-white" />
              </section>
            )}

            {strongTakes.length > 0 && (
              <section aria-labelledby="dia-fortes" className="rounded-lg bg-[#E1B16D]/10 p-4">
                <h2 id="dia-fortes" className="flex items-center gap-1.5 text-sm font-semibold text-[#f1d3a4]">
                  <Flame className="size-4" aria-hidden />
                  Trechos fortes desta gravação
                </h2>
                <ul className="mt-2 space-y-2 text-sm leading-5 text-white/85">
                  {strongTakes.map((question) => {
                    const take = takesOfShoot.get(question.id);
                    return (
                      <li key={question.id}>
                        <span className="mr-1.5 font-mono text-[#f1d3a4]">{take?.time_mark ?? "--:--"}</span>
                        {question.text}
                        {take?.note && <span className="block text-xs text-white/60">{take.note}</span>}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
