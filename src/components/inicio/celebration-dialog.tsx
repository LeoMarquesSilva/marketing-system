"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AtSign,
  Briefcase,
  Cake,
  CalendarDays,
  Heart,
  Layers,
  Loader2,
  MessageCircle,
  Search,
  Send,
  Share2,
  Smile,
  Trash2,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { EmployeeAvatar } from "@/components/ferias/employee-avatar";
import { CelebrationShare } from "@/components/inicio/celebration-share";
import {
  CELEBRATION_COMMENT_MAX,
  CELEBRATION_MENTIONS_MAX,
  CELEBRATION_PRAISES,
  likedByLabel,
  type CelebrationComment,
  type CelebrationDetail,
  type CelebrationPerson,
} from "@/lib/inicio/celebrations";
import {
  fetchCelebration,
  postComment,
  removeComment,
  toggleCommentLike,
  toggleLike,
  togglePraise,
} from "@/lib/inicio/celebrations-client";
import { shortDate } from "@/lib/inicio/dates";
import type { HomeCelebration } from "@/lib/inicio/types";
import { awardSealSrc } from "@/lib/rh/bp-awards/types";
import { cn } from "@/lib/utils";

/** Marinho e dourado da Bismarchi | Pires: a comemoração é uma peça da marca. */
const NAVY = "#0D1E2E";
const GOLD = "#E1B16D";

const QUICK_EMOJIS = ["🎉", "🎂", "👏", "❤️", "🥳", "🙌", "✨", "🥂"];

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** "Aniversário" ou "3 anos de casa". */
export function celebrationCaption(item: HomeCelebration): string {
  if (item.kind === "aniversario") return "Aniversário";
  return `${item.years ?? 0} ${plural(item.years ?? 0, "ano", "anos")} de casa`;
}

const dateOf = (item: HomeCelebration) => `${item.year}-${String(item.month).padStart(2, "0")}-${String(item.day).padStart(2, "0")}`;

/** "Hoje", "Amanhã", "Ontem", "Há 3 dias" ou "15 nov". */
export function celebrationWhen(item: HomeCelebration, today: string): string {
  if (item.inDays === 0) return "Hoje";
  if (item.inDays === 1) return "Amanhã";
  if (item.inDays === -1) return "Ontem";
  if (item.inDays < 0) return `Há ${-item.inDays} dias`;
  return shortDate(dateOf(item), today);
}

/** Selo do topo: "Aniversariante do dia", "5 anos de casa hoje", "Aniversário em 15 nov"… */
function badgeLabel(item: HomeCelebration, today: string): string {
  const when = celebrationWhen(item, today).toLowerCase();
  if (item.kind === "aniversario") {
    if (item.inDays === 0) return "Aniversariante do dia";
    return item.inDays > 0 ? `Aniversário ${item.inDays === 1 ? "amanhã" : `em ${when}`}` : `Fez aniversário ${when}`;
  }
  const caption = celebrationCaption(item);
  if (item.inDays === 0) return `${caption} hoje`;
  return item.inDays > 0 ? `${caption} ${item.inDays === 1 ? "amanhã" : `em ${when}`}` : `${caption} · ${when}`;
}

/** "Agora", "Há 12 min", "Há 3 horas", "Ontem" ou a data. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const minutes = Math.floor((Date.now() - then) / 60000);
  if (minutes < 1) return "Agora";
  if (minutes < 60) return `Há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Há ${hours} ${plural(hours, "hora", "horas")}`;
  if (hours < 48) return "Ontem";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso)).replace(".", "");
}

/** Fios dourados do canto do cabeçalho (decoração da peça). */
function GoldArcs() {
  return (
    <svg aria-hidden viewBox="0 0 420 200" className="pointer-events-none absolute right-0 top-0 hidden h-full w-[420px] sm:block" fill="none">
      <path d="M150 -20 C 230 60, 330 100, 440 96" stroke={GOLD} strokeOpacity="0.55" strokeWidth="1" />
      <path d="M190 -20 C 260 50, 345 84, 440 78" stroke={GOLD} strokeOpacity="0.4" strokeWidth="1" />
      <path d="M240 -20 C 290 36, 360 64, 440 58" stroke={GOLD} strokeOpacity="0.28" strokeWidth="1" />
      <path d="M300 220 C 340 170, 390 150, 440 150" stroke={GOLD} strokeOpacity="0.3" strokeWidth="1" />
    </svg>
  );
}

