"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlarmClock, Handshake, Hourglass, Plus, Sprout, UserRound, UserRoundX, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { civilSealSrc, type CivilKey } from "@/lib/rh/pdi/civil";
import { isStale, todayInBrasilia } from "@/lib/rh/pdi/progress";
import { PDI_LEARNING_KINDS, PDI_LEARNING_KIND_ORDER, type PdiOverview, type PdiPerson, type PdiPlanDetail } from "@/lib/rh/pdi/types";
import { cn } from "@/lib/utils";
import { PlanEditorDialog } from "./plan-editor-dialog";
import { PersonPlanCard, WithoutPlan, needsAttention, sortByAttention } from "./plan-list";
import { PlanView } from "./plan-view";
import { BODY, DueBadge, INK, MUTED, PersonPhoto, SURFACE, StatTile, formatDate, kindIconOf } from "./pdi-visuals";

type Tab = "meu" | "equipe";

const CIVIL_ORDER: CivilKey[] = ["cliente", "inovacao", "valorizacao", "inteligencia", "liberdade"];

function EmptyMine({ me, onCreate }: { me: PdiPerson; onCreate: () => void }) {
  return (
<section className="relative overflow-hidden rounded-2xl border border-[#e1ebee] bg-white text-[#0d2a38] shadow-[0_1px_3px_rgba(4,32,47,0.05)]">
      <div aria-hidden className="pointer-events-none absolute -right-32 -top-40 h-80 w-[44rem] rounded-full bg-[radial-gradient(closest-side,#dcf1f1,rgba(220,241,241,0))]" />
      <div className="relative grid gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-center">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
          <PersonPhoto person={me} size="lg" className="size-20 text-xl ring-2 ring-[#E1B16D] ring-offset-[3px] ring-offset-white" />
          <div className="max-w-xl">
            <p className="text-sm font-medium text-[#3e84a8]">Seu plano de desenvolvimento</p>
            <h2 className="mt-1 text-2xl font-semibold leading-tight sm:text-[28px]">Você ainda não tem um PDI ativo</h2>
            <p className="mt-3 text-[15px] leading-6 text-[#3b5560]">
              O PDI organiza o que você quer desenvolver nos próximos meses: frentes ligadas aos valores CIVIL e ações práticas, combinadas com o
              seu gestor.
            </p>
            <button
              type="button"
              onClick={onCreate}
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0f5f70] px-5 text-sm font-semibold text-white outline-none transition-colors hover:bg-[#0c5262] focus-visible:ring-2 focus-visible:ring-[#47cdd0] focus-visible:ring-offset-2"
            >
              <Plus className="size-4" aria-hidden />
              Montar meu PDI
            </button>
          </div>
        </div>
        <div className="space-y-5">
          <ul className="flex flex-wrap gap-3" aria-label="Valores CIVIL">
            {CIVIL_ORDER.map((key) => (
              <li key={key}>
                <span className="grid size-16 place-items-center rounded-xl bg-[#0f1f2e] p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={civilSealSrc(key) ?? ""} alt="" className="size-full object-contain" />
                </span>
              </li>
            ))}
          </ul>
          <ul className="space-y-3">
            {PDI_LEARNING_KIND_ORDER.map((kind) => {
              const Icon = kindIconOf(kind);
              return (
                <li key={kind} className="flex items-center gap-3 text-sm text-[#3b5560]">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#eaf4f6] text-[#1d7086]">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span>
                    <span className="font-semibold text-[#0d2a38]">{PDI_LEARNING_KINDS[kind].share}</span> {PDI_LEARNING_KINDS[kind].label.toLowerCase()} ·{" "}
                    {PDI_LEARNING_KINDS[kind].hint}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

function TabSwitch({ tab, onChange, teamCount }: { tab: Tab; onChange: (tab: Tab) => void; teamCount: number }) {
  const items = [
    { id: "meu" as const, label: "Meu plano", icon: UserRound, count: 0 },
    { id: "equipe" as const, label: "Minha equipe", icon: UsersRound, count: teamCount },
  ];
  return (
    <div className={cn(SURFACE, "inline-flex p-1")} role="tablist" aria-label="Visão do PDI">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={tab === item.id}
          onClick={() => onChange(item.id)}
          className={cn(
            "inline-flex min-h-10 items-center gap-2 rounded-md px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
            tab === item.id ? "bg-[#e8f8f8] text-[#1d5670] shadow-[inset_0_0_0_1px_#47cdd0]" : cn("hover:bg-[#f4fafb]", BODY)
          )}
        >
          <item.icon className="size-4" aria-hidden />
          {item.label}
          {item.count > 0 && (
            <span
              className={cn(
                "rounded-full px-1.5 text-xs tabular-nums",
                tab === item.id ? "bg-[#E1B16D] text-[#0D1E2E]" : "bg-[#eaf2f5] text-[#285f7a]"
              )}
            >
              {item.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function TeamView({ overview, onCreate }: { overview: PdiOverview; onCreate: (person: PdiPerson) => void }) {
  const today = todayInBrasilia();
  const active = overview.teamPlans.filter((plan) => plan.status === "ativo");
  const closed = overview.teamPlans.filter((plan) => plan.status !== "ativo");
  const attention = sortByAttention(active.filter((plan) => needsAttention(plan, today)));
  const onTrack = sortByAttention(active.filter((plan) => !needsAttention(plan, today)));
  const stats = {
    late: active.filter((plan) => plan.due_state === "atrasado").length,
    stale: active.filter((plan) => isStale(plan, today)).length,
    noAgreement: active.filter((plan) => !plan.agreed_at).length,
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile icon={Sprout} value={active.length} label="PDIs ativos" tone="bg-[#e6f0f5] text-[#285f7a]" />
        <StatTile icon={AlarmClock} value={stats.late} label="Atrasados" tone="bg-red-50 text-red-700" />
        <StatTile icon={Hourglass} value={stats.stale} label="Parados há 30+ dias" tone="bg-amber-50 text-amber-700" />
        <StatTile icon={Handshake} value={stats.noAgreement} label="Sem de acordo" tone="bg-[#ecebf3] text-[#48466e]" />
        <StatTile icon={UserRoundX} value={overview.teamWithoutPlan.length} label="Sem PDI" tone="bg-[#f1f5f6] text-[#3b5560]" />
      </div>

      {attention.length > 0 && (
        <section className="space-y-3">
          <h2 className={cn("flex items-center gap-2 text-base font-semibold", INK)}>
            Pedem atenção
            <span className="rounded-full bg-amber-100 px-2 text-xs font-semibold tabular-nums text-amber-800">{attention.length}</span>
          </h2>
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {attention.map((plan) => (
              <PersonPlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        </section>
      )}

      {onTrack.length > 0 && (
        <section className="space-y-3">
          <h2 className={cn("flex items-center gap-2 text-base font-semibold", INK)}>
            No ritmo
            <span className="rounded-full bg-[#eaf2f5] px-2 text-xs font-semibold tabular-nums text-[#285f7a]">{onTrack.length}</span>
          </h2>
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {onTrack.map((plan) => (
              <PersonPlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        </section>
      )}

      {active.length === 0 && (
        <p className={cn(SURFACE, "px-5 py-8 text-center text-sm", MUTED)}>Ninguém da sua equipe tem PDI ativo.</p>
      )}

      <WithoutPlan people={overview.teamWithoutPlan} onCreate={onCreate} />

      {closed.length > 0 && (
        <section className="space-y-3">
          <h2 className={cn("text-base font-semibold", INK)}>Encerrados</h2>
          <ul className={cn(SURFACE, "divide-y divide-[#e6eff1] px-5")}>
            {closed.map((plan) => (
              <li key={plan.id}>
                <Link href={`/pdi/${plan.id}`} className="flex items-center justify-between gap-3 py-3 text-sm outline-none hover:underline">
                  <span className={cn("truncate", INK)}>
                    {plan.employee.name} · {plan.title}
                  </span>
                  <DueBadge state={plan.due_state} daysLeft={plan.days_left} status={plan.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function MeuPdiClient({
  overview,
  selected,
  initialTab,
}: {
  overview: PdiOverview;
  selected: PdiPlanDetail | null;
  initialTab: Tab;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(overview.isLeader ? initialTab : "meu");
  const [creatingFor, setCreatingFor] = useState<PdiPerson | null>(null);
  const otherPlans = overview.myPlans.filter((plan) => plan.id !== selected?.id);
  const teamActive = overview.teamPlans.filter((plan) => plan.status === "ativo").length;

  return (
    <div className="space-y-6">
      {overview.isLeader && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabSwitch tab={tab} onChange={setTab} teamCount={teamActive} />
          {tab === "equipe" && (
            <Button onClick={() => setCreatingFor(overview.teamWithoutPlan[0] ?? overview.creatable[0] ?? null)}>
              <Plus className="size-4" aria-hidden />
              Novo PDI
            </Button>
          )}
        </div>
      )}

      {tab === "meu" && (
        <>
          {selected ? (
            <PlanView key={selected.id} plan={selected} types={overview.types} />
          ) : overview.me ? (
            <EmptyMine me={overview.me} onCreate={() => setCreatingFor(overview.me)} />
          ) : (
            <p className={cn(SURFACE, "px-5 py-6 text-sm", BODY)}>
              Seu usuário ainda não está ligado a um cadastro de colaborador. Fale com Pessoas e Cultura.
            </p>
          )}
          {otherPlans.length > 0 && (
            <section className="space-y-3">
              <h2 className={cn("text-base font-semibold", INK)}>Outros planos</h2>
              <ul className={cn(SURFACE, "divide-y divide-[#e6eff1] px-5")}>
                {otherPlans.map((plan) => (
                  <li key={plan.id}>
                    <Link href={`/pdi?plano=${plan.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3.5 text-sm outline-none hover:underline">
                      <span className="min-w-0">
                        <span className={cn("block truncate font-medium", INK)}>{plan.title}</span>
                        <span className={cn("text-xs", MUTED)}>
                          {formatDate(plan.start_date)} a {formatDate(plan.due_date)} · {plan.progress}%
                        </span>
                      </span>
                      <DueBadge state={plan.due_state} daysLeft={plan.days_left} status={plan.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {tab === "equipe" && <TeamView overview={overview} onCreate={setCreatingFor} />}

      {creatingFor && (
        <PlanEditorDialog
          people={overview.creatable}
          managerOptions={overview.isHr ? overview.creatable : undefined}
          types={overview.types}
          defaultEmployeeId={creatingFor.id}
          onClose={() => setCreatingFor(null)}
          onCreated={(id) => {
            setCreatingFor(null);
            router.push(creatingFor.id === overview.me?.id ? `/pdi?plano=${id}` : `/pdi/${id}`);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

