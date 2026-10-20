"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, LoaderCircle, LockKeyhole, RefreshCw, TriangleAlert } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { FIRM_LOGO_ALT, FIRM_LOGO_SRC } from "@/components/profiles/profile-public-utils";
import {
  RegistrationFormFields,
  registrationFieldId,
  withCompanionFields,
} from "@/components/rh/registration/registration-form-fields";
import styles from "@/components/rh/registration/ficha-publica.module.css";
import { loginPathWithReturn } from "@/lib/login-redirect";
import {
  SELF_REGISTRATION_PATH,
  type RegistrationAnswers,
  type RegistrationField,
  type RegistrationKind,
  type RegistrationStatus,
} from "@/lib/rh/registration/types";
import {
  firstErrorField,
  missingRegistrationFields,
  normalizeRegistrationAnswers,
  registrationProgress,
  validateRegistrationAnswers,
  type RegistrationErrors,
} from "@/lib/rh/registration/validation";

type ReadyPayload = {
  state: "ready";
  employeeName: string;
  kind: RegistrationKind;
  vinculoLabel: string;
  answers: RegistrationAnswers;
  form: {
    status: RegistrationStatus;
    submittedAt: string | null;
    approvedAt: string | null;
    reopenNote: string | null;
  } | null;
};

type Payload = { state: "no_employee" } | ReadyPayload;

type Screen =
  | { kind: "loading" }
  | { kind: "message"; title: string; body: string }
  | { kind: "done"; firstName: string }
  | { kind: "form"; payload: ReadyPayload };

type Mode = "missing" | "all";

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" }).format(
    new Date(iso)
  );
}

function scrollToField(field: RegistrationField) {
  const element = document.getElementById(registrationFieldId(field));
  const wrapper = element?.closest("[data-field]") ?? element;
  wrapper?.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => element?.focus({ preventScroll: true }), 350);
}

async function fetchOwnRegistration(): Promise<Screen> {
  try {
    const response = await fetch("/api/minha-ficha", { cache: "no-store" });
    const data = (await response.json().catch(() => null)) as (Payload & { error?: string }) | null;
    if (!response.ok || !data || !("state" in data)) {
      return {
        kind: "message",
        title: "algo deu errado",
        body: data?.error ?? "Não foi possível carregar sua ficha. Recarregue a página em instantes.",
      };
    }
    if (data.state === "no_employee") {
      return {
        kind: "message",
        title: "ficha não encontrada",
        body: "Não achamos um cadastro de colaborador ativo ligado ao seu usuário. Fale com a equipe de Pessoas e Cultura para conferir.",
      };
    }
    return { kind: "form", payload: data };
  } catch {
    return { kind: "message", title: "sem conexão", body: "Verifique sua internet e recarregue a página." };
  }
}