/** Cartão da comemoração para quem ainda não tem arte: mesma linguagem das peças de aniversário. */
function FallbackArt({ item, today }: { item: HomeCelebration; today: string }) {
  const firstName = item.name.split(" ")[0];
  const dateLabel = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${dateOf(item)}T12:00:00Z`));
  return (
    <div className="relative flex h-full min-h-[320px] flex-col justify-between overflow-hidden rounded-lg p-6 text-white" style={{ backgroundColor: NAVY }}>
      <svg aria-hidden viewBox="0 0 400 520" className="pointer-events-none absolute inset-0 h-full w-full" fill="none" preserveAspectRatio="none">
        <path d="M-20 420 C 120 380, 260 440, 420 330" stroke={GOLD} strokeOpacity="0.45" strokeWidth="1" />
        <path d="M-20 460 C 140 420, 280 480, 420 380" stroke={GOLD} strokeOpacity="0.3" strokeWidth="1" />
        <path d="M-20 60 C 60 20, 140 30, 200 -20" stroke={GOLD} strokeOpacity="0.3" strokeWidth="1" />
      </svg>
      <p className="relative text-xs font-semibold uppercase" style={{ color: GOLD }}>
        {item.kind === "aniversario" ? (item.inDays === 0 ? "Aniversariante do dia" : "Aniversário") : "Aniversário de empresa"}
      </p>
      <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <EmployeeAvatar
          name={item.name}
          avatarUrl={item.avatarUrl}
          className="h-28 w-28 rounded-lg ring-2 ring-offset-4 ring-offset-[#0D1E2E]"
          fallbackClassName="rounded-lg bg-[#16324a] text-3xl text-white"
        />
        <div>
          <p className="text-3xl font-semibold leading-tight">
            Parabéns,
            <span className="block" style={{ color: GOLD }}>
              {firstName}!
            </span>
          </p>
          <span className="mt-3 block h-px w-10" style={{ backgroundColor: GOLD }} />
          <p className="mt-3 max-w-[26ch] text-sm leading-relaxed text-white/85">
            {item.kind === "aniversario"
              ? "Que este novo ciclo seja repleto de realizações."
              : `${celebrationCaption(item)} fazendo parte do nosso time.`}
          </p>
        </div>
      </div>
      <p className="relative flex items-center gap-3 text-xs font-semibold uppercase text-white/90">
        <span className="h-px flex-1" style={{ backgroundColor: GOLD, opacity: 0.6 }} />
        <span className="rounded-full border px-3 py-1" style={{ borderColor: GOLD }}>
          {dateLabel}
          {item.inDays > 0 && item.year !== Number(today.slice(0, 4)) ? ` de ${item.year}` : ""}
        </span>
        <span className="h-px flex-1" style={{ backgroundColor: GOLD, opacity: 0.6 }} />
      </p>
    </div>
  );
}

/** Fotos empilhadas de quem reconheceu um valor, com "+N" quando passa do que cabe. */
function FaceStack({ people, total, dark }: { people: Array<{ name: string; avatarUrl: string | null }>; total: number; dark?: boolean }) {
  const shown = people.slice(0, 3);
  const rest = total - shown.length;
  return (
    <span
      className="flex shrink-0 items-center"
      aria-label={`${total} ${total === 1 ? "pessoa reconheceu" : "pessoas reconheceram"}: ${people.map((person) => person.name).join(", ")}`}
    >
      {shown.map((person, index) => (
        <EmployeeAvatar
          key={`${person.name}-${index}`}
          name={person.name}
          avatarUrl={person.avatarUrl}
          className={cn("h-6 w-6 ring-2", dark ? "ring-[#0D1E2E]" : "ring-white", index > 0 && "-ml-2")}
          fallbackClassName="text-[10px]"
        />
      ))}
      {rest > 0 && (
        <span className={cn("ml-1 text-xs font-semibold tabular-nums", dark ? "text-white/85" : "text-[#3b5560]")}>+{rest}</span>
      )}
    </span>
  );
}

/** Seletor de colegas para marcar na mensagem. */
function MentionPicker({ people, selected, onToggle }: { people: CelebrationPerson[]; selected: string[]; onToggle: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const full = selected.length >= CELEBRATION_MENTIONS_MAX;
  const matches = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    const list = term ? people.filter((person) => person.name.toLocaleLowerCase("pt-BR").includes(term)) : people;
    return list.slice(0, 30);
  }, [people, query]);

  return (
    <div className="rounded-lg border border-[#dce9eb] bg-white shadow-[0_8px_24px_rgba(4,32,47,0.10)]">
      <label className="flex items-center gap-2 border-b border-[#e6eff1] px-3 py-2">
        <Search className="size-4 shrink-0 text-[#7b929c]" aria-hidden />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar pessoa para marcar"
          aria-label="Buscar pessoa para marcar"
          className="w-full bg-transparent text-sm outline-none placeholder:text-[#7b929c]"
        />
      </label>
      <ul className="max-h-36 overflow-y-auto p-1">
        {matches.length === 0 && <li className="px-2 py-2 text-sm text-muted-foreground">Ninguém com esse nome.</li>}
        {matches.map((person) => {
          const checked = selected.includes(person.id);
          return (
            <li key={person.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                disabled={!checked && full}
                onClick={() => onToggle(person.id)}
                className={cn(
                  "flex min-h-10 w-full items-center gap-2.5 rounded px-2 py-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0] disabled:opacity-45",
                  checked ? "bg-[#eef7f9]" : "hover:bg-[#f4fafb]"
                )}
              >
                <EmployeeAvatar name={person.name} avatarUrl={person.avatarUrl} className="h-7 w-7" />
                <span className="min-w-0 flex-1 truncate text-sm text-[#0d2a38]">{person.name}</span>
                <span className="truncate text-xs text-[#5a717b]">{person.department ?? ""}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MessageCard({
  comment,
  busy,
  onLike,
  onDelete,
}: {
  comment: CelebrationComment;
  busy: string | null;
  onLike: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex gap-3 rounded-lg border border-[#e3ecee] bg-white p-3 shadow-[0_1px_2px_rgba(4,32,47,0.04)]">
      <EmployeeAvatar name={comment.author.name} avatarUrl={comment.author.avatarUrl} className="h-10 w-10" />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-1.5">
          <span className="truncate text-sm font-semibold text-[#0d2a38]">{comment.author.name}</span>
          {comment.author.department && <span className="truncate text-xs text-[#5a717b]">· {comment.author.department}</span>}
          <span className="ml-auto shrink-0 text-xs text-[#7b929c]">{relativeTime(comment.createdAt)}</span>
        </p>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#22404d]">{comment.body}</p>
        {comment.mentions.length > 0 && (
          <p className="mt-1.5 flex flex-wrap gap-1">
            {comment.mentions.map((person) => (
              <span key={person.id} className="rounded-full bg-[#dceff3] px-2 py-0.5 text-xs font-medium text-[#285f7a]">
                @{person.name}
              </span>
            ))}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end justify-between gap-1">
        {comment.canDelete ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={busy !== null}
            aria-label={`Apagar a mensagem de ${comment.author.name}`}
            className="flex size-7 items-center justify-center rounded text-[#9fb2ba] outline-none transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:ring-2 focus-visible:ring-[#47cdd0] disabled:opacity-50"
          >
            {busy === `del:${comment.id}` ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
          </button>
        ) : (
          <span className="size-7" aria-hidden />
        )}
        <button
          type="button"
          onClick={onLike}
          disabled={busy !== null}
          aria-pressed={comment.liked}
          aria-label={comment.liked ? "Descurtir a mensagem" : "Curtir a mensagem"}
          className={cn(
            "inline-flex min-h-7 items-center gap-1 rounded px-1.5 text-sm tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0] disabled:opacity-60",
            comment.liked ? "text-[#285f7a]" : "text-[#5a717b] hover:text-[#285f7a]"
          )}
        >
          <Heart className={cn("size-4", comment.liked && "fill-[#347796] text-[#347796]")} aria-hidden />
          {comment.likes > 0 ? comment.likes : ""}
        </button>
      </div>
    </li>
  );
}

/** A comemoração de uma pessoa: arte, parabéns, elogios e mensagens do time, em modal centralizado. */
export function CelebrationDialog({
  item,
  today,
  onClose,
  onChanged,
}: {
  item: HomeCelebration | null;
  today: string;
  onClose: () => void;
  /** Parabéns ou mensagem mudou: a tela inicial atualiza os números. */
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<CelebrationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [panel, setPanel] = useState<"mentions" | "emojis" | null>(null);
  const [reload, setReload] = useState(0);
  /** O mesmo modal troca entre a comemoração e o montador de post (sem empilhar outro modal). */
  const [view, setView] = useState<"celebration" | "share">("celebration");
  const input = useRef<HTMLTextAreaElement>(null);

  const targetKey = item ? `${item.id}:${item.kind}:${item.year}` : null;

  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    fetchCelebration({ employeeId: item.id, kind: item.kind, year: item.year })
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setError(null);
      })
      .catch((failure: unknown) => {
        if (!cancelled) setError(failure instanceof Error ? failure.message : "Não foi possível carregar as felicitações.");
      });
    return () => {
      cancelled = true;
    };
    // `item` muda de identidade a cada atualização da tela; a chave diz se é outra comemoração.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, reload]);

  const close = () => {
    setDetail(null);
    setError(null);
    setText("");
    setMentions([]);
    setPanel(null);
    setView("celebration");
    onClose();
  };

  if (!item) return null;
  const target = { employeeId: item.id, kind: item.kind, year: item.year };
  const firstName = item.name.split(" ")[0];
  const mentionNames = new Map((detail?.people ?? []).map((person) => [person.id, person.name]));
  const canInteract = detail?.canInteract ?? false;
  const messageCount = detail?.comments.length ?? item.comments;
  /** O valor que mais gente reconheceu (empate: a ordem do CIVIL). */
  const topPraise = (() => {
    const best = [...(detail?.praises ?? [])].sort((a, b) => b.count - a.count)[0];
    if (!best || best.count === 0) return null;
    return { ...best, label: CELEBRATION_PRAISES.find((praise) => praise.key === best.key)?.label ?? "" };
  })();

  const run = async (key: string, task: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await task();
      onChanged();
      setReload((value) => value + 1);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível concluir. Tente de novo.");
    } finally {
      setBusy(null);
    }
  };

  const publish = () =>
    run("comment", async () => {
      await postComment(target, text, mentions);
      setText("");
      setMentions([]);
      setPanel(null);
    });

  const toggleMention = (id: string) =>
    setMentions((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));

  const addEmoji = (emoji: string) => {
    setText((current) => `${current}${emoji}`.slice(0, CELEBRATION_COMMENT_MAX));
    input.current?.focus();
  };

  return (
    <Dialog open onOpenChange={(next) => !next && close()}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        {/* Cabeçalho da peça: quem é, quando e o selo da comemoração. */}
        <header className="relative shrink-0 overflow-hidden border-b border-[#ece4d3] bg-[linear-gradient(100deg,#ffffff_0%,#ffffff_55%,#fbf4e6_100%)] px-6 py-5">
          <GoldArcs />
          <div className="relative flex flex-wrap items-center gap-x-5 gap-y-4 pr-10">
            <EmployeeAvatar
              name={item.name}
              avatarUrl={item.avatarUrl}
              className="h-20 w-20 ring-2 ring-[#E1B16D] ring-offset-2 ring-offset-white sm:h-24 sm:w-24"
              fallbackClassName="bg-[#16324a] text-2xl text-white"
            />
            <div className="min-w-0 flex-1 basis-56">
              <DialogTitle className="truncate text-2xl font-semibold leading-tight text-[#0D1E2E]">{item.name}</DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-1.5 text-[15px] text-[#3b5560]">
                <Briefcase className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{item.position ?? item.department ?? "Bismarchi | Pires"}</span>
              </DialogDescription>
              <p className="mt-3 flex flex-wrap gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-[#fbefd6] px-2.5 py-1 font-semibold text-[#7a5a1e]">
                  <CalendarDays className="size-4" aria-hidden />
                  {celebrationWhen(item, today)}
                </span>
                {item.department && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-[#eaf2f5] px-2.5 py-1 font-medium text-[#285f7a]">
                    <Layers className="size-4" aria-hidden />
                    Área: {item.department}
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#f6dfae] px-4 py-2 text-sm font-semibold text-[#5c4210] shadow-[0_2px_10px_rgba(225,177,109,0.35)]">
                {item.kind === "aniversario" ? <Cake className="size-5" aria-hidden /> : <Trophy className="size-5" aria-hidden />}
                {badgeLabel(item, today)}
              </span>
              {detail?.canShare && view === "celebration" && (
                <Button className="rounded-full bg-[#12385a] hover:bg-[#0D1E2E]" onClick={() => setView("share")}>
                  <Share2 className="size-4" aria-hidden />
                  {detail.isOwn ? "Compartilhar nas redes" : "Montar post"}
                </Button>
              )}
            </div>
          </div>
        </header>

        {view === "share" && detail ? (
          <CelebrationShare item={item} detail={detail} onBack={() => setView("celebration")} />
        ) : (
        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto bg-[#f7fafb] p-5 md:grid-cols-[5fr_6fr] md:overflow-hidden">
          {/* Arte da comemoração */}
          <div className="flex items-stretch md:min-h-0 md:overflow-hidden">
            {item.artUrl ? (
              <div className="flex w-full items-center justify-center overflow-hidden rounded-lg" style={{ backgroundColor: NAVY }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.artUrl}
                  alt={`Arte de ${celebrationCaption(item).toLowerCase()} de ${item.name}`}
                  className="max-h-[60dvh] w-auto max-w-full object-contain md:max-h-full"
                />
              </div>
            ) : (
              <div className="w-full">
                <FallbackArt item={item} today={today} />
              </div>
            )}
          </div>

          {/* Parabéns, elogios e mensagens */}
          <div className="flex flex-col gap-4 md:min-h-0 md:overflow-hidden">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => run("like", () => toggleLike(target))}
                disabled={!canInteract || busy !== null}
                aria-pressed={detail?.liked ?? false}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2.5 rounded-lg px-6 text-base font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0] focus-visible:ring-offset-2 disabled:opacity-55",
                  detail?.liked ? "bg-[#fbefd6] text-[#5c4210] hover:bg-[#f6dfae]" : "bg-[#12385a] text-white hover:bg-[#0D1E2E]"
                )}
              >
                {busy === "like" ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                ) : (
                  <Heart className={cn("size-5", detail?.liked && "fill-[#c98a1e] text-[#c98a1e]")} aria-hidden />
                )}
                {detail?.liked ? "Você parabenizou" : "Parabenizar"}
              </button>
              <span className="ml-auto inline-flex items-center gap-2 rounded-full bg-[#e6eef2] px-3.5 py-2 text-sm text-[#22404d]">
                <Users className="size-4" aria-hidden />
                <strong className="font-semibold tabular-nums">{messageCount}</strong> {plural(messageCount, "mensagem", "mensagens")}
              </span>
              <p className="basis-full text-xs text-[#5a717b]">{detail ? likedByLabel(detail.likedBy, detail.likes) : " "}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-[#22404d]">O que você reconhece em {firstName}?</p>
              {topPraise && (
                <div className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-white" style={{ backgroundColor: NAVY }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={awardSealSrc(topPraise.key)} alt="" className="size-12 shrink-0 object-contain" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs" style={{ color: GOLD }}>
                      O time reconhece em {firstName}
                    </p>
                    <p className="truncate text-base font-semibold leading-tight">{topPraise.label}</p>
                  </div>
                  <FaceStack people={topPraise.people} total={topPraise.count} dark />
                </div>
              )}
              {/* Cada valor aparece com o selo oficial dele (os mesmos arquivos da identidade do BP Awards). */}
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {CELEBRATION_PRAISES.map((praise) => {
                  const state = detail?.praises.find((entry) => entry.key === praise.key);
                  return (
                    <button
                      key={praise.key}
                      type="button"
                      onClick={() => run(`praise:${praise.key}`, () => togglePraise(target, praise.key))}
                      disabled={!canInteract || busy !== null}
                      aria-pressed={state?.mine ?? false}
                      className={cn(
                        "relative flex flex-col items-center gap-1.5 rounded-lg border px-1.5 pb-2 pt-2.5 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0] disabled:opacity-55",
                        state?.mine ? "border-[#E1B16D] bg-[#fbefd6]" : "border-[#d5e2e6] bg-white hover:border-[#E1B16D]/70 hover:bg-[#fffaf0]"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-14 items-center justify-center rounded-full ring-2 ring-offset-2",
                          state?.mine ? "ring-[#E1B16D] ring-offset-[#fbefd6]" : "ring-transparent ring-offset-white"
                        )}
                        style={{ backgroundColor: NAVY }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={awardSealSrc(praise.key)} alt="" className="size-[52px] object-contain" loading="lazy" />
                      </span>
                      <span className={cn("text-xs font-semibold leading-tight", state?.mine ? "text-[#5c4210]" : "text-[#22404d]")}>
                        {praise.label}
                      </span>
                      {state && state.count > 0 ? (
                        <FaceStack people={state.people} total={state.count} />
                      ) : (
                        <span className="text-xs text-[#7b929c]">Reconhecer</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col md:min-h-0 md:flex-1">
              <div className="flex items-baseline justify-between">
                <h3 className="text-base font-semibold text-[#0D1E2E]">Mensagens do time</h3>
                {detail && detail.comments.length > 1 && <span className="text-xs text-[#5a717b]">Mais recentes primeiro</span>}
              </div>
              {error && (
                <p role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                  {error}
                </p>
              )}
              <div className="mt-2 min-h-[120px] md:flex-1 md:overflow-y-auto md:pr-1">
                {!detail && !error ? (
                  <div className="flex min-h-[120px] items-center justify-center">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Carregando" />
                  </div>
                ) : detail && detail.comments.length === 0 ? (
                  <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#d5e2e6] bg-white px-4 py-6 text-center">
                    <MessageCircle className="size-7 text-[#9fb2ba]" aria-hidden />
                    <p className="text-sm text-muted-foreground">
                      {canInteract ? `Nenhuma mensagem ainda. Seja a primeira pessoa a escrever para ${firstName}.` : "As mensagens aparecem aqui a partir do dia."}
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2.5">
                    {detail?.comments.map((comment) => (
                      <MessageCard
                        key={comment.id}
                        comment={comment}
                        busy={busy}
                        onLike={() => run(`like:${comment.id}`, () => toggleCommentLike(comment.id))}
                        onDelete={() => run(`del:${comment.id}`, () => removeComment(comment.id))}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Escrever */}
            {detail && !canInteract ? (
              <p className="rounded-lg border border-[#e3ecee] bg-white px-4 py-3 text-sm text-muted-foreground">
                {item.inDays > 0
                  ? `Você poderá parabenizar, elogiar e escrever a partir de ${shortDate(dateOf(item), today)}.`
                  : "O período para parabenizar terminou."}
              </p>
            ) : (
              <div className="shrink-0 space-y-2">
                {panel === "mentions" && detail && <MentionPicker people={detail.people} selected={mentions} onToggle={toggleMention} />}
                {panel === "emojis" && (
                  <div className="flex flex-wrap gap-1 rounded-lg border border-[#dce9eb] bg-white p-1.5 shadow-[0_8px_24px_rgba(4,32,47,0.10)]">
                    {QUICK_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => addEmoji(emoji)}
                        aria-label={`Inserir ${emoji}`}
                        className="flex size-10 items-center justify-center rounded text-xl outline-none hover:bg-[#f4fafb] focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
                {mentions.length > 0 && (
                  <p className="flex flex-wrap gap-1.5">
                    {mentions.map((id) => (
                      <span key={id} className="inline-flex items-center gap-1 rounded-full bg-[#dceff3] py-0.5 pl-2.5 pr-1 text-xs font-medium text-[#285f7a]">
                        @{mentionNames.get(id) ?? "pessoa"}
                        <button
                          type="button"
                          onClick={() => toggleMention(id)}
                          aria-label={`Desmarcar ${mentionNames.get(id) ?? "pessoa"}`}
                          className="flex size-5 items-center justify-center rounded-full outline-none hover:bg-[#c5e2e8] focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
                        >
                          <X className="size-3" aria-hidden />
                        </button>
                      </span>
                    ))}
                  </p>
                )}
                <div className="flex items-end gap-2">
                  <div className="flex min-h-11 flex-1 items-end gap-1 rounded-lg border border-[#cfdde2] bg-white px-2 py-1 focus-within:border-[#47cdd0] focus-within:ring-2 focus-within:ring-[#47cdd0]/30">
                    <MessageCircle className="mb-2 ml-1 size-5 shrink-0 text-[#7b929c]" aria-hidden />
                    <textarea
                      ref={input}
                      value={text}
                      onChange={(event) => setText(event.target.value.slice(0, CELEBRATION_COMMENT_MAX))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey && text.trim() && busy === null) {
                          event.preventDefault();
                          void publish();
                        }
                      }}
                      rows={1}
                      placeholder={`Escreva uma mensagem para ${firstName}...`}
                      aria-label={`Mensagem para ${firstName}`}
                      disabled={!detail || busy === "comment"}
                      className="max-h-28 min-h-9 flex-1 resize-none bg-transparent px-1.5 py-2 text-sm outline-none [field-sizing:content] placeholder:text-[#7b929c]"
                    />
                    <button
                      type="button"
                      onClick={() => setPanel((current) => (current === "mentions" ? null : "mentions"))}
                      disabled={!detail}
                      aria-expanded={panel === "mentions"}
                      aria-label="Marcar pessoas"
                      title="Marcar pessoas"
                      className={cn(
                        "mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
                        panel === "mentions" || mentions.length > 0 ? "bg-[#dceff3] text-[#285f7a]" : "text-[#5a717b] hover:bg-[#f1f5f6]"
                      )}
                    >
                      <AtSign className="size-5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPanel((current) => (current === "emojis" ? null : "emojis"))}
                      aria-expanded={panel === "emojis"}
                      aria-label="Inserir emoji"
                      title="Inserir emoji"
                      className={cn(
                        "mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
                        panel === "emojis" ? "bg-[#fbefd6] text-[#7a5a1e]" : "text-[#5a717b] hover:bg-[#f1f5f6]"
                      )}
                    >
                      <Smile className="size-5" aria-hidden />
                    </button>
                  </div>
                  <Button
                    size="icon"
                    className="size-11 shrink-0 rounded-lg bg-[#12385a] hover:bg-[#0D1E2E]"
                    disabled={!detail || busy !== null || text.trim().length === 0}
                    aria-label="Enviar mensagem"
                    onClick={publish}
                  >
                    {busy === "comment" ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Send className="size-5" aria-hidden />}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
