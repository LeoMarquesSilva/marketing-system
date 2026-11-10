"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  CalendarClock,
  CircleCheck,
  CircleDashed,
  ExternalLink,
  LoaderCircle,
  LockKeyhole,
  Megaphone,
  MonitorPlay,
  PencilLine,
  Settings2,
  Trophy,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { KpiCard } from "@/components/rh/kpi-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatAwardDateTime } from "@/lib/rh/bp-awards/format";
import {
  AWARD_HUBS,
  AWARD_PHASE_LABEL,
  AWARDS_REVEAL_PATH,
  AWARDS_SYMBOL_SRC,
  AWARDS_VOTING_PATH,
  TOTAL_AWARDS,
  resolveAwardPhase,
  slotKey,
  type AwardEdition,
  type AwardFinalist,
  type AwardPhase,
  type CommitteeView,
  type ParticipantOverride,
} from "@/lib/rh/bp-awards/types";
import { cn } from "@/lib/utils";
import { ParticipationPanel } from "./participation-panel";
import { requestJson } from "./request";
import { SettingsPanel } from "./settings-panel";
import { TallyPanel } from "./tally-panel";

type Tab = "apuracao" | "participacao" | "configuracoes";

const TABS: Array<{ key: Tab; label: string; icon: LucideIcon }> = [
  { key: "apuracao", label: "Apuração", icon: Trophy },
  { key: "participacao", label: "Participação", icon: UsersRound },
  { key: "configuracoes", label: "Configurações", icon: Settings2 },
];

const PHASE_STYLE: Record<AwardPhase, string> = {
  rascunho: "bg-slate-100 text-slate-700 ring-slate-200",
  agendada: "bg-sky-50 text-sky-800 ring-sky-200",
  aberta: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  apuracao: "bg-amber-50 text-amber-800 ring-amber-200",
  publicada: "bg-[#0d1e2e] text-[#e1b16d] ring-[#0d1e2e]",
};

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

