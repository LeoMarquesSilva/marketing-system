"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Expand,
  ExternalLink,
  Eye,
  Image as ImageIcon,
  LoaderCircle,
  MessageSquareQuote,
  Pencil,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PE27_PROVOCACOES } from "@/lib/pe27/conteudo";
import {
  DECISIONS,
  DECISION_ACTIONS,
  DIMENSION_LABELS,
  DIMENSIONS,
  formatPe27DateTime,
  staysInPlan,
  type Decision,
  type Dimension,
  type Pe27Board,
  type Pe27Goal,
  type Pe27Group,
  type Pe27Lever,
} from "@/lib/pe27/types";
import { DIMENSION_TONES, DecisionBadge, DimensionTile, PersonLine, countDecisions, plural, requestJson } from "./shared";

type StatusFilter = "todas" | "em_analise" | "no_plano" | "juntada" | "descartada";

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: "todas", label: "Todas" },
  { id: "em_analise", label: "Em análise" },
  { id: "no_plano", label: "No plano" },
  { id: "juntada", label: "Juntadas" },
  { id: "descartada", label: "Descartadas" },
];

function matchesFilter(status: Decision, filter: StatusFilter): boolean {
  if (filter === "todas") return true;
  if (filter === "no_plano") return staysInPlan(status);
  return status === filter;
}

type ItemTarget = { kind: "lever"; leverId: string } | { kind: "goal"; goalId: string };
type CreateTarget = { kind: "lever"; dimension: Dimension } | { kind: "goal"; leverId: string };

/* ------------------------------------------------------------------ pequenos */

