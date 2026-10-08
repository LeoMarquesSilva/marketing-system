"use client";

import { Fragment } from "react";
import { ChevronRight, Network, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  roleLevel,
  type OrgChartView,
  type OrgDivisionView,
  type OrgMember,
  type OrgTeamView,
  type OrgTier,
} from "@/lib/rh/org-chart";
import { cn } from "@/lib/utils";
import {
  AvatarStack,
  LevelBar,
  LevelLegend,
  OrgAvatar,
  OrgPersonCard,
  PartnerPortrait,
} from "@/components/rh/organograma/org-visuals";
import styles from "@/components/rh/organograma/org-tree.module.css";

type PersonHandlers = {
  highlightId: string | null;
  editing: boolean;
  onSelectMember: (member: OrgMember) => void;
};

function pluralPessoas(count: number) {
  return `${count} ${count === 1 ? "pessoa" : "pessoas"}`;
}

export function PartnersBand({
  partners,
  ...handlers
}: { partners: OrgMember[] } & PersonHandlers) {
  return (
    <div className={cn(styles.partnersBand, "relative px-4 pb-6 pt-5 sm:px-8")}>
      <div className="flex items-center justify-center gap-3">
        <span className={cn(styles.hairline, "w-12 sm:w-24")} aria-hidden />
        <p className="text-xs font-medium text-white/70">Bismarchi | Pires · Sócios patrimoniais</p>
        <span className={cn(styles.hairline, "w-12 sm:w-24")} aria-hidden />
      </div>
      {partners.length === 0 ? (
        <p className="mt-4 text-center text-sm text-white/60">Nenhum sócio patrimonial posicionado.</p>
      ) : (
        <div className="mt-4 flex flex-wrap justify-center gap-4 sm:gap-10">
          {partners.map((m) => (
            <PartnerPortrait
              key={m.id}
              member={m}
              highlighted={handlers.highlightId === m.employeeId}
              editing={handlers.editing}
              onSelect={handlers.onSelectMember}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DivisionPanel({
  division,
  selectedTeam,
  onSelectTeam,
  ...handlers
}: {
  division: OrgDivisionView;
  selectedTeam: string;
  onSelectTeam: (key: string) => void;
} & PersonHandlers) {
  const leaders = division.leaders.flat();
  return (
    <div className="w-full rounded-lg border border-[#dce9eb] bg-card shadow-[0_1px_2px_rgba(4,32,47,0.05)]">
      <div className="border-b border-[#dce9eb] px-4 pb-3.5 pt-4">
        <p className="text-xs font-medium text-[#347796]">Área executiva</p>
        <h3 className="text-lg font-semibold leading-tight text-foreground">{division.label}</h3>
        <p className="mt-1 text-xs leading-snug text-muted-foreground">{division.summary}</p>
        {leaders.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {leaders.map((m) => (
              <button
                key={m.id}
                type="button"
                data-employee={m.employeeId}
                onClick={() => handlers.onSelectMember(m)}
                className={cn(
                  "flex items-center gap-2 rounded-md bg-[var(--orquestrai-surface-to)] py-1.5 pl-1.5 pr-3 text-left text-white transition-transform hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orquestrai-cyan",
                  handlers.highlightId === m.employeeId && "ring-2 ring-orquestrai-cyan ring-offset-2"
                )}
              >
                <OrgAvatar name={m.name} photoUrl={m.photoUrl} size={30} />
                <span>
                  <span className="block text-sm font-medium leading-tight">{m.name}</span>
                  <span className="block text-xs text-white/60">{m.role}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <ul className="divide-y divide-[#dce9eb]/80">
        {division.teams.map((team) => {
          const active = team.key === selectedTeam;
          return (
            <li key={team.key}>
              <button
                type="button"
                onClick={() => onSelectTeam(team.key)}
                aria-pressed={active}
                className={cn(
                  "group flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#47cdd0]/6 focus-visible:bg-[#47cdd0]/10 focus-visible:outline-none",
                  active && "bg-[#47cdd0]/10 hover:bg-[#47cdd0]/12"
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate text-sm font-medium", active ? "text-[#1c1c1c]" : "text-foreground")}>
                      {team.label}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {team.members.length > 0 ? pluralPessoas(team.members.length) : "a definir"}
                    </span>
                  </span>
                  <LevelBar members={team.members} className="mt-1.5" />
                </span>
                {team.members.length > 0 && <AvatarStack members={team.members} />}
                <ChevronRight
                  aria-hidden
                  className={cn(
                    "size-4 shrink-0 transition-[transform,color]",
                    active ? "translate-x-0.5 text-[#347796]" : "text-muted-foreground/50 group-hover:text-muted-foreground"
                  )}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function StructureOverview({
  view,
  selectedTeam,
  onSelectTeam,
  ...handlers
}: {
  view: OrgChartView;
  selectedTeam: string;
  onSelectTeam: (key: string) => void;
} & PersonHandlers) {
  return (
    <section
      aria-label="Estrutura do escritório"
      className={cn(styles.tree, styles.canvas, "overflow-hidden rounded-lg border border-[#dce9eb]")}
    >
      <PartnersBand partners={view.partners} {...handlers} />
      <div className="px-3 pb-5 sm:px-6">
        <div className={cn(styles.stem, "hidden md:block")} />
        <div className={cn(styles.split, "pt-5 md:pt-0")}>
          {view.divisions.map((division) => (
            <div key={division.key} className={styles.branch}>
              <DivisionPanel
                division={division}
                selectedTeam={selectedTeam}
                onSelectTeam={onSelectTeam}
                {...handlers}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TierTree({
  tiers,
  root,
  ...handlers
}: { tiers: OrgTier[]; root?: boolean } & PersonHandlers) {
  return (
    <>
      {tiers.map((tier, index) => (
        <Fragment key={tier.map((m) => m.id).join("|")}>
          {(index > 0 || !root) && <div className={styles.stem} />}
          <div
            className={cn(styles.row, styles.rise)}
            style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
          >
            {tier.map((m) =>
              index === 0 && root ? (
                <div key={m.id} className="px-[7px]">
                  <OrgPersonCard
                    member={m}
                    highlighted={handlers.highlightId === m.employeeId}
                    editing={handlers.editing}
                    onSelect={handlers.onSelectMember}
                  />
                </div>
              ) : (
                <div key={m.id} className={styles.branch}>
                  <OrgPersonCard
                    member={m}
                    highlighted={handlers.highlightId === m.employeeId}
                    editing={handlers.editing}
                    onSelect={handlers.onSelectMember}
                  />
                </div>
              )
            )}
          </div>
        </Fragment>
      ))}
    </>
  );
}

export function TeamDetail({
  division,
  team,
  onAddPerson,
  onOpenFullChart,
  ...handlers
}: {
  division: OrgDivisionView;
  team: OrgTeamView;
  onAddPerson?: () => void;
  onOpenFullChart: () => void;
} & PersonHandlers) {
  const levels = [...new Set(team.members.map((m) => roleLevel(m.role)))];
  const leaders = division.leaders.flat();
  const hasPeople = team.members.length > 0;
  return (
    <section
      className="overflow-hidden rounded-lg border border-[#dce9eb] bg-card shadow-[0_1px_2px_rgba(4,32,47,0.05)]"
      aria-labelledby="org-team-title"
    >
      <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#347796]">{division.label}</p>
          <h3 id="org-team-title" className="text-xl font-semibold leading-tight text-foreground">
            {team.label}
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{team.summary}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {hasPeople && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e8f8f8] px-2.5 py-1 text-xs font-medium text-[#285f7a]">
              <Users className="size-3.5" aria-hidden />
              {pluralPessoas(team.members.length)}
            </span>
          )}
          {handlers.editing && onAddPerson && (
            <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={onAddPerson}>
              <Plus className="size-3.5" />
              Adicionar pessoa
            </Button>
          )}
          <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={onOpenFullChart}>
            <Network className="size-3.5" />
            Ver na área completa
          </Button>
        </div>
      </div>

      <div className={cn(styles.tree, styles.canvas, "border-t border-[#dce9eb]")}>
        <div className="overflow-x-auto">
          <div key={team.key} className="mx-auto w-max min-w-full px-6 pb-8 pt-6">
            {leaders.length > 0 && hasPeople && (
              <div className={cn(styles.rise, "mx-auto flex w-fit items-center gap-2 rounded-full border border-dashed border-[#3e84a8]/35 bg-card/80 py-1 pl-1 pr-3")}>
                <div className="flex -space-x-2">
                  {leaders.map((m) => (
                    <span key={m.id} className="rounded-full ring-2 ring-card">
                      <OrgAvatar name={m.name} photoUrl={m.photoUrl} size={24} />
                    </span>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  Liderança de {division.label}: {leaders.map((m) => m.name).join(" e ")}
                </span>
              </div>
            )}

            {!hasPeople ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <span className="rounded-full bg-[#e8f8f8] p-3 text-[#347796]">
                  <Users className="size-5" aria-hidden />
                </span>
                <p className="text-sm font-medium text-foreground">Ninguém posicionado nesta equipe</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Use “Ajustar organograma” para colocar pessoas aqui.
                </p>
              </div>
            ) : (
              <>
                <TierTree tiers={team.tiers} root={leaders.length === 0} {...handlers} />
                {team.groups.length > 0 && (
                  <>
                    {team.tiers.length > 0 && <div className={styles.stem} />}
                    <div className={styles.row}>
                      {team.groups.map((group) => (
                        <div key={group.label} className={team.tiers.length > 0 ? styles.branch : "px-[7px]"}>
                          <div className={cn(styles.rise, "rounded-lg border border-[#dce9eb] bg-card/70 px-3 pb-5 pt-3 backdrop-blur-[1px]")}>
                            <p className="text-center text-xs font-semibold text-[#285f7a]">{group.label}</p>
                            <div className="mt-3">
                              <TierTree tiers={group.tiers} root {...handlers} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        {hasPeople && (
          <div className="border-t border-[#dce9eb] bg-card/80 px-5 py-2.5">
            <LevelLegend levels={levels} />
          </div>
        )}
      </div>
    </section>
  );
}

export function CommitteesSection({
  view,
  contextOf,
  ...handlers
}: { view: OrgChartView; contextOf: (employeeId: string) => string } & PersonHandlers) {
  return (
    <>
      {view.committees
        .filter((c) => c.members.length > 0 || handlers.editing)
        .map((committee) => (
          <section key={committee.key} className="rounded-lg border border-[#dce9eb] bg-card px-5 py-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
              <h3 className="font-semibold text-foreground">{committee.label}</h3>
              <p className="text-sm text-muted-foreground">{committee.summary}</p>
            </div>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {committee.members.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    data-employee={m.employeeId}
                    onClick={() => handlers.onSelectMember(m)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-[#47cdd0]/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orquestrai-cyan",
                      handlers.highlightId === m.employeeId && "ring-2 ring-orquestrai-cyan"
                    )}
                  >
                    <OrgAvatar name={m.name} photoUrl={m.photoUrl} size={38} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">{m.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {contextOf(m.employeeId) || m.role}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </>
  );
}
