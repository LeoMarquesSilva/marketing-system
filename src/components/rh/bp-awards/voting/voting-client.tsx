"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  CloudCheck,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Send,
  Shirt,
  Sparkle,
  Timer,
  TriangleAlert,
} from "lucide-react";
import { AwardAvatar } from "@/components/rh/bp-awards/award-avatar";
import styles from "@/components/rh/bp-awards/awards-theme.module.css";
import { PersonPicker } from "@/components/rh/bp-awards/voting/person-picker";
import { firstName, formatAwardDateTime } from "@/lib/rh/bp-awards/format";
import {
  AWARD_CATEGORIES,
  AWARDS_COMMITTEE_PATH,
  AWARDS_LOGO_SRC,
  AWARDS_SYMBOL_SRC,
  JUSTIFICATION_MAX,
  awardSealSrc,
  JUSTIFICATION_MIN,
  type AwardCategory,
  type AwardCategoryKey,
  type AwardPerson,
  type VoterView,
} from "@/lib/rh/bp-awards/types";
import { cn } from "@/lib/utils";

type ReadyView = Extract<VoterView, { state: "ready" }>;
type Draft = { nominee: string | null; text: string };
type Drafts = Record<AwardCategoryKey, Draft>;
type SaveState = { status: "idle" | "pending" | "saving" | "saved" | "error"; message?: string };
type Screen = "intro" | "step" | "review" | "done";

const PARTY = { when: "17 de dezembro de 2026, às 18h", where: "Fazenda Santa Margarida, Campinas/SP" };
const SAVE_DELAY_MS = 900;

const emptyDrafts = (): Drafts =>
  Object.fromEntries(AWARD_CATEGORIES.map((category) => [category.key, { nominee: null, text: "" }])) as unknown as Drafts;

const idleSaves = (): Record<AwardCategoryKey, SaveState> =>
  Object.fromEntries(AWARD_CATEGORIES.map((category) => [category.key, { status: "idle" }])) as unknown as Record<
    AwardCategoryKey,
    SaveState
  >;

function isComplete(draft: Draft): boolean {
  return Boolean(draft.nominee) && draft.text.trim().length >= JUSTIFICATION_MIN;
}

async function readError(response: Response, fallback: string): Promise<string> {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? fallback;
}

/* =============================================================== página */

