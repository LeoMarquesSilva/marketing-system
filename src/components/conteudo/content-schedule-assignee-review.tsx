"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  CircleHelp,
  Loader2,
  RefreshCw,
  Sparkles,
  UserRoundCheck,
  UserRoundX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { likelySamePerson } from "@/lib/content-schedule/assignee-issues";
import { normalizeScheduleArea } from "@/lib/content-schedule/domain";
import type {
  ContentScheduleAssigneeIssue,
  ContentScheduleAssigneeReviewResponse,
  ContentScheduleCollaborator,
} from "@/lib/content-schedule/types";
import { cn } from "@/lib/utils";
import { AreaMark, CollaboratorAvatar } from "./content-schedule-visuals";

const REASONS = {
  inactive: { label: "Ex-colaborador", Icon: UserRoundX, tone: "border-red-200 bg-red-50 text-red-800" },
  abbreviated: { label: "Nome abreviado", Icon: Sparkles, tone: "border-sky-200 bg-sky-50 text-sky-800" },
  moved_area: { label: "Mudou de área", Icon: ArrowRightLeft, tone: "border-amber-200 bg-amber-50 text-amber-800" },
  placeholder: { label: "Pessoa a definir", Icon: CircleHelp, tone: "border-slate-200 bg-slate-50 text-slate-700" },
  ambiguous: { label: "Mais de uma pessoa", Icon: CircleHelp, tone: "border-amber-200 bg-amber-50 text-amber-800" },
  unmatched: { label: "Sem correspondência", Icon: AlertTriangle, tone: "border-amber-200 bg-amber-50 text-amber-800" },
} as const;

async function readError(response: Response) {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error || "Não foi possível concluir a associação.";
}

