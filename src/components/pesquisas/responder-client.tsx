"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, Eye, LoaderCircle, Lock, Send, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  SURVEYS_PATH,
  SURVEY_BRAND_LOGOS,
  formatSurveyDate,
  hasAnswer,
  isAnswerable,
  questionNumber,
  sanitizeAnswers,
  type AnswerValue,
  type RespondentView,
  type SurveyAnswers,
  type SurveyQuestion,
} from "@/lib/pesquisas/types";
import { QuestionInput } from "./question-inputs";
import { PersonFace, RichText, requestJson } from "./shared";

/* Identidade das peças do PE27: papel, marinho, dourado; Montserrat + Bebas (no lugar de Gotham + Gobold). */
const EYEBROW = "text-[12px] font-semibold uppercase tracking-[0.28em] text-[#9c7434]";
const DISPLAY = "font-[family-name:var(--font-survey-display)] uppercase leading-[0.9] text-[#0d1e2e]";
const NAVY_BUTTON =
  "h-11 rounded-full border-[#0d1e2e] bg-[#0d1e2e] px-6 text-white shadow-none hover:border-[#1b3247] hover:bg-[#1b3247]";
const SIGNATURE_PE27 = "O futuro do escritório se constrói com a participação de todos.";

function draftKey(slug: string): string {
  return `pesquisa:${slug}:rascunho`;
}

function readDraft(slug: string): SurveyAnswers {
  try {
    const raw = window.localStorage.getItem(draftKey(slug));
    return raw ? (JSON.parse(raw) as SurveyAnswers) : {};
  } catch {
    return {};
  }
}

function writeDraft(slug: string, answers: SurveyAnswers | null) {
  try {
    if (answers) window.localStorage.setItem(draftKey(slug), JSON.stringify(answers));
    else window.localStorage.removeItem(draftKey(slug));
  } catch {
    // Sem armazenamento: o rascunho só não sobrevive a um recarregamento.
  }
}

/** Estimativa honesta: resposta longa ~1,5 min, o resto ~30 s. */
function estimateMinutes(questions: SurveyQuestion[]): number {
  const seconds = questions.reduce(
    (sum, question) => sum + (question.type === "texto_longo" ? 90 : isAnswerable(question) ? 30 : 0),
    0
  );
  return Math.max(2, Math.round(seconds / 60));
}

/* ------------------------------------------------------------------ */
/* Abertura: o texto colado do WhatsApp vira blocos da peça             */
/* ------------------------------------------------------------------ */

type IntroChunk = { heading: string | null; lines: string[] };

const HEADING_LINE = /^\*([^*]+)\*$/;
/** "*C – Cliente no centro:* texto" → letra, nome e descrição. */
const VALUE_LINE = /^\*\s*([A-ZÀ-Ú])\s*[–-]\s*([^:*]+?):?\s*\*\s*:?\s*(.*)$/;

function parseIntro(intro: string): IntroChunk[] {
  return intro
    .split(/\n\s*\n/)
    .map((block) => block.split("\n").map((line) => line.trim()).filter(Boolean))
    .filter((lines) => lines.length > 0)
    .map((lines) => {
      const heading = HEADING_LINE.exec(lines[0]);
      return heading ? { heading: heading[1].trim(), lines: lines.slice(1) } : { heading: null, lines };
    });
}

function ReferenceChunk({ chunk }: { chunk: IntroChunk }) {
  return (
    <div className="space-y-2.5">
      <h3 className={EYEBROW}>{chunk.heading}</h3>
      {chunk.lines.map((line, index) => {
        const value = VALUE_LINE.exec(line);
        if (value) {
          return (
            <div key={index} className="flex gap-4 border-t border-[#d4b06a]/30 pt-3 first-of-type:border-t-0 first-of-type:pt-0">
              <span className={cn(DISPLAY, "w-7 shrink-0 text-center text-[2.6rem] text-[#b8893f]")} aria-hidden>
                {value[1]}
              </span>
              <p className="text-[14.5px] leading-6 text-[#3a3f45]">
                <strong className="block font-semibold text-[#0d1e2e]">
                  {value[1]} – {value[2]}
                </strong>
                {value[3]}
              </p>
            </div>
          );
        }
        const quoted = /^["“].*["”]$/.test(line);
        return (
          <p
            key={index}
            className={cn("text-[15px] leading-7 text-[#2b3036]", quoted && "text-[16px] font-medium italic text-[#0d1e2e]")}
          >
            <RichText text={line} />
          </p>
        );
      })}
    </div>
  );
}

