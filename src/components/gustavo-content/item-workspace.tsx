"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  LoaderCircle,
  Save,
  Send,
  ShieldCheck,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScoreBadge } from "@/components/gustavo-content/score-badge";
import { SCORE_CRITERIA } from "@/lib/gustavo-content/score";
import { COMPLIANCE_FLAG_LABELS } from "@/lib/gustavo-content/compliance";
import { GUSTAVO_CONTENT_STATUS_LABELS } from "@/lib/gustavo-content/constants";
import { parseReelScript } from "@/lib/gustavo-content/planner";
import { ANGLE_LABELS, type GustavoContentItem } from "@/lib/gustavo-content/types";
import { cn } from "@/lib/utils";
import {
  EditorialError,
  EditorialLoading,
} from "@/components/gustavo-content/editorial-states";

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
  const [copied, setCopied] = useState(false);

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
      setAnswers(
        Array.isArray(data.gustavo_answers) && data.gustavo_answers.length > 0
          ? data.gustavo_answers
          : data.gustavo_questions?.map(() => "") ?? []
      );
      setLinkedinUrl(data.linkedin_published_url ?? "");
      setInstagramUrl(data.instagram_published_url ?? "");
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  async function patchItem(action: string, extra?: Record<string, unknown>) {
    const response = await fetch(`/api/gustavo-content/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error ?? "Ação não concluída.");
    }
    return data as GustavoContentItem;
  }

  function applyItem(next: GustavoContentItem) {
    setItem(next);
    setLinkedin(next.linkedin_post ?? "");
    setReel(next.reel_script ?? "");
    if (Array.isArray(next.gustavo_answers) && next.gustavo_answers.length > 0) {
      setAnswers(next.gustavo_answers);
    }
  }

  async function act(action: string, extra?: Record<string, unknown>) {
    setBusy(action);
    setError(null);
    try {
      applyItem(await patchItem(action, extra));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir esta ação.");
    } finally {
      setBusy(null);
    }
  }

  async function submitVision(skip: boolean) {
    setBusy(skip ? "skip" : "answer");
    setError(null);
    try {
      applyItem(await patchItem("answer", { answers, skip }));
      setBusy("generate");
      applyItem(await patchItem("generate"));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : skip
            ? "Não foi possível seguir sem registrar a visão."
            : "Não foi possível usar as respostas."
      );
    } finally {
      setBusy(null);
    }
  }

  if (!item && error) return <EditorialError message={error} />;
  if (!item) return <EditorialLoading label="Abrindo a mesa desta pauta" />;

  const reelParsed = parseReelScript(reel) ?? {};
  const canApprove = item.status === "aguardando_aprovacao" && (isOwner || isAdmin);
  const dirty = linkedin !== (item.linkedin_post ?? "") || reel !== (item.reel_script ?? "");
  const linkedinCharacters = linkedin.length;
  const canReanalyze = ["radar", "sugestao", "aguardando_opiniao", "rascunho"].includes(item.status);
  const canReject = !["publicado", "arquivado"].includes(item.status);

  function updateReelField(
    field: "duration" | "hook" | "talkingPoints" | "closing" | "recordingNote",
    value: string
  ) {
    const current = parseReelScript(reel) ?? {};
    const next = {
      duration: current.duration ?? "60s",
      hook: current.hook ?? "",
      talkingPoints: current.talkingPoints ?? [],
      closing: current.closing ?? "",
      recordingNote: current.recordingNote ?? "",
      [field]: field === "talkingPoints"
        ? value.split("\n").map((point) => point.trim()).filter(Boolean)
        : value,
    };
    setReel(JSON.stringify(next));
  }

  async function copyLinkedin() {
    await navigator.clipboard.writeText(linkedin);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/conteudo/gustavo/radar" className="text-xs text-[#347796] hover:underline">
            ← Radar
          </Link>
          <p className="editorial-kicker mt-3 font-mono text-[11px] uppercase text-[#347796]">
            {GUSTAVO_CONTENT_STATUS_LABELS[item.status]}
          </p>
          <h3 className="editorial-display mt-2 max-w-4xl text-3xl font-semibold leading-tight text-[#04202f]">{item.title}</h3>
        </div>
        <ScoreBadge score={item.editorial_score} />
      </div>

      <WorkflowRail status={item.status} />

      {(busy || error) && (
        <ActionBanner
          busy={busy}
          error={error}
          onRetry={
            item.opinion_status === "validated" && !item.linkedin_post
              ? () => void act("generate")
              : undefined
          }
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
        <aside className="space-y-4 lg:sticky lg:top-5 lg:self-start">
          <section className="overflow-hidden rounded-[1.35rem] bg-white/85 shadow-[0_18px_48px_rgba(4,32,47,0.055)]">
            <div className="p-5">
            <p className="editorial-kicker font-mono text-[11px] uppercase text-[#347796]">Evidência de origem</p>
            {item.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.image_url}
                alt=""
                className="mt-4 aspect-[16/8] w-full rounded-lg object-cover"
              />
            )}
            <p className="mt-4 text-sm leading-6 text-[#526b75]">{item.content_snippet}</p>
            {item.link && (
              <a
                href={item.link}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#347796] hover:underline"
              >
                Abrir matéria <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            )}
            {item.published_at && (
              <p className="mt-2 text-xs text-muted-foreground">
                {format(new Date(item.published_at), "dd MMM yyyy", { locale: ptBR })}
              </p>
            )}
            {item.source_context?.extractionWarning && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">{item.source_context.extractionWarning}</p>
            )}
            </div>
          </section>

          {item.score_breakdown && (
            <section className="rounded-[1.35rem] bg-white/70 p-5">
              <p className="editorial-kicker font-mono text-[11px] uppercase text-[#347796]">
                Leitura do score
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

          {item.source_context?.historyAlert && (
            <section className="rounded-[1.2rem] bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              {item.source_context.historyAlert}
            </section>
          )}

          {item.source_context && (
            <section className="rounded-[1.35rem] bg-white/70 p-5 text-sm">
              <p className="editorial-kicker font-mono text-[11px] uppercase text-[#347796]">
                Base factual
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
                {(item.source_context.facts ?? []).map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
              {(item.source_context.numbers?.length ?? 0) > 0 && (
                <div className="mt-4 border-t border-[#04202f]/[0.07] pt-3">
                  <p className="text-xs font-semibold text-[#04202f]">Números citáveis</p>
                  <p className="mt-1 text-xs leading-5 text-[#6f858d]">{item.source_context.numbers.join(" · ")}</p>
                </div>
              )}
            </section>
          )}
        </aside>

        <div className="space-y-4">
          {item.business_problem && (
            <section className="relative overflow-hidden rounded-[1.5rem] bg-[#e4f5f5] px-5 py-6 sm:px-7">
              <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full border border-[#347796]/10" />
              <p className="editorial-kicker font-mono text-[11px] uppercase text-[#285f7a]">
                O que realmente importa
              </p>
              <p className="editorial-display mt-3 max-w-3xl text-xl font-semibold leading-7 text-[#04202f] sm:text-2xl">
                {item.business_problem}
              </p>
            </section>
          )}
          {item.angles && item.angles.length > 0 && (
            <section className="space-y-3 rounded-[1.5rem] bg-white/80 p-5 sm:p-6">
              <p className="editorial-kicker font-mono text-[11px] uppercase text-[#347796]">
                Escolha editorial · três leituras possíveis
              </p>
              {item.angles.map((angle, index) => {
                const selected = item.selected_angle?.type === angle.type;
                return (
                  <button
                    key={angle.type}
                    type="button"
                    onClick={() => act("select_angle", { angleIndex: index })}
                    className={cn(
                      "group w-full rounded-xl border-l-2 px-4 py-4 text-left transition-all",
                      selected
                        ? "border-[#347796] bg-[#e4f5f5] shadow-[0_10px_32px_rgba(4,32,47,0.055)]"
                        : "border-transparent bg-[#04202f]/[0.025] hover:bg-[#04202f]/[0.05]"
                    )}
                  >
                    <p className="editorial-kicker font-mono text-[10px] uppercase text-[#347796]">
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

          <section className="rounded-[1.35rem] bg-[#04202f] p-5 text-white sm:p-6">
            <p className="editorial-kicker font-mono text-[11px] uppercase text-[#7fe1e3]">Tese do Gustavo</p>
            {item.thesis_snapshot ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/85">{item.thesis_snapshot}</p>
            ) : (
              <p className="mt-3 text-sm text-white/60">
                Ainda não temos uma opinião registrada.
              </p>
            )}
            <p className="mt-3 text-xs text-white/45">
              {item.opinion_status === "validated" ? "Status: validada" : "A IA não inventa opinião."}
            </p>
          </section>

          {item.status === "aguardando_opiniao" &&
            item.opinion_status !== "validated" &&
            (item.gustavo_questions?.length ?? 0) > 0 && (
            <section className="rounded-2xl border border-[#04202f]/15 bg-white p-5">
              <h4 className="text-lg font-semibold text-[#04202f]">Precisamos da sua visão</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                A IA propositalmente não gerou opinião. Responda para liberar o rascunho, ou
                siga só com o ângulo já escolhido.
              </p>
              <div className="mt-4 space-y-3">
                {item.gustavo_questions?.map((question, index) => (
                  <div key={question}>
                    <p className="text-sm font-medium text-[#04202f]">{question}</p>
                    <Textarea
                      className="mt-1"
                      rows={2}
                      value={answers[index] ?? ""}
                      disabled={!!busy}
                      onChange={(event) => {
                        const next = [...answers];
                        next[index] = event.target.value;
                        setAnswers(next);
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => void submitVision(false)} disabled={!!busy}>
                  {busy === "answer" || busy === "generate" ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                      {busy === "answer" ? "Salvando respostas…" : "Gerando rascunho…"}
                    </>
                  ) : (
                    "Usar minhas respostas"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void submitVision(true)}
                  disabled={!!busy}
                >
                  {busy === "skip" ? "Seguindo sem visão…" : "Seguir sem registrar visão"}
                </Button>
              </div>
              <p className="mt-3 text-xs leading-5 text-[#6f858d]">
                Sem uma visão escrita, o rascunho usa só o ângulo escolhido e a estratégia. A IA
                não inventa uma opinião no seu lugar.
              </p>
            </section>
          )}

          {item.opinion_status === "validated" && !item.linkedin_post && (
            <section className="rounded-2xl border border-[#347796]/20 bg-[#e4f5f5] p-5">
              <h4 className="text-lg font-semibold text-[#04202f]">Visão registrada</h4>
              <p className="mt-1 text-sm text-[#4f6872]">
                {busy === "generate"
                  ? "Gerando LinkedIn e Reel. Isso pode levar até um minuto."
                  : "O rascunho ainda não foi gerado. Pode tentar de novo sem refazer as respostas."}
              </p>
              {(item.gustavo_answers?.length ?? 0) > 0 && (
                <ul className="mt-3 space-y-2 text-sm leading-6 text-[#294d5a]">
                  {item.gustavo_answers?.map((answer) => (
                    <li key={answer} className="rounded-lg bg-white/70 px-3 py-2">
                      {answer}
                    </li>
                  ))}
                </ul>
              )}
              <Button
                className="mt-4"
                onClick={() => void act("generate")}
                disabled={!!busy}
              >
                {busy === "generate" ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                    Gerando rascunho…
                  </>
                ) : (
                  <>
                    <WandSparkles className="h-4 w-4" aria-hidden />
                    Gerar rascunho
                  </>
                )}
              </Button>
            </section>
          )}

          <section className="rounded-[1.5rem] bg-white/85 p-5 shadow-[0_20px_60px_rgba(4,32,47,0.055)] sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="editorial-kicker font-mono text-[11px] uppercase text-[#347796]">Estúdio de conteúdo</p>
                <p className="mt-1 text-sm text-[#6f858d]">Edite sem perder a versão original da IA.</p>
              </div>
              {dirty && <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">alterações não salvas</span>}
            </div>
            <div className="mt-5 flex gap-2 border-b border-[#04202f]/[0.08]">
              <button
                type="button"
                onClick={() => setTab("linkedin")}
                className={cn(
                  "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  tab === "linkedin" ? "border-[#347796] text-[#04202f]" : "border-transparent text-[#6f858d] hover:text-[#04202f]"
                )}
              >
                LinkedIn
              </button>
              <button
                type="button"
                onClick={() => setTab("reel")}
                className={cn(
                  "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  tab === "reel" ? "border-[#347796] text-[#04202f]" : "border-transparent text-[#6f858d] hover:text-[#04202f]"
                )}
              >
                Instagram Reel
              </button>
            </div>

            {tab === "linkedin" ? (
              <div className="mt-4">
                <Textarea
                  className="min-h-[360px] resize-y border-0 bg-[#f5f8f8] px-4 py-4 text-[0.95rem] leading-7 shadow-none focus-visible:ring-[#347796]"
                  value={linkedin}
                  onChange={(event) => setLinkedin(event.target.value)}
                  placeholder="O post textual aparece aqui depois da geração."
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-[#6f858d]">
                  <span className="font-mono tabular-nums">{linkedinCharacters} caracteres · {linkedin.trim() ? linkedin.trim().split(/\s+/).length : 0} palavras</span>
                  <button type="button" onClick={() => void copyLinkedin()} disabled={!linkedin} className="inline-flex items-center gap-1.5 font-semibold text-[#347796] disabled:opacity-40">
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copiado" : "Copiar texto"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 grid gap-4">
                <div className="grid gap-4 sm:grid-cols-[7rem_1fr]">
                  <label className="grid gap-1.5 text-xs font-semibold text-[#36535f]">
                    Duração
                    <Input value={reelParsed.duration ?? ""} onChange={(event) => updateReelField("duration", event.target.value)} placeholder="60s" />
                  </label>
                  <label className="grid gap-1.5 text-xs font-semibold text-[#36535f]">
                    Gancho falado
                    <Input value={reelParsed.hook ?? ""} onChange={(event) => updateReelField("hook", event.target.value)} />
                  </label>
                </div>
                <label className="grid gap-1.5 text-xs font-semibold text-[#36535f]">
                  Pontos de fala · um por linha
                  <Textarea className="min-h-36 bg-[#f5f8f8] leading-6" value={(reelParsed.talkingPoints ?? []).join("\n")} onChange={(event) => updateReelField("talkingPoints", event.target.value)} />
                </label>
                <label className="grid gap-1.5 text-xs font-semibold text-[#36535f]">
                  Fecho
                  <Textarea rows={2} value={reelParsed.closing ?? ""} onChange={(event) => updateReelField("closing", event.target.value)} />
                </label>
                <label className="grid gap-1.5 text-xs font-semibold text-[#36535f]">
                  Orientação de gravação
                  <Input value={reelParsed.recordingNote ?? ""} onChange={(event) => updateReelField("recordingNote", event.target.value)} />
                </label>
              </div>
            )}

            {(item.alternative_hooks?.length ?? 0) > 0 && (
              <div className="mt-3 text-sm">
                <p className="font-medium text-[#04202f]">Hooks alternativos</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.alternative_hooks?.map((hook) => (
                    <button
                      key={hook}
                      type="button"
                      onClick={() => setLinkedin((current) => current ? `${hook}\n\n${current.replace(/^[\s\S]*?(\n\n|$)/, "")}` : hook)}
                      className="rounded-lg bg-[#04202f]/[0.045] px-3 py-2 text-left text-xs leading-5 text-[#36535f] transition-colors hover:bg-[#e4f5f5]"
                    >
                      {hook}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {item.compliance_flags && item.compliance_flags.flags.length > 0 && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                {item.compliance_flags.flags.map((flag) => (
                  <p key={flag}>{COMPLIANCE_FLAG_LABELS[flag]}</p>
                ))}
              </div>
            )}
            {!item.compliance_flags && (linkedin || reel) && (
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#04202f]/[0.035] p-3 text-sm text-[#526b75]">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#347796]" aria-hidden />
                A revisão de compliance será refeita com o texto atual antes do envio.
              </div>
            )}
          </section>

          <section className="rounded-[1.4rem] bg-[#04202f] p-5 text-white sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="editorial-kicker font-mono text-[11px] uppercase text-[#7fe1e3]">Próximo passo</p>
                <p className="mt-2 text-sm text-white/60">
                  {nextStepText(item.status, dirty, item.opinion_status, Boolean(item.linkedin_post), busy)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {dirty && (
                  <Button onClick={() => act("save", { linkedin_post: linkedin, reel_script: reel })} disabled={!!busy} className="bg-[#7fe1e3] text-[#04202f] hover:bg-white">
                    <Save className="h-4 w-4" aria-hidden /> {busy === "save" ? "Salvando…" : "Salvar alterações"}
                  </Button>
                )}
                {!dirty && item.opinion_status === "validated" && !item.linkedin_post && (
                  <Button onClick={() => void act("generate")} disabled={!!busy} className="bg-[#7fe1e3] text-[#04202f] hover:bg-white">
                    {busy === "generate" ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <WandSparkles className="h-4 w-4" aria-hidden />
                    )}
                    {busy === "generate" ? "Gerando rascunho…" : "Gerar rascunho"}
                  </Button>
                )}
                {!dirty && item.status === "rascunho" && (item.linkedin_post || item.reel_script) && (
                  <Button onClick={() => act("submit")} disabled={!!busy} className="bg-[#7fe1e3] text-[#04202f] hover:bg-white">
                    <Send className="h-4 w-4" aria-hidden /> {busy === "submit" ? "Revisando…" : "Revisar e enviar"}
                  </Button>
                )}
                {canApprove && (
                  <Button onClick={() => act("approve")} disabled={!!busy} className="bg-[#7fe1e3] text-[#04202f] hover:bg-white">
                    <Check className="h-4 w-4" aria-hidden /> Aprovar conteúdo
                  </Button>
                )}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
              {canReanalyze && (
                <Button size="sm" variant="ghost" onClick={() => act("analyze")} disabled={!!busy} className="text-white/70 hover:bg-white/10 hover:text-white">
                  {busy === "analyze" ? "Analisando…" : "Refazer análise"}
                </Button>
              )}
              {canReanalyze && item.opinion_status === "validated" && item.linkedin_post && (
                <Button size="sm" variant="ghost" onClick={() => void act("generate")} disabled={!!busy} className="text-white/70 hover:bg-white/10 hover:text-white">
                  {busy === "generate" ? "Gerando nova versão…" : "Gerar nova versão"}
                </Button>
              )}
              {canReject && <details className="ml-auto text-sm text-white/60">
                <summary className="cursor-pointer select-none hover:text-white">Solicitar ajuste ou rejeitar</summary>
                <div className="mt-3 grid min-w-[18rem] gap-2 rounded-xl bg-white/10 p-3">
                  <Input value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Motivo da decisão" className="border-white/15 bg-white text-[#04202f]" />
                  <Button variant="destructive" size="sm" onClick={() => act("reject", { reason: rejectReason })} disabled={!!busy}>
                    Confirmar rejeição
                  </Button>
                </div>
              </details>}
            </div>
          </section>

          {isAdmin && (item.status === "aprovado" || item.status === "enviado_mkt" || item.status === "publicado") ? (
            <section className="rounded-[1.35rem] bg-white/75 p-5">
              <p className="editorial-kicker font-mono text-[11px] uppercase text-[#347796]">Produção no Planner</p>
              <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => act("planner_linkedin")}
                disabled={!!busy || Boolean(item.marketing_request_linkedin_id)}
              >
                {item.marketing_request_linkedin_id ? "LinkedIn enviado" : "Criar tarefa LinkedIn"}
              </Button>
              <Button
                variant="outline"
                onClick={() => act("planner_reel")}
                disabled={!!busy || Boolean(item.marketing_request_reel_id)}
              >
                {item.marketing_request_reel_id ? "Reel enviado" : "Criar tarefa Reel"}
              </Button>
              </div>
            </section>
          ) : null}

          {isAdmin && (
            <section className="rounded-[1.35rem] bg-white/75 p-5">
              <p className="editorial-kicker font-mono text-[11px] uppercase text-[#347796]">
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

const WORKFLOW_STAGES = [
  { label: "Leitura", statuses: ["radar", "sugestao", "aguardando_opiniao"] },
  { label: "Redação", statuses: ["rascunho"] },
  { label: "Aprovação", statuses: ["aguardando_aprovacao", "aprovado"] },
  { label: "Produção", statuses: ["enviado_mkt"] },
  { label: "Publicado", statuses: ["publicado", "arquivado"] },
] as const;

function WorkflowRail({ status }: { status: GustavoContentItem["status"] }) {
  if (status === "rejeitado") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-900">
        <AlertTriangle className="h-4 w-4" aria-hidden /> Conteúdo rejeitado ou devolvido para ajuste.
      </div>
    );
  }
  const current = WORKFLOW_STAGES.findIndex((stage) =>
    (stage.statuses as readonly string[]).includes(status)
  );
  return (
    <ol className="grid grid-cols-5 overflow-hidden rounded-xl bg-white/60 p-1" aria-label="Progresso editorial">
      {WORKFLOW_STAGES.map((stage, index) => (
        <li key={stage.label} className={cn("relative px-2 py-2 text-center font-mono text-[10px] sm:text-xs", index <= current ? "text-[#04202f]" : "text-[#8da0a7]") }>
          <span className={cn("mx-auto mb-1 block h-1 rounded-full", index <= current ? "bg-[#347796]" : "bg-[#04202f]/10")} />
          {stage.label}
        </li>
      ))}
    </ol>
  );
}

function nextStepText(
  status: GustavoContentItem["status"],
  dirty: boolean,
  opinionStatus: GustavoContentItem["opinion_status"],
  hasDraft: boolean,
  busy: string | null
): string {
  if (busy === "generate") return "Gerando LinkedIn e Reel. Isso pode levar até um minuto.";
  if (busy === "answer" || busy === "skip") return "Registrando a visão para liberar a redação.";
  if (dirty) return "Salve as alterações para preservar a trilha de edição.";
  if (status === "aguardando_opiniao" && opinionStatus === "validated" && !hasDraft) {
    return "Visão registrada. Agora geramos o rascunho.";
  }
  if (status === "aguardando_opiniao") return "Aguardando uma resposta do Gustavo para liberar a redação.";
  if (status === "rascunho") return "Faça a revisão final; o compliance será recalculado no envio.";
  if (status === "aguardando_aprovacao") return "O texto está pronto para a decisão final do Gustavo.";
  if (status === "aprovado") return "Conteúdo aprovado. Agora cada canal pode seguir para produção.";
  if (status === "enviado_mkt") return "A produção já está no Planner; registre a publicação quando sair.";
  if (status === "publicado") return "Conteúdo publicado e disponível para alimentar a memória editorial.";
  return "Escolha um ângulo e avance para a redação.";
}

const BUSY_LABELS: Record<string, string> = {
  answer: "Salvando sua visão…",
  skip: "Seguindo sem registrar visão…",
  generate: "Gerando o rascunho. Isso pode levar até um minuto.",
  analyze: "Refazendo a análise editorial…",
  save: "Salvando alterações…",
  submit: "Revisando o texto antes do envio…",
  approve: "Registrando a aprovação…",
  reject: "Registrando a rejeição…",
  planner_linkedin: "Criando a tarefa de LinkedIn…",
  planner_reel: "Criando a tarefa de Reel…",
  publish: "Marcando como publicado…",
  select_angle: "Registrando o ângulo…",
};

function ActionBanner({
  busy,
  error,
  onRetry,
}: {
  busy: string | null;
  error: string | null;
  onRetry?: () => void;
}) {
  if (error) {
    return (
      <section className="flex flex-col gap-3 rounded-[1.25rem] border border-red-200 bg-red-50 px-5 py-4 text-red-950 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
          <div>
            <p className="font-semibold">Esta etapa não concluiu</p>
            <p className="mt-1 text-sm text-red-900/75">{error}</p>
          </div>
        </div>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry} className="border-red-200 bg-white">
            Tentar gerar de novo
          </Button>
        )}
      </section>
    );
  }

  if (!busy) return null;

  return (
    <section
      className="flex items-center gap-3 rounded-[1.25rem] bg-[#04202f] px-5 py-4 text-white"
      aria-live="polite"
      aria-busy="true"
    >
      <LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-[#7fe1e3]" aria-hidden />
      <p className="text-sm font-medium">{BUSY_LABELS[busy] ?? "Processando…"}</p>
    </section>
  );
}
