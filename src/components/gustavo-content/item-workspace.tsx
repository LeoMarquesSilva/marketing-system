"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScoreBadge } from "@/components/gustavo-content/score-badge";
import { SCORE_CRITERIA } from "@/lib/gustavo-content/score";
import { COMPLIANCE_FLAG_LABELS } from "@/lib/gustavo-content/compliance";
import { canSubmitForApproval } from "@/lib/gustavo-content/compliance";
import { GUSTAVO_CONTENT_STATUS_LABELS } from "@/lib/gustavo-content/constants";
import { parseReelScript } from "@/lib/gustavo-content/planner";
import { ANGLE_LABELS, type GustavoContentItem } from "@/lib/gustavo-content/types";
import { cn } from "@/lib/utils";

export function ItemWorkspace({
  itemId,
  isAdmin,
  isOwner,
}: {
  itemId: string;
  isAdmin: boolean;
  isOwner: boolean;
}) {
  const [item, setItem] = useState<GustavoContentItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"linkedin" | "reel">("linkedin");
  const [linkedin, setLinkedin] = useState("");
  const [reel, setReel] = useState("");
  const [answers, setAnswers] = useState<string[]>([]);
  const [rejectReason, setRejectReason] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch(`/api/gustavo-content/items/${itemId}`);
      const data = await response.json().catch(() => ({}));
      if (cancelled) return;
      if (!response.ok) {
        setError(data.error ?? "Não foi possível abrir a pauta.");
        return;
      }
      setItem(data);
      setLinkedin(data.linkedin_post ?? "");
      setReel(data.reel_script ?? "");
      setAnswers(data.gustavo_answers ?? data.gustavo_questions?.map(() => "") ?? []);
      setLinkedinUrl(data.linkedin_published_url ?? "");
      setInstagramUrl(data.instagram_published_url ?? "");
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  async function act(action: string, extra?: Record<string, unknown>) {
    setBusy(action);
    setError(null);
    try {
      const response = await fetch(`/api/gustavo-content/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Ação não concluída.");
      setItem(data);
      setLinkedin(data.linkedin_post ?? "");
      setReel(data.reel_script ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro.");
    } finally {
      setBusy(null);
    }
  }

  if (!item) {
    return <p className="text-sm text-muted-foreground">{error ?? "Carregando pauta…"}</p>;
  }

  const reelParsed = parseReelScript(item.reel_script);
  const canApprove = item.status === "aguardando_aprovacao" && (isOwner || isAdmin);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/conteudo/gustavo/radar" className="text-xs text-[#347796] hover:underline">
            ← Radar
          </Link>
          <p className="mt-2 text-[11px] uppercase tracking-wide text-[#347796]">
            {GUSTAVO_CONTENT_STATUS_LABELS[item.status]}
          </p>
          <h3 className="text-2xl font-semibold text-[#04202f]">{item.title}</h3>
        </div>
        <ScoreBadge score={item.editorial_score} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#347796]">Fonte</p>
            {item.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.image_url}
                alt=""
                className="mt-3 h-36 w-full rounded-xl object-cover"
              />
            )}
            <p className="mt-3 text-sm text-muted-foreground">{item.content_snippet}</p>
            {item.link && (
              <a
                href={item.link}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-sm font-medium text-[#347796] hover:underline"
              >
                Abrir matéria
              </a>
            )}
            {item.published_at && (
              <p className="mt-2 text-xs text-muted-foreground">
                {format(new Date(item.published_at), "dd MMM yyyy", { locale: ptBR })}
              </p>
            )}
            {item.source_context?.extractionWarning && (
              <p className="mt-2 text-xs text-amber-700">{item.source_context.extractionWarning}</p>
            )}
          </section>

          {item.score_breakdown && (
            <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#347796]">
                Score
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{item.score_reason}</p>
              <ul className="mt-3 space-y-2">
                {SCORE_CRITERIA.map((criterion) => (
                  <li key={criterion.key} className="text-sm">
                    <div className="flex justify-between">
                      <span>{criterion.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {item.score_breakdown?.[criterion.key] ?? 0}/{criterion.max}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
                      <div
                        className="h-full bg-[#47cdd0]"
                        style={{
                          width: `${((item.score_breakdown?.[criterion.key] ?? 0) / criterion.max) * 100}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {item.business_problem && (
            <section className="rounded-2xl border border-[#47cdd0]/30 bg-[#e8f8f8] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#285f7a]">
                Problema empresarial
              </p>
              <p className="mt-2 text-base leading-relaxed text-[#04202f]">{item.business_problem}</p>
            </section>
          )}

          {item.source_context?.historyAlert && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {item.source_context.historyAlert}
            </section>
          )}

          {item.source_context && (
            <section className="rounded-2xl border border-black/[0.06] bg-white p-4 text-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#347796]">
                Fatos da fonte
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
                {(item.source_context.facts ?? []).map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="space-y-4">
          {item.angles && item.angles.length > 0 && (
            <section className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#347796]">
                Três ângulos
              </p>
              {item.angles.map((angle, index) => {
                const selected = item.selected_angle?.type === angle.type;
                return (
                  <button
                    key={angle.type}
                    type="button"
                    onClick={() => act("select_angle", { angleIndex: index })}
                    className={cn(
                      "w-full rounded-2xl border p-4 text-left",
                      selected
                        ? "border-[#04202f] bg-[#04202f]/[0.03]"
                        : "border-black/[0.06] bg-white"
                    )}
                  >
                    <p className="text-[11px] uppercase tracking-wide text-[#347796]">
                      {ANGLE_LABELS[angle.type]}
                    </p>
                    <p className="mt-1 font-semibold text-[#04202f]">{angle.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{angle.thesis}</p>
                    <p className="mt-2 text-xs text-[#04202f]/70">{angle.whyItMatters}</p>
                  </button>
                );
              })}
            </section>
          )}

          <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#347796]">Tese</p>
            {item.thesis_snapshot ? (
              <p className="mt-2 whitespace-pre-wrap text-sm text-[#04202f]">{item.thesis_snapshot}</p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Ainda não temos uma opinião registrada.
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {item.opinion_status === "validated" ? "Status: validada" : "A IA não inventa opinião."}
            </p>
          </section>

          {item.status === "aguardando_opiniao" && (item.gustavo_questions?.length ?? 0) > 0 && (
            <section className="rounded-2xl border border-[#04202f]/15 bg-white p-4">
              <h4 className="text-lg font-semibold text-[#04202f]">Precisamos da sua visão</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                A IA propositalmente não gerou opinião. Responda para liberar o rascunho.
              </p>
              <div className="mt-4 space-y-3">
                {item.gustavo_questions?.map((question, index) => (
                  <div key={question}>
                    <p className="text-sm font-medium text-[#04202f]">{question}</p>
                    <Textarea
                      className="mt-1"
                      rows={2}
                      value={answers[index] ?? ""}
                      onChange={(event) => {
                        const next = [...answers];
                        next[index] = event.target.value;
                        setAnswers(next);
                      }}
                    />
                  </div>
                ))}
              </div>
              <Button
                className="mt-3"
                onClick={() => act("answer", { answers })}
                disabled={busy === "answer"}
              >
                Usar minhas respostas
              </Button>
            </section>
          )}

          <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTab("linkedin")}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm",
                  tab === "linkedin" ? "bg-[#04202f] text-white" : "bg-black/[0.04]"
                )}
              >
                LinkedIn
              </button>
              <button
                type="button"
                onClick={() => setTab("reel")}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm",
                  tab === "reel" ? "bg-[#04202f] text-white" : "bg-black/[0.04]"
                )}
              >
                Instagram Reel
              </button>
            </div>

            {tab === "linkedin" ? (
              <Textarea
                className="mt-3 min-h-[280px]"
                value={linkedin}
                onChange={(event) => setLinkedin(event.target.value)}
                placeholder="O post textual aparece aqui depois da geração."
              />
            ) : (
              <div className="mt-3 space-y-2">
                {reelParsed && (
                  <div className="rounded-xl bg-black/[0.03] p-3 text-sm">
                    <p>
                      <strong>Gancho:</strong> {reelParsed.hook}
                    </p>
                    <p className="mt-2">
                      <strong>Fecho:</strong> {reelParsed.closing}
                    </p>
                  </div>
                )}
                <Textarea
                  className="min-h-[200px] font-mono text-xs"
                  value={reel}
                  onChange={(event) => setReel(event.target.value)}
                />
              </div>
            )}

            {(item.alternative_hooks?.length ?? 0) > 0 && (
              <div className="mt-3 text-sm">
                <p className="font-medium text-[#04202f]">Hooks alternativos</p>
                <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                  {item.alternative_hooks?.map((hook) => (
                    <li key={hook}>{hook}</li>
                  ))}
                </ul>
              </div>
            )}

            {item.compliance_flags && item.compliance_flags.flags.length > 0 && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                {item.compliance_flags.flags.map((flag) => (
                  <p key={flag}>{COMPLIANCE_FLAG_LABELS[flag]}</p>
                ))}
              </div>
            )}
          </section>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => act("analyze")} disabled={!!busy}>
              {busy === "analyze" ? "Analisando…" : "Analisar"}
            </Button>
            <Button
              variant="outline"
              onClick={() => act("generate")}
              disabled={!!busy || item.opinion_status !== "validated"}
            >
              {busy === "generate" ? "Gerando…" : "Gerar conteúdo"}
            </Button>
            <Button
              variant="outline"
              onClick={() => act("save", { linkedin_post: linkedin, reel_script: reel })}
              disabled={!!busy}
            >
              Salvar edição
            </Button>
            <Button
              onClick={() => act("submit")}
              disabled={!!busy || !canSubmitForApproval(item.compliance_flags)}
            >
              Enviar para Gustavo
            </Button>
            {canApprove && (
              <Button onClick={() => act("approve")} disabled={!!busy}>
                Aprovar conteúdo
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => act("reject", { reason: rejectReason })}
              disabled={!!busy}
            >
              Solicitar ajuste / rejeitar
            </Button>
          </div>
          <Input
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="Motivo da rejeição (opcional)"
          />

          {item.status === "aprovado" || item.status === "enviado_mkt" || item.status === "publicado" ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => act("planner_linkedin")}
                disabled={!!busy || Boolean(item.marketing_request_linkedin_id)}
              >
                Criar tarefa LinkedIn
              </Button>
              <Button
                variant="outline"
                onClick={() => act("planner_reel")}
                disabled={!!busy || Boolean(item.marketing_request_reel_id)}
              >
                Criar tarefa Reel
              </Button>
            </div>
          ) : null}

          {isAdmin && (
            <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#347796]">
                Publicação
              </p>
              <div className="mt-3 grid gap-2">
                <Input
                  value={linkedinUrl}
                  onChange={(event) => setLinkedinUrl(event.target.value)}
                  placeholder="URL publicada no LinkedIn"
                />
                <Input
                  value={instagramUrl}
                  onChange={(event) => setInstagramUrl(event.target.value)}
                  placeholder="URL publicada no Instagram"
                />
                <Button
                  size="sm"
                  onClick={() =>
                    act("publish", {
                      linkedin_published_url: linkedinUrl,
                      instagram_published_url: instagramUrl,
                    })
                  }
                  disabled={!!busy}
                >
                  Marcar como publicado
                </Button>
              </div>
            </section>
          )}

          {item.approval_kind && (
            <p className="text-xs text-muted-foreground">
              Aprovação: {item.approval_kind === "gustavo" ? "Gustavo" : "exceção administrativa"}
              {item.approved_at
                ? ` em ${format(new Date(item.approved_at), "dd MMM yyyy HH:mm", { locale: ptBR })}`
                : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
