"use client";

import { useMemo, useState } from "react";
import { Briefcase, ChevronRight, LoaderCircle, MessageSquareQuote, Scale, Sparkles, Star, TriangleAlert, Waypoints, X, type LucideIcon } from "lucide-react";
import { AwardAvatar } from "@/components/rh/bp-awards/award-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AWARD_CATEGORIES,
  AWARD_HUBS,
  CITATION_MAX,
  MAX_FINALISTS,
  awardHub,
  awardSealSrc,
  type AwardCategoryKey,
  type AwardFinalist,
  type AwardHubKey,
  type AwardPerson,
  type HubTallies,
} from "@/lib/rh/bp-awards/types";
import { cn } from "@/lib/utils";
import { NomineeDialog } from "./nominee-dialog";
import { requestJson } from "./request";

const HUB_ICONS: Record<AwardHubKey, LucideIcon> = {
  empresarial: Briefcase,
  reestruturacao: Scale,
  operacoes: Waypoints,
};

export function TallyPanel({
  tallies,
  finalists,
  people,
  partial,
  onFinalistsChange,
}: {
  tallies: HubTallies;
  finalists: AwardFinalist[];
  people: AwardPerson[];
  /** Votação ainda aberta: a contagem é parcial. */
  partial: boolean;
  onFinalistsChange: (finalists: AwardFinalist[]) => void;
}) {
  const [activeHub, setActiveHub] = useState<AwardHubKey>("empresarial");
  const [active, setActive] = useState<AwardCategoryKey>("cliente");
  const [openNominee, setOpenNominee] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const category = AWARD_CATEGORIES.find((item) => item.key === active)!;
  const hub = awardHub(activeHub);
  const list = tallies[activeHub][active];
  const hubFinalists = finalists.filter((finalist) => finalist.hub === activeHub);
  const own = hubFinalists.filter((finalist) => finalist.category === active);
  const personById = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const finalistByEmployee = new Map(own.map((finalist) => [finalist.employee_id, finalist]));
  const maxCount = list[0]?.count ?? 0;
  const totalInCategory = list.reduce((sum, tally) => sum + tally.count, 0);

  /** Pessoa que venceu em mais de um valor do hub (a regra sugerida é um prêmio por pessoa). */
  const winsByEmployee = useMemo(() => {
    const map = new Map<string, AwardCategoryKey[]>();
    for (const finalist of finalists) {
      if (finalist.hub === activeHub && finalist.is_winner) {
        map.set(finalist.employee_id, [...(map.get(finalist.employee_id) ?? []), finalist.category]);
      }
    }
    return map;
  }, [finalists, activeHub]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  const addFinalist = (employeeId: string) =>
    run(async () => {
      const data = await requestJson<{ finalist: AwardFinalist }>("/api/rh/bp-awards/finalistas", {
        method: "POST",
        body: JSON.stringify({ hub: activeHub, category: active, employee_id: employeeId }),
      });
      onFinalistsChange([...finalists, data.finalist]);
    });

  const addTopThree = () =>
    run(async () => {
      let next = [...finalists];
      for (const tally of list.slice(0, MAX_FINALISTS)) {
        if (next.some((finalist) => finalist.hub === activeHub && finalist.category === active && finalist.employee_id === tally.person.id)) continue;
        const data = await requestJson<{ finalist: AwardFinalist }>("/api/rh/bp-awards/finalistas", {
          method: "POST",
          body: JSON.stringify({ hub: activeHub, category: active, employee_id: tally.person.id }),
        });
        next = [...next, data.finalist];
        onFinalistsChange(next);
      }
    });

  const removeFinalist = (finalist: AwardFinalist) =>
    run(async () => {
      await requestJson(`/api/rh/bp-awards/finalistas/${finalist.id}`, { method: "DELETE" });
      onFinalistsChange(finalists.filter((item) => item.id !== finalist.id));
    });

  const patchFinalist = (finalist: AwardFinalist, patch: { is_winner?: boolean; citation?: string }) =>
    run(async () => {
      const data = await requestJson<{ finalists: AwardFinalist[] }>(`/api/rh/bp-awards/finalistas/${finalist.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      onFinalistsChange(data.finalists);
    });

  const openTally = list.find((tally) => tally.person.id === openNominee) ?? null;

  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-3" role="tablist" aria-label="Hubs">
        {AWARD_HUBS.map((item) => {
          const selected = item.key === activeHub;
          const Icon = HUB_ICONS[item.key];
          const winners = finalists.filter((finalist) => finalist.hub === item.key && finalist.is_winner).length;
          const count = AWARD_CATEGORIES.reduce(
            (sum, category) => sum + tallies[item.key][category.key].reduce((total, tally) => total + tally.count, 0),
            0
          );
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                setActiveHub(item.key);
                setError(null);
              }}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors duration-150",
                selected ? "border-[#0f1f2e] bg-[#0f1f2e] text-white" : "border-[#dce9eb] bg-white hover:border-[#47cdd0]/60 hover:bg-[#f5fbfb]"
              )}
            >
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-md",
                  selected ? "bg-white/10 text-[#d5b371]" : "bg-[#eef3f5] text-[#285f7a]"
                )}
                aria-hidden
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{item.name}</span>
                <span className={cn("block text-xs", selected ? "text-white/70" : "text-muted-foreground")}>
                  {count} {count === 1 ? "indicação" : "indicações"} · {winners}/{AWARD_CATEGORIES.length} vencedores
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Valores">
        {AWARD_CATEGORIES.map((item) => {
          const selected = item.key === active;
          const count = tallies[activeHub][item.key].reduce((sum, tally) => sum + tally.count, 0);
          const itemFinalists = hubFinalists.filter((finalist) => finalist.category === item.key);
          const hasWinner = itemFinalists.some((finalist) => finalist.is_winner);
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                setActive(item.key);
                setError(null);
              }}
              className={cn(
                "flex min-w-[11.5rem] shrink-0 items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors duration-150",
                selected
                  ? "border-[#347796] bg-[#e8f4f8] shadow-xs"
                  : "border-[#dce9eb] bg-white hover:border-[#47cdd0]/60 hover:bg-[#f5fbfb]"
              )}
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-md bg-[#0f1f2e] p-0.5" aria-hidden>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={awardSealSrc(item.key)} alt="" width={640} height={640} className="size-full" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">{item.name}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  {count} {count === 1 ? "indicação" : "indicações"}
                  {hasWinner ? (
                    <Star className="size-3 fill-[#cfab68] text-[#9c7434]" aria-label="vencedor definido" />
                  ) : itemFinalists.length > 0 ? (
                    ` · ${itemFinalists.length} final.`
                  ) : null}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <section aria-labelledby="indicados-titulo" className="min-w-0 rounded-lg border border-[#dce9eb] bg-white shadow-xs">
          <header className="border-b border-[#dce9eb] px-4 py-3">
            <h2 id="indicados-titulo" className="text-sm font-semibold">
              Indicados em {category.name} · {hub.name}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {totalInCategory} {totalInCategory === 1 ? "indicação" : "indicações"} de cédulas enviadas
              {partial ? " · contagem parcial, a votação está aberta" : ""}. Abra a pessoa para ler os relatos.
            </p>
          </header>
          {list.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <MessageSquareQuote className="mx-auto size-6 text-muted-foreground" aria-hidden />
              <p className="mt-2 text-sm font-medium">Nenhuma indicação enviada ainda</p>
              <p className="mt-1 text-sm text-muted-foreground">
                As indicações aparecem aqui quando o colaborador envia a cédula completa.
              </p>
            </div>
          ) : (
            <ol className="divide-y divide-[#eef3f5]">
              {list.map((tally) => {
                const finalist = finalistByEmployee.get(tally.person.id);
                return (
                  <li key={tally.person.id}>
                    <button
                      type="button"
                      onClick={() => setOpenNominee(tally.person.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-[#f5fbfb]"
                    >
                      <AwardAvatar person={tally.person} size="md" tone="system" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">{tally.person.short_name}</span>
                          {finalist?.is_winner ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#0d1e2e] px-2 py-0.5 text-xs font-medium text-[#e1b16d]">
                              <Star className="size-3 fill-current" aria-hidden />
                              Vencedor
                            </span>
                          ) : finalist ? (
                            <span className="rounded-full bg-[#e8f4f8] px-2 py-0.5 text-xs font-medium text-[#285f7a] ring-1 ring-inset ring-[#3e84a8]/20">
                              Finalista
                            </span>
                          ) : null}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">{tally.person.department}</span>
                        <span className="mt-1.5 flex h-1.5 max-w-xs overflow-hidden rounded-full bg-[#eef3f5]" aria-hidden>
                          <span className="rounded-full bg-[#3e84a8]" style={{ width: `${maxCount ? (tally.count / maxCount) * 100 : 0}%` }} />
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block text-lg font-semibold tabular-nums text-[#285f7a]">{tally.count}</span>
                        <span className="block text-xs text-muted-foreground">{tally.count === 1 ? "indicação" : "indicações"}</span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <FinalistsColumn
          key={`${activeHub}-${active}`}
          categoryName={category.name}
          finalists={own}
          personById={personById}
          winsByEmployee={winsByEmployee}
          activeKey={active}
          canSuggest={list.length > 0 && own.length === 0}
          busy={busy}
          error={error}
          onSuggest={() => void addTopThree()}
          onOpen={(employeeId) => setOpenNominee(employeeId)}
          onRemove={(finalist) => void removeFinalist(finalist)}
          onWinner={(finalist) => void patchFinalist(finalist, { is_winner: !finalist.is_winner })}
          onCitation={(finalist, citation) => patchFinalist(finalist, { citation })}
        />
      </div>

      {openTally && (
        <NomineeDialog
          key={`${activeHub}-${active}-${openTally.person.id}`}
          tally={openTally}
          category={category}
          hubName={hub.name}
          finalist={finalistByEmployee.get(openTally.person.id) ?? null}
          finalistCount={own.length}
          busy={busy}
          onOpenChange={(open) => !open && setOpenNominee(null)}
          onAddFinalist={() => void addFinalist(openTally.person.id)}
          onRemoveFinalist={() => {
            const finalist = finalistByEmployee.get(openTally.person.id);
            if (finalist) void removeFinalist(finalist);
          }}
          onMakeWinner={() => {
            const finalist = finalistByEmployee.get(openTally.person.id);
            if (finalist) void patchFinalist(finalist, { is_winner: true });
          }}
        />
      )}
    </div>
  );
}

function FinalistsColumn({
  categoryName,
  finalists,
  personById,
  winsByEmployee,
  activeKey,
  canSuggest,
  busy,
  error,
  onSuggest,
  onOpen,
  onRemove,
  onWinner,
  onCitation,
}: {
  categoryName: string;
  finalists: AwardFinalist[];
  personById: Map<string, AwardPerson>;
  winsByEmployee: Map<string, AwardCategoryKey[]>;
  activeKey: AwardCategoryKey;
  canSuggest: boolean;
  busy: boolean;
  error: string | null;
  onSuggest: () => void;
  onOpen: (employeeId: string) => void;
  onRemove: (finalist: AwardFinalist) => void;
  onWinner: (finalist: AwardFinalist) => void;
  onCitation: (finalist: AwardFinalist, citation: string) => Promise<void>;
}) {
  const winner = finalists.find((finalist) => finalist.is_winner) ?? null;
  const sorted = [...finalists].sort((a, b) => Number(b.is_winner) - Number(a.is_winner));

  return (
    <section aria-labelledby="finalistas-titulo" className="rounded-lg border border-[#dce9eb] bg-white shadow-xs">
      <header className="border-b border-[#dce9eb] px-4 py-3">
        <h2 id="finalistas-titulo" className="flex items-center justify-between text-sm font-semibold">
          Finalistas e vencedor
          <span className="text-xs font-normal tabular-nums text-muted-foreground">
            {finalists.length}/{MAX_FINALISTS}
          </span>
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          No telão, os finalistas aparecem em ordem alfabética e sem número de votos.
        </p>
      </header>

      <div className="space-y-4 p-4">
        {finalists.length === 0 ? (
          <div className="rounded-md border border-dashed border-[#dce9eb] px-4 py-6 text-center">
            <p className="text-sm font-medium">Nenhum finalista em {categoryName}</p>
            <p className="mt-1 text-sm text-muted-foreground">Abra um indicado para marcá-lo, ou comece pelos mais indicados.</p>
            {canSuggest && (
              <Button type="button" variant="secondary" size="sm" className="mt-3" disabled={busy} onClick={onSuggest}>
                {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
                Usar os {MAX_FINALISTS} mais indicados
              </Button>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {sorted.map((finalist) => {
              const person = personById.get(finalist.employee_id) ?? null;
              const otherWins = (winsByEmployee.get(finalist.employee_id) ?? []).filter((key) => key !== activeKey);
              return (
                <li
                  key={finalist.id}
                  className={cn(
                    "rounded-md border p-2.5",
                    finalist.is_winner ? "border-[#cfab68] bg-[#fdf8ee]" : "border-[#dce9eb]"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-2.5 text-left" onClick={() => onOpen(finalist.employee_id)}>
                      <AwardAvatar person={person} size="sm" tone="system" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{person?.short_name ?? "Colaborador"}</span>
                        <span className="block truncate text-xs text-muted-foreground">{person?.department}</span>
                      </span>
                    </button>
                    <Button
                      type="button"
                      variant={finalist.is_winner ? "default" : "outline"}
                      size="xs"
                      disabled={busy}
                      onClick={() => onWinner(finalist)}
                      aria-pressed={finalist.is_winner}
                      className={finalist.is_winner ? "border-[#0d1e2e] bg-[#0d1e2e] text-[#e1b16d] hover:bg-[#13283b] hover:text-[#e1b16d]" : undefined}
                    >
                      <Star className={cn("size-3", finalist.is_winner && "fill-current")} aria-hidden />
                      {finalist.is_winner ? "Vencedor" : "Vencedor?"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      disabled={busy}
                      onClick={() => onRemove(finalist)}
                      aria-label={`Tirar ${person?.short_name ?? "colaborador"} dos finalistas`}
                    >
                      <X aria-hidden />
                    </Button>
                  </div>
                  {otherWins.length > 0 && (
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-800">
                      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      Também venceu em{" "}
                      {otherWins.map((key) => AWARD_CATEGORIES.find((item) => item.key === key)?.name).join(" e ")}. Vale dar o
                      prêmio a outra pessoa?
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {winner && <CitationEditor key={winner.id} finalist={winner} busy={busy} onSave={onCitation} />}
        {!winner && finalists.length > 0 && (
          <p className="text-sm text-muted-foreground">Marque o vencedor para escrever a homenagem lida no telão.</p>
        )}
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

function CitationEditor({
  finalist,
  busy,
  onSave,
}: {
  finalist: AwardFinalist;
  busy: boolean;
  onSave: (finalist: AwardFinalist, citation: string) => Promise<void>;
}) {
  const [text, setText] = useState(finalist.citation ?? "");
  const dirty = text.trim() !== (finalist.citation ?? "").trim();

  return (
    <div className="space-y-2 border-t border-[#dce9eb] pt-4">
      <label htmlFor="homenagem" className="block text-sm font-semibold">
        Homenagem (lida no telão)
      </label>
      <Textarea
        id="homenagem"
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={CITATION_MAX}
        rows={4}
        placeholder="Uma ou duas frases a partir dos relatos: o que essa pessoa fez que representa o valor."
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs tabular-nums text-muted-foreground">
          {text.length}/{CITATION_MAX}
        </span>
        <Button type="button" size="sm" disabled={busy || !dirty} onClick={() => void onSave(finalist, text)}>
          {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {dirty ? "Salvar homenagem" : "Salva"}
        </Button>
      </div>
    </div>
  );
}
