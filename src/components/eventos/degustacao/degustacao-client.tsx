"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  Check,
  ExternalLink,
  ImagePlus,
  Loader2,
  MapPin,
  Martini,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PersonFace } from "@/components/pesquisas/shared";
import { OverallRankingList, TastingScoreTable, faceOf } from "@/components/eventos/degustacao/tasting-results";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/utils/supabase/client";
import {
  drinkSuggestions,
  formatAverage,
  missingVoters,
  overallRanking,
  participantKey,
  scoreTable,
  SCORES,
  SCORE_LABEL,
  splitLocation,
  type Score,
  type TastingDrink,
  type TastingVote,
} from "@/lib/eventos-degustacao";
import {
  createDrink,
  deleteDrink,
  fetchDrinkTastings,
  fetchTastingEventId,
  saveVote,
  updateDrink,
  updateParticipants,
  uploadDrinkPhoto,
  type DrinkTastingData,
} from "@/lib/eventos-degustacao-db";
import { prepareDrinkPhoto } from "@/lib/eventos-degustacao-photo";
import { formatClock, tastingLinkHref, type EventTasting, type TastingParticipant } from "@/lib/eventos-programa";
import { cn } from "@/lib/utils";

type View = "votar" | "tabela" | "geral";

const CARD = "rounded-lg border border-[#dce9eb] bg-card shadow-[0_1px_2px_rgba(3,32,47,0.05)]";

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function longDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const text = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "2-digit", month: "2-digit" }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function shortDate(iso: string | null): string {
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "";
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/* ───────────────────────────── Página ───────────────────────────── */

export function DegustacaoClient({ tastingId }: { tastingId: string }) {
  const { profile } = useAuth();
  const [data, setData] = useState<DrinkTastingData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<View>("votar");
  const [actingKey, setActingKey] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, Score>>({});
  const [notice, setNotice] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [drinkForm, setDrinkForm] = useState<{ drink: TastingDrink | null } | null>(null);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [photoBusyId, setPhotoBusyId] = useState<string | null>(null);
  const eventIdRef = useRef<string | null>(null);
  const mutationSeq = useRef(0);
  const reloadTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const eventId = eventIdRef.current ?? (await fetchTastingEventId(tastingId));
      if (!eventId) {
        setLoadError("Degustação não encontrada.");
        return;
      }
      eventIdRef.current = eventId;
      const seq = mutationSeq.current;
      const next = await fetchDrinkTastings(eventId);
      // Uma nota gravada enquanto a leitura corria: lê de novo para não voltar ao estado antigo.
      if (seq !== mutationSeq.current) {
        void load();
        return;
      }
      setData(next);
      setLoadError(null);
    } catch (error) {
      setLoadError(errorText(error, "Não foi possível carregar a degustação."));
    }
  }, [tastingId]);

  const scheduleReload = useCallback(() => {
    if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
    reloadTimer.current = window.setTimeout(() => void load(), 300);
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  // Tabela ao vivo: qualquer nota, drink ou mudança na lista de quem participa recarrega; a cada 20 s confere de novo.
  useEffect(() => {
    const channel = supabase
      .channel(`degustacao-${tastingId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_tasting_votes" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_tasting_drinks" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_tastings", filter: `id=eq.${tastingId}` }, scheduleReload)
      .subscribe();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 20_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [tastingId, load, scheduleReload]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), notice.tone === "error" ? 6000 : 2500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const tasting = data?.tastings.find((entry) => entry.id === tastingId) ?? null;
  const people = useMemo(() => tasting?.participants ?? [], [tasting]);
  const isAdmin = profile?.role === "admin";
  const me = people.find((person) => profile && person.userId === profile.id) ?? null;
  const canActFor = useCallback(
    (person: TastingParticipant) => isAdmin || (me != null && participantKey(person) === participantKey(me)) || (!person.userId && me != null),
    [isAdmin, me]
  );
  const acting = useMemo(() => {
    const chosen = actingKey ? people.find((person) => participantKey(person) === actingKey) : null;
    if (chosen && canActFor(chosen)) return chosen;
    return me;
  }, [actingKey, people, me, canActFor]);

  const drinks = useMemo(
    () => (data?.drinks ?? []).filter((drink) => drink.tastingId === tastingId).sort((a, b) => b.sortOrder - a.sortOrder || b.createdAt.localeCompare(a.createdAt)),
    [data, tastingId]
  );
  const votes = useMemo<TastingVote[]>(() => {
    const base = (data?.votes ?? []).filter((vote) => vote.tastingId === tastingId);
    const entries = Object.entries(pending);
    if (entries.length === 0) return base;
    const pendingKeys = new Set(entries.map(([id]) => id));
    const merged = base.filter((vote) => !pendingKeys.has(`${vote.drinkId}|${vote.participantKey}`));
    for (const [id, score] of entries) {
      const [drinkId, key] = id.split("|");
      const person = people.find((entry) => participantKey(entry) === key);
      merged.push({ id: `pendente-${id}`, drinkId, tastingId, participantKey: key, participantName: person?.name ?? "", userId: person?.userId ?? null, score, recordedBy: profile?.id ?? null });
    }
    return merged;
  }, [data, pending, people, profile, tastingId]);

  const actingKeyValue = acting ? participantKey(acting) : null;
  const myScore = (drinkId: string): Score | null =>
    actingKeyValue ? (votes.find((vote) => vote.drinkId === drinkId && vote.participantKey === actingKeyValue)?.score ?? null) : null;

  const vote = async (drink: TastingDrink, score: Score) => {
    if (!acting) return;
    const key = participantKey(acting);
    const id = `${drink.id}|${key}`;
    setPending((current) => ({ ...current, [id]: score }));
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(12);
    try {
      const saved = await saveVote({ drink, person: acting, score, recordedBy: profile?.id ?? null });
      mutationSeq.current += 1;
      setData((current) =>
        current ? { ...current, votes: [...current.votes.filter((entry) => !(entry.drinkId === drink.id && entry.participantKey === key)), saved] } : current
      );
    } catch (error) {
      setNotice({ tone: "error", text: errorText(error, "A nota não foi salva.") });
    } finally {
      setPending((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
  };

  const changePeople = async (change: (current: TastingParticipant[]) => TastingParticipant[], success: string) => {
    try {
      const next = await updateParticipants(tastingId, change);
      mutationSeq.current += 1;
      setData((current) =>
        current ? { ...current, tastings: current.tastings.map((entry) => (entry.id === tastingId ? { ...entry, participants: next } : entry)) } : current
      );
      setNotice({ tone: "ok", text: success });
      void load();
      return true;
    } catch (error) {
      setNotice({ tone: "error", text: errorText(error, "Não foi possível atualizar a lista.") });
      return false;
    }
  };

  const addPhotoToDrink = async (drink: TastingDrink, file: File) => {
    if (!tasting) return;
    setPhotoBusyId(drink.id);
    try {
      const blob = await prepareDrinkPhoto(file);
      const uploaded = await uploadDrinkPhoto(tasting.eventId, tasting.id, drink.name, blob);
      const saved = await updateDrink(drink, { name: drink.name, note: drink.note, shortlisted: drink.shortlisted, photoPath: uploaded.path, photoUrl: uploaded.url });
      mutationSeq.current += 1;
      setData((current) => (current ? { ...current, drinks: current.drinks.map((entry) => (entry.id === saved.id ? saved : entry)) } : current));
      setNotice({ tone: "ok", text: "Foto incluída." });
    } catch (error) {
      setNotice({ tone: "error", text: errorText(error, "A foto não subiu.") });
    } finally {
      setPhotoBusyId(null);
    }
  };

  if (loadError && !data) {
    return (
      <Shell>
        <div className={cn(CARD, "mx-4 mt-6 flex flex-col items-center gap-3 px-6 py-10 text-center")}>
          <AlertCircle className="size-8 text-red-600" aria-hidden />
          <p className="text-sm font-medium text-foreground">{loadError}</p>
          <Button variant="outline" onClick={() => void load()}>
            Tentar de novo
          </Button>
        </div>
      </Shell>
    );
  }

  if (!data || !tasting) {
    return (
      <Shell>
        <div className="flex items-center justify-center gap-2 px-6 py-24 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Abrindo a degustação…
        </div>
      </Shell>
    );
  }

  const others = data.tastings.filter((entry) => entry.id !== tastingId);
  const place = splitLocation(tasting.location);
  const instagram = tastingLinkHref(tasting.linkUrl);
  const when = [longDate(tasting.tastingDate), tasting.tastingTime ? formatClock(tasting.tastingTime) : null].filter(Boolean).join(" · ");
  const myDone = acting ? drinks.filter((drink) => myScore(drink.id) != null).length : 0;
  const nextSort = drinks.reduce((max, drink) => Math.max(max, drink.sortOrder), 0) + 1;

  return (
    <Shell>
      <header className="bg-[linear-gradient(160deg,#03070c,#04202f)] px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] text-[#f9f9f9]">
        <div className="mx-auto max-w-xl">
          <div className="flex items-center justify-between gap-3">
            <Link href="/degustacao" className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-white/70 hover:text-white">
              <ArrowLeft className="size-4" aria-hidden />
              {data.eventName ?? "Degustações"}
            </Link>
            <span className="text-xs font-medium tracking-normal text-white/50">ORQESTRAI</span>
          </div>
          <div className="mt-1 flex items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-white/10 text-[#47cdd0]" aria-hidden>
              <Martini className="size-6" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#47cdd0]">Degustação de drinks</p>
              <h1 className="text-2xl font-semibold leading-tight">{tasting.vendorName}</h1>
              {when && <p className="mt-0.5 text-sm text-white/75">{when}</p>}
            </div>
          </div>
          {(place.address || place.mapUrl || instagram) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {(place.address || place.mapUrl) &&
                (place.mapUrl ? (
                  <a href={place.mapUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-white/10 px-3 text-xs font-medium hover:bg-white/15">
                    <MapPin className="size-3.5 text-[#47cdd0]" aria-hidden />
                    {place.address ?? "Como chegar"}
                    <ExternalLink className="size-3 text-white/60" aria-hidden />
                  </a>
                ) : (
                  <span className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-white/10 px-3 text-xs font-medium">
                    <MapPin className="size-3.5 text-[#47cdd0]" aria-hidden />
                    {place.address}
                  </span>
                ))}
              {instagram && (
                <a href={instagram} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-white/10 px-3 text-xs font-medium hover:bg-white/15">
                  Instagram
                  <ExternalLink className="size-3 text-white/60" aria-hidden />
                </a>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setPeopleOpen(true)}
            className="mt-4 flex w-full items-center gap-3 rounded-lg bg-white/[0.07] px-3 py-2.5 text-left ring-1 ring-inset ring-white/10 outline-none transition-colors hover:bg-white/10 focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/60"
          >
            {acting ? (
              <>
                <PersonFace size="md" person={faceOf(acting, data.faces)} />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-white/60">{me && acting === me ? "Você está votando" : "Lançando as notas de"}</span>
                  <span className="block truncate text-sm font-semibold">{acting.name}</span>
                </span>
              </>
            ) : (
              <>
                <span className="grid size-11 place-items-center rounded-full bg-white/10" aria-hidden>
                  <Users className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">Você não está na lista</span>
                  <span className="block text-xs text-white/60">Toque para entrar e votar</span>
                </span>
              </>
            )}
            <span className="shrink-0 text-right text-xs">
              <span className="block font-medium text-[#47cdd0]">Trocar</span>
              <span className="block text-white/50">{people.length} na lista</span>
            </span>
          </button>
          <div className="mt-2 flex items-center gap-2">
            <span className="flex -space-x-2" aria-hidden>
              {people.map((person, index) => (
                <span key={`${person.name}-${index}`} className="rounded-full ring-2 ring-[#04202f]">
                  <PersonFace size="sm" person={faceOf(person, data.faces)} />
                </span>
              ))}
            </span>
            <span className="min-w-0 truncate text-xs text-white/60">{people.map((person) => firstName(person.name)).join(", ")}</span>
          </div>
          {acting && me && acting !== me && (
            <p className="mt-2 rounded-md bg-amber-400/15 px-3 py-2 text-xs text-amber-100">
              As notas que você tocar agora ficam no nome de {firstName(acting.name)}.{" "}
              <button type="button" className="font-semibold underline underline-offset-2" onClick={() => setActingKey(participantKey(me))}>
                Voltar para mim
              </button>
            </p>
          )}
        </div>
      </header>

      <nav aria-label="Seções da degustação" className="sticky top-0 z-20 border-b border-[#dce9eb] bg-white/95 px-4 backdrop-blur">
        <div className="mx-auto grid max-w-xl grid-cols-3">
          {(
            [
              { id: "votar", label: "Votar", count: drinks.length },
              { id: "tabela", label: "Tabela", count: 0 },
              { id: "geral", label: others.length > 0 ? "Comparar" : "Ranking", count: 0 },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-current={view === tab.id ? "page" : undefined}
              onClick={() => setView(tab.id)}
              className={cn(
                "inline-flex min-h-12 items-center justify-center gap-1.5 border-b-[3px] text-sm font-medium transition-colors outline-none focus-visible:bg-[#47cdd0]/10",
                view === tab.id ? "border-[#347796] font-semibold text-foreground" : "border-transparent text-muted-foreground"
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={cn("rounded-full px-1.5 text-xs tabular-nums", view === tab.id ? "bg-[#347796] text-white" : "bg-[#eaf2f5] text-[#285f7a]")}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-xl px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-4">
        {view === "votar" && (
          <div className="space-y-4">
            <Button size="lg" className="h-14 w-full text-base" onClick={() => setDrinkForm({ drink: null })}>
              <Camera className="size-5" />
              Novo drink
            </Button>
            {acting && drinks.length > 0 && (
              <p className="text-center text-xs text-muted-foreground">
                {firstName(acting.name)} deu nota a {myDone} de {drinks.length} {drinks.length === 1 ? "drink" : "drinks"}
              </p>
            )}
            {drinks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#c9d8dc] bg-white px-5 py-10 text-center">
                <Martini className="mx-auto size-8 text-[#9fc3cf]" aria-hidden />
                <p className="mt-2 text-sm font-medium text-foreground">Nenhum drink ainda</p>
                <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">Quando chegar o primeiro, toque em &quot;Novo drink&quot;, tire a foto e escreva o nome.</p>
              </div>
            ) : (
              <ul className="space-y-4">
                {drinks.map((drink, index) => (
                  <li key={drink.id}>
                    <DrinkVoteCard
                      drink={drink}
                      number={drinks.length - index}
                      people={people}
                      votes={votes}
                      faces={data.faces}
                      acting={acting}
                      score={myScore(drink.id)}
                      photoBusy={photoBusyId === drink.id}
                      onVote={(score) => void vote(drink, score)}
                      onEdit={() => setDrinkForm({ drink })}
                      onPhoto={(file) => void addPhotoToDrink(drink, file)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {view === "tabela" && (
          <section aria-label="Tabela de notas" className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Notas completas · {tasting.vendorName}</h2>
              <p className="text-xs text-muted-foreground">Ao vivo: muda sozinha quando alguém vota.</p>
            </div>
            {drinks.length > 0 && <OverallRankingList tastings={[tasting]} drinks={drinks} votes={votes} showTasting={false} />}
            <h3 className="pt-2 text-sm font-semibold text-foreground">Nota de cada pessoa</h3>
            <TastingScoreTable tasting={tasting} drinks={drinks} votes={votes} faces={data.faces} />
          </section>
        )}

        {view === "geral" && (
          <div className="space-y-6">
            <section aria-label="Ranking geral" className="space-y-2">
              <div>
                <h2 className="text-base font-semibold text-foreground">{others.length > 0 ? "Ranking geral das degustações" : "Ranking"}</h2>
                {others.length > 0 && <p className="text-xs leading-5 text-muted-foreground">Cada drink com a média do grupo que provou. Os grupos mudam de uma degustação para outra.</p>}
              </div>
              <OverallRankingList tastings={data.tastings} drinks={data.drinks} votes={[...data.votes.filter((entry) => entry.tastingId !== tastingId), ...votes]} />
            </section>
            {others.map((other) => (
              <section key={other.id} aria-label={`Notas de ${other.vendorName}`} className="space-y-2">
                <h2 className="text-base font-semibold text-foreground">
                  {other.vendorName}
                  {other.tastingDate ? <span className="font-normal text-muted-foreground"> · {shortDate(other.tastingDate)}</span> : null}
                </h2>
                <TastingScoreTable
                  tasting={other}
                  drinks={data.drinks.filter((drink) => drink.tastingId === other.id)}
                  votes={data.votes.filter((entry) => entry.tastingId === other.id)}
                  faces={data.faces}
                />
              </section>
            ))}
          </div>
        )}
      </main>

      {notice && (
        <div
          role={notice.tone === "error" ? "alert" : "status"}
          className={cn(
            "fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-lg px-4 py-3 text-sm font-medium shadow-lg",
            notice.tone === "error" ? "bg-red-700 text-white" : "bg-[#04202f] text-white"
          )}
        >
          {notice.text}
        </div>
      )}

      {drinkForm && (
        <DrinkDialog
          tasting={tasting}
          drink={drinkForm.drink}
          canShortlist={isAdmin}
          onClose={() => setDrinkForm(null)}
          onSaved={(saved, created) => {
            mutationSeq.current += 1;
            setData((current) =>
              current ? { ...current, drinks: created ? [...current.drinks, saved] : current.drinks.map((entry) => (entry.id === saved.id ? saved : entry)) } : current
            );
            setDrinkForm(null);
            setView("votar");
            setNotice({ tone: "ok", text: created ? `${saved.name} incluído. Já dá para votar.` : "Drink atualizado." });
          }}
          onDeleted={(removed) => {
            mutationSeq.current += 1;
            setData((current) =>
              current ? { ...current, drinks: current.drinks.filter((entry) => entry.id !== removed.id), votes: current.votes.filter((entry) => entry.drinkId !== removed.id) } : current
            );
            setDrinkForm(null);
            setNotice({ tone: "ok", text: `${removed.name} apagado.` });
          }}
          nextSort={nextSort}
          createdBy={profile?.id ?? null}
          previousNames={overallRanking(others, data.drinks, data.votes).map((row) => row.drink.name)}
          takenNames={drinks.filter((drink) => drink.id !== drinkForm.drink?.id).map((drink) => drink.name)}
        />
      )}

      {peopleOpen && (
        <PeopleDialog
          people={people}
          faces={data.faces}
          drinks={drinks}
          votes={votes}
          me={me}
          acting={acting}
          canActFor={canActFor}
          isAdmin={isAdmin}
          profile={profile ? { id: profile.id, name: profile.name } : null}
          onClose={() => setPeopleOpen(false)}
          onPick={(person) => {
            setActingKey(participantKey(person));
            setPeopleOpen(false);
            setView("votar");
          }}
          onJoin={async () => {
            if (!profile) return;
            const ok = await changePeople(
              (current) => (current.some((person) => person.userId === profile.id) ? current : [...current, { name: profile.name, userId: profile.id, status: "confirmado", note: null }]),
              "Você entrou na lista. Já pode votar."
            );
            if (ok) {
              setActingKey(profile.id);
              setPeopleOpen(false);
            }
          }}
          onAddGuest={async (name) => {
            const clean = name.trim().replace(/\s+/g, " ");
            const key = participantKey({ name: clean, userId: null });
            const ok = await changePeople(
              (current) => (current.some((person) => participantKey(person) === key) ? current : [...current, { name: clean, userId: null, status: "confirmado", note: "Convidado(a), sem login" }]),
              `${clean} entrou na lista.`
            );
            if (ok) {
              setActingKey(key);
              setPeopleOpen(false);
            }
            return ok;
          }}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-[#f2f7f8] text-foreground">{children}</div>;
}

/* ───────────────────────────── Cartão do drink ───────────────────────────── */

function DrinkVoteCard({
  drink,
  number,
  people,
  votes,
  faces,
  acting,
  score,
  photoBusy,
  onVote,
  onEdit,
  onPhoto,
}: {
  drink: TastingDrink;
  number: number;
  people: TastingParticipant[];
  votes: TastingVote[];
  faces: DrinkTastingData["faces"];
  acting: TastingParticipant | null;
  score: Score | null;
  photoBusy: boolean;
  onVote: (score: Score) => void;
  onEdit: () => void;
  onPhoto: (file: File) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const row = scoreTable([drink], votes, people)[0];
  const missing = missingVoters(drink.id, votes, people);

  return (
    <article className={cn(CARD, "overflow-hidden")} aria-label={drink.name}>
      {drink.photoUrl ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element -- foto do Storage, já reduzida no envio */}
          <img src={drink.photoUrl} alt={`Foto do ${drink.name}`} className="aspect-[4/3] w-full bg-[#eaf5f7] object-cover" />
          <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2 py-0.5 text-xs font-semibold text-white">#{number}</span>
        </div>
      ) : (
        <button
          type="button"
          disabled={photoBusy}
          onClick={() => cameraRef.current?.click()}
          className="flex w-full items-center gap-3 border-b border-[#eef3f4] bg-[#f6fafb] px-4 py-3 text-left text-sm font-medium text-[#285f7a] outline-none hover:bg-[#eef6f8] focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-[#47cdd0]/50 disabled:opacity-70"
        >
          <span className="grid size-10 place-items-center rounded-md bg-white text-[#3e84a8] ring-1 ring-inset ring-[#dce9eb]" aria-hidden>
            {photoBusy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
          </span>
          <span className="flex-1">{photoBusy ? "Enviando a foto…" : "Tirar foto deste drink"}</span>
          <span className="text-xs font-semibold text-muted-foreground">#{number}</span>
        </button>
      )}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onPhoto(file);
        }}
      />

      <div className="p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className={cn("text-lg leading-6 text-foreground", drink.shortlisted ? "font-bold" : "font-semibold")}>{drink.name}</h2>
            {drink.note && <p className="mt-0.5 text-sm leading-5 text-muted-foreground">{drink.note}</p>}
          </div>
          <Button size="icon-lg" variant="ghost" className="-mr-2 -mt-2" aria-label={`Editar ${drink.name}`} onClick={onEdit}>
            <Pencil className="size-4" />
          </Button>
        </div>

        {acting ? (
          <>
            <div role="radiogroup" aria-label={`Nota de ${firstName(acting.name)} para ${drink.name}`} className="mt-3 grid grid-cols-5 gap-2">
              {SCORES.map((value) => {
                const selected = score === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${value} · ${SCORE_LABEL[value]}`}
                    onClick={() => onVote(value)}
                    className={cn(
                      "grid h-14 place-items-center rounded-lg text-xl font-semibold tabular-nums transition-[background-color,color,transform] outline-none active:scale-95 focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/60",
                      selected
                        ? "bg-[#347796] text-white shadow-[0_2px_8px_rgba(52,119,150,0.3)]"
                        : "border border-[#cfe0e4] bg-white text-[#285f7a] hover:border-[#47cdd0] hover:bg-[#f3fafb]"
                    )}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
            <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
              <span>Ruim</span>
              <span>{score ? <span className="font-medium text-[#285f7a]">{SCORE_LABEL[score]}</span> : "Toque na nota"}</span>
              <span>Muito bom</span>
            </div>
          </>
        ) : (
          <p className="mt-3 rounded-md bg-[#f6fafb] px-3 py-2 text-sm text-muted-foreground">Entre na lista (botão &quot;Trocar&quot;, lá em cima) para dar sua nota.</p>
        )}

        <div className="mt-3 flex items-center gap-3 border-t border-[#eef3f4] pt-3">
          <div className="min-w-0 flex-1 text-xs leading-5 text-muted-foreground">
            {score != null || !acting ? (
              <p>
                <span className="text-sm font-semibold text-foreground">{formatAverage(row?.average ?? null)}</span> de média · {row?.votes ?? 0} de {people.length} notas
              </p>
            ) : (
              <p>
                {row?.votes ?? 0} de {people.length} já deram nota. A média aparece depois do seu voto.
              </p>
            )}
          </div>
          {missing.length > 0 && missing.length < people.length && (
            <div className="flex items-center gap-1.5" title={`Falta: ${missing.map((person) => firstName(person.name)).join(", ")}`}>
              <span className="text-xs text-muted-foreground">falta</span>
              <span className="flex -space-x-2">
                {missing.slice(0, 4).map((person, index) => (
                  <span key={`${person.name}-${index}`} className="rounded-full opacity-80 ring-2 ring-white">
                    <PersonFace size="sm" person={faceOf(person, faces)} />
                  </span>
                ))}
              </span>
              {missing.length > 4 && <span className="text-xs text-muted-foreground">+{missing.length - 4}</span>}
            </div>
          )}
          {missing.length === 0 && people.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
              <Check className="size-3.5" aria-hidden />
              Todos votaram
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

/* ───────────────────────────── Novo drink / editar ───────────────────────────── */

function DrinkDialog({
  tasting,
  drink,
  canShortlist,
  nextSort,
  createdBy,
  previousNames,
  takenNames,
  onClose,
  onSaved,
  onDeleted,
}: {
  tasting: EventTasting;
  drink: TastingDrink | null;
  canShortlist: boolean;
  nextSort: number;
  createdBy: string | null;
  /** Drinks das outras degustações (melhor média primeiro), sugeridos antes dos clássicos. */
  previousNames: string[];
  /** Nomes que já entraram nesta degustação (não aparecem como sugestão). */
  takenNames: string[];
  onClose: () => void;
  onSaved: (drink: TastingDrink, created: boolean) => void;
  onDeleted: (drink: TastingDrink) => void;
}) {
  const [name, setName] = useState(drink?.name ?? "");
  const [note, setNote] = useState(drink?.note ?? "");
  const [shortlisted, setShortlisted] = useState(drink?.shortlisted ?? false);
  const [photo, setPhoto] = useState<{ blob: Blob; preview: string } | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [stage, setStage] = useState<"idle" | "preparing" | "saving" | "deleting">("idle");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.preview);
  }, [photo]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setStage("preparing");
    try {
      const blob = await prepareDrinkPhoto(file);
      setPhoto({ blob, preview: URL.createObjectURL(blob) });
      setRemovePhoto(false);
    } catch (pickError) {
      setError(errorText(pickError, "Não deu para ler essa foto."));
    } finally {
      setStage("idle");
    }
  };

  const currentPhoto = photo?.preview ?? (removePhoto ? null : drink?.photoUrl ?? null);
  const busy = stage !== "idle";
  const typed = name.trim();
  const matches = drinkSuggestions(typed, previousNames, takenNames, 12);
  // Nome já escolhido: some a lista para não sobrar um botão repetindo o campo.
  const suggestions = matches.length === 1 && matches[0].toLowerCase() === typed.toLowerCase() ? [] : matches;

  const save = async () => {
    const clean = name.trim().replace(/\s+/g, " ");
    if (!clean) {
      setError("Escreva o nome do drink.");
      return;
    }
    setError(null);
    setStage("saving");
    try {
      let photoPath = removePhoto ? null : drink?.photoPath ?? null;
      let photoUrl = removePhoto ? null : drink?.photoUrl ?? null;
      if (photo) {
        const uploaded = await uploadDrinkPhoto(tasting.eventId, tasting.id, clean, photo.blob);
        photoPath = uploaded.path;
        photoUrl = uploaded.url;
      }
      const input = { name: clean, note: note.trim() || null, shortlisted, photoPath, photoUrl };
      const saved = drink ? await updateDrink(drink, input) : await createDrink(tasting, input, createdBy, nextSort);
      onSaved(saved, !drink);
    } catch (saveError) {
      setError(errorText(saveError, "Não foi possível salvar."));
      setStage("idle");
    }
  };

  const remove = async () => {
    if (!drink) return;
    setStage("deleting");
    try {
      await deleteDrink(drink);
      onDeleted(drink);
    } catch (deleteError) {
      setError(errorText(deleteError, "Não foi possível apagar."));
      setStage("idle");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-[#e6eef0] px-5 py-4 text-left">
          <DialogTitle>{drink ? "Editar drink" : "Novo drink"}</DialogTitle>
          <DialogDescription>{drink ? "Troque o nome ou a foto." : `Foto e nome do drink que acabou de chegar na ${tasting.vendorName}.`}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {currentPhoto ? (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- prévia local da foto */}
              <img src={currentPhoto} alt="Prévia da foto do drink" className="aspect-[4/3] w-full rounded-lg bg-[#eaf5f7] object-cover" />
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" disabled={busy} onClick={() => cameraRef.current?.click()}>
                  <Camera className="size-4" />
                  Tirar outra
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setPhoto(null);
                    setRemovePhoto(true);
                  }}
                >
                  Remover foto
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => cameraRef.current?.click()}
                className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#9fc3cf] bg-[#f6fafb] text-[#285f7a] outline-none transition-colors hover:bg-[#eef6f8] focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/50 disabled:opacity-70"
              >
                {stage === "preparing" ? <Loader2 className="size-9 animate-spin" aria-hidden /> : <Camera className="size-9" aria-hidden />}
                <span className="text-base font-semibold">{stage === "preparing" ? "Preparando a foto…" : "Tirar foto"}</span>
                <span className="text-xs text-muted-foreground">Abre a câmera do celular</span>
              </button>
              <button type="button" disabled={busy} onClick={() => galleryRef.current?.click()} className="w-full py-1 text-center text-sm font-medium text-[#347796] hover:underline">
                ou escolher da galeria
              </button>
            </div>
          )}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void pick(file); }} />
          <input ref={galleryRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void pick(file); }} />

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Nome do drink</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Negroni"
              autoCapitalize="words"
              enterKeyHint="done"
              maxLength={80}
              className="h-12 w-full rounded-md border border-input bg-white px-3 text-base outline-none focus-visible:border-[#47cdd0] focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/30"
            />
          </label>
          {suggestions.length > 0 && (
            <div className="-mt-2 space-y-1.5">
              <p className="text-xs text-muted-foreground">{typed ? "Toque para usar" : "Toque em um nome ou escreva acima"}</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Sugestões de nome">
                {suggestions.map((suggestion) => {
                  const active = suggestion.toLowerCase() === typed.toLowerCase();
                  return (
                    <button
                      key={suggestion}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setName(suggestion);
                        setError(null);
                      }}
                      className={cn(
                        "inline-flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/40",
                        active
                          ? "border-[#347796] bg-[#347796] text-white"
                          : "border-[#cfe0e4] bg-white text-[#285f7a] hover:border-[#47cdd0] hover:bg-[#f3fafb]"
                      )}
                    >
                      {suggestion}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">
              Ingredientes ou observação <span className="font-normal text-muted-foreground">(opcional)</span>
            </span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ex.: gin, limão e manjericão"
              maxLength={160}
              className="h-12 w-full rounded-md border border-input bg-white px-3 text-base outline-none focus-visible:border-[#47cdd0] focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/30"
            />
          </label>
          {canShortlist && (
            <label className="flex min-h-11 items-center gap-3 rounded-md px-1">
              <input type="checkbox" checked={shortlisted} onChange={(event) => setShortlisted(event.target.checked)} className="size-5 accent-[#347796]" />
              <span className="text-sm">
                <span className="font-medium text-foreground">Pré-selecionado</span>
                <span className="block text-xs text-muted-foreground">Fica em negrito na tabela.</span>
              </span>
            </label>
          )}
          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-[#e6eef0] px-5 py-3">
          {drink &&
            (confirmDelete ? (
              <Button type="button" variant="destructive" disabled={busy} onClick={() => void remove()}>
                {stage === "deleting" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Apagar mesmo
              </Button>
            ) : (
              <Button type="button" variant="ghost" className="text-red-700 hover:text-red-800" disabled={busy} onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" />
                Apagar
              </Button>
            ))}
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" disabled={busy} onClick={() => void save()}>
              {stage === "saving" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {stage === "saving" ? (photo ? "Enviando…" : "Salvando…") : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────────── Quem vota ───────────────────────────── */

function PeopleDialog({
  people,
  faces,
  drinks,
  votes,
  me,
  acting,
  canActFor,
  isAdmin,
  profile,
  onClose,
  onPick,
  onJoin,
  onAddGuest,
}: {
  people: TastingParticipant[];
  faces: DrinkTastingData["faces"];
  drinks: TastingDrink[];
  votes: TastingVote[];
  me: TastingParticipant | null;
  acting: TastingParticipant | null;
  canActFor: (person: TastingParticipant) => boolean;
  isAdmin: boolean;
  profile: { id: string; name: string } | null;
  onClose: () => void;
  onPick: (person: TastingParticipant) => void;
  onJoin: () => Promise<void>;
  onAddGuest: (name: string) => Promise<boolean>;
}) {
  const [guest, setGuest] = useState("");
  const [busy, setBusy] = useState(false);
  const actingKey = acting ? participantKey(acting) : null;

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-[#e6eef0] px-5 py-4 text-left">
          <DialogTitle>Quem está votando</DialogTitle>
          <DialogDescription>
            {isAdmin
              ? "Toque em alguém para lançar as notas no nome da pessoa (para quem está sem celular ou sem login)."
              : "Cada um vota no próprio celular. Quem não tem login entra como convidado e alguém da lista lança as notas."}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          <ul className="divide-y divide-[#eef3f4]">
            {people.map((person, index) => {
              const key = participantKey(person);
              const done = new Set(votes.filter((vote) => vote.participantKey === key).map((vote) => vote.drinkId));
              const count = drinks.filter((drink) => done.has(drink.id)).length;
              const allowed = canActFor(person);
              const current = key === actingKey;
              return (
                <li key={`${person.name}-${index}`}>
                  <button
                    type="button"
                    disabled={!allowed}
                    onClick={() => onPick(person)}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 rounded-md px-2 py-2 text-left outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/50",
                      allowed ? "hover:bg-[#f3fafb]" : "cursor-default",
                      current && "bg-[#eaf5f7]"
                    )}
                  >
                    <PersonFace size="md" person={faceOf(person, faces)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {person.name}
                        {me && key === participantKey(me) ? <span className="font-normal text-muted-foreground"> (você)</span> : null}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {count} de {drinks.length} notas{!person.userId ? " · sem login" : ""}
                      </span>
                    </span>
                    {current ? (
                      <Check className="size-5 text-[#347796]" aria-label="Votando agora" />
                    ) : allowed ? (
                      <span className="text-xs font-medium text-[#347796]">Votar por</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="space-y-3 border-t border-[#e6eef0] px-5 py-4">
          {profile && !me && (
            <Button
              className="h-12 w-full"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await onJoin();
                setBusy(false);
              }}
            >
              <Plus className="size-4" />
              Entrar na lista como {firstName(profile.name)}
            </Button>
          )}
          {(me || isAdmin) && (
            <form
              className="flex gap-2"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!guest.trim()) return;
                setBusy(true);
                const ok = await onAddGuest(guest);
                setBusy(false);
                if (ok) setGuest("");
              }}
            >
              <input
                value={guest}
                onChange={(event) => setGuest(event.target.value)}
                placeholder="Nome de um convidado sem login"
                autoCapitalize="words"
                maxLength={60}
                className="h-11 min-w-0 flex-1 rounded-md border border-input bg-white px-3 text-base outline-none focus-visible:border-[#47cdd0] focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/30"
              />
              <Button type="submit" variant="outline" className="h-11" disabled={busy || !guest.trim()}>
                <UserPlus className="size-4" />
                Incluir
              </Button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