export function CommitteeClient({ initial }: { initial: CommitteeView }) {
  const router = useRouter();
  const [edition, setEdition] = useState<AwardEdition>(initial.edition);
  const [overrides, setOverrides] = useState<ParticipantOverride[]>(initial.overrides);
  const [finalists, setFinalists] = useState<AwardFinalist[]>(initial.finalists);
  const phase = resolveAwardPhase(edition);
  const [tab, setTab] = useState<Tab>(
    phase === "apuracao" || phase === "publicada" ? "apuracao" : phase === "aberta" ? "participacao" : "configuracoes"
  );
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const participation = initial.participation;
  const stats = useMemo(() => {
    const sent = participation.filter((row) => row.status === "enviou").length;
    const draft = participation.filter((row) => row.status === "rascunho").length;
    return { total: participation.length, sent, draft, pending: participation.length - sent - draft };
  }, [participation]);
  const winners = new Set(
    finalists.filter((finalist) => finalist.is_winner).map((finalist) => slotKey(finalist.hub, finalist.category))
  );
  const allWinners = winners.size === TOTAL_AWARDS;

  const nextStep: Record<AwardPhase, string> = {
    rascunho: "Votação fechada. Ajuste os hubs e, quando for soltar, defina as datas em Configurações.",
    agendada: edition.voting_opens_at
      ? `A votação abre em ${formatAwardDateTime(edition.voting_opens_at)}. Quem entrar no sistema verá o convite.`
      : "",
    aberta: `${stats.sent} de ${stats.total} colaboradores já enviaram. Use Participação para lembrar quem falta.`,
    apuracao: allWinners
      ? `Os ${TOTAL_AWARDS} vencedores estão definidos. Revise as homenagens e ensaie a revelação no telão.`
      : `Escolha até 3 finalistas e o vencedor de cada valor, em cada hub (${winners.size} de ${TOTAL_AWARDS} definidos).`,
    publicada: edition.results_published_at
      ? `Resultado publicado em ${formatAwardDateTime(edition.results_published_at)}: todos veem os vencedores na página do BP Awards.`
      : "",
  };

  /** Área, hub e exceções mudam participação e apuração, que vêm do servidor. */
  function refreshAfterSettings() {
    router.refresh();
  }

  async function setPublished(publish: boolean) {
    setPublishing(true);
    setPublishError(null);
    try {
      const data = await requestJson<{ edition: AwardEdition }>("/api/rh/bp-awards", {
        method: "PATCH",
        body: JSON.stringify({ publish }),
      });
      setEdition(data.edition);
      setPublishOpen(false);
    } catch (cause) {
      setPublishError(cause instanceof Error ? cause.message : "Não foi possível publicar.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="edicao-titulo"
        className="overflow-hidden rounded-lg border border-[#dce9eb] bg-white shadow-xs"
      >
        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-[#0f1f2e]" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={AWARDS_SYMBOL_SRC} alt="" width={613} height={400} className="h-9 w-auto" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="edicao-titulo" className="text-lg font-semibold text-foreground">
                  {edition.title} {edition.year}
                </h2>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", PHASE_STYLE[phase])}>
                  {AWARD_PHASE_LABEL[phase]}
                </span>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CalendarClock className="size-4" aria-hidden />
                  {edition.voting_opens_at && edition.voting_closes_at
                    ? `${formatAwardDateTime(edition.voting_opens_at)} até ${formatAwardDateTime(edition.voting_closes_at)}`
                    : "Datas da votação não definidas"}
                </span>
                <span>{AWARD_HUBS.length} hubs, 5 premiações em cada</span>
                <span>{edition.partners_eligible ? "Sócios de área concorrem" : "Sócios votam, mas não concorrem"}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`${AWARDS_VOTING_PATH}?previa=1`} target="_blank" rel="noopener">
                <ExternalLink className="size-4" aria-hidden />
                Pré-visualizar votação
              </Link>
            </Button>
            <Button asChild variant={phase === "apuracao" ? "default" : "outline"}>
              <Link href={AWARDS_REVEAL_PATH} target="_blank" rel="noopener">
                <MonitorPlay className="size-4" aria-hidden />
                Revelação no telão
              </Link>
            </Button>
            {(phase === "apuracao" || phase === "publicada") && (
              <Button
                type="button"
                variant={phase === "publicada" ? "outline" : "secondary"}
                onClick={() => {
                  setPublishError(null);
                  setPublishOpen(true);
                }}
              >
                <Megaphone className="size-4" aria-hidden />
                {phase === "publicada" ? "Despublicar" : "Publicar resultado"}
              </Button>
            )}
          </div>
        </div>
        <p className="flex items-start gap-2 border-t border-[#dce9eb] bg-[#f7fbfb] px-4 py-2.5 text-sm text-[#285f7a] sm:px-5">
          <LockKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {nextStep[phase]} <span className="text-muted-foreground">Só quem tem RH vê esta tela.</span>
          </span>
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={CircleCheck}
          label="Enviaram"
          value={`${stats.sent}/${stats.total}`}
          hint={stats.total ? `${Math.round((stats.sent / stats.total) * 100)}% dos colaboradores ativos` : "Sem colaboradores"}
        />
        <KpiCard icon={PencilLine} label="Em rascunho" value={stats.draft} hint="Começaram e ainda não enviaram" tone={stats.draft ? "warning" : "neutral"} />
        <KpiCard icon={CircleDashed} label="Não começaram" value={stats.pending} hint="Nenhum valor preenchido" />
        <KpiCard
          icon={Trophy}
          label="Vencedores definidos"
          value={`${winners.size}/${TOTAL_AWARDS}`}
          hint={
            phase === "aberta" && edition.voting_closes_at
              ? `Votação fecha em ${daysUntil(edition.voting_closes_at)} ${daysUntil(edition.voting_closes_at) === 1 ? "dia" : "dias"}`
              : "5 valores em cada um dos 3 hubs"
          }
        />
      </div>

      <div className="space-y-5">
        <div role="tablist" aria-label="Visões" className="flex gap-1 border-b border-[#dce9eb]">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#47cdd0]/50",
                tab === key
                  ? "border-[#347796] text-foreground"
                  : "border-transparent text-muted-foreground hover:border-[#dce9eb] hover:text-foreground"
              )}
            >
              <Icon className={cn("size-4", tab === key ? "text-[#347796]" : "text-muted-foreground")} aria-hidden />
              {label}
            </button>
          ))}
        </div>

        {tab === "configuracoes" ? (
          <SettingsPanel
            edition={edition}
            overrides={overrides}
            people={initial.people}
            onEdition={(next) => {
              setEdition(next);
              refreshAfterSettings();
            }}
            onOverrides={(next) => {
              setOverrides(next);
              refreshAfterSettings();
            }}
          />
        ) : tab === "apuracao" ? (
          <TallyPanel
            tallies={initial.tallies}
            finalists={finalists}
            people={initial.people}
            partial={phase === "aberta"}
            onFinalistsChange={setFinalists}
          />
        ) : (
          <ParticipationPanel rows={participation} />
        )}
      </div>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{phase === "publicada" ? "Despublicar o resultado?" : "Publicar o resultado?"}</DialogTitle>
            <DialogDescription>
              {phase === "publicada"
                ? "A página do BP Awards volta a mostrar só o encerramento da votação, sem os vencedores."
                : "Todos os colaboradores passam a ver os vencedores e as homenagens na página do BP Awards. Faça isso depois da revelação na festa."}
            </DialogDescription>
          </DialogHeader>
          {phase !== "publicada" && !allWinners && (
            <p className="text-sm text-amber-800">
              Faltam vencedores: {TOTAL_AWARDS - winners.size} de {TOTAL_AWARDS} premiações ainda sem definição.
            </p>
          )}
          {publishError && (
            <p className="text-sm text-red-600" role="alert">
              {publishError}
            </p>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setPublishOpen(false)} disabled={publishing}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={publishing || (phase !== "publicada" && !allWinners)}
              onClick={() => void setPublished(phase !== "publicada")}
            >
              {publishing && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
              {phase === "publicada" ? "Despublicar" : "Publicar agora"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
