"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  EyeOff,
  LoaderCircle,
  Maximize2,
  MessageSquareQuote,
  Minimize2,
  Sparkles,
  Star,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { AwardAvatar } from "@/components/rh/bp-awards/award-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AWARD_CATEGORIES,
  AWARD_HUBS,
  MAX_FINALISTS,
  awardSealSrc,
  type AwardAiReview,
  type AwardAiSlot,
  type AwardCategory,
  type AwardCategoryKey,
  type AwardFinalist,
  type AwardHubKey,
  type HubTallies,
  type NomineeTally,
} from "@/lib/rh/bp-awards/types";
import { cn } from "@/lib/utils";
import { requestJson } from "./request";

/**
 * Aba Reunião do comitê: para projetar no debate. Por hub e valor, a sugestão
 * da IA, quem entra no lugar, a nota da IA, todos os relatos e o botão para
 * definir o vencedor. Nunca mostra quem indicou.
 */

type Review = Pick<AwardAiReview, "score" | "summary">;
type Opened = { hub: AwardHubKey; category: AwardCategory; tally: NomineeTally };

const reviewKey = (hub: string, category: string, employeeId: string) => `${hub}:${category}:${employeeId}`;
const slotKeyOf = (hub: string, category: string) => `${hub}:${category}`;

function scoreTone(score: number): string {
  if (score >= 8) return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (score >= 6) return "bg-amber-50 text-amber-800 ring-amber-200";
  return "bg-rose-50 text-rose-800 ring-rose-200";
}

function ScoreBadge({ review, large = false }: { review: Review | undefined; large?: boolean }) {
  if (!review) return <span className="text-xs text-muted-foreground">sem nota</span>;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-baseline gap-1 rounded-md px-2 py-0.5 font-semibold tabular-nums ring-1 ring-inset",
        large ? "text-base" : "text-xs",
        scoreTone(review.score)
      )}
      title="Nota da IA (0 a 10) pela força dos relatos, não pela quantidade de votos"
    >
      {review.score}
      <span className={cn("font-normal opacity-75", large ? "text-xs" : "text-[10px]")}>/10</span>
    </span>
  );
}

function votesLabel(count: number): string {
  return `${count} ${count === 1 ? "voto" : "votos"}`;
}

