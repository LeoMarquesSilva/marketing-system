"use client";

import { useState } from "react";
import { CalendarClock, CheckCircle2, ExternalLink, Lightbulb, Link2, Loader2, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PDI_LEARNING_KINDS, type PdiAction, type PdiPlanDetail } from "@/lib/rh/pdi/types";
import { cn } from "@/lib/utils";
import { BODY, CivilSeal, INK, KindIcon, MUTED, PersonPhoto, ProgressBar, formatDate, relativeDays } from "./pdi-visuals";

const QUICK_STEPS = [0, 25, 50, 75, 100];

function Detail({ icon: Icon, label, children }: { icon: typeof Target; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg border border-[#e6eff1] bg-[#f9fbfc] px-4 py-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-[#3e84a8]" aria-hidden />
      <div className="min-w-0">
        <p className={cn("text-xs font-medium", MUTED)}>{label}</p>
        <div className={cn("mt-0.5 whitespace-pre-line text-sm", INK)}>{children}</div>
      </div>
    </div>
  );
}

export function ActionDialog({
  plan,
  action,
  onClose,
  onSaved,
}: {
  plan: PdiPlanDetail;
  action: PdiAction;
  onClose: () => void;
  onSaved: (plan: PdiPlanDetail) => void;
}) {
  const canUpdate = plan.permissions.canUpdateProgress;
  const goal = plan.goals.find((item) => item.id === action.goal_id) ?? null;
  const [progress, setProgress] = useState(action.progress);
  const [note, setNote] = useState("");
  const [learnings, setLearnings] = useState(action.learnings ?? "");
  const [evidence, setEvidence] = useState(action.evidence_url ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const history = plan.activity.filter((item) => item.action_id === action.id);
  const kind = action.learning_kind ? PDI_LEARNING_KINDS[action.learning_kind] : null;
  const done = action.progress >= 100;
  const changed =
    progress !== action.progress ||
    note.trim() !== "" ||
    learnings.trim() !== (action.learnings ?? "").trim() ||
    evidence.trim() !== (action.evidence_url ?? "").trim();

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/pdi/acoes/${action.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress, note: note.trim() || null, learnings: learnings.trim() || null, evidence_url: evidence.trim() || null }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível salvar.");
      onSaved(body.plan as PdiPlanDetail);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl" showCloseButton={!saving}>
        <DialogHeader className="gap-0 border-b border-[#e6eef0] px-6 py-5 pr-14 text-left">
          {goal && (
            <p className={cn("mb-3 flex items-center gap-2 text-xs", MUTED)}>
              <CivilSeal competency={goal.competency} className="size-6" />
              <span className="truncate">
                {goal.competency ? `${goal.competency} · ` : ""}
                {goal.title}
              </span>
            </p>
          )}
          <div className="flex items-start gap-3.5">
            <KindIcon kind={action.learning_kind} className="size-11 rounded-lg [&_svg]:size-5" />
            <div className="min-w-0">
              <DialogTitle className={cn("text-lg leading-snug", INK)}>{action.title}</DialogTitle>
              <DialogDescription className="mt-1">
                {kind ? `${kind.label} · ${kind.share} do modelo 70-20-10` : "Ação sem tipo 70-20-10"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <section className="flex items-center gap-5 rounded-lg bg-[#f4f9fa] px-5 py-4">
            <p className="shrink-0 leading-none">
              <span className={cn("text-4xl font-semibold tabular-nums", done ? "text-emerald-700" : INK)}>{action.progress}</span>
              <span className={cn("text-lg", MUTED)}>%</span>
            </p>
            <div className="min-w-0 flex-1 space-y-1.5">
              <ProgressBar value={action.progress} tone={done ? "done" : action.overdue ? "late" : "default"} />
              <p className={cn("text-xs", action.overdue ? "font-medium text-red-700" : MUTED)}>
                {action.completed_at
                  ? `Concluída em ${formatDate(action.completed_at)}`
                  : action.overdue
                    ? `Prazo vencido em ${formatDate(action.due_date)}`
                    : action.last_update_at
                      ? `Última atualização ${relativeDays(action.last_update_at)}`
                      : "Nenhuma atualização registrada ainda"}
              </p>
            </div>
          </section>

          {action.description && (
            <section>
              <h3 className={cn("text-sm font-semibold", INK)}>Como fazer</h3>
              <p className={cn("mt-1.5 whitespace-pre-line text-[15px] leading-6", BODY)}>{action.description}</p>
            </section>
          )}

          {(action.expected_evidence || action.success_indicator || action.due_date || action.evidence_url) && (
            <section className="grid gap-3 sm:grid-cols-2">
              {action.expected_evidence && <Detail icon={CheckCircle2} label="Evidência esperada">{action.expected_evidence}</Detail>}
              {action.success_indicator && <Detail icon={Target} label="Indicador de conclusão">{action.success_indicator}</Detail>}
              {action.due_date && <Detail icon={CalendarClock} label="Prazo da ação">{formatDate(action.due_date)}</Detail>}
              {action.evidence_url && (
                <Detail icon={ExternalLink} label="Evidência entregue">
                  <a href={action.evidence_url} target="_blank" rel="noreferrer" className="font-medium text-[#285f7a] underline-offset-2 hover:underline">
                    Abrir evidência
                  </a>
                </Detail>
              )}
            </section>
          )}

          {!canUpdate && action.learnings && (
            <section>
              <h3 className={cn("flex items-center gap-2 text-sm font-semibold", INK)}>
                <Lightbulb className="size-4 text-[#b58a45]" aria-hidden />
                Aprendizados
              </h3>
              <p className={cn("mt-2 whitespace-pre-line rounded-lg border border-[#e8dcc4] bg-[#fbf7ef] px-4 py-3 text-sm leading-6", INK)}>
                {action.learnings}
              </p>
            </section>
          )}

          {canUpdate && (
            <section className="space-y-5 rounded-lg border border-[#dce9eb] p-5">
              <h3 className={cn("flex items-center gap-2 text-sm font-semibold", INK)}>
                <TrendingUp className="size-4 text-[#3e84a8]" aria-hidden />
                Atualizar esta ação
              </h3>
              <div className="space-y-3">
                <div className="flex items-baseline justify-between gap-3">
                  <Label htmlFor="pdi-progress">Quanto já foi feito</Label>
                  <span className="text-2xl font-semibold tabular-nums text-[#285f7a]">{progress}%</span>
                </div>
                <input
                  id="pdi-progress"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={progress}
                  onChange={(event) => setProgress(Number(event.target.value))}
                  className="h-2 w-full cursor-pointer accent-[#347796]"
                />
                <div className="flex flex-wrap gap-2">
                  {QUICK_STEPS.map((step) => (
                    <button
                      key={step}
                      type="button"
                      onClick={() => setProgress(step)}
                      className={cn(
                        "h-9 rounded-md border px-3.5 text-sm tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60",
                        progress === step
                          ? "border-[#04202f] bg-[#04202f] font-semibold text-white"
                          : "border-[#dce9eb] bg-white text-[#285f7a] hover:border-[#47cdd0]/70 hover:bg-[#47cdd0]/10"
                      )}
                    >
                      {step === 100 ? "Concluí" : `${step}%`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pdi-note">O que avançou desde a última vez?</Label>
                <Textarea id="pdi-note" value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="Ex.: apresentei o fechamento do mês na reunião de área." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pdi-learnings" className="flex items-center gap-1.5">
                  <Lightbulb className="size-3.5 text-[#b58a45]" aria-hidden />
                  Aprendizados
                </Label>
                <Textarea id="pdi-learnings" value={learnings} onChange={(event) => setLearnings(event.target.value)} rows={4} placeholder="Conte seus maiores aprendizados com esta ação." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pdi-evidence" className="flex items-center gap-1.5">
                  <Link2 className="size-3.5 text-[#3e84a8]" aria-hidden />
                  Link da evidência (opcional)
                </Label>
                <Input
                  id="pdi-evidence"
                  type="url"
                  inputMode="url"
                  value={evidence}
                  onChange={(event) => setEvidence(event.target.value)}
                  placeholder="https://… (certificado, documento no SharePoint, apresentação)"
                />
              </div>
            </section>
          )}

          {history.length > 0 && (
            <section>
              <h3 className={cn("text-sm font-semibold", INK)}>Histórico desta ação</h3>
              <ul className="mt-3 space-y-3">
                {history.map((item) => (
                  <li key={item.id} className="flex gap-3">
                    <PersonPhoto person={{ name: item.author_name ?? "?", avatar_url: item.author_avatar_url }} size="xs" className="mt-0.5 size-7" />
                    <div className="min-w-0 text-sm">
                      <p className={INK}>
                        <span className="font-semibold">{item.author_name?.split(" ")[0] ?? "Alguém"}</span>{" "}
                        {item.kind === "progresso" && item.progress_from !== item.progress_to
                          ? `levou de ${item.progress_from}% para ${item.progress_to}%`
                          : item.kind === "comentario"
                            ? "comentou"
                            : "registrou uma atualização"}
                        <span className={cn("text-xs", MUTED)}> · {relativeDays(item.created_at)}</span>
                      </p>
                      {item.body && <p className={cn("mt-0.5 whitespace-pre-line", BODY)}>{item.body}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-3 border-t border-[#e6eef0] px-6 py-4 sm:justify-between">
          <p className="min-w-0 text-sm text-red-700" role="alert">
            {error}
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              {canUpdate ? "Cancelar" : "Fechar"}
            </Button>
            {canUpdate && (
              <Button onClick={save} disabled={saving || !changed}>
                {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Salvar
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