function TranscriptionHint({ note }: { note: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label={`Nota da transcrição: ${note}`}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-[#9c7434] outline-none hover:bg-[#fdf3e3] focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/30"
        >
          <MessageSquareQuote className="size-3.5" aria-hidden />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{note}</TooltipContent>
    </Tooltip>
  );
}

function findLever(board: Pe27Board, id: string | null): Pe27Lever | undefined {
  return id ? board.levers.find((lever) => lever.id === id) : undefined;
}

function findGoal(board: Pe27Board, id: string | null): { goal: Pe27Goal; lever: Pe27Lever } | undefined {
  if (!id) return undefined;
  for (const lever of board.levers) {
    const goal = lever.goals.find((item) => item.id === id);
    if (goal) return { goal, lever };
  }
  return undefined;
}

/* ------------------------------------------------------------------ cartaz */

function PosterDialog({ group, onOpenChange }: { group: Pe27Group | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={Boolean(group)} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Cartaz · {group?.name}</DialogTitle>
          <DialogDescription>Foto tirada no workshop de 05/11. A transcrição desta tela foi feita a partir dela.</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-[50dvh] flex-1 items-center justify-center overflow-auto bg-[#f4f7f8] p-4">
          {group?.poster_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={group.poster_url}
              alt={`Cartaz do ${group.name}`}
              className="mx-auto max-h-[70dvh] w-auto rounded-md object-contain shadow-sm"
            />
          )}
        </div>
        <DialogFooter className="border-t px-6 py-3">
          {group?.poster_url && (
            <Button asChild variant="outline">
              <a href={group.poster_url} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" aria-hidden />
                Abrir em tamanho original
              </a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ alavanca */

function GoalRow({ goal, onOpen }: { goal: Pe27Goal; onOpen: () => void }) {
  const discarded = goal.status === "descartada" || goal.status === "juntada";
  return (
    <li className="flex items-center gap-1">
      <button
        type="button"
        onClick={onOpen}
        className="group flex min-h-10 min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors outline-none hover:bg-[#f2f8f9] focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/30"
      >
        <Target className={cn("size-4 shrink-0", discarded ? "text-muted-foreground/60" : "text-[#3e84a8]")} aria-hidden />
        <span
          className={cn(
            "min-w-0 flex-1 text-sm leading-5",
            discarded ? "text-muted-foreground line-through decoration-muted-foreground/50" : "text-foreground",
          )}
        >
          {goal.text}
          {goal.target && !discarded && <span className="ml-2 text-xs font-medium text-[#285f7a] no-underline">Alvo: {goal.target}</span>}
        </span>
        {/* Meta ainda sem decisão fica sem selo: o que já foi decidido salta aos olhos na reunião. */}
        {goal.status === "em_analise" ? <span className="sr-only">Em análise</span> : <DecisionBadge status={goal.status} />}
      </button>
      {goal.transcription_note ? <TranscriptionHint note={goal.transcription_note} /> : <span className="w-6 shrink-0" aria-hidden />}
    </li>
  );
}

function LeverItem({
  lever,
  number,
  filter,
  board,
  onOpenItem,
  onCreateGoal,
}: {
  lever: Pe27Lever;
  number: number;
  filter: StatusFilter;
  board: Pe27Board;
  onOpenItem: (target: ItemTarget) => void;
  onCreateGoal: (leverId: string) => void;
}) {
  const goals = lever.goals.filter((goal) => matchesFilter(goal.status, filter));
  const hidden = lever.goals.length - goals.length;
  const mergedInto = lever.status === "juntada" ? findLever(board, lever.merged_into) : undefined;
  const out = lever.status === "descartada" || lever.status === "juntada";
  const tone = DIMENSION_TONES[lever.dimension];

  return (
    <li className="px-4 py-4 sm:px-5">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md text-sm font-semibold tabular-nums",
            out ? "bg-muted text-muted-foreground" : tone.tile,
          )}
          aria-hidden
        >
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3
              className={cn(
                "text-base leading-6 font-semibold",
                out ? "text-muted-foreground line-through decoration-muted-foreground/50" : "text-foreground",
              )}
            >
              {lever.title}
            </h3>
            <DecisionBadge status={lever.status} />
            {!lever.group_id && (
              <span className="rounded-full bg-[#fdf3e3] px-2 py-0.5 text-xs font-medium text-[#8a6224]">Criada na revisão</span>
            )}
            {lever.transcription_note && <TranscriptionHint note={lever.transcription_note} />}
          </div>
          {mergedInto && (
            <p className="mt-1 text-xs text-muted-foreground">
              Juntada em <span className="font-medium text-foreground">{mergedInto.title}</span> ({DIMENSION_LABELS[mergedInto.dimension]})
            </p>
          )}
          {lever.decision_note && <p className="mt-1 text-sm leading-6 text-[#315f73]">{lever.decision_note}</p>}

          {goals.length > 0 && (
            <ul className="mt-2 -ml-2 max-w-3xl space-y-0.5" aria-label={`Metas sugeridas para ${lever.title}`}>
              {goals.map((goal) => (
                <GoalRow key={goal.id} goal={goal} onOpen={() => onOpenItem({ kind: "goal", goalId: goal.id })} />
              ))}
            </ul>
          )}
          {lever.goals.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Nenhuma meta sugerida ainda.</p>}
          {hidden > 0 && filter !== "todas" && (
            <p className="mt-1 text-xs text-muted-foreground">{plural(hidden, "meta fora do filtro", "metas fora do filtro")}</p>
          )}

          {board.can_edit && (
            <Button variant="ghost" size="sm" className="mt-1 -ml-2" onClick={() => onCreateGoal(lever.id)}>
              <Plus className="size-4" aria-hidden />
              Meta
            </Button>
          )}
        </div>
        <Button variant="outline" size="sm" className="shrink-0" onClick={() => onOpenItem({ kind: "lever", leverId: lever.id })}>
          {board.can_edit ? "Decidir" : "Ver"}
        </Button>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ dimensão */

function DimensionSection({
  dimension,
  board,
  filter,
  onOpenItem,
  onCreate,
  onOpenPoster,
}: {
  dimension: Dimension;
  board: Pe27Board;
  filter: StatusFilter;
  onOpenItem: (target: ItemTarget) => void;
  onCreate: (target: CreateTarget) => void;
  onOpenPoster: (group: Pe27Group) => void;
}) {
  const group = board.groups.find((item) => item.dynamic === 2 && item.dimension === dimension);
  const allLevers = board.levers.filter((lever) => lever.dimension === dimension);
  const levers = allLevers.filter(
    (lever) => matchesFilter(lever.status, filter) || lever.goals.some((goal) => matchesFilter(goal.status, filter)),
  );
  const provocacoes = PE27_PROVOCACOES[dimension];
  const counts = countDecisions(allLevers);

  return (
    <section
      id={dimension}
      aria-labelledby={`pe27-${dimension}`}
      className="scroll-mt-24 overflow-hidden rounded-lg border border-[#dce9eb] bg-white"
    >
      <div className="flex gap-4 border-b border-[#e6eef0] px-4 py-4 sm:px-5">
        <DimensionTile dimension={dimension} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 id={`pe27-${dimension}`} className="text-lg leading-7 font-semibold text-foreground">
            {DIMENSION_LABELS[dimension]}
          </h2>
          <p className="text-sm text-muted-foreground">
            {plural(counts.levers.total, "alavanca", "alavancas")} · {plural(counts.goals.total, "meta", "metas")} ·{" "}
            {counts.levers.decided + counts.goals.decided} de {counts.levers.total + counts.goals.total} decididos
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/85">{provocacoes.central}</p>
        </div>
        {group?.poster_url && (
          <button
            type="button"
            onClick={() => onOpenPoster(group)}
            className="group relative hidden h-28 w-[84px] shrink-0 overflow-hidden rounded-md border border-[#dce9eb] bg-[#f4f7f8] outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/40 sm:block"
            aria-label={`Ver o cartaz do ${group.name}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={group.poster_url} alt="" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-[#04202f]/75 py-1 text-xs font-medium text-white">
              <Expand className="size-3" aria-hidden />
              Cartaz
            </span>
          </button>
        )}
      </div>

      {group && group.members.length > 0 && (
        <div className="border-b border-[#e6eef0] bg-[#fbfdfd] px-4 py-4 sm:px-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">
              {group.name} · {plural(group.members.length, "pessoa", "pessoas")}
            </p>
            {group.poster_url && (
              <Button variant="ghost" size="sm" className="sm:hidden" onClick={() => onOpenPoster(group)}>
                <ImageIcon className="size-4" aria-hidden />
                Ver cartaz
              </Button>
            )}
          </div>
          <ul className="grid gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
            {group.members.map((member) => (
              <li key={member.id} className="min-w-0">
                <PersonLine person={member} detail={member.area} badge={member.is_area_partner ? "Sócio de área" : null} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="group/prov border-b border-[#e6eef0]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-[#285f7a] outline-none hover:bg-[#f7fbfb] focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/30 focus-visible:ring-inset sm:px-5 [&::-webkit-details-marker]:hidden">
          Provocações entregues ao grupo
          <span className="text-xs text-muted-foreground group-open/prov:hidden">Mostrar</span>
          <span className="hidden text-xs text-muted-foreground group-open/prov:inline">Esconder</span>
        </summary>
        <ol className="list-decimal space-y-1.5 px-4 pb-4 pl-9 text-sm leading-6 text-foreground/85 marker:text-muted-foreground sm:px-5 sm:pl-10">
          {provocacoes.perguntas.map((pergunta) => (
            <li key={pergunta}>{pergunta}</li>
          ))}
        </ol>
      </details>

      {levers.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-5">
          Nada com esse filtro em {DIMENSION_LABELS[dimension]}.
        </p>
      ) : (
        <ol className="divide-y divide-[#eef3f4]">
          {levers.map((lever) => (
            <LeverItem
              key={lever.id}
              lever={lever}
              number={allLevers.indexOf(lever) + 1}
              filter={filter}
              board={board}
              onOpenItem={onOpenItem}
              onCreateGoal={(leverId) => onCreate({ kind: "goal", leverId })}
            />
          ))}
        </ol>
      )}

      {board.can_edit && (
        <div className="border-t border-[#e6eef0] px-4 py-3 sm:px-5">
          <Button variant="ghost" size="sm" className="-ml-2" onClick={() => onCreate({ kind: "lever", dimension })}>
            <Plus className="size-4" aria-hidden />
            Nova alavanca em {DIMENSION_LABELS[dimension]}
          </Button>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ decisão */

function ReadField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 text-sm leading-6", value ? "text-foreground" : "text-muted-foreground")}>{value || "Não informado"}</dd>
    </div>
  );
}

function ItemDialog({
  board,
  target,
  onClose,
  onSaved,
}: {
  board: Pe27Board;
  target: ItemTarget;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const lever = target.kind === "lever" ? findLever(board, target.leverId) : undefined;
  const goalHit = target.kind === "goal" ? findGoal(board, target.goalId) : undefined;
  const item = lever ?? goalHit?.goal;
  const parentLever = goalHit?.lever ?? lever;

  const [status, setStatus] = useState<Decision>(item?.status ?? "em_analise");
  const [mergedInto, setMergedInto] = useState<string>(item?.merged_into ?? "");
  const [decisionNote, setDecisionNote] = useState(item?.decision_note ?? "");
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(lever?.title ?? goalHit?.goal.text ?? "");
  const [dimension, setDimension] = useState<Dimension>(lever?.dimension ?? "clientes");
  const [leverId, setLeverId] = useState(goalHit?.lever.id ?? "");
  const [baseline, setBaseline] = useState(goalHit?.goal.baseline ?? "");
  const [goalTarget, setGoalTarget] = useState(goalHit?.goal.target ?? "");
  const [dataSource, setDataSource] = useState(goalHit?.goal.data_source ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mergeOptions = useMemo(() => {
    const keep = (status: Decision) => status !== "juntada" && status !== "descartada";
    return DIMENSIONS.map((dim) => {
      const levers = board.levers.filter((item) => item.dimension === dim);
      const options =
        target.kind === "lever"
          ? levers.filter((item) => item.id !== target.leverId && keep(item.status)).map((item) => ({ id: item.id, label: item.title }))
          : levers.flatMap((item) =>
              item.goals
                .filter((goal) => goal.id !== target.goalId && keep(goal.status))
                .map((goal) => ({
                  id: goal.id,
                  label: `${goal.text} · ${item.title}`,
                })),
            );
      return { dimension: dim, options };
    }).filter((group) => group.options.length > 0);
  }, [board, target]);

  if (!item || !parentLever) return null;

  const isLever = target.kind === "lever";
  const original = isLever ? lever?.original_title : goalHit?.goal.original_text;
  const current = isLever ? lever?.title : goalHit?.goal.text;
  const fromWorkshop = original !== null && original !== undefined;
  const group = board.groups.find((entry) => entry.id === parentLever.group_id);
  const readOnly = !board.can_edit;
  const mergedLabel =
    item.status === "juntada"
      ? isLever
        ? (findLever(board, item.merged_into)?.title ?? null)
        : (findGoal(board, item.merged_into)?.goal.text ?? null)
      : null;

  async function save() {
    if (status === "juntada" && !mergedInto) {
      setError(`Escolha com qual ${isLever ? "alavanca" : "meta"} ela foi juntada.`);
      return;
    }
    setSaving(true);
    setError(null);
    const body: Record<string, unknown> = {
      status,
      merged_into: status === "juntada" ? mergedInto : null,
      decision_note: decisionNote,
    };
    if (editing) {
      if (isLever) {
        body.title = text;
        body.dimension = dimension;
      } else {
        body.text = text;
        body.lever_id = leverId;
        body.baseline = baseline;
        body.target = goalTarget;
        body.data_source = dataSource;
      }
    }
    try {
      await requestJson(isLever ? `/api/pe27/alavancas/${item!.id}` : `/api/pe27/metas/${item!.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      await onSaved(`${isLever ? "Alavanca" : "Meta"} salva.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    setError(null);
    try {
      await requestJson(isLever ? `/api/pe27/alavancas/${item!.id}` : `/api/pe27/metas/${item!.id}`, { method: "DELETE" });
      await onSaved(`${isLever ? "Alavanca" : "Meta"} apagada.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível apagar.");
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-4 pr-12">
          <DialogDescription className="flex items-center gap-2">
            <DimensionTile dimension={parentLever.dimension} size="sm" />
            {isLever ? `Alavanca · ${DIMENSION_LABELS[parentLever.dimension]}` : `Meta · ${parentLever.title}`}
          </DialogDescription>
          <DialogTitle className="text-lg leading-7">{current}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* Origem */}
          <div className="rounded-md bg-[#f7fbfb] px-4 py-3 text-sm leading-6">
            {fromWorkshop ? (
              <>
                <p className="text-muted-foreground">
                  Veio do cartaz do <span className="font-medium text-foreground">{group?.name ?? "workshop"}</span>
                  {original !== current && (
                    <>
                      , onde estava escrito <span className="font-medium text-foreground">“{original}”</span>
                    </>
                  )}
                  .
                </p>
                {item.transcription_note && (
                  <p className="mt-1 flex gap-2 text-[#7a5a26]">
                    <MessageSquareQuote className="mt-1 size-3.5 shrink-0" aria-hidden />
                    {item.transcription_note}
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Criada na revisão, fora dos cartazes do workshop.</p>
            )}
          </div>

          {/* Decisão: quem tem só leitura vê o que foi decidido, sem os controles. */}
          {readOnly ? (
            <section className="space-y-2" aria-labelledby="pe27-decisao">
              <h3 id="pe27-decisao" className="text-sm font-semibold text-foreground">
                Decisão dos sócios
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <DecisionBadge status={item.status} />
                {mergedLabel && (
                  <span>
                    com <span className="font-medium text-foreground">{mergedLabel}</span>
                  </span>
                )}
              </div>
              <p className={cn("text-sm leading-6", item.decision_note ? "text-foreground" : "text-muted-foreground")}>
                {item.decision_note || "Sem observação."}
              </p>
            </section>
          ) : (
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-foreground">Decisão dos sócios</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Decisão">
                {DECISIONS.map((option) => {
                  const selected = status === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setStatus(option)}
                      className={cn(
                        "flex min-h-11 items-center justify-center gap-2 rounded-md border px-2 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/30",
                        selected
                          ? "border-[#347796] bg-[#347796] text-white"
                          : "border-[#dce9eb] bg-white text-foreground hover:border-[#47cdd0]/60",
                      )}
                    >
                      {DECISION_ACTIONS[option]}
                    </button>
                  );
                })}
              </div>

              {status === "juntada" && (
                <div className="space-y-1.5">
                  <Label htmlFor="pe27-merge">Juntar com</Label>
                  <Select value={mergedInto} onValueChange={setMergedInto}>
                    <SelectTrigger id="pe27-merge" className="w-full">
                      <SelectValue placeholder={isLever ? "Escolha a alavanca que fica" : "Escolha a meta que fica"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {mergeOptions.map((groupOption) => (
                        <SelectGroup key={groupOption.dimension}>
                          <SelectLabel>{DIMENSION_LABELS[groupOption.dimension]}</SelectLabel>
                          {groupOption.options.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">O item continua registrado, apontando para o que ficou no plano.</p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="pe27-decision-note">Observação da decisão</Label>
                <Textarea
                  id="pe27-decision-note"
                  value={decisionNote}
                  onChange={(event) => setDecisionNote(event.target.value)}
                  maxLength={2000}
                  rows={3}
                  placeholder="O que foi decidido e por quê (opcional)"
                />
              </div>
            </fieldset>
          )}

          {/* Texto e dados */}
          <section className="space-y-3" aria-labelledby="pe27-dados">
            <div className="flex items-center justify-between gap-3">
              <h3 id="pe27-dados" className="text-sm font-semibold text-foreground">
                {isLever ? "Texto e dimensão" : "Texto e dados da meta"}
              </h3>
              {!editing && !readOnly && (
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="size-4" aria-hidden />
                  Editar
                </Button>
              )}
            </div>

            {!editing ? (
              <dl className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <ReadField label={isLever ? "Alavanca" : "Meta"} value={current ?? null} />
                </div>
                {isLever ? (
                  <ReadField label="Dimensão" value={DIMENSION_LABELS[parentLever.dimension]} />
                ) : (
                  <>
                    <ReadField label="Alavanca" value={parentLever.title} />
                    <ReadField label="Fonte do dado" value={goalHit?.goal.data_source ?? null} />
                    <ReadField label="Ponto de partida (2026)" value={goalHit?.goal.baseline ?? null} />
                    <ReadField label="Alvo para 2027" value={goalHit?.goal.target ?? null} />
                  </>
                )}
              </dl>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="pe27-text">{isLever ? "Alavanca" : "Meta"}</Label>
                  <Input id="pe27-text" value={text} onChange={(event) => setText(event.target.value)} maxLength={isLever ? 200 : 300} />
                </div>
                {isLever ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="pe27-dimension">Dimensão</Label>
                    <Select value={dimension} onValueChange={(value) => setDimension(value as Dimension)}>
                      <SelectTrigger id="pe27-dimension" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DIMENSIONS.map((dim) => (
                          <SelectItem key={dim} value={dim}>
                            {DIMENSION_LABELS[dim]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="pe27-lever">Alavanca</Label>
                      <Select value={leverId} onValueChange={setLeverId}>
                        <SelectTrigger id="pe27-lever" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-80">
                          {DIMENSIONS.map((dim) => (
                            <SelectGroup key={dim}>
                              <SelectLabel>{DIMENSION_LABELS[dim]}</SelectLabel>
                              {board.levers
                                .filter((item) => item.dimension === dim)
                                .map((item) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.title}
                                  </SelectItem>
                                ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pe27-baseline">Ponto de partida (2026)</Label>
                      <Input id="pe27-baseline" value={baseline} onChange={(event) => setBaseline(event.target.value)} maxLength={200} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pe27-target">Alvo para 2027</Label>
                      <Input id="pe27-target" value={goalTarget} onChange={(event) => setGoalTarget(event.target.value)} maxLength={200} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="pe27-source">Fonte do dado</Label>
                      <Input
                        id="pe27-source"
                        value={dataSource}
                        onChange={(event) => setDataSource(event.target.value)}
                        maxLength={200}
                        placeholder="De onde sai o número (ex.: pesquisa de NPS, VIOS, financeiro)"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </section>

          {error && (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 border-t px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-h-9 items-center gap-2 text-xs text-muted-foreground">
            {!fromWorkshop &&
              !readOnly &&
              (confirmDelete ? (
                <>
                  <span className="text-sm text-foreground">Apagar de vez?</span>
                  <Button variant="destructive" size="sm" onClick={remove} disabled={saving}>
                    Apagar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} disabled={saving}>
                    Não
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 text-destructive hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4" aria-hidden />
                  Apagar
                </Button>
              ))}
            {(fromWorkshop || readOnly) && item.updated_by_name && (
              <span>
                Alterado por {item.updated_by_name} em {formatPe27DateTime(item.updated_at)}
              </span>
            )}
          </div>
          {readOnly ? (
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={saving || (editing && !text.trim())}>
                {saving && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
                Salvar
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ criação */

function CreateDialog({
  board,
  target,
  onClose,
  onSaved,
}: {
  board: Pe27Board;
  target: CreateTarget;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [dimension, setDimension] = useState<Dimension>(target.kind === "lever" ? target.dimension : "clientes");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lever = target.kind === "goal" ? findLever(board, target.leverId) : undefined;
  const isLever = target.kind === "lever";

  async function create() {
    setSaving(true);
    setError(null);
    try {
      if (isLever) {
        await requestJson("/api/pe27/alavancas", {
          method: "POST",
          body: JSON.stringify({ dimension, title: text }),
        });
      } else {
        await requestJson("/api/pe27/metas", {
          method: "POST",
          body: JSON.stringify({ lever_id: lever?.id, text }),
        });
      }
      await onSaved(isLever ? "Alavanca criada." : "Meta criada.");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar.");
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{isLever ? "Nova alavanca" : "Nova meta"}</DialogTitle>
          <DialogDescription>
            {isLever
              ? "Para o que os sócios incluírem na revisão. Fica marcada como criada fora dos cartazes."
              : `Em ${lever?.title ?? "alavanca"} (${lever ? DIMENSION_LABELS[lever.dimension] : ""}).`}
          </DialogDescription>
        </DialogHeader>
        <form
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5"
          id="pe27-create"
          onSubmit={(event) => {
            event.preventDefault();
            if (text.trim()) void create();
          }}
        >
          {isLever && (
            <div className="space-y-1.5">
              <Label htmlFor="pe27-new-dimension">Dimensão</Label>
              <Select value={dimension} onValueChange={(value) => setDimension(value as Dimension)}>
                <SelectTrigger id="pe27-new-dimension" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIMENSIONS.map((dim) => (
                    <SelectItem key={dim} value={dim}>
                      {DIMENSION_LABELS[dim]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="pe27-new-text">{isLever ? "Alavanca" : "Meta"}</Label>
            <Input
              id="pe27-new-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={isLever ? 200 : 300}
              autoFocus
              placeholder={isLever ? "Ex.: Experiência do cliente" : "Ex.: NPS de clientes acima de 75"}
            />
          </div>
          {error && (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
        <DialogFooter className="border-t px-6 py-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="pe27-create" disabled={saving || !text.trim()}>
            {saving && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ tela */

export function Pe27Insumos({ initialBoard, initialDimension }: { initialBoard: Pe27Board; initialDimension: Dimension | null }) {
  const [board, setBoard] = useState(initialBoard);
  const [dimension, setDimension] = useState<Dimension | null>(initialDimension);
  const [filter, setFilter] = useState<StatusFilter>("todas");
  const [openItem, setOpenItem] = useState<ItemTarget | null>(null);
  const [creating, setCreating] = useState<CreateTarget | null>(null);
  const [poster, setPoster] = useState<Pe27Group | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(async (message: string) => {
    const next = await requestJson<Pe27Board>("/api/pe27");
    setBoard(next);
    setNotice(message);
    window.setTimeout(() => setNotice((current) => (current === message ? null : current)), 3500);
  }, []);

  function chooseDimension(next: Dimension | null) {
    setDimension(next);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("dimensao", next);
    else url.searchParams.delete("dimensao");
    window.history.replaceState(null, "", url);
  }

  const visibleLevers = dimension ? board.levers.filter((lever) => lever.dimension === dimension) : board.levers;
  const counts = countDecisions(board.levers);
  const filterCounts = useMemo(() => {
    const all = visibleLevers.flatMap((lever) => [lever.status, ...lever.goals.map((goal) => goal.status)]);
    return Object.fromEntries(
      STATUS_FILTERS.map((option) => [option.id, all.filter((status) => matchesFilter(status, option.id)).length]),
    ) as Record<StatusFilter, number>;
  }, [visibleLevers]);
  const dimensions = dimension ? [dimension] : DIMENSIONS;

  return (
    <TooltipProvider>
      <div className="space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Dimensão">
              {[null, ...DIMENSIONS].map((option) => {
                const selected = dimension === option;
                const total = option ? board.levers.filter((lever) => lever.dimension === option).length : board.levers.length;
                return (
                  <button
                    key={option ?? "todas"}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => chooseDimension(option)}
                    className={cn(
                      "inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/30",
                      selected
                        ? "border-[#347796] bg-[#347796] text-white"
                        : "border-[#dce9eb] bg-white text-foreground hover:border-[#47cdd0]/60",
                    )}
                  >
                    {option ? DIMENSION_LABELS[option] : "Todas as dimensões"}
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-xs leading-5 tabular-nums",
                        selected ? "bg-white/20 text-white" : "bg-[#eaf2f5] text-[#285f7a]",
                      )}
                    >
                      {total}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Decisão">
              {STATUS_FILTERS.map((option) => {
                const selected = filter === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setFilter(option.id)}
                    className={cn(
                      "inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/30",
                      selected ? "bg-[#04202f] text-white" : "text-[#315f73] hover:bg-[#47cdd0]/10",
                    )}
                  >
                    {option.label}
                    <span className={cn("tabular-nums", selected ? "text-white/75" : "text-muted-foreground")}>
                      {filterCounts[option.id]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <p className="text-muted-foreground" aria-live="polite">
              {notice ? <span className="font-medium text-emerald-700">{notice}</span> : "Ficam no plano:"}{" "}
              {!notice && (
                <span className="font-semibold text-foreground tabular-nums">
                  {plural(counts.levers.inPlan, "alavanca", "alavancas")} · {plural(counts.goals.inPlan, "meta", "metas")}
                </span>
              )}
            </p>
            {board.can_edit ? (
              <Button
                onClick={() =>
                  setCreating({
                    kind: "lever",
                    dimension: dimension ?? "clientes",
                  })
                }
              >
                <Plus className="size-4" aria-hidden />
                Nova alavanca
              </Button>
            ) : (
              <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[#eaf2f5] px-3 text-xs font-medium text-[#285f7a]">
                <Eye className="size-3.5" aria-hidden />
                Só leitura
              </span>
            )}
          </div>
        </div>

        {dimensions.map((dim) => (
          <DimensionSection
            key={dim}
            dimension={dim}
            board={board}
            filter={filter}
            onOpenItem={setOpenItem}
            onCreate={setCreating}
            onOpenPoster={setPoster}
          />
        ))}

        {openItem && (
          <ItemDialog
            key={openItem.kind === "lever" ? openItem.leverId : openItem.goalId}
            board={board}
            target={openItem}
            onClose={() => setOpenItem(null)}
            onSaved={reload}
          />
        )}
        {creating && <CreateDialog board={board} target={creating} onClose={() => setCreating(null)} onSaved={reload} />}
        <PosterDialog group={poster} onOpenChange={(open) => !open && setPoster(null)} />
      </div>
    </TooltipProvider>
  );
}