export function MeetingPanel({
  tallies,
  finalists,
  aiReviews,
  aiSlots,
  onFinalistsChange,
}: {
  tallies: HubTallies;
  finalists: AwardFinalist[];
  aiReviews: AwardAiReview[];
  aiSlots: AwardAiSlot[];
  onFinalistsChange: (finalists: AwardFinalist[]) => void;
}) {
  const [hub, setHub] = useState<AwardHubKey>(AWARD_HUBS[0].key);
  const [presenting, setPresenting] = useState(false);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reviews = useMemo(
    () => new Map(aiReviews.map((review) => [reviewKey(review.hub, review.category, review.employee_id), review])),
    [aiReviews]
  );
  const slots = useMemo(() => new Map(aiSlots.map((slot) => [slotKeyOf(slot.hub, slot.category), slot])), [aiSlots]);

  // Tela cheia do navegador junto com o modo apresentação. Sair da tela cheia (Esc) sai
  // da apresentação; se o navegador não deixar abrir em tela cheia, a apresentação segue na janela.
  const enteredFullscreen = useRef(false);
  useEffect(() => {
    const sync = () => {
      if (document.fullscreenElement) {
        enteredFullscreen.current = true;
      } else if (enteredFullscreen.current) {
        enteredFullscreen.current = false;
        setPresenting(false);
      }
    };
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  // Esc sai da apresentação quando não há tela cheia nem modal aberto. Escuta na captura,
  // antes do modal: com os relatos abertos, o Esc só fecha o modal.
  const openedRef = useRef<Opened | null>(null);
  useEffect(() => {
    openedRef.current = opened;
  }, [opened]);
  useEffect(() => {
    if (!presenting) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !openedRef.current && !document.fullscreenElement) setPresenting(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [presenting]);

  async function togglePresenting() {
    if (presenting) {
      setPresenting(false);
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      return;
    }
    setPresenting(true);
    await document.documentElement.requestFullscreen?.().catch(() => undefined);
  }

  const winnerOf = (hubKey: AwardHubKey, category: AwardCategoryKey) =>
    finalists.find((finalist) => finalist.hub === hubKey && finalist.category === category && finalist.is_winner) ?? null;

  async function makeWinner(hubKey: AwardHubKey, category: AwardCategoryKey, employeeId: string) {
    setBusy(`${hubKey}:${category}:${employeeId}`);
    setError(null);
    try {
      let finalist = finalists.find(
        (item) => item.hub === hubKey && item.category === category && item.employee_id === employeeId
      );
      if (!finalist) {
        const slotFinalists = finalists.filter((item) => item.hub === hubKey && item.category === category);
        if (slotFinalists.length >= MAX_FINALISTS) {
          throw new Error(`Este valor já tem ${MAX_FINALISTS} finalistas. Tire um na aba Apuração para escolher outra pessoa.`);
        }
        const created = await requestJson<{ finalist: AwardFinalist }>("/api/rh/bp-awards/finalistas", {
          method: "POST",
          body: JSON.stringify({ hub: hubKey, category, employee_id: employeeId }),
        });
        finalist = created.finalist;
        onFinalistsChange([...finalists, finalist]);
      }
      const data = await requestJson<{ finalists: AwardFinalist[] }>(`/api/rh/bp-awards/finalistas/${finalist.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_winner: true }),
      });
      onFinalistsChange(data.finalists);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível definir o vencedor.");
    } finally {
      setBusy(null);
    }
  }

  async function undoWinner(finalist: AwardFinalist) {
    setBusy(`${finalist.hub}:${finalist.category}:${finalist.employee_id}`);
    setError(null);
    try {
      const data = await requestJson<{ finalists: AwardFinalist[] }>(`/api/rh/bp-awards/finalistas/${finalist.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_winner: false }),
      });
      onFinalistsChange(data.finalists);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível desfazer.");
    } finally {
      setBusy(null);
    }
  }

  function toggleExpanded(key: string) {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const hubInfo = AWARD_HUBS.find((item) => item.key === hub) ?? AWARD_HUBS[0];

  const body = (
    <div className={cn("space-y-5", presenting && "mx-auto max-w-[112rem]")}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Hub">
          {AWARD_HUBS.map((item) => {
            const done = AWARD_CATEGORIES.filter((category) => winnerOf(item.key, category.key)).length;
            const active = item.key === hub;
            return (
              <button
                key={item.key}
                type="button"
                aria-pressed={active}
                onClick={() => setHub(item.key)}
                className={cn(
                  "inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors duration-150",
                  active
                    ? "border-[#0d1e2e] bg-[#0d1e2e] text-[#e1b16d]"
                    : "border-[#dce9eb] bg-white text-foreground hover:border-[#347796]"
                )}
              >
                {item.name}
                <span className={cn("rounded-full px-1.5 text-xs tabular-nums", active ? "bg-white/10" : "bg-[#eef3f5] text-muted-foreground")}>
                  {done}/5
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-[#eef3f5] px-2.5 py-1.5 text-xs font-medium text-[#285f7a]">
            <EyeOff className="size-3.5" aria-hidden />
            Nesta aba não aparece quem indicou
          </span>
          <Button type="button" variant={presenting ? "default" : "outline"} onClick={() => void togglePresenting()}>
            {presenting ? <Minimize2 className="size-4" aria-hidden /> : <Maximize2 className="size-4" aria-hidden />}
            {presenting ? "Sair da apresentação" : "Modo apresentação"}
          </Button>
        </div>
      </div>

      <p className="flex items-start gap-2 rounded-lg border border-[#dce9eb] bg-white px-4 py-3 text-sm text-muted-foreground">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-[#9c7434]" aria-hidden />
        <span>
          A IA leu todos os relatos e deu a cada indicado uma nota de 0 a 10 pela força dos exemplos, não pela quantidade de votos. A
          sugestão segue a regra de um prêmio por pessoa no hub. <strong className="font-medium text-foreground">Quem decide é o comitê.</strong>
        </span>
      </p>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <h2 className="text-lg font-semibold text-foreground">
        {hubInfo.name}
        <span className="ml-2 text-sm font-normal text-muted-foreground">{hubInfo.departments.join(", ")}</span>
      </h2>

      <ol className="space-y-4">
        {AWARD_CATEGORIES.map((category) => {
          const list = tallies[hub]?.[category.key] ?? [];
          const total = list.reduce((sum, tally) => sum + tally.count, 0);
          const slot = slots.get(slotKeyOf(hub, category.key));
          const byId = new Map(list.map((tally) => [tally.person.id, tally]));
          const suggested = slot?.suggested_employee_id ? byId.get(slot.suggested_employee_id) : undefined;
          const alternatives = (slot?.alternative_employee_ids ?? [])
            .map((id) => byId.get(id))
            .filter((tally): tally is NomineeTally => Boolean(tally));
          const winner = winnerOf(hub, category.key);
          const winnerTally = winner ? byId.get(winner.employee_id) : undefined;
          const key = slotKeyOf(hub, category.key);
          const open = expanded.has(key);
          const review = (tally: NomineeTally) => reviews.get(reviewKey(hub, category.key, tally.person.id));

          return (
            <li key={category.key} className="overflow-hidden rounded-xl border border-[#dce9eb] bg-white shadow-xs">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef3f5] px-4 py-3 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#0f1f2e]" aria-hidden>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={awardSealSrc(category.key)} alt="" width={640} height={640} className="size-10" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground">
                      <span className="text-[#9c7434]">{category.letter}</span> · {category.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {votesLabel(total)} · {list.length} {list.length === 1 ? "indicado" : "indicados"}
                    </p>
                  </div>
                </div>
                {winner ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#0d1e2e] py-1 pl-1 pr-3 text-sm font-medium text-[#e1b16d]">
                    {winnerTally && <AwardAvatar person={winnerTally.person} size="sm" tone="system" className="size-7" />}
                    <Star className="size-3.5 fill-current" aria-hidden />
                    Vencedor: {winnerTally?.person.short_name ?? "definido"}
                  </span>
                ) : (
                  <span className="rounded-full bg-[#eef3f5] px-3 py-1 text-xs font-medium text-muted-foreground">Sem vencedor definido</span>
                )}
              </header>

              <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                {/* Sugestão da IA */}
                <section aria-label="Sugestão da IA" className="rounded-lg bg-[#f7fbfb] p-4">
                  <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#9c7434]">
                    <Sparkles className="size-3.5" aria-hidden />
                    Sugestão da IA
                  </p>
                  {suggested ? (
                    <>
                      <div className="flex items-start gap-3">
                        <AwardAvatar person={suggested.person} size="lg" tone="system" />
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-semibold text-foreground">{suggested.person.short_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {[suggested.person.department, suggested.person.position].filter(Boolean).join(" · ")}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium tabular-nums text-foreground">
                              {suggested.count} de {total} votos
                            </span>
                            <ScoreBadge review={review(suggested)} large />
                          </div>
                        </div>
                      </div>
                      {slot?.reason && <p className="mt-3 text-sm leading-6 text-foreground">{slot.reason}</p>}
                      <PersonActions
                        tally={suggested}
                        winner={winner}
                        busy={busy === `${hub}:${category.key}:${suggested.person.id}`}
                        locked={busy !== null}
                        onOpen={() => setOpened({ hub, category, tally: suggested })}
                        onWinner={() => void makeWinner(hub, category.key, suggested.person.id)}
                        onUndo={(finalist) => void undoWinner(finalist)}
                      />
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sem sugestão para este valor.</p>
                  )}
                </section>

                {/* Quem entra no lugar */}
                <section aria-label="Se não for, quem?">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Se não for, quem?</p>
                  <ul className="space-y-2">
                    {alternatives.map((tally) => (
                      <li key={tally.person.id} className="rounded-lg border border-[#eef3f5] p-3">
                        <div className="flex items-center gap-3">
                          <AwardAvatar person={tally.person} size="md" tone="system" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">{tally.person.short_name}</p>
                            <p className="truncate text-xs text-muted-foreground">{tally.person.department}</p>
                          </div>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{votesLabel(tally.count)}</span>
                          <ScoreBadge review={review(tally)} />
                        </div>
                        <PersonActions
                          compact
                          tally={tally}
                          winner={winner}
                          busy={busy === `${hub}:${category.key}:${tally.person.id}`}
                          locked={busy !== null}
                          onOpen={() => setOpened({ hub, category, tally })}
                          onWinner={() => void makeWinner(hub, category.key, tally.person.id)}
                          onUndo={(finalist) => void undoWinner(finalist)}
                        />
                      </li>
                    ))}
                    {alternatives.length === 0 && <li className="text-sm text-muted-foreground">Sem alternativas sugeridas.</li>}
                  </ul>
                  {slot?.attention && (
                    <p className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
                      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                      {slot.attention}
                    </p>
                  )}
                </section>
              </div>

              {/* Todos os indicados do valor */}
              <div className="border-t border-[#eef3f5]">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => toggleExpanded(key)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-sm font-medium text-[#285f7a] hover:bg-[#f7fbfb] sm:px-5"
                >
                  {open ? "Esconder" : "Ver"} todos os indicados ({list.length})
                  <ChevronDown className={cn("size-4 transition-transform duration-200", open && "rotate-180")} aria-hidden />
                </button>
                {open && (
                  <ol className="divide-y divide-[#eef3f5] border-t border-[#eef3f5]">
                    {list.map((tally, index) => {
                      const rv = review(tally);
                      const isWinner = winner?.employee_id === tally.person.id;
                      return (
                        <li key={tally.person.id}>
                          <button
                            type="button"
                            onClick={() => setOpened({ hub, category, tally })}
                            className="grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-left hover:bg-[#f7fbfb] sm:grid-cols-[2rem_minmax(0,14rem)_8rem_3.5rem_minmax(0,1fr)] sm:px-5"
                          >
                            <span className="text-sm tabular-nums text-muted-foreground">{index + 1}º</span>
                            <span className="flex min-w-0 items-center gap-2.5">
                              <AwardAvatar person={tally.person} size="sm" tone="system" />
                              <span className="min-w-0">
                                <span className="flex items-center gap-1 truncate text-sm font-medium text-foreground">
                                  {isWinner && <Star className="size-3.5 shrink-0 fill-[#e1b16d] text-[#e1b16d]" aria-label="Vencedor" />}
                                  {tally.person.short_name}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">{tally.person.department}</span>
                              </span>
                            </span>
                            <span className="hidden items-center gap-2 sm:flex">
                              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eef3f5]">
                                <span
                                  className="block h-full rounded-full bg-[#3e84a8]"
                                  style={{ width: `${total ? Math.round((tally.count / total) * 100) : 0}%` }}
                                />
                              </span>
                              <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{votesLabel(tally.count)}</span>
                            </span>
                            <span className="justify-self-end sm:justify-self-start">
                              <ScoreBadge review={rv} />
                            </span>
                            <span className="col-span-3 text-xs leading-5 text-muted-foreground sm:col-span-1">{rv?.summary ?? ""}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <RelatosDialog
        opened={opened}
        review={opened ? reviews.get(reviewKey(opened.hub, opened.category.key, opened.tally.person.id)) : undefined}
        winner={opened ? winnerOf(opened.hub, opened.category.key) : null}
        busy={opened ? busy === `${opened.hub}:${opened.category.key}:${opened.tally.person.id}` : false}
        onClose={() => setOpened(null)}
        onWinner={() => opened && void makeWinner(opened.hub, opened.category.key, opened.tally.person.id)}
        onUndo={(finalist) => void undoWinner(finalist)}
      />
    </div>
  );

  // Na apresentação, a aba cobre a tela toda por cima do menu e do cabeçalho do sistema
  // (vai para o body; o modal dos relatos abre depois e fica por cima).
  if (presenting) {
    return createPortal(
      <div className="fixed inset-0 z-50 overflow-y-auto bg-[#f7fbfb] px-6 py-6 sm:px-10" aria-label="Modo apresentação">
        {body}
      </div>,
      document.body
    );
  }
  return body;
}

function PersonActions({
  tally,
  winner,
  busy,
  locked,
  compact = false,
  onOpen,
  onWinner,
  onUndo,
}: {
  tally: NomineeTally;
  winner: AwardFinalist | null;
  busy: boolean;
  locked: boolean;
  compact?: boolean;
  onOpen: () => void;
  onWinner: () => void;
  onUndo: (finalist: AwardFinalist) => void;
}) {
  const isWinner = winner?.employee_id === tally.person.id;
  return (
    <div className={cn("flex flex-wrap gap-2", compact ? "mt-2.5" : "mt-4")}>
      <Button type="button" variant="outline" size="sm" onClick={onOpen}>
        <MessageSquareQuote className="size-4" aria-hidden />
        Ver {tally.testimonies.length} {tally.testimonies.length === 1 ? "relato" : "relatos"}
      </Button>
      {isWinner && winner ? (
        <Button type="button" variant="ghost" size="sm" disabled={locked} onClick={() => onUndo(winner)}>
          {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Undo2 className="size-4" aria-hidden />}
          Desfazer vencedor
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          disabled={locked}
          onClick={onWinner}
          className="bg-[#0d1e2e] text-[#e1b16d] hover:bg-[#13283b] hover:text-[#e1b16d]"
        >
          {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Star className="size-4" aria-hidden />}
          {winner ? "Trocar o vencedor por esta pessoa" : "Definir como vencedor"}
        </Button>
      )}
    </div>
  );
}

function RelatosDialog({
  opened,
  review,
  winner,
  busy,
  onClose,
  onWinner,
  onUndo,
}: {
  opened: Opened | null;
  review: Review | undefined;
  winner: AwardFinalist | null;
  busy: boolean;
  onClose: () => void;
  onWinner: () => void;
  onUndo: (finalist: AwardFinalist) => void;
}) {
  const tally = opened?.tally;
  const isWinner = Boolean(tally && winner?.employee_id === tally.person.id);
  return (
    <Dialog open={Boolean(opened)} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="flex max-h-[88dvh] flex-col gap-0 p-0 sm:max-w-3xl">
        {opened && tally && (
          <>
            <DialogHeader className="border-b border-[#dce9eb] px-6 py-5 text-left">
              <div className="flex items-start gap-4">
                <AwardAvatar person={tally.person} size="lg" tone="system" />
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-xl">{tally.person.short_name}</DialogTitle>
                  <DialogDescription>
                    {opened.category.letter} · {opened.category.name} · {AWARD_HUBS.find((item) => item.key === opened.hub)?.name} ·{" "}
                    {votesLabel(tally.count)}
                  </DialogDescription>
                  <div className="mt-2 flex items-start gap-2">
                    <ScoreBadge review={review} large />
                    {review && <p className="text-sm leading-6 text-foreground">{review.summary}</p>}
                  </div>
                </div>
              </div>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <EyeOff className="size-3.5" aria-hidden />
                Os relatos aparecem sem o nome de quem indicou.
              </p>
              <ol className="space-y-3">
                {tally.testimonies.map((testimony, index) => (
                  <li key={testimony.id} className="rounded-lg border border-[#dce9eb] bg-[#fbfdfd] p-4">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#9c7434]">Relato {index + 1}</p>
                    <p className="whitespace-pre-wrap text-[0.98rem] leading-7 text-foreground">{testimony.justification}</p>
                  </li>
                ))}
              </ol>
            </div>
            <DialogFooter className="gap-2 border-t border-[#dce9eb] px-6 py-4 sm:justify-between sm:gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Fechar
              </Button>
              {isWinner && winner ? (
                <Button type="button" variant="ghost" disabled={busy} onClick={() => onUndo(winner)}>
                  {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Undo2 className="size-4" aria-hidden />}
                  Desfazer vencedor
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={busy}
                  onClick={onWinner}
                  className="bg-[#0d1e2e] text-[#e1b16d] hover:bg-[#13283b] hover:text-[#e1b16d]"
                >
                  {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Star className="size-4" aria-hidden />}
                  {winner ? "Trocar o vencedor por esta pessoa" : "Definir como vencedor"}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
