"use client";

import { Fragment } from "react";
import type { OrgChartView, OrgDivisionView, OrgMember, OrgTeamView, OrgTier } from "@/lib/rh/org-chart";
import { cn } from "@/lib/utils";
import { LevelLegend, OrgPill } from "@/components/rh/organograma/org-visuals";
import styles from "@/components/rh/organograma/org-tree.module.css";

type Handlers = {
  highlightId: string | null;
  editing: boolean;
  onSelectMember: (member: OrgMember) => void;
};

/** Níveis empilhados numa coluna: pessoas do mesmo nível ficam juntas. */
function ColumnTiers({ tiers, ...handlers }: { tiers: OrgTier[] } & Handlers) {
  return (
    <>
      {tiers.map((tier, index) => (
        <Fragment key={tier.map((m) => m.id).join("|")}>
          {index > 0 && <div className={styles.stemShort} />}
          <div className="flex flex-col gap-1.5">
            {tier.map((m) => (
              <OrgPill
                key={m.id}
                member={m}
                highlighted={handlers.highlightId === m.employeeId}
                editing={handlers.editing}
                onSelect={handlers.onSelectMember}
              />
            ))}
          </div>
        </Fragment>
      ))}
    </>
  );
}

function TeamColumn({
  team,
  onOpenTeam,
  ...handlers
}: { team: OrgTeamView; onOpenTeam: (key: string) => void } & Handlers) {
  return (
    <>
      <button
        type="button"
        onClick={() => onOpenTeam(team.key)}
        className="rounded-md bg-[var(--orquestrai-surface-to)] px-3.5 py-1.5 text-sm font-medium text-white shadow-[0_6px_14px_-10px_rgba(4,32,47,0.9)] transition-colors hover:bg-[#0a3346] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orquestrai-cyan focus-visible:ring-offset-2"
        title="Abrir equipe"
      >
        {team.label}
      </button>
      {team.members.length === 0 ? (
        <>
          <div className={styles.stemShort} />
          <p className="w-[188px] rounded-md border border-dashed border-[#3e84a8]/30 bg-card/70 px-3 py-2 text-center text-xs text-muted-foreground">
            Equipe a definir
          </p>
        </>
      ) : (
        <>
          {team.tiers.length > 0 && <div className={styles.stemShort} />}
          <ColumnTiers tiers={team.tiers} {...handlers} />
          {team.groups.length > 0 && (
            <>
              {team.tiers.length > 0 && <div className={styles.stemShort} />}
              <div className={styles.row}>
                {team.groups.map((group) => (
                  <div key={group.label} className={styles.branch}>
                    <p className="mb-2 rounded-md border border-[#dce9eb] bg-card px-2.5 py-1 text-xs font-semibold text-[#285f7a]">
                      {group.label}
                    </p>
                    <ColumnTiers tiers={group.tiers} {...handlers} />
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

function DivisionTree({
  view,
  division,
  onOpenTeam,
  ...handlers
}: {
  view: OrgChartView;
  division: OrgDivisionView;
  onOpenTeam: (key: string) => void;
} & Handlers) {
  return (
    <div key={division.key} className={cn(styles.rise, "flex flex-col items-center")}>
      {view.partners.length > 0 && (
        <>
          <div className="flex flex-wrap justify-center gap-2">
            {view.partners.map((m) => (
              <OrgPill
                key={m.id}
                member={m}
                highlighted={handlers.highlightId === m.employeeId}
                editing={handlers.editing}
                onSelect={handlers.onSelectMember}
              />
            ))}
          </div>
          <div className={styles.stem} />
        </>
      )}

      <div className="rounded-lg bg-[linear-gradient(160deg,var(--orquestrai-surface-from),var(--orquestrai-surface-to))] px-6 py-2.5 text-center shadow-[0_10px_24px_-14px_rgba(4,32,47,0.8)]">
        <p className="text-xs font-medium text-[#47cdd0]">Área executiva</p>
        <p className="text-base font-semibold text-white">{division.label}</p>
      </div>

      {division.leaders.map((tier) => (
        <Fragment key={tier.map((m) => m.id).join("|")}>
          <div className={styles.stem} />
          <div className="flex gap-2">
            {tier.map((m) => (
              <OrgPill
                key={m.id}
                member={m}
                highlighted={handlers.highlightId === m.employeeId}
                editing={handlers.editing}
                onSelect={handlers.onSelectMember}
              />
            ))}
          </div>
        </Fragment>
      ))}

      <div className={styles.stem} />
      <div className={cn(styles.row, "items-start")}>
        {division.teams.map((team) => (
          <div key={team.key} className={cn(styles.branch, "px-2.5")}>
            <TeamColumn team={team} onOpenTeam={onOpenTeam} {...handlers} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function OrgFullChart({
  view,
  divisionKey,
  onChangeDivision,
  onOpenTeam,
  ...handlers
}: {
  view: OrgChartView;
  divisionKey: string;
  onChangeDivision: (key: string) => void;
  onOpenTeam: (key: string) => void;
} & Handlers) {
  const division = view.divisions.find((d) => d.key === divisionKey) ?? view.divisions[0];
  return (
    <section
      aria-label={`Organograma completo de ${division.label}`}
      className="overflow-hidden rounded-lg border border-[#dce9eb] bg-card shadow-[0_1px_2px_rgba(4,32,47,0.05)]"
    >
      <div className="flex flex-col gap-3 border-b border-[#dce9eb] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label="Área executiva" className="inline-flex w-fit rounded-md bg-[#eef4f5] p-1">
          {view.divisions.map((d) => {
            const active = d.key === division.key;
            return (
              <button
                key={d.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onChangeDivision(d.key)}
                className={cn(
                  "min-h-9 rounded px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orquestrai-cyan",
                  active
                    ? "bg-card text-[#1c1c1c] shadow-[0_1px_3px_rgba(4,32,47,0.12)]"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {d.label}
              </button>
            );
          })}
        </div>
        <LevelLegend />
      </div>
      <div className={cn(styles.tree, styles.canvas)}>
        <div className="overflow-x-auto">
          <div className="mx-auto w-max min-w-full px-8 pb-10 pt-8">
            <DivisionTree
              key={division.key}
              view={view}
              division={division}
              onOpenTeam={onOpenTeam}
              {...handlers}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
