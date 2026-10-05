"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Check, Clock3, LoaderCircle, LockKeyhole, TriangleAlert } from "lucide-react";
import { FIRM_LOGO_ALT, FIRM_LOGO_SRC } from "@/components/profiles/profile-public-utils";
import {
  RegistrationFormFields,
  registrationFieldId,
} from "@/components/rh/registration/registration-form-fields";
import {
  REGISTRATION_KIND_LABEL,
  type RegistrationAnswers,
  type RegistrationField,
  type RegistrationKind,
} from "@/lib/rh/registration/types";
import {
  firstErrorField,
  normalizeRegistrationAnswers,
  validateRegistrationAnswers,
  type RegistrationErrors,
} from "@/lib/rh/registration/validation";
import styles from "./ficha-cadastral-public.module.css";

type Payload =
  | { state: "not_found" | "expired" | "cancelled" | "rate_limited" }
  | { state: "submitted"; inviteeName: string; submittedAt: string | null }
  | {
      state: "ready";
      kind: RegistrationKind;
      inviteeName: string;
      answers: RegistrationAnswers;
      reopenNote: string | null;
      expiresAt: string;
    };

type Screen =
  | { kind: "loading" }
  | { kind: "message"; tone: "neutral" | "warning"; title: string; body: string }
  | { kind: "done"; firstName: string }
  | { kind: "form"; payload: Extract<Payload, { state: "ready" }> };

const MESSAGES: Record<string, { title: string; body: string; tone: "neutral" | "warning" }> = {
  not_found: {
    tone: "warning",
    title: "link não encontrado",
    body: "Confira se o endereço foi copiado inteiro. Se o problema continuar, fale com a equipe de Pessoas e Cultura.",
  },
  expired: {
    tone: "warning",
    title: "este link expirou",
    body: "Peça um novo link à equipe de Pessoas e Cultura. É rapidinho.",
  },
  cancelled: {
    tone: "warning",
    title: "esta ficha foi cancelada",
    body: "Se você ainda precisa enviar seus dados, peça um novo link à equipe de Pessoas e Cultura.",
  },
  rate_limited: {
    tone: "warning",
    title: "muitas tentativas",
    body: "Aguarde um minuto e recarregue a página.",
  },
};

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

function Masthead() {
  return (
    <header className={styles.masthead}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={FIRM_LOGO_SRC} alt={FIRM_LOGO_ALT} className={styles.logo} />
      <span className={styles.mastheadTag}>Pessoas e Cultura</span>
    </header>
  );
}

