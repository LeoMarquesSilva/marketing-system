"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  Compass,
  Fingerprint,
  Globe,
  Instagram,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import {
  FIRM_LOGO_ALT,
  FIRM_LOGO_SRC,
  FIRM_WEBSITE_URL,
} from "@/components/profiles/profile-public-utils";
import type { NpsEligibleRespondent } from "@/lib/nps/eligible";
import {
  splitLabelEmphasis,
  type NpsQuestion,
  type NpsScoreField,
  type NpsTextField,
  type NpsTextQuestion,
} from "@/lib/nps/questions";
import styles from "./nps-public-page.module.css";

const FIRM_INSTAGRAM_URL = "https://www.instagram.com/bismarchipires/";

type Screen =
  | "loading"
  | "ready"
  | "submitting"
  | "success"
  | "error"
  | "already"
  | "all_responded";

interface ReadyPayload {
  state: "ready";
  campaign: { id: string; name: string };
  group: { id: string; name: string };
  respondents: NpsEligibleRespondent[];
  questions: NpsQuestion[];
}

interface ErrorPayload {
  state: string;
  message?: string;
  campaign?: { id: string; name: string };
  group?: { id: string; name: string };
}

interface ClientRef {
  name: string;
  campaign: string | null;
}

type LoadOutcome =
  | { kind: "ready"; payload: ReadyPayload }
  | { kind: "all_responded"; message: string; group?: { id: string; name: string }; campaign?: { id: string; name: string } }
  | {
      kind: "error";
      message: string;
      group?: { id: string; name: string };
      campaign?: { id: string; name: string };
    };