/**
 * Parágrafos soltos ficam como texto; blocos com título (*NOSSO PROPÓSITO*…)
 * entram juntos na caixa com fio dourado; o que vem depois dela vira a faixa de destaque.
 */
function IntroBlocks({ intro }: { intro: string }) {
  const chunks = parseIntro(intro);
  const groups: Array<{ kind: "text" | "reference" | "highlight"; chunks: IntroChunk[] }> = [];
  let afterReference = false;
  for (const chunk of chunks) {
    const kind = chunk.heading ? "reference" : afterReference ? "highlight" : "text";
    if (chunk.heading) afterReference = true;
    const last = groups[groups.length - 1];
    if (last && last.kind === kind) last.chunks.push(chunk);
    else groups.push({ kind, chunks: [chunk] });
  }

  return (
    <div className="space-y-6">
      {groups.map((group, index) => {
        if (group.kind === "reference") {
          return (
            <div key={index} className="space-y-7 border border-[#d4b06a]/80 bg-white/55 px-5 py-6 sm:px-8 sm:py-8">
              {group.chunks.map((chunk, chunkIndex) => (
                <ReferenceChunk key={chunkIndex} chunk={chunk} />
              ))}
            </div>
          );
        }
        const paragraphs = group.chunks.flatMap((chunk) => chunk.lines.join(" "));
        return (
          <div
            key={index}
            className={cn("space-y-4", group.kind === "highlight" && "bg-[#ead9b6]/40 px-5 py-5 sm:px-8")}
          >
            {paragraphs.map((paragraph, paragraphIndex) => (
              <p key={paragraphIndex} className="text-[15.5px] leading-7 text-[#2b3036]">
                <RichText text={paragraph} />
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Moldura da página                                                   */
/* ------------------------------------------------------------------ */

function PageShell({ brand, children, footerGap }: { brand: RespondentView["survey"]["brand"]; children: ReactNode; footerGap?: boolean }) {
  const logo = brand ? SURVEY_BRAND_LOGOS[brand] : null;
  return (
    <div className="relative min-h-dvh bg-[#fbf8f3] font-[family-name:var(--font-survey-sans)] text-[#1f2328]">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[url('/pesquisas/pe27-fundo-claro.jpg')] bg-cover bg-right-top"
      />
      <div className={cn("relative mx-auto w-full max-w-2xl px-5 pt-10 sm:px-8 sm:pt-14", footerGap ? "pb-36" : "pb-14")}>
        <header className="flex justify-center">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo.src}
              alt="Bismarchi | Pires 10 anos: Planejamento Estratégico 2027"
              width={logo.width}
              height={logo.height}
              className="h-auto w-[min(25rem,86%)]"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/dress-code/10-anos/logo-10-anos.png"
              alt="Bismarchi | Pires Sociedade de Advogados: 10 anos"
              width={640}
              height={527}
              className="h-auto w-40"
            />
          )}
        </header>
        {children}
        <footer className="mt-14 flex items-center gap-3 border-t border-[#b8893f]/45 pt-4">
          {brand === "pe27" ? (
            <>
              <span className={cn(DISPLAY, "text-[2.1rem] leading-none text-[#b8893f]")}>PE27</span>
              <span className="h-7 w-px bg-[#b8893f]/70" aria-hidden />
              <p className="text-[13px] font-semibold leading-5 text-[#141b24]">{SIGNATURE_PE27}</p>
            </>
          ) : (
            <p className="text-xs text-[#8a8478]">Bismarchi | Pires Sociedade de Advogados</p>
          )}
        </footer>
      </div>
    </div>
  );
}

function StateMessage({
  brand,
  icon: Icon,
  title,
  accent,
  children,
}: {
  brand: RespondentView["survey"]["brand"];
  icon: typeof CheckCircle2;
  title: string;
  /** Trecho do título em dourado. */
  accent?: string;
  children?: ReactNode;
}) {
  return (
    <PageShell brand={brand}>
      <section className="mt-14 flex flex-col items-center text-center">
        <span className="flex size-14 items-center justify-center rounded-full border border-[#d4b06a]/80 bg-white/70 text-[#b8893f]">
          <Icon className="size-6" aria-hidden />
        </span>
        <h1 className={cn(DISPLAY, "mt-6 text-[clamp(2.6rem,10vw,4rem)]")}>
          {title}
          {accent && <span className="text-[#b8893f]"> {accent}</span>}
        </h1>
        {children && <div className="mt-5 max-w-md space-y-3 text-[15px] leading-7 text-[#3a3f45]">{children}</div>}
      </section>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export function ResponderClient({ slug, preview }: { slug: string; preview: boolean }) {
  const [view, setView] = useState<RespondentView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [invalidId, setInvalidId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [previewNotice, setPreviewNotice] = useState(false);
  const questionRefs = useRef(new Map<string, HTMLElement>());

  const load = useCallback(async () => {
    try {
      const data = await requestJson<RespondentView>(`/api/pesquisas/responder/${encodeURIComponent(slug)}`);
      setView(data);
      if (data.state === "aberta") setAnswers(readDraft(slug));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Não foi possível abrir a pesquisa.");
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const questions = useMemo(() => view?.survey.questions ?? [], [view]);
  const answerable = questions.filter(isAnswerable);
  const answeredCount = answerable.filter((question) => hasAnswer(question, answers[question.id])).length;
  const isPreview = Boolean(view?.can_preview && (preview || view.state !== "aberta"));
  const canFill = view?.state === "aberta" || isPreview;

  const setAnswer = (id: string, value: AnswerValue) => {
    setPreviewNotice(false);
    setConfirming(false);
    setAnswers((current) => {
      const next = { ...current, [id]: value };
      if (!isPreview) writeDraft(slug, next);
      return next;
    });
    if (invalidId === id) {
      setInvalidId(null);
      setFormError(null);
    }
  };

  const validate = (): boolean => {
    const { error } = sanitizeAnswers(questions, answers);
    if (!error && answeredCount > 0) return true;
    const missing = questions.find((question) => question.required && !hasAnswer(question, answers[question.id]));
    const target = missing ?? answerable[0];
    setFormError(error ?? "Responda pelo menos uma pergunta.");
    if (target) {
      setInvalidId(target.id);
      questionRefs.current.get(target.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return false;
  };

  const askToSend = () => {
    if (!validate()) return;
    if (isPreview) setPreviewNotice(true);
    else setConfirming(true);
  };

  const send = async () => {
    setSending(true);
    try {
      const { answers: clean } = sanitizeAnswers(questions, answers);
      const result = await requestJson<{ submitted_at: string }>(`/api/pesquisas/responder/${encodeURIComponent(slug)}`, {
        method: "POST",
        body: JSON.stringify({ answers: clean }),
      });
      writeDraft(slug, null);
      setSentAt(result.submitted_at);
      setConfirming(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível enviar.");
      setConfirming(false);
    } finally {
      setSending(false);
    }
  };

  if (loadError) {
    return (
      <StateMessage brand={null} icon={Lock} title="Não deu para abrir" accent="a pesquisa">
        <p>{loadError}</p>
      </StateMessage>
    );
  }

  if (!view) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#fbf8f3]">
        <LoaderCircle className="size-6 animate-spin text-[#b8893f]" aria-label="Carregando" />
      </div>
    );
  }

  const { survey } = view;
  const managerLink = view.can_preview ? (
    <Link href={SURVEYS_PATH} className="font-semibold text-[#9c7434] underline-offset-4 hover:underline">
      Voltar para a gestão das pesquisas
    </Link>
  ) : null;

  if (sentAt || view.state === "respondida") {
    return (
      <StateMessage brand={survey.brand} icon={CheckCircle2} title="Obrigado" accent={view.first_name ? `${view.first_name}!` : "!"}>
        <p>
          Sua resposta {sentAt ? "foi enviada" : `foi enviada em ${formatSurveyDate(view.submitted_at)}`}.{" "}
          {survey.brand === "pe27"
            ? "Ela vai com os embaixadores de Operações Legais para o Workshop de Planejamento Estratégico 2027."
            : "Ela já está com quem organizou a pesquisa."}
        </p>
        {managerLink && <p>{managerLink}</p>}
      </StateMessage>
    );
  }

  if (!canFill) {
    const messages = {
      rascunho: { icon: Clock3, title: "Ainda não", accent: "abrimos", text: "Assim que a pesquisa abrir, este link passa a funcionar." },
      encerrada: { icon: Lock, title: "Pesquisa", accent: "encerrada", text: "O prazo para responder terminou. Obrigado pelo interesse!" },
      fora_do_publico: {
        icon: UserRound,
        title: "Esta pesquisa é de",
        accent: "outra equipe",
        text: "Se você acha que deveria responder, fale com quem enviou o link.",
      },
    } as const;
    const message = messages[view.state as keyof typeof messages];
    return (
      <StateMessage brand={survey.brand} icon={message.icon} title={message.title} accent={message.accent}>
        <p>{message.text}</p>
      </StateMessage>
    );
  }

  const minutes = estimateMinutes(questions);

  return (
    <PageShell brand={survey.brand} footerGap>
      {isPreview && (
        <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 border border-[#e9c98a] bg-[#fff6e0]/90 px-4 py-3 text-sm text-[#6b4e1c]">
          <Eye className="size-4 shrink-0" aria-hidden />
          <span className="font-medium">Prévia: é assim que a equipe vê. Nada do que você escrever aqui é gravado.</span>
          {managerLink}
        </div>
      )}

      <section className="mt-10 text-center sm:mt-12">
        <p className={EYEBROW}>Escuta da equipe</p>
        {survey.brand === "pe27" ? (
          <h1 className={cn(DISPLAY, "mt-4 text-[clamp(3.1rem,13vw,5.4rem)]")}>
            A sua <span className="text-[#b8893f]">voz</span> no PE27
          </h1>
        ) : (
          <h1 className={cn(DISPLAY, "mt-4 text-[clamp(2.6rem,10vw,4.2rem)]")}>{survey.title}</h1>
        )}
        {survey.brand === "pe27" && <p className="mt-4 text-lg font-semibold text-[#0d1e2e]">{survey.title}</p>}
        <p className="mt-2 text-sm text-[#5c6168]">
          {answerable.length} {answerable.length === 1 ? "pergunta" : "perguntas"} · uns {minutes} minutos
          {survey.closes_at ? ` · até ${formatSurveyDate(survey.closes_at, true)}` : ""}
        </p>
        {view.respondent && (
          <div className="mt-6 inline-flex items-center gap-2.5 rounded-full border border-[#e4d6b8] bg-white/75 py-1.5 pl-1.5 pr-4 text-left">
            <PersonFace person={view.respondent} />
            <span className="text-[13px] leading-tight text-[#3a3f45]">
              Respondendo como <strong className="font-semibold text-[#0d1e2e]">{view.respondent.short_name}</strong>
            </span>
          </div>
        )}
      </section>

      {survey.intro && (
        <div className="mt-10">
          <IntroBlocks intro={survey.intro} />
        </div>
      )}

      <div className="mt-12 space-y-6">
        {questions.map((question, index) => {
          if (question.type === "secao") {
            return (
              <div key={question.id} className="pt-4">
                <h2 className={cn(DISPLAY, "text-[2.2rem]")}>{question.title}</h2>
                <span className="mt-2 block h-[3px] w-12 bg-[#d4b06a]" aria-hidden />
                {question.help && <p className="mt-3 text-[15px] leading-7 text-[#5c6168]">{question.help}</p>}
              </div>
            );
          }
          const invalid = invalidId === question.id;
          const number = String(questionNumber(questions, index)).padStart(2, "0");
          return (
            <section
              key={question.id}
              ref={(node) => {
                if (node) questionRefs.current.set(question.id, node);
                else questionRefs.current.delete(question.id);
              }}
              aria-labelledby={`q-${question.id}`}
              className={cn(
                "scroll-mt-10 border bg-white/70 px-5 py-6 sm:px-8 sm:py-7",
                invalid ? "border-[#c2410c]/60 ring-2 ring-[#c2410c]/10" : "border-[#e4d6b8]"
              )}
            >
              <div className="mb-5 flex gap-4">
                <span className={cn(DISPLAY, "shrink-0 text-[2.75rem] leading-[0.8] text-[#b8893f]")} aria-hidden>
                  {number}
                </span>
                <div className="min-w-0">
                  <h3 id={`q-${question.id}`} className="text-[17px] font-semibold leading-7 text-[#0d1e2e]">
                    {question.title}
                  </h3>
                  {question.help && <p className="mt-1.5 text-[14px] leading-6 text-[#5c6168]">{question.help}</p>}
                  {question.required && (
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9c7434]">Obrigatória</p>
                  )}
                </div>
              </div>
              <QuestionInput
                question={question}
                value={answers[question.id]}
                onChange={(value) => setAnswer(question.id, value)}
                invalid={invalid}
                tone="brand"
              />
            </section>
          );
        })}
      </div>

      <p className="mt-6 text-center text-[13px] leading-6 text-[#5c6168]">
        {survey.anonymous
          ? "Resposta anônima: o sistema só registra que você respondeu. "
          : "Você responde com o seu login: os embaixadores veem o seu nome junto da resposta. "}
        O rascunho fica salvo neste navegador até você enviar.
      </p>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#e4d6b8] bg-[#fbf8f3]/92 backdrop-blur supports-[backdrop-filter]:bg-[#fbf8f3]/80">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-3 sm:gap-4 sm:px-8">
          {confirming ? (
            <>
              <p className="min-w-0 flex-1 text-[13px] leading-5 text-[#2b3036]">
                <strong className="font-semibold text-[#0d1e2e]">Enviar agora?</strong> Depois de enviar não dá para mudar.
              </p>
              <Button type="button" variant="outline" className="h-11 rounded-full border-[#d4b06a] bg-transparent text-[#0d1e2e]" onClick={() => setConfirming(false)} disabled={sending}>
                Revisar
              </Button>
              <Button type="button" onClick={() => void send()} disabled={sending} className={NAVY_BUTTON}>
                {sending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
                Confirmar
              </Button>
            </>
          ) : (
            <>
              <div className="min-w-0 flex-1" aria-live="polite">
                <p className="text-[13px] font-semibold tabular-nums text-[#0d1e2e]">
                  {answeredCount} de {answerable.length} respondidas
                </p>
                {formError ? (
                  <p className="truncate text-xs font-medium text-[#c2410c]">{formError}</p>
                ) : previewNotice ? (
                  <p className="truncate text-xs font-medium text-[#6b4e1c]">Prévia: tudo certo, e nada foi enviado.</p>
                ) : (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#efe5d1]" aria-hidden>
                    <div
                      className="h-full rounded-full bg-[#b8893f] transition-[width]"
                      style={{ width: `${answerable.length ? (answeredCount / answerable.length) * 100 : 0}%` }}
                    />
                  </div>
                )}
              </div>
              <Button type="button" onClick={askToSend} disabled={sending} className={NAVY_BUTTON}>
                <Send className="size-4" aria-hidden />
                Enviar respostas
              </Button>
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}

