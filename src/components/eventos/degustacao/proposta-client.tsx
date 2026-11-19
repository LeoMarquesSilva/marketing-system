"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, Coffee, FlaskConical, Loader2, Martini, Plus, Sparkles, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PersonFace } from "@/components/pesquisas/shared";
import { DrinkThumb, ScoreChip, faceOf } from "@/components/eventos/degustacao/tasting-results";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/utils/supabase/client";
import { columnLabels, formatAverage, scoreTable, SCORE_MAX, type ScoreRow, type TastingDrink } from "@/lib/eventos-degustacao";
import { fetchDrinkTastings, setDrinkChosen, type DrinkTastingData, type TastingFace } from "@/lib/eventos-degustacao-db";
import type { EventTasting, TastingParticipant } from "@/lib/eventos-programa";
import { cn } from "@/lib/utils";

const CARD = "rounded-lg border border-[#dce9eb] bg-card shadow-[0_1px_2px_rgba(3,32,47,0.05)]";

function shortDate(iso: string | null): string {
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "";
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** Ícone de cada ponto forte, pelo assunto. */
function highlightIcon(text: string) {
  return /xarope/i.test(text) ? FlaskConical : Sparkles;
}

/** Posição pela média, com empate dividindo a posição (as linhas já vêm em ordem). */
function ranks(rows: ScoreRow[]): Map<string, number> {
  const map = new Map<string, number>();
  rows.forEach((row, index) => {
    const previous = rows[index - 1];
    map.set(row.drink.id, previous && previous.average === row.average ? (map.get(previous.drink.id) ?? index + 1) : index + 1);
  });
  return map;
}

interface TastingView {
  tasting: EventTasting;
  rows: ScoreRow[];
  labels: string[];
}

/**
 * Proposta dos drinks da festa para quem decide: a degustação mais recente em destaque
 * (combinado, pontos fortes, drinks com foto, ingredientes e a nota de cada pessoa) e a escolha
 * salva na hora. As outras degustações aparecem abertas embaixo, no mesmo formato, para comparar.
 */
export function PropostaClient({ eventId }: { eventId: string }) {
  const { profile } = useAuth();
  const [data, setData] = useState<DrinkTastingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [photo, setPhoto] = useState<TastingDrink | null>(null);
  const timer = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchDrinkTastings(eventId));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar.");
    }
  }, [eventId]);

  useEffect(() => {
    void load();
    const reload = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void load(), 300);
    };
    const channel = supabase
      .channel(`proposta-drinks-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_tasting_drinks", filter: `event_id=eq.${eventId}` }, reload)
      .subscribe();
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [eventId, load]);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(id);
  }, [notice]);

  // A degustação mais recente com drinks é a proposta; as outras servem de comparação.
  const views = useMemo<TastingView[]>(() => {
    if (!data) return [];
    return data.tastings
      .filter((tasting) => data.drinks.some((drink) => drink.tastingId === tasting.id))
      .sort((a, b) => (b.tastingDate ?? "").localeCompare(a.tastingDate ?? ""))
      .map((tasting) => ({
        tasting,
        rows: scoreTable(
          data.drinks.filter((drink) => drink.tastingId === tasting.id),
          data.votes.filter((vote) => vote.tastingId === tasting.id),
          tasting.participants
        ),
        labels: columnLabels(tasting.participants),
      }));
  }, [data]);

  if (error && !data) {
    return (
      <Shell>
        <div className={cn(CARD, "mx-4 mt-6 flex flex-col items-center gap-3 px-6 py-10 text-center")}>
          <AlertCircle className="size-8 text-red-600" aria-hidden />
          <p className="text-sm font-medium text-foreground">{error}</p>
          <Button variant="outline" onClick={() => void load()}>
            Tentar de novo
          </Button>
        </div>
      </Shell>
    );
  }
  if (!data) {
    return (
      <Shell>
        <p className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Abrindo a proposta…
        </p>
      </Shell>
    );
  }
  const [main, ...others] = views;
  if (!main) {
    return (
      <Shell>
        <p className="mx-4 mt-6 rounded-lg border border-dashed border-[#c9d8dc] bg-white px-4 py-10 text-center text-sm text-muted-foreground">Ainda não há degustação de drinks com notas.</p>
      </Shell>
    );
  }

  const featured = main.tasting;
  const extras = data.extras[featured.id] ?? { highlights: [], choiceLimit: null };
  const limit = extras.choiceLimit ?? 4;
  const included = main.rows.filter((row) => row.drink.included);
  const volantes = main.rows.filter((row) => row.drink.isVolante);
  const options = main.rows.filter((row) => !row.drink.included && !row.drink.isVolante);
  const optionRank = ranks(options);
  const chosen = options.filter((row) => row.drink.chosenAt);
  const chooserIds = [...new Set(main.rows.map((row) => row.drink.chosenBy).filter((id): id is string => Boolean(id)))];
  const chooserNames = chooserIds.map((id) => data.faces[id]?.name).filter((name): name is string => Boolean(name));

  const toggle = async (drink: TastingDrink, next: boolean) => {
    if (next && !drink.isVolante && chosen.length >= limit) {
      setNotice(`Já são ${limit} escolhidos. Tire um para trocar.`);
      return;
    }
    setBusyId(drink.id);
    try {
      const saved = await setDrinkChosen(drink.id, next, profile?.id ?? null);
      setData((current) => (current ? { ...current, drinks: current.drinks.map((entry) => (entry.id === saved.id ? saved : entry)) } : current));
      if (next && !drink.isVolante && chosen.length + 1 === limit) {
        setNotice(`Pronto: ${limit} drinks escolhidos, além do ${included.map((row) => row.drink.name).join(" e ") || "combinado"}.`);
      }
    } catch (toggleError) {
      setNotice(toggleError instanceof Error ? toggleError.message : "A escolha não foi salva.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Shell>
      <header className="bg-[linear-gradient(160deg,#03070c,#04202f)] px-4 pb-6 pt-[max(1.25rem,env(safe-area-inset-top))] text-[#f9f9f9] lg:px-8 lg:pb-8 lg:pt-6">
        <div className="mx-auto max-w-2xl lg:max-w-6xl">
          <div className="flex items-center justify-between gap-3 text-xs font-medium">
            <span className="text-white/70">{data.eventName ?? "Festa"}</span>
            <span className="text-white/50">ORQESTRAI</span>
          </div>
          <div className="mt-3 flex items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-white/10 text-[#47cdd0]" aria-hidden>
              <Martini className="size-6" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#47cdd0]">Drinks da festa</p>
              <h1 className="text-2xl font-semibold leading-tight">Escolha dos drinks</h1>
              <p className="mt-1 text-sm leading-5 text-white/75">
                {views.length === 1 ? "Uma degustação" : `${views.length} degustações`}, com a nota de 1 a 5 de cada pessoa que provou. Recomendação: <span className="font-semibold text-white">{featured.vendorName}</span>.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-7 px-4 pb-28 pt-5 lg:max-w-6xl lg:px-8 lg:pt-8">
        {/* No computador, o combinado e os pontos fortes ficam lado a lado. */}
        <div className="grid gap-7 lg:grid-cols-2 lg:items-start">
        {/* Combinado e escolha */}
        <section aria-label="O combinado" className={cn(CARD, "overflow-hidden")}>
          <div className="border-b border-[#eef3f4] px-4 py-3">
            <p className="text-xs font-medium text-[#285f7a]">Recomendação: {featured.vendorName}</p>
            <h2 className="text-base font-semibold text-foreground">O combinado</h2>
            {featured.resultNote && <p className="mt-1 text-sm leading-5 text-muted-foreground">{featured.resultNote}</p>}
          </div>
          <ul className="divide-y divide-[#eef3f4]">
            {included.map((row) => (
              <li key={row.drink.id} className="flex items-center gap-3 px-4 py-3">
                <DrinkThumb drink={row.drink} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{row.drink.name}</p>
                  <p className="text-xs text-muted-foreground">Já incluso no combinado</p>
                </div>
                <Check className="size-5 text-emerald-600" aria-label="Incluso" />
              </li>
            ))}
            <li className="px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="grid size-14 shrink-0 place-items-center rounded-md bg-[#eaf5f7] text-lg font-semibold text-[#285f7a]" aria-hidden>
                  +{limit}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{limit} drinks à escolha</p>
                  <p className="text-xs text-muted-foreground">
                    {chosen.length === 0
                      ? `Toque em "Escolher" nos drinks da ${featured.vendorName} abaixo.`
                      : `${chosen.length} de ${limit} escolhidos${chooserNames.length ? ` por ${chooserNames.map(firstName).join(" e ")}` : ""}`}
                  </p>
                </div>
              </div>
              {chosen.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {chosen.map((row) => (
                    <li key={row.drink.id} className="inline-flex items-center gap-2 rounded-md border border-[#cfe0e4] bg-[#f6fafb] py-1 pl-1 pr-2.5 text-sm font-medium text-foreground">
                      <DrinkThumb drink={row.drink} />
                      {row.drink.name}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          </ul>
        </section>

        {/* Por que a casa em destaque */}
        {extras.highlights.length > 0 && (
          <section aria-label={`Por que a ${featured.vendorName}`} className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Por que a {featured.vendorName}</h2>
            <ul className={cn(CARD, "divide-y divide-[#eef3f4]")}>
              {extras.highlights.map((text) => {
                const Icon = highlightIcon(text);
                return (
                  <li key={text} className="flex items-start gap-3 px-4 py-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[#eaf5f7] text-[#285f73]" aria-hidden>
                      <Icon className="size-4" />
                    </span>
                    <p className="pt-1.5 text-sm leading-5 text-foreground">{text}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        </div>

        {/* Casas lado a lado */}
        {others.length > 0 && <VersusSummary views={views} faces={data.faces} />}

        {/* Drinks da casa em destaque */}
        <section aria-label={`Drinks da ${featured.vendorName}`} className="space-y-3">
          <SectionTitle
            overline={`Recomendada · ${shortDate(featured.tastingDate)}`}
            title={`Drinks da ${featured.vendorName}`}
            subtitle="Da maior para a menor média, com a nota de cada pessoa. Toque na foto para ampliar."
          />
          <PeopleLegend people={featured.participants} labels={main.labels} faces={data.faces} />
          <ol className="grid gap-3 lg:grid-cols-2 lg:items-start">
            {included.map((row) => (
              <li key={row.drink.id}>
                <DrinkCard row={row} rank={null} people={featured.participants} faces={data.faces} labels={main.labels} mode="included" onPhoto={() => setPhoto(row.drink)} />
              </li>
            ))}
            {options.map((row) => (
              <li key={row.drink.id}>
                <DrinkCard
                  row={row}
                  rank={optionRank.get(row.drink.id) ?? null}
                  people={featured.participants}
                  faces={data.faces}
                  labels={main.labels}
                  mode="choose"
                  chosen={Boolean(row.drink.chosenAt)}
                  full={chosen.length >= limit}
                  limit={limit}
                  busy={busyId === row.drink.id}
                  onPhoto={() => setPhoto(row.drink)}
                  onToggle={(next) => void toggle(row.drink, next)}
                />
              </li>
            ))}
          </ol>
        </section>

        {/* Volantes */}
        {volantes.length > 0 && (
          <section aria-label="Drinks volantes" className="space-y-3">
            <SectionTitle title="Drinks volantes" subtitle={`Fora dos ${limit}: circulam em copo menor, perto do fim da festa. Valor à parte.`} />
            <ol className="grid gap-3 lg:grid-cols-2 lg:items-start">
              {volantes.map((row) => (
                <li key={row.drink.id}>
                  <DrinkCard
                    row={row}
                    rank={null}
                    people={featured.participants}
                    faces={data.faces}
                    labels={main.labels}
                    mode="volante"
                    chosen={Boolean(row.drink.chosenAt)}
                    busy={busyId === row.drink.id}
                    onPhoto={() => setPhoto(row.drink)}
                    onToggle={(next) => void toggle(row.drink, next)}
                  />
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Outras degustações, abertas para comparar */}
        {others.map((view) => {
          const rank = ranks(view.rows);
          return (
            <section key={view.tasting.id} aria-label={`Para comparar: ${view.tasting.vendorName}`} className="space-y-3 border-t border-[#dce9eb] pt-6">
              <SectionTitle
                overline={`Para comparar · ${shortDate(view.tasting.tastingDate)}`}
                title={`Drinks da ${view.tasting.vendorName}`}
                subtitle="Outra degustação, com outro grupo. Da maior para a menor média."
              />
              <PeopleLegend people={view.tasting.participants} labels={view.labels} faces={data.faces} />
              <ol className="grid gap-3 lg:grid-cols-2 lg:items-start">
                {view.rows.map((row) => (
                  <li key={row.drink.id}>
                    <DrinkCard
                      row={row}
                      rank={rank.get(row.drink.id) ?? null}
                      people={view.tasting.participants}
                      faces={data.faces}
                      labels={view.labels}
                      mode="compare"
                      onPhoto={() => setPhoto(row.drink)}
                    />
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </main>

      {/* Resumo fixo da escolha */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#dce9eb] bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:px-8">
        <div className="mx-auto flex max-w-2xl items-center gap-3 lg:max-w-6xl">
          <div className="flex -space-x-2">
            {[...included, ...chosen].map((row) => (
              <span key={row.drink.id} className="rounded-md ring-2 ring-white">
                <DrinkThumb drink={row.drink} />
              </span>
            ))}
          </div>
          <p className="min-w-0 flex-1 text-sm leading-5 text-foreground">
            <span className="font-semibold">
              {chosen.length} de {limit}
            </span>{" "}
            escolhidos
            {included.length > 0 ? <span className="text-muted-foreground"> + {included.map((row) => row.drink.name).join(", ")}</span> : null}
          </p>
          {chosen.length >= limit && (
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">
              <Check className="size-4" aria-hidden />
              Completo
            </span>
          )}
        </div>
      </div>

      {notice && (
        <div role="status" className="fixed inset-x-4 bottom-20 z-40 mx-auto max-w-md rounded-lg bg-[#04202f] px-4 py-3 text-sm font-medium text-white shadow-lg">
          {notice}
        </div>
      )}

      {photo && (
        <Dialog open onOpenChange={(open) => !open && setPhoto(null)}>
          <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-lg">
            <DialogHeader className="border-b border-[#e6eef0] px-5 py-4 text-left">
              <DialogTitle>{photo.name}</DialogTitle>
              {photo.note && <DialogDescription>{photo.note}</DialogDescription>}
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {photo.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- foto do Storage
                <img src={photo.photoUrl} alt={`Foto do ${photo.name}`} className="max-h-[70dvh] w-full rounded-md object-contain" />
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">Sem foto.</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-[#f2f7f8] text-foreground">{children}</div>;
}

function SectionTitle({ overline, title, subtitle }: { overline?: string; title: string; subtitle?: string }) {
  return (
    <div>
      {overline && <p className="text-xs font-medium text-[#285f7a]">{overline}</p>}
      <h2 className="text-lg font-semibold leading-6 text-foreground">{title}</h2>
      {subtitle && <p className="text-xs leading-5 text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

/** Quem provou: rosto e primeiro nome, na mesma ordem das notas dos cartões. */
function PeopleLegend({ people, labels, faces }: { people: TastingParticipant[]; labels: string[]; faces: Record<string, TastingFace> }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5" aria-label="Quem provou">
      {people.map((person, index) => (
        <span key={`${person.name}-${index}`} className="inline-flex items-center gap-1.5 text-xs text-foreground">
          <PersonFace size="sm" person={faceOf(person, faces)} />
          {labels[index]}
        </span>
      ))}
    </div>
  );
}

/** As degustações lado a lado: quantos drinks, quem provou, quantos com média 4 ou mais e o melhor drink. */
function VersusSummary({ views, faces }: { views: TastingView[]; faces: Record<string, TastingFace> }) {
  return (
    <section aria-label="As degustações lado a lado" className="space-y-2">
      <h2 className="text-base font-semibold text-foreground">{views.map((view) => view.tasting.vendorName).join(" x ")}</h2>
      <div className={cn(CARD, "grid divide-x divide-[#eef3f4] overflow-hidden")} style={{ gridTemplateColumns: `repeat(${views.length}, minmax(0, 1fr))` }}>
        {views.map((view, index) => {
          const scored = view.rows.filter((row) => row.average != null);
          const good = scored.filter((row) => (row.average ?? 0) >= 4).length;
          const bestAverage = scored[0]?.average ?? null;
          const best = scored.filter((row) => row.average === bestAverage);
          return (
            <div key={view.tasting.id} className={cn("space-y-2.5 p-3", index === 0 && "bg-[#f3fafb]")}>
              <div>
                {index === 0 && <p className="text-xs font-semibold text-[#285f7a]">Recomendada</p>}
                <p className="text-base font-semibold leading-5 text-foreground">{view.tasting.vendorName}</p>
                <p className="text-xs text-muted-foreground">{shortDate(view.tasting.tastingDate)}</p>
              </div>
              <div className="flex -space-x-2">
                {view.tasting.participants.map((person, position) => (
                  <span key={`${person.name}-${position}`} className="rounded-full ring-2 ring-white">
                    <PersonFace size="sm" person={faceOf(person, faces)} />
                  </span>
                ))}
              </div>
              <dl className="space-y-1.5 text-xs leading-4">
                <div>
                  <dt className="text-muted-foreground">Drinks provados</dt>
                  <dd className="text-sm font-semibold text-foreground">{view.rows.length}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Com média 4 ou mais</dt>
                  <dd className="text-sm font-semibold text-foreground">
                    {good} <span className="font-normal text-muted-foreground">de {scored.length}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Melhor nota</dt>
                  <dd className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Trophy className="size-3.5 shrink-0 text-amber-500" aria-hidden />
                    <span className="min-w-0">
                      {best.map((row) => row.drink.name).join(" e ")} · {formatAverage(bestAverage)}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>
    </section>
  );
}

type CardMode = "choose" | "volante" | "included" | "compare";

function DrinkCard({
  row,
  rank,
  people,
  faces,
  labels,
  mode,
  chosen = false,
  full = false,
  limit = 0,
  busy = false,
  onPhoto,
  onToggle,
}: {
  row: ScoreRow;
  rank: number | null;
  people: TastingParticipant[];
  faces: Record<string, TastingFace>;
  labels: string[];
  mode: CardMode;
  chosen?: boolean;
  full?: boolean;
  limit?: number;
  busy?: boolean;
  onPhoto: () => void;
  onToggle?: (next: boolean) => void;
}) {
  const { drink } = row;
  const columns = { gridTemplateColumns: `repeat(${Math.min(Math.max(people.length, 1), 6)}, minmax(0, 1fr))` };
  return (
    <article className={cn(CARD, "overflow-hidden", chosen && "border-[#347796] ring-1 ring-[#347796]")} aria-label={drink.name}>
      <div className="flex gap-3 p-3">
        <button type="button" onClick={onPhoto} className="relative shrink-0 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/50" aria-label={`Ampliar a foto do ${drink.name}`}>
          {drink.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto do Storage, já reduzida no envio
            <img src={drink.photoUrl} alt="" loading="lazy" className="size-24 rounded-md object-cover ring-1 ring-black/5" />
          ) : (
            <span className="grid size-24 place-items-center rounded-md bg-[#eaf5f7] text-[#3e84a8]">
              {mode === "volante" ? <Coffee className="size-7" aria-hidden /> : <Martini className="size-7" aria-hidden />}
            </span>
          )}
          {rank != null && <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-1.5 text-xs font-semibold text-white">{rank}º</span>}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className="min-w-0 flex-1 text-base font-semibold leading-5 text-foreground">{drink.name}</h3>
            <div className="shrink-0 text-right">
              <p className="text-xl font-semibold leading-6 tabular-nums text-foreground">{formatAverage(row.average)}</p>
              <p className="text-xs text-muted-foreground">
                {row.total}/{people.length * SCORE_MAX}
              </p>
            </div>
          </div>
          {drink.note && <p className="mt-1 text-sm leading-5 text-muted-foreground">{drink.note}</p>}
          {mode === "included" && (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
              <Check className="size-3.5" aria-hidden />
              Já incluso
            </span>
          )}
        </div>
      </div>

      {/* Nota de cada pessoa */}
      <ul className="grid gap-y-1 border-t border-[#eef3f4] bg-[#fafcfc] px-3 py-2.5" style={columns} aria-label={`Notas de cada pessoa para ${drink.name}`}>
        {people.map((person, index) => (
          <li key={`${person.name}-${index}`} className="flex flex-col items-center gap-1" aria-label={`${labels[index]}: ${row.scores[index] ?? "sem nota"}`}>
            <PersonFace size="sm" person={faceOf(person, faces)} />
            <ScoreChip score={row.scores[index]} size="sm" />
          </li>
        ))}
      </ul>

      {(mode === "choose" || mode === "volante") && onToggle && (
        <div className="border-t border-[#eef3f4] px-3 py-2">
          <Button
            type="button"
            variant={chosen ? "default" : "outline"}
            className="h-11 w-full"
            disabled={busy || (!chosen && full)}
            aria-pressed={chosen}
            onClick={() => onToggle(!chosen)}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : chosen ? <Check className="size-4" /> : <Plus className="size-4" />}
            {chosen ? (mode === "volante" ? "Incluído como volante" : "Escolhido") : full ? `Já são ${limit} escolhidos` : mode === "volante" ? "Incluir como volante" : "Escolher"}
          </Button>
        </div>
      )}
    </article>
  );
}