function Masthead() {
  return (
    <header className="masthead">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={FIRM_LOGO_SRC} alt={FIRM_LOGO_ALT} className="masthead__logo" />

      <nav className="social" aria-label="Canais do escritório">
        <a
          href={FIRM_WEBSITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="social__link"
        >
          <Globe aria-hidden="true" />
          <span className="social__label">Site</span>
        </a>
        <a
          href={FIRM_INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="social__link"
        >
          <Instagram aria-hidden="true" />
          <span className="social__label">Instagram</span>
        </a>
      </nav>
    </header>
  );
}

function Lede({ client }: { client: ClientRef | null }) {
  return (
    <div className="lede">
      <p className="eyebrow">Pesquisa de satisfação</p>

      <h1 className="lede__title">
        Sua avaliação orienta o <em>nosso próximo passo.</em>
      </h1>

      <p className="lede__note">
        As respostas são lidas pela diretoria e pela equipe responsável pelo seu
        atendimento, e orientam os ajustes que fazemos ao longo do ano.
      </p>

      <div className="facts">
        <div className="fact">
          <Clock3 aria-hidden="true" />
          <span>Menos de dois minutos</span>
        </div>
        <div className="fact">
          <Fingerprint aria-hidden="true" />
          <span>Você se identifica ao responder</span>
        </div>
        <div className="fact">
          <Compass aria-hidden="true" />
          <span>Usada para melhorias reais no atendimento</span>
        </div>
      </div>

      {client && (
        <div className="client">
          <p className="eyebrow">Cliente</p>
          <p className="client__name">{client.name}</p>
          {client.campaign && <p className="client__campaign">{client.campaign}</p>}
        </div>
      )}
    </div>
  );
}

function PublicShell({
  client,
  children,
}: {
  client: ClientRef | null;
  children: React.ReactNode;
}) {
  return (
    <main className={`${styles.root} nps-root`}>
      <div className="page">
        <Masthead />

        <div className="body">
          <Lede client={client} />
          <div className="questions">{children}</div>
        </div>

        <footer className="colophon">
          <div className="colophon__top">
            <div className="colophon__brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/fenix.png" alt="" aria-hidden="true" className="colophon__mark" />
              <div>
                <p className="colophon__firm">Bismarchi | Pires</p>
                <p className="colophon__sub">Sociedade de Advogados</p>
              </div>
            </div>

            <nav className="colophon__links" aria-label="Canais do escritório">
              <a href={FIRM_WEBSITE_URL} target="_blank" rel="noopener noreferrer">
                bismarchipires.com.br
              </a>
              <a href={FIRM_INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
                Instagram
              </a>
            </nav>
          </div>

          <p className="colophon__base">Pesquisa de satisfação · uso interno</p>
        </footer>
      </div>
    </main>
  );
}

/**
 * Combobox próprio: o popup do <select> nativo é desenhado pelo sistema
 * operacional e não aceita estilo. Segue o padrão ARIA de combobox com
 * aria-activedescendant — o foco permanece no gatilho.
 */
function formatRespondedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function RespondentSelect({
  options,
  value,
  onChange,
  disabled,
}: {
  options: NpsEligibleRespondent[];
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectableIndexes = useMemo(
    () =>
      options
        .map((o, i) => (o.alreadyResponded ? -1 : i))
        .filter((i): i is number => i >= 0),
    [options]
  );

  const selectedIndex = options.findIndex((o) => `${o.kind}:${o.id}` === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  /** Mantém a opção destacada visível só dentro da lista (sem scroll da página). */
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const list = listRef.current;
    const option = list?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    if (!list || !option) return;

    const optionTop = option.offsetTop;
    const optionBottom = optionTop + option.offsetHeight;
    const viewTop = list.scrollTop;
    const viewBottom = viewTop + list.clientHeight;

    if (optionTop < viewTop) {
      list.scrollTop = optionTop;
    } else if (optionBottom > viewBottom) {
      list.scrollTop = optionBottom - list.clientHeight;
    }
  }, [open, activeIndex]);

  function firstSelectableIndex() {
    if (selectedIndex >= 0 && !options[selectedIndex]?.alreadyResponded) {
      return selectedIndex;
    }
    return selectableIndexes[0] ?? 0;
  }

  function openList() {
    if (disabled) return;
    setActiveIndex(firstSelectableIndex());
    setOpen(true);
  }

  function commit(index: number) {
    const option = options[index];
    if (!option || option.alreadyResponded) return;
    onChange(`${option.kind}:${option.id}`);
    setOpen(false);
  }

  function moveActive(direction: 1 | -1) {
    if (selectableIndexes.length === 0) return;
    const currentPos = selectableIndexes.indexOf(activeIndex);
    const nextPos =
      currentPos < 0
        ? direction === 1
          ? 0
          : selectableIndexes.length - 1
        : Math.min(
            selectableIndexes.length - 1,
            Math.max(0, currentPos + direction)
          );
    setActiveIndex(selectableIndexes[nextPos]!);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (disabled) return;

    if (!open) {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openList();
      }
      return;
    }

    switch (event.key) {
      case "Escape":
        event.preventDefault();
        setOpen(false);
        break;
      case "ArrowDown":
        event.preventDefault();
        moveActive(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveActive(-1);
        break;
      case "Home":
        event.preventDefault();
        if (selectableIndexes[0] != null) setActiveIndex(selectableIndexes[0]);
        break;
      case "End":
        event.preventDefault();
        if (selectableIndexes.length > 0) {
          setActiveIndex(selectableIndexes[selectableIndexes.length - 1]!);
        }
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        commit(activeIndex);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  return (
    <div className={open ? "combo is-open" : "combo"} ref={rootRef}>
      <button
        type="button"
        id="nps-respondent"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="nps-respondent-list"
        aria-labelledby="nps-respondent-label nps-respondent"
        aria-activedescendant={
          open && activeIndex >= 0 ? `nps-respondent-opt-${activeIndex}` : undefined
        }
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleKeyDown}
        className={selected ? "combo__trigger" : "combo__trigger is-placeholder"}
      >
        <span className="combo__value">
          {selected ? selected.name : "Selecione o seu nome"}
        </span>
        <ChevronDown className="combo__chevron" aria-hidden="true" />
      </button>

      {open && (
        <ul
          id="nps-respondent-list"
          ref={listRef}
          role="listbox"
          aria-label="Respondentes elegíveis"
          className="combo__list"
        >
          {options.map((option, index) => {
            const key = `${option.kind}:${option.id}`;
            const isSelected = key === value;
            const already = Boolean(option.alreadyResponded);
            return (
              <li
                key={key}
                id={`nps-respondent-opt-${index}`}
                data-index={index}
                data-active={!already && index === activeIndex}
                data-disabled={already || undefined}
                role="option"
                aria-selected={isSelected}
                aria-disabled={already}
                className={already ? "combo__option is-disabled" : "combo__option"}
                onMouseEnter={() => {
                  if (!already) setActiveIndex(index);
                }}
                onClick={() => commit(index)}
              >
                <span className="combo__name">
                  {option.name}
                  {already && option.respondedAt && (
                    <span className="combo__done">
                      Já respondeu · {formatRespondedAt(option.respondedAt)}
                    </span>
                  )}
                  {already && !option.respondedAt && (
                    <span className="combo__done">Já respondeu</span>
                  )}
                </span>
                {already ? (
                  <Check className="combo__check is-done" aria-hidden="true" />
                ) : (
                  isSelected && <Check className="combo__check" aria-hidden="true" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Enunciado com os termos-chave em negrito, preservando o texto original. */
function QuestionLabel({ label, emphasis }: { label: string; emphasis?: string[] }) {
  return (
    <>
      {splitLabelEmphasis(label, emphasis).map((part, i) =>
        part.strong ? <strong key={i}>{part.text}</strong> : <span key={i}>{part.text}</span>
      )}
    </>
  );
}

type Tone = "low" | "mid" | "high";

function scoreTone(n: number): Tone {
  if (n <= 6) return "low";
  if (n <= 8) return "mid";
  return "high";
}

const TONE_LABEL: Record<Tone, string> = {
  low: "Baixa",
  mid: "Média",
  high: "Alta",
};

function ScorePicker({
  value,
  onChange,
  disabled,
  lowLabel,
  highLabel,
}: {
  value: number | null;
  onChange: (n: number) => void;
  disabled?: boolean;
  lowLabel?: string;
  highLabel?: string;
}) {
  const tone = value == null ? null : scoreTone(value);

  return (
    <div className="scale">
      <div className="scale__track" role="radiogroup" aria-label="Nota de 0 a 10">
        {Array.from({ length: 11 }, (_, n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`Nota ${n}`}
            disabled={disabled}
            onClick={() => onChange(n)}
            className={`mark tone-${scoreTone(n)}`}
          >
            <span className="mark__dot">{n}</span>
          </button>
        ))}
      </div>

      <div className="scale__ends">
        <span>{lowLabel ?? "Baixa"}</span>
        <span>{highLabel ?? "Alta"}</span>
      </div>

      <p className={tone ? `scale__readout tone-${tone}` : "scale__readout"}>
        {value != null && tone ? (
          <>
            <strong>Nota {value}</strong> · {TONE_LABEL[tone]}
          </>
        ) : (
          " "
        )}
      </p>
    </div>
  );
}

export function NpsPublicClient({ token }: { token: string }) {
  const [screen, setScreen] = useState<Screen>("loading");
  const [payload, setPayload] = useState<ReadyPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [groupLabel, setGroupLabel] = useState<string | null>(null);
  const [campaignLabel, setCampaignLabel] = useState<string | null>(null);

  const [respondentKey, setRespondentKey] = useState("");
  const [scores, setScores] = useState<Partial<Record<NpsScoreField, number>>>({});
  const [texts, setTexts] = useState<Partial<Record<NpsTextField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const fetchSurvey = useCallback(async (): Promise<LoadOutcome> => {
    try {
      const res = await fetch(`/api/nps/public/${encodeURIComponent(token)}`);
      const data = (await res.json()) as ReadyPayload | ErrorPayload;
      if (data.state === "ready") {
        return { kind: "ready", payload: data as ReadyPayload };
      }
      const err = data as ErrorPayload;
      if (err.state === "all_responded") {
        return {
          kind: "all_responded",
          message:
            err.message ??
            "Todos os contatos deste cliente já responderam esta pesquisa. Obrigado pela participação.",
          group: err.group,
          campaign: err.campaign,
        };
      }
      return {
        kind: "error",
        message: err.message ?? "Não foi possível abrir a pesquisa.",
        group: err.group,
        campaign: err.campaign,
      };
    } catch {
      return { kind: "error", message: "Falha de conexão. Tente novamente." };
    }
  }, [token]);

  const applyOutcome = useCallback((outcome: LoadOutcome) => {
    if (outcome.kind === "ready") {
      setPayload(outcome.payload);
      setGroupLabel(outcome.payload.group.name);
      setCampaignLabel(outcome.payload.campaign.name);
      setScreen("ready");
      return;
    }
    if (outcome.group) setGroupLabel(outcome.group.name);
    if (outcome.campaign) setCampaignLabel(outcome.campaign.name);
    setErrorMessage(outcome.message);
    if (outcome.kind === "all_responded") {
      setScreen("all_responded");
      return;
    }
    setScreen("error");
  }, []);

  /** Retentativa manual: volta para "carregando" antes de refazer a busca. */
  const retry = useCallback(() => {
    setScreen("loading");
    setErrorMessage(null);
    void fetchSurvey().then(applyOutcome);
  }, [fetchSurvey, applyOutcome]);

  useEffect(() => {
    let cancelled = false;
    void fetchSurvey().then((outcome) => {
      if (!cancelled) applyOutcome(outcome);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchSurvey, applyOutcome]);

  const respondentOptions = useMemo(() => payload?.respondents ?? [], [payload]);

  /**
   * Agrupa em seções numeradas: campos de texto marcados com `attachToPrevious`
   * entram no bloco da pergunta anterior em vez de abrir uma seção própria.
   */
  const sections = useMemo(() => {
    const grouped: Array<{ lead: NpsQuestion; attached: NpsTextQuestion[] }> = [];
    for (const question of payload?.questions ?? []) {
      const last = grouped[grouped.length - 1];
      if (question.kind === "text" && question.attachToPrevious && last) {
        last.attached.push(question);
      } else {
        grouped.push({ lead: question, attached: [] });
      }
    }
    return grouped;
  }, [payload]);

  const client: ClientRef | null = groupLabel
    ? { name: groupLabel, campaign: campaignLabel }
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!payload) return;
    setFormError(null);

    const [kind, id] = respondentKey.split(":");
    if ((kind !== "contact" && kind !== "person") || !id) {
      setFormError("Selecione quem está respondendo.");
      return;
    }

    const chosen = payload.respondents.find((r) => r.kind === kind && r.id === id);
    if (!chosen || chosen.alreadyResponded) {
      setFormError("Esta pessoa já respondeu. Selecione outro nome na lista.");
      return;
    }

    const body = {
      respondentKind: kind,
      respondentId: id,
      score_recommend: scores.score_recommend,
      reason: texts.reason ?? null,
      score_availability: scores.score_availability,
      score_communication: scores.score_communication,
      score_innovation: scores.score_innovation,
      score_technical: scores.score_technical,
      improvement: texts.improvement ?? null,
    };

    setScreen("submitting");
    try {
      const res = await fetch(`/api/nps/public/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { success?: boolean; error?: string; code?: string };
      if (res.status === 409 || data.code === "ALREADY_RESPONDED") {
        setScreen("already");
        return;
      }
      if (!res.ok || !data.success) {
        setFormError(data.error ?? "Não foi possível enviar. Tente novamente.");
        setScreen("ready");
        return;
      }
      setScreen("success");
    } catch {
      setFormError("Falha de conexão. Tente novamente.");
      setScreen("ready");
    }
  }

  if (screen === "loading") {
    return (
      <PublicShell client={null}>
        <div className="status">
          <LoaderCircle className="status__icon spin" aria-hidden="true" />
          <p className="status__text">Carregando pesquisa…</p>
        </div>
      </PublicShell>
    );
  }

  if (screen === "success" || screen === "already" || screen === "all_responded") {
    return (
      <PublicShell client={client}>
        <div className="status">
          <Check className="status__icon is-good" aria-hidden="true" />
          <h2 className="status__title">
            {screen === "all_responded"
              ? "Pesquisa já respondida"
              : screen === "already"
                ? "Você já respondeu"
                : "Obrigado pela sua avaliação"}
          </h2>
          <p className="status__text">
            {screen === "all_responded"
              ? errorMessage ??
                "Todos os contatos deste cliente já responderam esta pesquisa. Obrigado pela participação."
              : screen === "already"
                ? "Sua resposta já foi registrada nesta pesquisa. Agradecemos a participação."
                : "Sua avaliação foi registrada e será analisada pela equipe responsável pelo seu atendimento."}
          </p>
          <p className="status__tag">Bismarchi | Pires</p>
        </div>
      </PublicShell>
    );
  }

  if (screen === "error" || !payload) {
    return (
      <PublicShell client={client}>
        <div className="status">
          <TriangleAlert className="status__icon is-bad" aria-hidden="true" />
          <h2 className="status__title">Pesquisa indisponível</h2>
          <p className="status__text">{errorMessage}</p>
          <div className="status__action">
            <button type="button" className="submit" onClick={retry}>
              Tentar novamente
              <ArrowRight aria-hidden="true" />
            </button>
          </div>
        </div>
      </PublicShell>
    );
  }

  const submitting = screen === "submitting";

  return (
    <PublicShell client={client}>
      <form onSubmit={(e) => void handleSubmit(e)} className="form">
        <div className={respondentKey ? "field is-answered" : "field"}>
          <span id="nps-respondent-label" className="field__label">
            Quem está respondendo
          </span>
          <RespondentSelect
            options={respondentOptions}
            value={respondentKey}
            onChange={setRespondentKey}
            disabled={submitting}
          />
        </div>

        {sections.map(({ lead, attached }, i) => {
          const index = String(i + 1).padStart(2, "0");
          const answered =
            lead.kind === "scale"
              ? scores[lead.id] != null
              : (texts[lead.id] ?? "").trim().length > 0;

          return (
            <div key={lead.id} className={answered ? "q is-answered" : "q"}>
              <div className="q__head">
                <span className="q__num" aria-hidden="true">
                  {index}
                </span>
                {lead.kind === "scale" ? (
                  <p className="q__label">
                    <QuestionLabel label={lead.label} emphasis={lead.emphasis} />
                  </p>
                ) : (
                  <label htmlFor={lead.id} className="q__label">
                    <QuestionLabel label={lead.label} emphasis={lead.emphasis} />
                  </label>
                )}
              </div>

              <div className="q__body">
                {lead.kind === "scale" ? (
                  <ScorePicker
                    value={scores[lead.id] ?? null}
                    disabled={submitting}
                    lowLabel={lead.lowLabel}
                    highLabel={lead.highLabel}
                    onChange={(n) => setScores((prev) => ({ ...prev, [lead.id]: n }))}
                  />
                ) : (
                  <textarea
                    id={lead.id}
                    rows={lead.rows ?? 3}
                    disabled={submitting}
                    placeholder={lead.placeholder}
                    value={texts[lead.id] ?? ""}
                    onChange={(e) =>
                      setTexts((prev) => ({ ...prev, [lead.id]: e.target.value }))
                    }
                    className="textarea"
                  />
                )}
              </div>

              {attached.map((sub) => (
                <div key={sub.id} className="q__sub">
                  <label htmlFor={sub.id} className="q__sub-label">
                    {sub.label}
                  </label>
                  <textarea
                    id={sub.id}
                    rows={sub.rows ?? 3}
                    disabled={submitting}
                    placeholder={sub.placeholder}
                    value={texts[sub.id] ?? ""}
                    onChange={(e) =>
                      setTexts((prev) => ({ ...prev, [sub.id]: e.target.value }))
                    }
                    className="textarea"
                  />
                </div>
              ))}
            </div>
          );
        })}

        <div className="foot">
          {formError && <p className="alert">{formError}</p>}

          <button type="submit" disabled={submitting} className="submit">
            {submitting ? (
              <>
                <LoaderCircle className="spin" aria-hidden="true" />
                Enviando
              </>
            ) : (
              <>
                Enviar resposta
                <ArrowRight aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </form>
    </PublicShell>
  );
}