function countLabel(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function AssigneeIssueCard({
  issue,
  collaborators,
  selectedId,
  saving,
  onSelect,
  onConfirm,
}: {
  issue: ContentScheduleAssigneeIssue;
  collaborators: ContentScheduleCollaborator[];
  selectedId: string;
  saving: boolean;
  onSelect: (id: string) => void;
  onConfirm: () => void;
}) {
  const reason = REASONS[issue.reason];
  const areaCollaborators = collaborators.filter((person) =>
    normalizeScheduleArea(person.department) === normalizeScheduleArea(issue.area) &&
    (issue.mode === "future_replacement" || likelySamePerson(issue.sourceName, person.name))
  );
  const selected = areaCollaborators.find((person) => person.id === selectedId);
  const buttonLabel = issue.mode === "identity" ? "Associar identidade" : "Reatribuir próximas";
  const helper = issue.mode === "identity"
    ? `${countLabel(issue.affectedSlotCount, "tarefa será associada", "tarefas serão associadas")}, inclusive o histórico.`
    : `${countLabel(issue.futureSlotCount, "próxima será reatribuída", "próximas serão reatribuídas")}; ${countLabel(issue.pastSlotCount, "passada fica preservada", "passadas ficam preservadas")}.`;

  return (
    <article className={cn("overflow-hidden rounded-lg border bg-white shadow-[0_10px_28px_rgba(24,63,80,.06)]", issue.reason === "inactive" ? "border-red-200" : "border-[#dce9eb]")}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e8f0f2] bg-[#f8fbfb] px-4 py-3">
        <div className="min-w-0">
          <AreaMark area={issue.area} compact />
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Nome na planilha</p>
          <h4 className="truncate text-lg font-semibold text-[#183f50]">{issue.sourceName}</h4>
        </div>
        <Badge variant="outline" className={cn("gap-1.5", reason.tone)}><reason.Icon className="size-3.5" />{reason.label}</Badge>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid grid-cols-3 divide-x divide-[#e8f0f2] rounded-md border border-[#e8f0f2] bg-white py-2 text-center">
          <div><strong className="block font-mono text-lg text-slate-900">{issue.slotCount}</strong><span className="text-[10px] uppercase tracking-wide text-slate-500">Total</span></div>
          <div><strong className="block font-mono text-lg text-slate-900">{issue.pastSlotCount}</strong><span className="text-[10px] uppercase tracking-wide text-slate-500">Passadas</span></div>
          <div><strong className="block font-mono text-lg text-[#285f7a]">{issue.futureSlotCount}</strong><span className="text-[10px] uppercase tracking-wide text-slate-500">Próximas</span></div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-slate-700">Associar a</p>
          <Select value={selectedId || undefined} onValueChange={onSelect}>
            <SelectTrigger className="w-full bg-white" aria-label={`Associar ${issue.sourceName} a uma pessoa`}>
              {selected ? (
                <span className="flex min-w-0 items-center gap-2">
                  <CollaboratorAvatar person={{ name: selected.name, avatarUrl: selected.avatar_url }} />
                  <span className="truncate">{selected.name}</span>
                </span>
              ) : <SelectValue placeholder="Escolher colaborador da área" />}
            </SelectTrigger>
            <SelectContent>
              {areaCollaborators.map((person) => (
                <SelectItem value={person.id} key={person.id} className="py-2">
                  <span className="flex items-center gap-2">
                    <CollaboratorAvatar person={{ name: person.name, avatarUrl: person.avatar_url }} />
                    <span>{person.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {issue.suggestedCollaboratorName && <p className="mt-1.5 text-xs text-sky-700">Sugestão pelo nome: {issue.suggestedCollaboratorName}</p>}
          {!areaCollaborators.length && <p className="mt-1.5 text-xs text-amber-700">Nenhum colaborador compatível está ativo nesta área.</p>}
        </div>

        <div className={cn("rounded-md px-3 py-2 text-xs", issue.mode === "identity" ? "bg-sky-50 text-sky-800" : "bg-amber-50 text-amber-900")}>{helper}</div>
        <Button
          className="w-full bg-[#347796] text-white hover:bg-[#285f7a]"
          disabled={!selectedId || saving || issue.affectedSlotCount === 0}
          onClick={onConfirm}
        >
          {saving ? <Loader2 className="animate-spin" /> : <UserRoundCheck />}
          {issue.affectedSlotCount === 0 ? "Sem tarefas futuras" : buttonLabel}
        </Button>
      </div>
    </article>
  );
}

export function ContentScheduleAssigneeReview({ year, onUpdated }: { year: number; onUpdated: (message: string) => Promise<void> }) {
  const [data, setData] = useState<ContentScheduleAssigneeReviewResponse | null>(null);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/content-schedule/assignees?year=${year}`, { cache: "no-store" });
      if (!response.ok) throw new Error(await readError(response));
      const payload = await response.json() as ContentScheduleAssigneeReviewResponse;
      setData(payload);
      setSelection((current) => {
        const next = { ...current };
        for (const issue of payload.issues) {
          if (!next[issue.key] && issue.suggestedCollaboratorId) next[issue.key] = issue.suggestedCollaboratorId;
        }
        return next;
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os nomes pendentes.");
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => {
    const issues = data?.issues ?? [];
    return {
      total: issues.length,
      inactive: issues.filter((issue) => issue.reason === "inactive").length,
      abbreviated: issues.filter((issue) => issue.mode === "identity").length,
      replacement: issues.filter((issue) => issue.mode === "future_replacement").length,
    };
  }, [data]);
  const groups = useMemo(() => {
    const grouped = new Map<string, ContentScheduleAssigneeIssue[]>();
    for (const issue of data?.issues ?? []) {
      grouped.set(issue.area, [...(grouped.get(issue.area) ?? []), issue]);
    }
    return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right, "pt-BR"));
  }, [data]);

  async function confirm(issue: ContentScheduleAssigneeIssue) {
    const collaboratorId = selection[issue.key] || issue.suggestedCollaboratorId;
    if (!collaboratorId) return;
    setSaving(issue.key);
    setError(null);
    try {
      const response = await fetch("/api/content-schedule/assignees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          area: issue.area,
          source_name: issue.sourceName,
          collaborator_id: collaboratorId,
          mode: issue.mode,
        }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const result = await response.json() as { updated: number };
      await onUpdated(`${result.updated} ${result.updated === 1 ? "tarefa atualizada" : "tarefas atualizadas"}.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível associar o responsável.");
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="size-5 animate-spin text-[#347796]" />Carregando nomes da planilha…</div>;
  if (error && !data) return <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center"><AlertTriangle className="size-7 text-amber-600" /><p className="text-sm text-slate-700">{error}</p><Button variant="outline" onClick={() => void load()}><RefreshCw />Tentar novamente</Button></div>;
  if (!data?.issues.length) return <div className="flex min-h-64 flex-col items-center justify-center p-6 text-center"><UserRoundCheck className="size-9 text-emerald-600" /><h3 className="mt-3 font-semibold text-slate-900">Todos os nomes estão associados</h3><p className="mt-1 max-w-md text-sm text-slate-500">Não há abreviações ou responsáveis antigos aguardando revisão em {year}.</p></div>;

  return (
    <div className="space-y-5 p-4 sm:p-5">
      <section className="overflow-hidden rounded-lg bg-[#183f50] text-white shadow-[0_18px_40px_rgba(24,63,80,.16)]">
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#82e6e2]">Conferência da importação</p>
            <h3 className="mt-1 text-xl font-semibold">Quem é quem no cronograma</h3>
            <p className="mt-1 max-w-2xl text-sm text-slate-200">Confirme abreviações e indique substitutos para nomes antigos. Nenhuma sugestão é aplicada sem sua confirmação.</p>
          </div>
          <div className="grid grid-cols-4 divide-x divide-white/15 rounded-md border border-white/15 bg-white/5 text-center">
            {[{ label: "Nomes", value: totals.total }, { label: "Abreviados", value: totals.abbreviated }, { label: "Ex-colab.", value: totals.inactive }, { label: "Substituir", value: totals.replacement }].map((item) => (
              <div key={item.label} className="min-w-20 px-3 py-2"><strong className="block font-mono text-lg">{item.value}</strong><span className="text-[9px] uppercase tracking-wide text-slate-300">{item.label}</span></div>
            ))}
          </div>
        </div>
      </section>
      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      <div className="space-y-7">
        {groups.map(([area, issues]) => (
          <section key={area} aria-labelledby={`assignee-area-${area}`}>
            <div className="mb-3 flex items-center justify-between border-b border-[#dce9eb] pb-2">
              <h4 id={`assignee-area-${area}`} className="font-semibold text-[#183f50]"><AreaMark area={area} /></h4>
              <span className="rounded-full border border-[#dce9eb] bg-white px-2.5 py-1 text-xs font-medium tabular-nums text-slate-600">{countLabel(issues.length, "nome", "nomes")}</span>
            </div>
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {issues.map((issue) => (
                <AssigneeIssueCard
                  key={issue.key}
                  issue={issue}
                  collaborators={data.collaborators}
                  selectedId={selection[issue.key] || issue.suggestedCollaboratorId || ""}
                  saving={saving === issue.key}
                  onSelect={(id) => setSelection((current) => ({ ...current, [issue.key]: id }))}
                  onConfirm={() => void confirm(issue)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