export function FichaCadastralPublicClient({ token }: { token: string }) {
  const [screen, setScreen] = useState<Screen>({ kind: "loading" });
  const [answers, setAnswers] = useState<RegistrationAnswers | null>(null);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/ficha-cadastral/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as Payload | null;
        if (cancelled) return;
        if (!payload || !("state" in payload)) {
          setScreen({ kind: "message", tone: "warning", title: "algo deu errado", body: "Recarregue a página em instantes." });
          return;
        }
        if (payload.state === "ready") {
          setAnswers(payload.answers);
          setScreen({ kind: "form", payload });
        } else if (payload.state === "submitted") {
          setScreen({
            kind: "message",
            tone: "neutral",
            title: "ficha já enviada",
            body: "Recebemos seus dados. A equipe de Pessoas e Cultura vai revisar e, se precisar de algum ajuste, entra em contato com você.",
          });
        } else {
          setScreen({ kind: "message", ...MESSAGES[payload.state] });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setScreen({ kind: "message", tone: "warning", title: "sem conexão", body: "Verifique sua internet e recarregue a página." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleChange = useCallback(
    <K extends RegistrationField>(field: K, value: RegistrationAnswers[K]) => {
      setAnswers((current) => (current ? { ...current, [field]: value } : current));
      setErrors((current) => {
        if (!current[field]) return current;
        const next = { ...current };
        delete next[field];
        return next;
      });
    },
    []
  );

  async function handleSubmit(kind: RegistrationKind) {
    if (!answers) return;
    setSubmitError(null);
    const normalized = normalizeRegistrationAnswers(answers, kind);
    const nextErrors = validateRegistrationAnswers(normalized, kind);
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
      const response = await fetch(`/api/ficha-cadastral/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: normalized, consent: true }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        fieldErrors?: RegistrationErrors;
      };
      if (!response.ok) {
        if (data.fieldErrors) {
          setErrors(data.fieldErrors);
          const field = firstErrorField(data.fieldErrors);
          if (field) scrollToField(field);
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

  const errorCount = Object.keys(errors).length;

  return (
    <div className={styles.root}>
      <div className={styles.page}>
        <Masthead />

        {screen.kind === "loading" && (
          <div className={styles.centered} aria-live="polite">
            <LoaderCircle className={styles.spinner} aria-hidden />
            <span>Carregando sua ficha…</span>
          </div>
        )}

        {screen.kind === "message" && (
          <section className={styles.notice} data-tone={screen.tone}>
            {screen.tone === "warning" ? (
              <TriangleAlert className={styles.noticeIcon} aria-hidden />
            ) : (
              <Check className={styles.noticeIcon} aria-hidden />
            )}
            <h1 className={styles.noticeTitle}>{screen.title}</h1>
            <p className={styles.noticeBody}>{screen.body}</p>
          </section>
        )}

        {screen.kind === "done" && (
          <section className={styles.notice} data-tone="success">
            <Check className={styles.noticeIcon} aria-hidden />
            <h1 className={styles.noticeTitle}>
              {screen.firstName ? `obrigado, ${screen.firstName.toLowerCase()}` : "obrigado"}
            </h1>
            <p className={styles.noticeBody}>
              Sua ficha foi enviada para a equipe de Pessoas e Cultura. Ela fica travada para revisão; se algo
              precisar de ajuste, você recebe um novo contato. Pode fechar esta página.
            </p>
          </section>
        )}

        {screen.kind === "form" && answers && (
          <>
            <section className={styles.hero}>
              <p className={styles.eyebrow}>Ficha cadastral · {REGISTRATION_KIND_LABEL[screen.payload.kind]}</p>
              <h1 className={styles.title}>
                {firstName(screen.payload.inviteeName)
                  ? `boas-vindas, ${firstName(screen.payload.inviteeName).toLowerCase()}`
                  : "boas-vindas"}
              </h1>
              <p className={styles.lede}>
                Para começar seu cadastro no escritório, precisamos de alguns dados. Leva cerca de 5 minutos. Tenha à
                mão RG, CPF, PIS e os dados da sua conta bancária.
              </p>
              <ul className={styles.meta}>
                <li>
                  <Clock3 aria-hidden /> Link válido até {formatDate(screen.payload.expiresAt)}
                </li>
                <li>
                  <LockKeyhole aria-hidden /> Seus dados ficam visíveis só para Pessoas e Cultura
                </li>
              </ul>
            </section>

            {screen.payload.reopenNote && (
              <section className={styles.reopen} role="note">
                <p className={styles.reopenLabel}>Pessoas e Cultura pediu um ajuste</p>
                <p className={styles.reopenText}>{screen.payload.reopenNote}</p>
              </section>
            )}

            <form
              className={styles.form}
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubmit(screen.payload.kind);
              }}
            >
              <RegistrationFormFields
                kind={screen.payload.kind}
                answers={answers}
                errors={errors}
                disabled={submitting}
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
                    Declaro que as informações são verdadeiras e autorizo o Bismarchi | Pires a usá-las para minha
                    admissão e para a gestão do meu vínculo, conforme a LGPD.
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
                      Enviar ficha <ArrowRight aria-hidden />
                    </>
                  )}
                </button>
                <p className={styles.finePrint}>
                  Depois de enviada, a ficha fica travada até a revisão de Pessoas e Cultura.
                </p>
              </section>
            </form>
          </>
        )}

        <footer className={styles.colophon}>Bismarchi | Pires Sociedade de Advogados</footer>
      </div>
    </div>
  );
}