export function VotingClient({ preview = false }: { preview?: boolean }) {
  const [view, setView] = useState<ReadyView | null>(null);
  const [failure, setFailure] = useState<{ title: string; body: string } | null>(null);
  const [screen, setScreen] = useState<Screen>("intro");
  const [stepIndex, setStepIndex] = useState(0);
  const [drafts, setDrafts] = useState<Drafts>(emptyDrafts);
  const [saves, setSaves] = useState(idleSaves);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const draftsRef = useRef(drafts);
  const submittedRef = useRef(submittedAt);
  const timers = useRef(new Map<AwardCategoryKey, ReturnType<typeof setTimeout>>());
  const inflight = useRef(new Set<AwardCategoryKey>());
  const again = useRef(new Set<AwardCategoryKey>());
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);
  useEffect(() => {
    submittedRef.current = submittedAt;
  }, [submittedAt]);

  const load = useCallback(async () => {
    setFailure(null);
    try {
      const response = await fetch(preview ? "/api/bp-awards?previa=1" : "/api/bp-awards", { cache: "no-store" });
      if (!response.ok) {
        setFailure({
          title: response.status === 403 ? "só para o comitê" : "algo deu errado",
          body: await readError(response, "Não foi possível carregar o BP Awards."),
        });
        return;
      }
      const data = (await response.json()) as VoterView;
      if (data.state === "no_edition") {
        setFailure({ title: "em breve", body: "A premiação ainda está sendo preparada pela equipe de Pessoas e Cultura." });
        return;
      }
      const next = emptyDrafts();
      for (const nomination of data.nominations) {
        next[nomination.category] = { nominee: nomination.nominee_employee_id, text: nomination.justification };
      }
      setDrafts(next);
      draftsRef.current = next;
      setSubmittedAt(data.submittedAt);
      setView(data);
      setScreen(data.submittedAt && data.phase === "aberta" ? "review" : "intro");
    } catch {
      setFailure({ title: "sem conexão", body: "Verifique sua internet e recarregue a página." });
    }
  }, [preview]);

  useEffect(() => {
    void load();
  }, [load]);

  const candidatesById = useMemo(() => new Map((view?.candidates ?? []).map((person) => [person.id, person])), [view]);

  /* ---------------------------------------------------------- salvamento */

  const save = useCallback(async (key: AwardCategoryKey) => {
    if (inflight.current.has(key)) {
      again.current.add(key);
      return;
    }
    const draft = draftsRef.current[key];
    if (!draft.nominee) return;
    if (preview) {
      setSaves((current) => ({ ...current, [key]: { status: "saved" } }));
      return;
    }
    inflight.current.add(key);
    setSaves((current) => ({ ...current, [key]: { status: "saving" } }));
    try {
      const response = await fetch("/api/bp-awards/indicacoes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: key, nominee_employee_id: draft.nominee, justification: draft.text }),
      });
      if (!response.ok) {
        const message = await readError(response, "Não foi possível salvar.");
        setSaves((current) => ({ ...current, [key]: { status: "error", message } }));
      } else {
        setSaves((current) => ({ ...current, [key]: { status: "saved" } }));
      }
    } catch {
      setSaves((current) => ({ ...current, [key]: { status: "error", message: "Sem conexão. Tentaremos de novo." } }));
    } finally {
      inflight.current.delete(key);
      if (again.current.has(key)) {
        again.current.delete(key);
        void save(key);
      }
    }
  }, [preview]);

  const scheduleSave = useCallback(
    (key: AwardCategoryKey, delay: number) => {
      const timer = timers.current.get(key);
      if (timer) clearTimeout(timer);
      const draft = draftsRef.current[key];
      if (!draft.nominee) return;
      if (submittedRef.current && draft.text.trim().length < JUSTIFICATION_MIN) {
        setSaves((current) => ({
          ...current,
          [key]: { status: "error", message: `Para manter o envio, descreva com pelo menos ${JUSTIFICATION_MIN} caracteres.` },
        }));
        return;
      }
      setSaves((current) => ({ ...current, [key]: { status: "pending" } }));
      timers.current.set(
        key,
        setTimeout(() => {
          timers.current.delete(key);
          void save(key);
        }, delay)
      );
    },
    [save]
  );

  /** Salva já o que estiver esperando (troca de passo, revisão). */
  const flushSaves = useCallback(() => {
    for (const [key, timer] of timers.current) {
      clearTimeout(timer);
      timers.current.delete(key);
      void save(key);
    }
  }, [save]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (timers.current.size > 0 || inflight.current.size > 0) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const updateDraft = useCallback(
    (key: AwardCategoryKey, patch: Partial<Draft>, delay: number) => {
      const next = { ...draftsRef.current, [key]: { ...draftsRef.current[key], ...patch } };
      draftsRef.current = next;
      setDrafts(next);
      scheduleSave(key, delay);
    },
    [scheduleSave]
  );

  /* ---------------------------------------------------------- navegação */

  const go = useCallback(
    (next: Screen, index?: number) => {
      flushSaves();
      setSubmitError(null);
      if (index !== undefined) setStepIndex(index);
      setScreen(next);
      requestAnimationFrame(() => topRef.current?.scrollIntoView({ block: "start" }));
    },
    [flushSaves]
  );

  const firstIncomplete = AWARD_CATEGORIES.findIndex((category) => !isComplete(drafts[category.key]));
  const completeCount = AWARD_CATEGORIES.filter((category) => isComplete(drafts[category.key])).length;
  const anySaving = Object.values(saves).some((state) => state.status === "saving" || state.status === "pending");

  const submit = useCallback(async () => {
    flushSaves();
    setSubmitting(true);
    setSubmitError(null);
    // Espera os salvamentos em andamento terminarem antes de enviar.
    for (let attempt = 0; attempt < 40 && (inflight.current.size > 0 || timers.current.size > 0); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    if (preview) {
      setSubmittedAt(new Date().toISOString());
      setSubmitting(false);
      setScreen("done");
      requestAnimationFrame(() => topRef.current?.scrollIntoView({ block: "start" }));
      return;
    }
    try {
      const response = await fetch("/api/bp-awards/enviar", { method: "POST" });
      if (!response.ok) {
        setSubmitError(await readError(response, "Não foi possível enviar."));
        return;
      }
      const data = (await response.json()) as { submittedAt: string };
      setSubmittedAt(data.submittedAt);
      setScreen("done");
      requestAnimationFrame(() => topRef.current?.scrollIntoView({ block: "start" }));
    } catch {
      setSubmitError("Sem conexão. Verifique sua internet e tente de novo.");
    } finally {
      setSubmitting(false);
    }
  }, [flushSaves, preview]);

  /* -------------------------------------------------------------- telas */

  if (failure) {
    return (
      <Shell firstNameLabel={null} topRef={topRef}>
        <MessageBlock title={failure.title} body={failure.body}>
          <button type="button" className={styles.secondary} onClick={() => void load()}>
            <RefreshCw className="size-4" aria-hidden />
            Tentar de novo
          </button>
        </MessageBlock>
      </Shell>
    );
  }

  if (!view) {
    return (
      <Shell firstNameLabel={null} topRef={topRef}>
        <div className="flex min-h-[50dvh] items-center justify-center" role="status" aria-live="polite">
          <LoaderCircle className="size-7 animate-spin text-[var(--aw-gold)]" aria-hidden />
          <span className="sr-only">Carregando o BP Awards</span>
        </div>
      </Shell>
    );
  }

  const greeting = view.voterFirstName ? `Olá, ${view.voterFirstName}` : null;

  if (!view.eligible) {
    return (
      <Shell firstNameLabel={greeting} topRef={topRef}>
        <MessageBlock
          title="votação dos colaboradores"
          body="A indicação do BP Awards é feita pelos colaboradores ativos do escritório. Não achamos um cadastro de colaborador ligado ao seu usuário; se isso estiver errado, fale com a equipe de Pessoas e Cultura."
        />
      </Shell>
    );
  }

  if (view.phase === "publicada") {
    return (
      <Shell firstNameLabel={greeting} topRef={topRef}>
        <WinnersBlock view={view} />
      </Shell>
    );
  }

  if (view.phase === "rascunho" || view.phase === "agendada") {
    return (
      <Shell firstNameLabel={greeting} topRef={topRef}>
        <Hero
          closesAt={null}
          note={
            view.phase === "agendada" && view.edition.voting_opens_at
              ? `A votação abre em ${formatAwardDateTime(view.edition.voting_opens_at)}.`
              : "A votação ainda não começou. Você recebe o aviso quando abrir."
          }
        />
        <ValuesList />
      </Shell>
    );
  }

  if (view.phase === "apuracao") {
    return (
      <Shell firstNameLabel={greeting} topRef={topRef}>
        <MessageBlock
          title="votação encerrada"
          body={
            submittedAt
              ? "Obrigado por participar! O comitê está analisando as indicações e o resultado será revelado na festa de 10 anos."
              : "O prazo para indicar terminou. O comitê está analisando as indicações e o resultado será revelado na festa de 10 anos."
          }
        >
          <PartyInfo />
        </MessageBlock>
        {submittedAt && (
          <ReviewList drafts={drafts} candidatesById={candidatesById} readOnly onEdit={() => undefined} />
        )}
      </Shell>
    );
  }

  /* ----------------------------------------------------- votação aberta */

  const closesAt = view.edition.voting_closes_at;
  const category = AWARD_CATEGORIES[stepIndex];

  return (
    <Shell firstNameLabel={greeting} topRef={topRef} preview={view.preview}>
      {screen !== "intro" && screen !== "done" && (
        <CivilStepper
          drafts={drafts}
          current={screen === "step" ? stepIndex : null}
          reviewing={screen === "review"}
          onStep={(index) => go("step", index)}
          onReview={() => go("review")}
        />
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={screen === "step" ? `step-${stepIndex}` : screen}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {screen === "intro" && (
            <>
              <Hero closesAt={closesAt} note={null}>
                <button
                  type="button"
                  className={styles.primary}
                  onClick={() => (submittedAt ? go("review") : go("step", Math.max(firstIncomplete, 0)))}
                >
                  {submittedAt ? "Ver minhas indicações" : completeCount > 0 ? "Continuar de onde parei" : "Começar"}
                  <ArrowRight className="size-4" aria-hidden />
                </button>
                {completeCount > 0 && !submittedAt && (
                  <span className="text-sm text-[var(--aw-mist)]">{completeCount} de 5 valores preenchidos</span>
                )}
              </Hero>
              <ValuesList drafts={drafts} onPick={(index) => go("step", index)} />
              <Rules partnersEligible={view.edition.partners_eligible} />
            </>
          )}

          {screen === "step" && (
            <ValueStep
              index={stepIndex}
              category={category}
              draft={drafts[category.key]}
              save={saves[category.key]}
              candidates={view.candidates}
              candidatesById={candidatesById}
              drafts={drafts}
              submitted={Boolean(submittedAt)}
              onPick={(person) => updateDraft(category.key, { nominee: person.id }, 0)}
              onText={(text) => updateDraft(category.key, { text }, SAVE_DELAY_MS)}
              onRetry={() => void save(category.key)}
              onBack={() => (stepIndex === 0 ? go("intro") : go("step", stepIndex - 1))}
              onNext={() => (stepIndex === AWARD_CATEGORIES.length - 1 ? go("review") : go("step", stepIndex + 1))}
            />
          )}

          {screen === "review" && (
            <section aria-labelledby="revisao-titulo" className="pt-8">
              <h1 id="revisao-titulo" className={cn(styles.display, "text-[clamp(1.8rem,5.5vw,2.6rem)] text-[var(--aw-ivory)]")}>
                {submittedAt ? "Suas indicações" : "Revise e envie"}
              </h1>
              <p className="mt-3 max-w-[62ch] leading-7 text-[var(--aw-mist)]">
                {submittedAt
                  ? `Enviadas em ${formatAwardDateTime(submittedAt)}. Você pode ajustar até ${closesAt ? formatAwardDateTime(closesAt) : "o fim da votação"}; as mudanças são salvas sozinhas.`
                  : "Confira quem você indicou em cada valor. Depois de enviar, ainda dá para ajustar até o fim da votação."}
              </p>
              <ReviewList
                drafts={drafts}
                candidatesById={candidatesById}
                saves={saves}
                onEdit={(index) => go("step", index)}
              />
              {!submittedAt && (
                <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={completeCount < 5 || submitting}
                    onClick={() => void submit()}
                  >
                    {submitting ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
                    {submitting ? "Enviando…" : "Enviar indicações"}
                  </button>
                  <span className="text-sm text-[var(--aw-mist)]" aria-live="polite">
                    {completeCount < 5
                      ? `Faltam ${5 - completeCount} ${5 - completeCount === 1 ? "valor" : "valores"} para enviar.`
                      : anySaving
                        ? "Salvando as últimas mudanças…"
                        : "Tudo pronto."}
                  </span>
                </div>
              )}
              {submitError && (
                <p className="mt-4 flex items-start gap-2 text-sm text-[var(--aw-danger)]" role="alert">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {submitError}
                </p>
              )}
            </section>
          )}

          {screen === "done" && (
            <section aria-labelledby="obrigado-titulo" className="pt-10 text-center sm:pt-16">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={AWARDS_LOGO_SRC} alt="Bismarchi | Pires Awards" width={900} height={869} className="mx-auto h-auto w-44 sm:w-52" />
              <h1 id="obrigado-titulo" className={cn(styles.display, "mt-8 text-[clamp(2.2rem,7vw,3.25rem)] text-[var(--aw-gold)]")}>
                Obrigado!
              </h1>
              <p className="mx-auto mt-4 max-w-[56ch] text-[1.05rem] leading-8 text-[var(--aw-ivory)]">
                Suas indicações serão analisadas por um comitê nas próximas semanas, e o resultado será revelado com muita
                festa no nosso evento de 10 anos do Bismarchi | Pires.
              </p>
              <div className="mx-auto mt-8 max-w-md">
                <PartyInfo centered />
              </div>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <button type="button" className={styles.secondary} onClick={() => go("review")}>
                  Ver minhas indicações
                </button>
                <Link href="/" className={styles.secondary}>
                  Ir para o ORQESTRAI
                </Link>
              </div>
            </section>
          )}
        </motion.div>
      </AnimatePresence>
    </Shell>
  );
}

/* ============================================================ estrutura */

function Shell({
  firstNameLabel,
  topRef,
  preview = false,
  children,
}: {
  firstNameLabel: string | null;
  topRef: React.RefObject<HTMLDivElement | null>;
  preview?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.theme}>
      {preview && (
        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-[var(--aw-gold)] px-4 py-2 text-center text-sm font-medium text-[var(--aw-night)]">
          Pré-visualização do RH: a votação aparece aberta, mas nada é salvo nem enviado.
          <Link href={AWARDS_COMMITTEE_PATH} className="underline underline-offset-4">
            Voltar ao comitê
          </Link>
        </p>
      )}
      <div ref={topRef} className="mx-auto w-full max-w-[52rem] scroll-mt-0 px-4 pb-20 sm:px-6">
        <header className="flex items-center justify-between gap-4 py-5 sm:py-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={AWARDS_SYMBOL_SRC} alt="Bismarchi | Pires Awards" width={613} height={400} className="h-10 w-auto sm:h-12" />
          <div className="text-right text-sm">
            {firstNameLabel && <p className="font-medium text-[var(--aw-ivory)]">{firstNameLabel}</p>}
            <Link href="/" className="text-[var(--aw-mist)] underline-offset-4 hover:text-[var(--aw-ivory)] hover:underline">
              Ir para o ORQESTRAI
            </Link>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}

function Seal({ categoryKey, className }: { categoryKey: AwardCategoryKey; className?: string }) {
  // Selo decorativo: o nome do valor está sempre escrito ao lado.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={awardSealSrc(categoryKey)} alt="" width={640} height={640} className={cn("h-auto shrink-0", className)} />;
}

function MessageBlock({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <section className="py-12 sm:py-16">
      <p className={styles.kicker}>Premiação CIVIL</p>
      <h1 className={cn(styles.display, "mt-4 text-[clamp(1.9rem,6vw,2.75rem)] text-[var(--aw-ivory)]")}>{title}</h1>
      <p className="mt-5 max-w-[60ch] text-[1.02rem] leading-8 text-[var(--aw-mist)]">{body}</p>
      {children && <div className="mt-8 space-y-6">{children}</div>}
    </section>
  );
}

function Hero({
  closesAt,
  note,
  children,
}: {
  closesAt: string | null;
  note: string | null;
  children?: React.ReactNode;
}) {
  return (
    <section aria-labelledby="bp-awards-titulo" className="flex flex-col items-center pb-12 pt-2 text-center sm:pt-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={AWARDS_LOGO_SRC}
        alt="Bismarchi | Pires Awards"
        width={900}
        height={869}
        className="h-auto w-56 sm:w-72"
      />
      <p className={cn(styles.kicker, "mt-8")}>Premiação CIVIL · 10 anos</p>
      <h1 id="bp-awards-titulo" className={cn(styles.display, "mt-4 text-[clamp(1.75rem,5.6vw,2.6rem)] text-[var(--aw-ivory)]")}>
        Quem representa nossos valores?
      </h1>
      <p className="mt-5 max-w-[60ch] text-[1.02rem] leading-8 text-[var(--aw-mist)]">
        O Bismarchi | Pires Awards reconhece as pessoas que traduzem os valores CIVIL em atitudes do dia a dia. Pensando em
        cada um dos 5 valores, quem você indicaria como exemplo? Um comitê analisa as indicações e os vencedores são
        revelados na festa de 10 anos.
      </p>
      {note ? (
        <p className="mt-6 flex items-center gap-2 text-[var(--aw-ivory)]">
          <CalendarClock className="size-5 text-[var(--aw-gold)]" aria-hidden />
          {note}
        </p>
      ) : (
        <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-[var(--aw-ivory)]">
          {closesAt && (
            <li className="flex items-center gap-2">
              <CalendarClock className="size-4 text-[var(--aw-gold)]" aria-hidden />
              Até {formatAwardDateTime(closesAt)}
            </li>
          )}
          <li className="flex items-center gap-2">
            <Timer className="size-4 text-[var(--aw-gold)]" aria-hidden />
            Uns 10 minutos
          </li>
          <li className="flex items-center gap-2">
            <CloudCheck className="size-4 text-[var(--aw-gold)]" aria-hidden />
            Salva sozinho: dá para parar e continuar depois
          </li>
        </ul>
      )}
      {children && <div className="mt-8 flex flex-col items-center gap-3">{children}</div>}
    </section>
  );
}

/** "Cinco formas de reconhecer": os selos dos valores, como no slide da identidade. */
function ValuesList({ drafts, onPick }: { drafts?: Drafts; onPick?: (index: number) => void }) {
  return (
    <section aria-labelledby="valores-titulo" className="border-t border-[var(--aw-line-soft)] pt-10">
      <h2 id="valores-titulo" className={cn(styles.display, "text-center text-[1.5rem] text-[var(--aw-ivory)]")}>
        Cinco formas de reconhecer
      </h2>
      <p className="mt-2 text-center text-sm text-[var(--aw-mist)]">Os valores CIVIL</p>
      <ol className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-5">
        {AWARD_CATEGORIES.map((category, index) => {
          const done = drafts ? isComplete(drafts[category.key]) : false;
          const content = (
            <>
              <Seal categoryKey={category.key} className="w-28 sm:w-32" />
              <span className={cn(styles.pill, "mt-4 min-h-[3.25rem] w-full max-w-[11rem] px-2.5", done && "bg-[var(--aw-gold)] text-[var(--aw-night)]")}>
                {done && <Check className="size-3.5" aria-hidden />}
                {category.name}
              </span>
            </>
          );
          return (
            <li key={category.key} className={cn(index === 4 && "col-span-2 sm:col-span-1")}>
              {onPick ? (
                <button
                  type="button"
                  onClick={() => onPick(index)}
                  aria-label={`${category.name}${done ? ", preenchido" : ""}`}
                  className="group flex w-full flex-col items-center rounded-xl px-1 py-2 transition-transform duration-200 ease-out hover:-translate-y-0.5"
                >
                  {content}
                </button>
              ) : (
                <div className="flex flex-col items-center px-1 py-2">{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Rules({ partnersEligible }: { partnersEligible: boolean }) {
  const rules = [
    "Indique uma pessoa por valor. A mesma pessoa pode aparecer em mais de um valor.",
    "Não vale indicar a si mesmo.",
    partnersEligible ? null : "Sócios participam votando, mas não concorrem.",
    "A pesquisa é identificada: o comitê de Pessoas e Cultura lê cada relato.",
  ].filter(Boolean) as string[];
  return (
    <section aria-labelledby="regras-titulo" className="mt-12 border-t border-[var(--aw-line-soft)] pt-10">
      <h2 id="regras-titulo" className={cn(styles.display, "text-[1.25rem] text-[var(--aw-ivory)]")}>
        Como funciona
      </h2>
      <ul className="mt-4 space-y-3">
        {rules.map((rule) => (
          <li key={rule} className="flex gap-3 leading-7 text-[var(--aw-mist)]">
            <Sparkle className="mt-1.5 size-4 shrink-0 fill-[var(--aw-gold)] text-[var(--aw-gold)]" aria-hidden />
            {rule}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Progresso que soletra CIVIL: cada letra é um valor. */
function CivilStepper({
  drafts,
  current,
  reviewing,
  onStep,
  onReview,
}: {
  drafts: Drafts;
  current: number | null;
  reviewing: boolean;
  onStep: (index: number) => void;
  onReview: () => void;
}) {
  return (
    <nav
      aria-label="Valores"
      className="sticky top-0 z-20 -mx-4 flex items-center justify-between gap-3 border-b border-[var(--aw-line-soft)] bg-[var(--aw-navy)]/95 px-4 py-2 sm:-mx-6 sm:px-6"
    >
      <ol className="flex items-end gap-1 sm:gap-2">
        {AWARD_CATEGORIES.map((category, index) => {
          const done = isComplete(drafts[category.key]);
          const active = current === index;
          return (
            <li key={category.key}>
              <button
                type="button"
                onClick={() => onStep(index)}
                aria-current={active ? "step" : undefined}
                aria-label={`${category.name}${done ? ", preenchido" : ", a preencher"}`}
                title={category.name}
                className={cn(
                  "relative grid h-11 w-9 place-items-center text-xl font-bold transition-colors duration-150 sm:w-10",
                  active ? "text-[var(--aw-ivory)]" : done ? "text-[var(--aw-gold)]" : "text-[var(--aw-dim)] hover:text-[var(--aw-mist)]"
                )}
              >
                {category.letter}
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-2 bottom-0.5 h-0.5 rounded-full",
                    active ? "bg-[var(--aw-ivory)]" : done ? "bg-[var(--aw-gold)]" : "bg-transparent"
                  )}
                />
              </button>
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        onClick={onReview}
        aria-current={reviewing ? "step" : undefined}
        className={cn(
          "rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors duration-150",
          reviewing
            ? "border-[var(--aw-gold)] bg-[var(--aw-gold)] text-[var(--aw-night)]"
            : "border-[var(--aw-line)] text-[var(--aw-ivory)] hover:bg-[var(--aw-gold)]/10"
        )}
      >
        Revisar
      </button>
    </nav>
  );
}

function SaveStatus({ save, onRetry }: { save: SaveState; onRetry: () => void }) {
  if (save.status === "error") {
    return (
      <span className="flex items-center gap-1.5 text-[var(--aw-danger)]">
        <TriangleAlert className="size-3.5" aria-hidden />
        {save.message ?? "Não salvou."}
        <button type="button" className="underline underline-offset-4" onClick={onRetry}>
          Tentar de novo
        </button>
      </span>
    );
  }
  if (save.status === "saving" || save.status === "pending") {
    return (
      <span className="flex items-center gap-1.5 text-[var(--aw-mist)]">
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
        Salvando…
      </span>
    );
  }
  if (save.status === "saved") {
    return (
      <span className="flex items-center gap-1.5 text-[var(--aw-gold-bright)]">
        <CloudCheck className="size-3.5" aria-hidden />
        Salvo
      </span>
    );
  }
  return <span />;
}

function ValueStep({
  index,
  category,
  draft,
  save,
  candidates,
  candidatesById,
  drafts,
  submitted,
  onPick,
  onText,
  onRetry,
  onBack,
  onNext,
}: {
  index: number;
  category: AwardCategory;
  draft: Draft;
  save: SaveState;
  candidates: AwardPerson[];
  candidatesById: Map<string, AwardPerson>;
  drafts: Drafts;
  submitted: boolean;
  onPick: (person: AwardPerson) => void;
  onText: (text: string) => void;
  onRetry: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const nominee = draft.nominee ? (candidatesById.get(draft.nominee) ?? null) : null;
  const textId = `situacao-${category.key}`;
  const hintId = `${textId}-dica`;
  const length = draft.text.trim().length;
  const isLast = index === AWARD_CATEGORIES.length - 1;

  const usedIn = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const other of AWARD_CATEGORIES) {
      const id = drafts[other.key].nominee;
      if (other.key === category.key || !id) continue;
      map.set(id, [...(map.get(id) ?? []), other.letter]);
    }
    return map;
  }, [drafts, category.key]);

  return (
    <section aria-labelledby={`valor-${category.key}`} className="pt-8">
      {/* Como nos slides da identidade: texto, filete dourado e o selo do valor. */}
      <div className="flex flex-col-reverse items-center gap-6 sm:grid sm:grid-cols-[minmax(0,1fr)_1px_11rem] sm:items-center sm:gap-8">
        <div className="min-w-0 text-center sm:text-left">
          <p className="text-sm font-medium text-[var(--aw-gold-bright)]">Valor {index + 1} de 5</p>
          <h1 id={`valor-${category.key}`} className={cn(styles.display, "mt-2 text-[clamp(1.75rem,5.5vw,2.5rem)] text-[var(--aw-ivory)]")}>
            {category.name}
          </h1>
          <p className="mt-4 max-w-[58ch] text-[1.02rem] leading-8 text-[var(--aw-mist)]">{category.description}</p>
        </div>
        <span aria-hidden className="hidden h-40 w-px bg-[var(--aw-gold)] sm:block" />
        <Seal categoryKey={category.key} className="w-36 sm:w-44" />
      </div>

      <div className="mt-10 space-y-8 border-t border-[var(--aw-line-soft)] pt-8">
        <fieldset className="min-w-0">
          <legend className="mb-4 text-[1.05rem] font-semibold leading-7 text-[var(--aw-ivory)]">
            Pensando nesse valor, quem mais representa esse comportamento no dia a dia?
          </legend>
          <PersonPicker
            key={category.key}
            candidates={candidates}
            selected={nominee}
            onSelect={onPick}
            usedIn={usedIn}
            missingSelection={Boolean(draft.nominee) && !nominee}
          />
        </fieldset>

        {nominee && (
          <div>
            <label htmlFor={textId} className="block text-[1.05rem] font-semibold leading-7 text-[var(--aw-ivory)]">
              Descreva uma situação concreta em que {firstName(nominee.short_name)} demonstrou {category.name}.
            </label>
            <p id={hintId} className="mt-1 text-sm leading-6 text-[var(--aw-mist)]">
              Conte o que a pessoa fez, em que contexto e qual foi o resultado. O comitê lê cada relato com atenção.
            </p>
            <textarea
              id={textId}
              value={draft.text}
              onChange={(event) => onText(event.target.value)}
              maxLength={JUSTIFICATION_MAX}
              rows={7}
              aria-describedby={hintId}
              aria-invalid={save.status === "error" && submitted ? true : undefined}
              placeholder="Ex.: quando o cliente precisou de…, ela…"
              className={cn(styles.field, "mt-3 min-h-44 resize-y px-4 py-3")}
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs" aria-live="polite">
              <SaveStatus save={save} onRetry={onRetry} />
              <span className={length > 0 && length < JUSTIFICATION_MIN ? "text-[var(--aw-gold-bright)]" : "text-[var(--aw-dim)]"}>
                {length < JUSTIFICATION_MIN ? `${length}/${JUSTIFICATION_MIN} caracteres para valer` : `${length} caracteres`}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-10 flex items-center justify-between gap-3 border-t border-[var(--aw-line-soft)] pt-6">
        <button type="button" className={styles.secondary} onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden />
          {index === 0 ? "Início" : "Anterior"}
        </button>
        <button type="button" className={styles.primary} onClick={onNext}>
          {isLast ? "Revisar" : "Próximo valor"}
          <ArrowRight className="size-4" aria-hidden />
        </button>
      </div>
    </section>
  );
}

function ReviewList({
  drafts,
  candidatesById,
  saves,
  readOnly = false,
  onEdit,
}: {
  drafts: Drafts;
  candidatesById: Map<string, AwardPerson>;
  saves?: Record<AwardCategoryKey, SaveState>;
  readOnly?: boolean;
  onEdit: (index: number) => void;
}) {
  return (
    <ol className="mt-8 divide-y divide-[var(--aw-line-soft)] border-y border-[var(--aw-line-soft)]">
      {AWARD_CATEGORIES.map((category, index) => {
        const draft = drafts[category.key];
        const nominee = draft.nominee ? (candidatesById.get(draft.nominee) ?? null) : null;
        const complete = Boolean(nominee) && isComplete(draft);
        const error = saves?.[category.key]?.status === "error" ? saves[category.key].message : null;
        return (
          <li key={category.key} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-4 gap-y-3 py-5 sm:grid-cols-[4rem_minmax(0,1fr)_auto]">
            <Seal categoryKey={category.key} className="w-14 sm:w-16" />
            <div className="min-w-0">
              <p className="text-xs font-bold tracking-[0.04em] text-[var(--aw-gold-bright)] uppercase">{category.name}</p>
              {nominee ? (
                <div className="mt-2 flex items-center gap-3">
                  <AwardAvatar person={nominee} size="sm" />
                  <span className="truncate font-semibold text-[var(--aw-ivory)]">{nominee.short_name}</span>
                </div>
              ) : (
                <p className="mt-2 text-[var(--aw-gold-bright)]">Falta escolher quem você indica.</p>
              )}
              {nominee && draft.text.trim().length >= JUSTIFICATION_MIN && (
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--aw-mist)]">“{draft.text.trim()}”</p>
              )}
              {nominee && draft.text.trim().length < JUSTIFICATION_MIN && (
                <p className="mt-2 text-sm text-[var(--aw-gold-bright)]">
                  Falta descrever a situação (pelo menos {JUSTIFICATION_MIN} caracteres).
                </p>
              )}
              {error && <p className="mt-2 text-sm text-[var(--aw-danger)]">{error}</p>}
            </div>
            {!readOnly && (
              <button
                type="button"
                onClick={() => onEdit(index)}
                className={cn(styles.secondary, "col-start-2 min-h-10 justify-self-start px-4 text-sm sm:col-start-3 sm:self-center")}
              >
                {complete ? "Editar" : "Completar"}
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function PartyInfo({ centered = false }: { centered?: boolean }) {
  return (
    <ul className={cn("space-y-2 text-[var(--aw-ivory)]", centered && "text-left")}>
      <li className="flex items-start gap-2.5">
        <CalendarClock className="mt-0.5 size-4 shrink-0 text-[var(--aw-gold)]" aria-hidden />
        {PARTY.when}
      </li>
      <li className="flex items-start gap-2.5">
        <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--aw-gold)]" aria-hidden />
        {PARTY.where}
      </li>
      <li className="flex items-start gap-2.5">
        <Shirt className="mt-0.5 size-4 shrink-0 text-[var(--aw-gold)]" aria-hidden />
        <Link href="/dress-code" className="underline underline-offset-4 hover:text-[var(--aw-gold-bright)]">
          Ver as referências de dress code
        </Link>
      </li>
    </ul>
  );
}

function WinnersBlock({ view }: { view: ReadyView }) {
  return (
    <section aria-labelledby="vencedores-titulo" className="pt-2 sm:pt-4">
      <div className="flex flex-col items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={AWARDS_LOGO_SRC} alt="Bismarchi | Pires Awards" width={900} height={869} className="h-auto w-48 sm:w-60" />
        <p className={cn(styles.kicker, "mt-8")}>Premiação CIVIL · {view.edition.year}</p>
        <h1 id="vencedores-titulo" className={cn(styles.display, "mt-4 text-[clamp(1.9rem,6vw,2.75rem)] text-[var(--aw-ivory)]")}>
          Os vencedores
        </h1>
        <p className="mt-3 max-w-[58ch] leading-7 text-[var(--aw-mist)]">
          Obrigado a todos que indicaram colegas e contaram suas histórias. Estes são os colaboradores que representaram os
          nossos valores em {view.edition.year}.
        </p>
      </div>
      {view.winners.length === 0 ? (
        <p className="mt-10 text-center text-[var(--aw-mist)]">O resultado ainda está sendo preparado.</p>
      ) : (
        <ol className="mt-10 divide-y divide-[var(--aw-line-soft)] border-y border-[var(--aw-line-soft)]">
          {view.winners.map((winner) => {
            const category = AWARD_CATEGORIES.find((item) => item.key === winner.category)!;
            return (
              <li key={winner.category} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-5 py-7 sm:gap-8">
                <span className="relative">
                  <AwardAvatar person={winner.person} size="xl" className="ring-2 ring-[var(--aw-gold)]" />
                  <Seal categoryKey={winner.category} className="absolute -bottom-2 -right-3 w-12 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold tracking-[0.04em] text-[var(--aw-gold-bright)] uppercase">{category.name}</p>
                  <p className="mt-1 text-xl font-semibold text-[var(--aw-ivory)]">{winner.person.short_name}</p>
                  <p className="text-sm text-[var(--aw-mist)]">{winner.person.department}</p>
                  {winner.citation && (
                    <p className="mt-3 max-w-[60ch] leading-7 text-[var(--aw-ivory)]/90">“{winner.citation}”</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
