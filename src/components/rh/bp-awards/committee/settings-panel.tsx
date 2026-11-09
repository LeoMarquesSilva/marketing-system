"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Check, LoaderCircle, RotateCcw, Search, TriangleAlert, UserCog, Waypoints } from "lucide-react";
import { AwardAvatar } from "@/components/rh/bp-awards/award-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AreaIcon, getAreaIconStyle } from "@/lib/area-icons";
import { formatAwardDateTime, fromBrasiliaInput, toBrasiliaInput } from "@/lib/rh/bp-awards/format";
import {
  AWARD_HUBS,
  buildAwardRules,
  hubOfDepartment,
  isEquityPartner,
  isPartner,
  resolveAwardPhase,
  resolveParticipant,
  type AreaHubs,
  type AwardEdition,
  type AwardHubKey,
  type AwardPerson,
  type AwardPhase,
  type ParticipantOverride,
  type ResolvedParticipant,
} from "@/lib/rh/bp-awards/types";
import { cn } from "@/lib/utils";
import { requestJson } from "./request";

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-white px-2 text-sm outline-none transition-[color,box-shadow] hover:border-[#3e84a8]/40 focus-visible:border-[#47cdd0] focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/18 disabled:cursor-not-allowed disabled:opacity-50";

const NO_HUB = "";

function SectionHeader({ icon: Icon, title, hint }: { icon: typeof CalendarClock; title: string; hint: string }) {
  return (
    <header className="flex items-start gap-3 border-b border-[#dce9eb] px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[#eef3f5] text-[#285f7a]" aria-hidden>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>
      </div>
    </header>
  );
}

export function SettingsPanel({
  edition,
  overrides,
  people,
  onEdition,
  onOverrides,
}: {
  edition: AwardEdition;
  overrides: ParticipantOverride[];
  people: AwardPerson[];
  onEdition: (edition: AwardEdition) => void;
  onOverrides: (overrides: ParticipantOverride[]) => void;
}) {
  const phase = resolveAwardPhase(edition);
  const started = phase === "aberta" || phase === "apuracao" || phase === "publicada";
  return (
    <div className="space-y-5">
      {started && (
        <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />A votação já começou: mudar hubs agora pode invalidar
          indicações já feitas, e quem sair de um hub deixa de contar nele.
        </p>
      )}
      <VotingWindow key={`${edition.voting_opens_at}-${edition.voting_closes_at}`} edition={edition} phase={phase} onSaved={onEdition} />
      <AreasSection edition={edition} people={people} onSaved={onEdition} />
      <PeopleSection edition={edition} overrides={overrides} people={people} onOverrides={onOverrides} />
    </div>
  );
}

/* ---------------------------------------------------------- quando soltar */

function VotingWindow({
  edition,
  phase,
  onSaved,
}: {
  edition: AwardEdition;
  phase: AwardPhase;
  onSaved: (edition: AwardEdition) => void;
}) {
  const [opensAt, setOpensAt] = useState(() => toBrasiliaInput(edition.voting_opens_at));
  const [closesAt, setClosesAt] = useState(() => toBrasiliaInput(edition.voting_closes_at));
  const [partners, setPartners] = useState(edition.partners_eligible);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const status: Record<AwardPhase, string> = {
    rascunho: "Votação fechada: sem datas, ninguém vê o convite nem consegue indicar.",
    agendada: edition.voting_opens_at ? `Agendada: abre sozinha em ${formatAwardDateTime(edition.voting_opens_at)}.` : "",
    aberta: edition.voting_closes_at ? `Votação aberta até ${formatAwardDateTime(edition.voting_closes_at)}.` : "",
    apuracao: edition.voting_closes_at ? `Votação encerrada em ${formatAwardDateTime(edition.voting_closes_at)}.` : "",
    publicada: "Resultado publicado.",
  };
  const dirty =
    opensAt !== toBrasiliaInput(edition.voting_opens_at) ||
    closesAt !== toBrasiliaInput(edition.voting_closes_at) ||
    partners !== edition.partners_eligible;

  async function persist() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const data = await requestJson<{ edition: AwardEdition }>("/api/rh/bp-awards", {
        method: "PATCH",
        body: JSON.stringify({
          voting_opens_at: opensAt ? fromBrasiliaInput(opensAt) : null,
          voting_closes_at: closesAt ? fromBrasiliaInput(closesAt) : null,
          partners_eligible: partners,
        }),
      });
      setConfirmOpen(false);
      onSaved(data.edition);
      setSaved(true);
    } catch (cause) {
      setConfirmOpen(false);
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  function save() {
    setError(null);
    if (Boolean(opensAt) !== Boolean(closesAt)) {
      setError("Preencha a abertura e o encerramento, ou deixe os dois em branco.");
      return;
    }
    if (opensAt && closesAt && closesAt <= opensAt) {
      setError("O encerramento precisa ser depois da abertura.");
      return;
    }
    const next = resolveAwardPhase({
      voting_opens_at: opensAt ? fromBrasiliaInput(opensAt) : null,
      voting_closes_at: closesAt ? fromBrasiliaInput(closesAt) : null,
      results_published_at: edition.results_published_at,
    });
    // Soltar a votação é o único ajuste que todo mundo vê na hora: pede confirmação.
    if (next === "aberta" && phase !== "aberta") setConfirmOpen(true);
    else void persist();
  }

  return (
    <section aria-labelledby="config-datas" className="rounded-lg border border-[#dce9eb] bg-white shadow-xs">
      <div id="config-datas">
        <SectionHeader icon={CalendarClock} title="Quando soltar a votação" hint={status[phase]} />
      </div>
      <div className="space-y-4 p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
          <div className="space-y-1.5">
            <Label htmlFor="bp-abertura">Abertura (horário de Brasília)</Label>
            <Input id="bp-abertura" type="datetime-local" value={opensAt} onChange={(event) => setOpensAt(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bp-encerramento">Encerramento (horário de Brasília)</Label>
            <Input id="bp-encerramento" type="datetime-local" value={closesAt} onChange={(event) => setClosesAt(event.target.value)} />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Enquanto estiver sem datas, a votação fica fechada. O roteiro da pesquisa prevê de 10 a 15 dias; deixe tempo para o
          comitê antes da festa (17/12).
        </p>
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-[#dce9eb] p-3 lg:max-w-2xl">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-[#347796]"
            checked={partners}
            onChange={(event) => setPartners(event.target.checked)}
          />
          <span>
            <span className="block text-sm font-medium">Sócios de área podem ser indicados</span>
            <span className="block text-sm text-muted-foreground">
              Desmarcado, os sócios de área votam no hub da sua área, mas não aparecem na lista de indicação. Os sócios
              patrimoniais votam nos três hubs e não concorrem.
            </span>
          </span>
        </label>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={save} disabled={saving || !dirty}>
            {saving && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
            Salvar
          </Button>
          {(opensAt || closesAt) && (
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => {
                setOpensAt("");
                setClosesAt("");
              }}
            >
              Limpar datas
            </Button>
          )}
          {saved && !dirty && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-700" role="status">
              <Check className="size-4" aria-hidden />
              Salvo
            </span>
          )}
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Soltar a votação agora?</DialogTitle>
            <DialogDescription>
              Com essas datas a votação abre assim que você salvar: todos os colaboradores passam a ver o convite ao entrar no
              sistema e já podem indicar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void persist()} disabled={saving}>
              {saving && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
              Soltar a votação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ------------------------------------------------------------ área e hub */

function AreasSection({
  edition,
  people,
  onSaved,
}: {
  edition: AwardEdition;
  people: AwardPerson[];
  onSaved: (edition: AwardEdition) => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const areas = useMemo(() => {
    const counts = new Map<string, number>();
    for (const person of people) {
      if (person.department) counts.set(person.department, (counts.get(person.department) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
  }, [people]);

  async function change(area: string, hub: string) {
    setSaving(area);
    setError(null);
    const next: AreaHubs = { ...edition.area_hubs };
    if (hub) next[area] = hub as AwardHubKey;
    else delete next[area];
    try {
      const data = await requestJson<{ edition: AwardEdition }>("/api/rh/bp-awards", {
        method: "PATCH",
        body: JSON.stringify({ area_hubs: next }),
      });
      onSaved(data.edition);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section aria-labelledby="config-areas" className="rounded-lg border border-[#dce9eb] bg-white shadow-xs">
      <div id="config-areas">
        <SectionHeader
          icon={Waypoints}
          title="Qual área é de qual hub"
          hint="Quem é da área pertence ao hub, vota nele e concorre nele, salvo as exceções por pessoa abaixo."
        />
      </div>
      <ul className="divide-y divide-[#eef3f5]">
        {areas.map(([area, count]) => {
          const hub = hubOfDepartment(area, edition.area_hubs);
          const partnersArea = isEquityPartner({ department: area });
          return (
            <li key={area} className="grid gap-2 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-center">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-md ring-1", getAreaIconStyle(area))}>
                  <AreaIcon area={area} className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{area}</p>
                  <p className="text-xs text-muted-foreground">
                    {count} {count === 1 ? "pessoa" : "pessoas"}
                    {partnersArea
                      ? " · sócios patrimoniais votam nos 3 hubs e não concorrem"
                      : hub
                        ? ""
                        : " · fora dos hubs: não vota nem concorre"}
                  </p>
                </div>
              </div>
              <select
                aria-label={`Hub de ${area}`}
                className={SELECT_CLASS}
                value={hub ?? NO_HUB}
                disabled={saving !== null}
                onChange={(event) => void change(area, event.target.value)}
              >
                {AWARD_HUBS.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.name}
                  </option>
                ))}
                <option value={NO_HUB}>Fora dos hubs</option>
              </select>
            </li>
          );
        })}
      </ul>
      {error && (
        <p className="border-t border-[#dce9eb] px-4 py-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------- por pessoa */

type PeopleFilter = AwardHubKey | "todos" | "fora" | "excecoes";

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function PeopleSection({
  edition,
  overrides,
  people,
  onOverrides,
}: {
  edition: AwardEdition;
  overrides: ParticipantOverride[];
  people: AwardPerson[];
  onOverrides: (overrides: ParticipantOverride[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PeopleFilter>("todos");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rules = useMemo(() => buildAwardRules(edition, overrides), [edition, overrides]);
  const rows = useMemo(
    () =>
      people
        .map((person) => ({ person, participant: resolveParticipant(person, rules) }))
        .sort((a, b) => a.person.short_name.localeCompare(b.person.short_name, "pt-BR")),
    [people, rules]
  );

  const counts = useMemo(() => {
    const result: Record<PeopleFilter, number> = { todos: rows.length, empresarial: 0, reestruturacao: 0, operacoes: 0, fora: 0, excecoes: 0 };
    for (const { participant } of rows) {
      result[participant.hub ?? "fora"] += 1;
      if (participant.adjusted) result.excecoes += 1;
    }
    return result;
  }, [rows]);

  const visible = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    return rows.filter(({ person, participant }) => {
      if (filter === "excecoes" && !participant.adjusted) return false;
      if (filter === "fora" && participant.hub !== null) return false;
      if (filter !== "todos" && filter !== "excecoes" && filter !== "fora" && participant.hub !== filter) return false;
      if (!terms.length) return true;
      const haystack = normalize(`${person.short_name} ${person.full_name} ${person.department ?? ""}`);
      return terms.every((term) => haystack.includes(term));
    });
  }, [rows, filter, query]);

  async function save(person: AwardPerson, next: Omit<ParticipantOverride, "employee_id">) {
    setBusy(person.id);
    setError(null);
    try {
      const data = await requestJson<{ override: ParticipantOverride | null }>(`/api/rh/bp-awards/participantes/${person.id}`, {
        method: "PUT",
        body: JSON.stringify(next),
      });
      const others = overrides.filter((item) => item.employee_id !== person.id);
      onOverrides(data.override ? [...others, data.override] : others);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setBusy(null);
    }
  }

  async function reset(person: AwardPerson) {
    setBusy(person.id);
    setError(null);
    try {
      await requestJson(`/api/rh/bp-awards/participantes/${person.id}`, { method: "DELETE" });
      onOverrides(overrides.filter((item) => item.employee_id !== person.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setBusy(null);
    }
  }

  const filters: Array<{ key: PeopleFilter; label: string }> = [
    { key: "todos", label: "Todos" },
    ...AWARD_HUBS.map((hub) => ({ key: hub.key as PeopleFilter, label: hub.shortName })),
    { key: "fora", label: "Fora dos hubs" },
    { key: "excecoes", label: "Com exceção" },
  ];

  return (
    <section aria-labelledby="config-pessoas" className="min-w-0 rounded-lg border border-[#dce9eb] bg-white shadow-xs">
      <div id="config-pessoas">
        <SectionHeader
          icon={UserCog}
          title="Exceções por pessoa"
          hint="Para quem foge da regra da área: mude o hub, onde a pessoa vota e se ela concorre. Salva na hora."
        />
      </div>
      <div className="flex flex-col gap-3 border-b border-[#dce9eb] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar pessoas">
          {filters.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={filter === item.key}
              onClick={() => setFilter(item.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150",
                filter === item.key
                  ? "border-[#347796] bg-[#e8f4f8] text-[#285f7a]"
                  : "border-[#dce9eb] text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
              <span className="tabular-nums opacity-80">{counts[item.key]}</span>
            </button>
          ))}
        </div>
        <div className="relative lg:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar pessoa ou área"
            className="pl-9"
            aria-label="Buscar pessoa ou área"
          />
        </div>
      </div>
      {error && (
        <p className="border-b border-[#dce9eb] px-4 py-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="hidden grid-cols-[minmax(0,1.2fr)_11rem_minmax(0,1.5fr)_6rem_6.5rem] gap-3 border-b border-[#dce9eb] bg-[#f7fbfb] px-4 py-2 text-xs font-medium text-muted-foreground xl:grid">
        <span>Pessoa</span>
        <span>Pertence a</span>
        <span>Vota em</span>
        <span>Concorre</span>
        <span />
      </div>
      {visible.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          {filter === "excecoes" ? "Nenhuma exceção: todos seguem a regra da área." : "Ninguém encontrado."}
        </p>
      ) : (
        <ul className="divide-y divide-[#eef3f5]">
          {visible.map(({ person, participant }) => (
            <PersonRow
              key={person.id}
              person={person}
              participant={participant}
              partnersEligible={edition.partners_eligible}
              busy={busy === person.id}
              locked={busy !== null}
              onSave={(next) => void save(person, next)}
              onReset={() => void reset(person)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function PersonRow({
  person,
  participant,
  partnersEligible,
  busy,
  locked,
  onSave,
  onReset,
}: {
  person: AwardPerson;
  participant: ResolvedParticipant;
  partnersEligible: boolean;
  busy: boolean;
  locked: boolean;
  onSave: (next: Omit<ParticipantOverride, "employee_id">) => void;
  onReset: () => void;
}) {
  const current = {
    hub: participant.hub,
    vote_hubs: participant.voteHubs,
    can_compete: participant.canCompete,
  };

  function changeHub(value: string) {
    const hub = (value || null) as AwardHubKey | null;
    // Quem votava só no próprio hub acompanha a mudança; quem vota em vários mantém.
    const followed = participant.voteHubs.length === 0 || (participant.voteHubs.length === 1 && participant.voteHubs[0] === participant.hub);
    onSave({
      hub,
      vote_hubs: followed ? (hub ? [hub] : []) : participant.voteHubs,
      can_compete: hub === null ? false : participant.hub === null ? partnersEligible || !isPartner(person) : participant.canCompete,
    });
  }

  function toggleVote(hub: AwardHubKey) {
    const has = participant.voteHubs.includes(hub);
    onSave({ ...current, vote_hubs: has ? participant.voteHubs.filter((item) => item !== hub) : [...participant.voteHubs, hub] });
  }

  return (
    <li className="grid gap-3 px-4 py-3 xl:grid-cols-[minmax(0,1.2fr)_11rem_minmax(0,1.5fr)_6rem_6.5rem] xl:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <AwardAvatar person={person} size="sm" tone="system" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{person.short_name}</p>
          <p className="truncate text-xs text-muted-foreground">{[person.department, person.position].filter(Boolean).join(" · ")}</p>
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground xl:hidden">Pertence a</span>
        <select
          aria-label={`Hub de ${person.short_name}`}
          className={SELECT_CLASS}
          value={participant.hub ?? NO_HUB}
          disabled={locked}
          onChange={(event) => changeHub(event.target.value)}
        >
          {AWARD_HUBS.map((hub) => (
            <option key={hub.key} value={hub.key}>
              {hub.shortName}
            </option>
          ))}
          <option value={NO_HUB}>Fora dos hubs</option>
        </select>
      </label>

      <div>
        <span className="mb-1 block text-xs font-medium text-muted-foreground xl:hidden">Vota em</span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Hubs em que ${person.short_name} vota`}>
          {AWARD_HUBS.map((hub) => {
            const active = participant.voteHubs.includes(hub.key);
            return (
              <button
                key={hub.key}
                type="button"
                aria-pressed={active}
                disabled={locked}
                onClick={() => toggleVote(hub.key)}
                className={cn(
                  "inline-flex min-h-8 items-center gap-1 rounded-md border px-2 text-xs font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60",
                  active
                    ? "border-[#347796] bg-[#e8f4f8] text-[#285f7a]"
                    : "border-[#dce9eb] text-muted-foreground hover:border-[#3e84a8]/40 hover:text-foreground"
                )}
              >
                {active && <Check className="size-3" aria-hidden />}
                {hub.shortName}
              </button>
            );
          })}
        </div>
      </div>

      <label
        className={cn(
          "flex min-h-8 items-center gap-2 text-sm",
          participant.hub === null ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer"
        )}
      >
        <input
          type="checkbox"
          className="size-4 accent-[#347796]"
          checked={participant.canCompete}
          disabled={locked || participant.hub === null}
          onChange={(event) => onSave({ ...current, can_compete: event.target.checked })}
        />
        <span>Concorre</span>
      </label>

      <div className="flex min-h-8 items-center gap-2">
        {busy ? (
          <LoaderCircle className="size-4 animate-spin text-[#347796]" aria-label="Salvando" />
        ) : participant.adjusted ? (
          <Button type="button" variant="ghost" size="xs" disabled={locked} onClick={onReset} title="Voltar para a regra da área">
            <RotateCcw aria-hidden />
            Padrão
          </Button>
        ) : null}
      </div>
    </li>
  );
}