export function MinhaFichaClient() {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const [screen, setScreen] = useState<Screen>({ kind: "loading" });
  const [answers, setAnswers] = useState<RegistrationAnswers | null>(null);
  const [initialMissing, setInitialMissing] = useState<RegistrationField[]>([]);
  const [mode, setMode] = useState<Mode>("missing");
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const applyScreen = useCallback((next: Screen) => {
    if (next.kind === "form") {
      const missing = missingRegistrationFields(next.payload.answers, next.payload.kind);
      setAnswers(next.payload.answers);
      setInitialMissing(missing);
      setMode(missing.length > 0 ? "missing" : "all");
      setErrors({});
      setConsent(false);
      setConsentError(false);
      setSubmitError(null);
    }
    setScreen(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchOwnRegistration().then((next) => {
      if (!cancelled) applyScreen(next);
    });
    return () => {
      cancelled = true;
    };
  }, [applyScreen]);

  const handleChange = useCallback(<K extends RegistrationField>(field: K, value: RegistrationAnswers[K]) => {
    setAnswers((current) => (current ? { ...current, [field]: value } : current));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }, []);

  const payload = screen.kind === "form" ? screen.payload : null;
  const kind = payload?.kind ?? null;

  const progress = useMemo(
    () => (answers && kind ? registrationProgress(answers, kind) : { required: [], missing: [], filled: 0 }),
    [answers, kind]
  );
  const required = progress.required;
  const currentMissing = progress.missing;
  const missingSet = useMemo(() => new Set(currentMissing), [currentMissing]);
  // No "só o que falta" a lista fica fixa (o que faltava ao abrir + o que o envio recusou),
  // para o campo não sumir enquanto a pessoa digita.
  const visibleFields = useMemo(
    () =>
      mode === "missing"
        ? withCompanionFields([...initialMissing, ...(Object.keys(errors) as RegistrationField[])])
        : null,
    [mode, initialMissing, errors]
  );

  const filledCount = progress.filled;
  const percent = required.length ? Math.round((filledCount / required.length) * 100) : 100;

  async function handleSignOut() {
    await signOut();
    router.replace(loginPathWithReturn(SELF_REGISTRATION_PATH, ""));
  }

  async function handleSubmit(currentKind: RegistrationKind) {
    if (!answers) return;
    setSubmitError(null);
    const normalized = normalizeRegistrationAnswers(answers, currentKind);
    const nextErrors = validateRegistrationAnswers(normalized, currentKind);
    setErrors(nextErrors);
    const firstError = firstErrorField(nextErrors);
    if (firstError) {
      scrollToField(firstError);
      return;
    }
    if (!consent) {
      setConsentError(true);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/minha-ficha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: normalized, consent: true }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; fieldErrors?: RegistrationErrors };
      if (!response.ok) {
        if (data.fieldErrors) {
          setErrors(data.fieldErrors);
          const field = firstErrorField(data.fieldErrors);
          if (field) window.setTimeout(() => scrollToField(field), 50);
        }
        setSubmitError(data.error ?? "Não foi possível enviar. Tente de novo.");
        return;
      }
      setScreen({ kind: "done", firstName: firstName(normalized.fullName) });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setSubmitError("Sem conexão. Verifique sua internet e tente de novo.");
    } finally {
      setSubmitting(false);
    }
  }

  async function reload() {
    setScreen({ kind: "loading" });
    applyScreen(await fetchOwnRegistration());
  }

  const errorCount = Object.keys(errors).length;
  const displayName = payload ? firstName(profile?.name || payload.employeeName) : "";

  return (
    <div className={styles.root}>
      <div className={styles.page}>
        <header className={styles.masthead}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={FIRM_LOGO_SRC} alt={FIRM_LOGO_ALT} className={styles.logo} />
          <span className={styles.mastheadTag}>Pessoas e Cultura</span>
        </header>

        {screen.kind === "loading" && (
          <div className={styles.centered} aria-live="polite">
            <LoaderCircle className={styles.spinner} aria-hidden />
            <span>Carregando sua ficha…</span>
          </div>
        )}

        {screen.kind === "message" && (
          <section className={styles.notice} data-tone="warning">
            <TriangleAlert className={styles.noticeIcon} aria-hidden />
            <h1 className={styles.noticeTitle}>{screen.title}</h1>
            <p className={styles.noticeBody}>{screen.body}</p>
            <div className={styles.actions}>
              <Link href="/" className={styles.ghostButton}>
                <ArrowLeft aria-hidden /> Voltar ao sistema
              </Link>
            </div>
          </section>
        )}

        {screen.kind === "done" && (
          <section className={styles.notice} data-tone="success">
            <Check className={styles.noticeIcon} aria-hidden />
            <h1 className={styles.noticeTitle}>
              {screen.firstName ? `obrigado, ${screen.firstName.toLowerCase()}` : "obrigado"}
            </h1>
            <p className={styles.noticeBody}>
              Sua atualização foi enviada para a equipe de Pessoas e Cultura, que revisa antes de passar para o seu
              cadastro. Se algo precisar de ajuste, você vê o recado aqui mesmo.
            </p>
            <div className={styles.actions}>
              <Link href="/" className={styles.ghostButton}>
                <ArrowLeft aria-hidden /> Voltar ao sistema
              </Link>
              <button type="button" className={styles.ghostButton} onClick={() => void reload()}>
                <RefreshCw aria-hidden /> Ver minha ficha
              </button>
            </div>
          </section>
        )}

        {screen.kind === "form" && payload && answers && (
          <>
            <section className={styles.hero}>
              <p className={styles.eyebrow}>Ficha cadastral · {payload.vinculoLabel}</p>
              <h1 className={styles.title}>{displayName ? `olá, ${displayName.toLowerCase()}` : "olá"}</h1>
              <p className={styles.lede}>
                {initialMissing.length > 0
                  ? "Confira seus dados e complete o que falta."
                  : "Sua ficha está completa. Se algo mudou, é só atualizar."}
              </p>
            </section>

            {payload.form?.reopenNote && (
              <section className={styles.reopen} role="note">
                <p className={styles.reopenLabel}>Pessoas e Cultura pediu um ajuste</p>
                <p className={styles.reopenText}>{payload.form.reopenNote}</p>
              </section>
            )}
            {payload.form?.status === "recebida" && payload.form.submittedAt && (
              <section className={styles.status} role="note">
                <p>
                  Sua atualização de {formatDate(payload.form.submittedAt)} está com Pessoas e Cultura para revisão.
                  Se precisar corrigir algo, ajuste abaixo e envie de novo.
                </p>
              </section>
            )}
            {payload.form?.status === "aprovada" && payload.form.approvedAt && (
              <section className={styles.status} role="note">
                <p>
                  Ficha revisada por Pessoas e Cultura em {formatDate(payload.form.approvedAt)}. Mudou alguma coisa?
                  Atualize abaixo.
                </p>
              </section>
            )}

            <section className={styles.progress} aria-live="polite">
              <div className={styles.progressHead}>
                {currentMissing.length === 0 ? (
                  <p className={styles.progressCount}>
                    <Check className={styles.progressDone} aria-hidden /> tudo preenchido
                  </p>
                ) : (
                  <p className={styles.progressCount}>
                    <span className={styles.progressNumber}>{currentMissing.length}</span>
                    {currentMissing.length === 1 ? "informação para completar" : "informações para completar"}
                  </p>
                )}
                <p className={styles.progressMeta}>
                  {filledCount} de {required.length} preenchidas
                </p>
              </div>
              <div className={styles.bar} role="presentation">
                <div className={styles.barFill} style={{ width: `${percent}%` }} />
              </div>
              {initialMissing.length > 0 && (
                <div className={styles.modeToggle} role="group" aria-label="O que mostrar">
                  <button
                    type="button"
                    className={styles.modeOption}
                    aria-pressed={mode === "missing"}
                    onClick={() => setMode("missing")}
                  >
                    Só o que falta
                  </button>
                  <button
                    type="button"
                    className={styles.modeOption}
                    aria-pressed={mode === "all"}
                    onClick={() => setMode("all")}
                  >
                    Ficha completa
                  </button>
                </div>
              )}
            </section>

            <form
              className={styles.form}
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubmit(payload.kind);
              }}
            >
              <RegistrationFormFields
                kind={payload.kind}
                answers={answers}
                errors={errors}
                disabled={submitting}
                visibleFields={visibleFields}
                missingFields={missingSet}
                onChange={handleChange}
              />

              <section className={styles.finish}>
                <label className={styles.consent} data-invalid={consentError || undefined}>
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => {
                      setConsent(event.target.checked);
                      setConsentError(false);
                    }}
                  />
                  <span>
                    Declaro que as informações são verdadeiras e autorizo o Bismarchi | Pires a usá-las para a gestão
                    do meu vínculo, conforme a LGPD.
                  </span>
                </label>
                {consentError && (
                  <p className={styles.inlineError} role="alert">
                    Marque a declaração para enviar.
                  </p>
                )}
                {errorCount > 0 && (
                  <p className={styles.inlineError} role="alert">
                    {errorCount === 1 ? "Falta ajustar 1 campo." : `Faltam ajustar ${errorCount} campos.`}
                  </p>
                )}
                {submitError && errorCount === 0 && (
                  <p className={styles.inlineError} role="alert">
                    {submitError}
                  </p>
                )}
                <button type="submit" className={styles.submit} disabled={submitting}>
                  {submitting ? (
                    <>
                      <LoaderCircle className={styles.spinner} aria-hidden /> Enviando…
                    </>
                  ) : (
                    <>
                      Enviar atualização <ArrowRight aria-hidden />
                    </>
                  )}
                </button>
                <p className={styles.finePrint}>
                  <LockKeyhole aria-hidden /> Só você e Pessoas e Cultura veem estes dados. A atualização passa pela
                  revisão antes de entrar no seu cadastro.
                </p>
              </section>
            </form>

            <div className={styles.actions}>
              <Link href="/" className={styles.ghostButton}>
                <ArrowLeft aria-hidden /> Voltar ao sistema
              </Link>
            </div>
            {profile?.email && (
              <p className={styles.whoami}>
                <span>Conectado como {profile.email}</span>
                <button type="button" className={styles.linkButton} onClick={() => void handleSignOut()}>
                  Não é você? Sair
                </button>
              </p>
            )}
          </>
        )}

        <footer className={styles.colophon}>Bismarchi | Pires Sociedade de Advogados</footer>
      </div>
    </div>
  );
}
