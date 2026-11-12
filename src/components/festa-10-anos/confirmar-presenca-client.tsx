"use client";

import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Bus,
  CalendarPlus,
  CalendarX2,
  Car,
  Check,
  Download,
  ExternalLink,
  Loader2,
  PartyPopper,
  Shirt,
  User,
  UserPlus,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  RSVP_TRANSPORT_LABEL,
  firstNameOf,
  formatRsvpDeadline,
  usesOutbound,
  usesReturn,
  type RsvpTransport,
  type RsvpView,
} from "@/lib/event-rsvp";
import { DIETARY_NO_RESTRICTION, dietaryText, type DietaryChoice } from "@/lib/festa-convite";
import { DietaryPicker, FIELD, dietaryReady } from "./convite-client";
import { FESTA_ICS_PATH, googleCalendarUrl, outlookCalendarUrl } from "@/lib/festa-10-anos-agenda";
import {
  CALENDAR_BUTTON,
  ChoiceCard,
  FestaCard as Card,
  FestaShell,
  GOLD_BUTTON,
  GOLD_TEXT,
  OUTLINE_BUTTON,
  Ornament,
  formatRespondedAt,
  requestJson,
} from "./festa-ui";

const API = "/api/festa-10-anos";

type TransportOption = { value: RsvpTransport; icon: LucideIcon; title: string; hint: string };

const TRANSPORT_OPTIONS: TransportOption[] = [
  { value: "ida_volta", icon: Bus, title: "Ida e volta", hint: "Vou e volto de micro-ônibus" },
  { value: "so_ida", icon: ArrowRight, title: "Só ida", hint: "Volto por conta própria" },
  { value: "so_volta", icon: ArrowLeft, title: "Só volta", hint: "Vou por conta própria" },
  { value: "nao", icon: Car, title: "Não vou usar", hint: "Vou e volto por conta própria" },
];

function transportSentence(transport: RsvpTransport | null, withCompanion = false): string {
  const who = withCompanion ? "Vocês vão" : "Você vai";
  if (transport === "ida_volta") return `${who} e ${withCompanion ? "voltam" : "volta"} com a gente, saindo do escritório.`;
  if (transport === "so_ida") return `${who} com a gente, saindo do escritório, e ${withCompanion ? "voltam" : "volta"} por conta própria.`;
  if (transport === "so_volta") return `${who} por conta própria e ${withCompanion ? "voltam" : "volta"} com a gente ao final da festa.`;
  return `${who} e ${withCompanion ? "voltam" : "volta"} por conta própria.`;
}

type CompanionFields = Pick<RsvpView, "plusOne" | "plusOneName" | "plusOneDietary" | "ownDietary">;

function Shell({
  firstName,
  title = "Confirme sua presença",
  message = "Nossa festa de 10 anos está chegando, e queremos celebrar esse marco ao lado de todos que fazem parte da nossa história.",
  children,
}: {
  firstName?: string;
  title?: string;
  message?: string;
  children: ReactNode;
}) {
  return (
    <FestaShell
      title={title}
      intro={
        <p>
          {firstName ? <strong className="font-semibold text-[#0d1e2e]">Olá, {firstName}! </strong> : null}
          {message}
        </p>
      }
      footer={
        <Link href="/" className="underline-offset-4 hover:underline">
          Ir para o ORQESTRAI
        </Link>
      }
    >
      {children}
    </FestaShell>
  );
}

function DietaryNote({ dietary }: { dietary: string | null }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-[#f6efe2] px-4 py-3 text-[13px] leading-5 text-[#3a3f45]">
      <UtensilsCrossed className="mt-0.5 size-4 shrink-0 text-[#9c7434]" aria-hidden />
      <p>
        {!dietary ? (
          <>Tem alguma restrição alimentar? </>
        ) : dietary === "Nenhuma restrição" ? (
          <>Pela sua ficha cadastral, você não tem restrição alimentar. Algo mudou? </>
        ) : (
          <>
            Restrição alimentar na sua ficha cadastral: <strong className="font-semibold text-[#0d1e2e]">{dietary}</strong>.
            Algo mudou?{" "}
          </>
        )}
        <Link href="/minha-ficha" className="font-semibold text-[#7a5a26] underline underline-offset-2">
          {dietary ? "Atualize a ficha" : "Informe na sua ficha cadastral"}
        </Link>
        .
      </p>
    </div>
  );
}

function Summary({
  view,
  preview,
  onEdit,
}: {
  view: Pick<RsvpView, "attending" | "transport" | "respondedAt" | "open" | "closesAt" | "dietary" | "askDietary" | "plusOneAllowed"> &
    CompanionFields;
  preview: boolean;
  onEdit: () => void;
}) {
  const going = view.attending === true;
  const usesBus = usesOutbound(view.transport) || usesReturn(view.transport);
  const companion = going && view.plusOne && view.plusOneName ? view.plusOneName : null;
  const ownDietary = view.askDietary ? dietaryText(view.ownDietary) : "";
  const companionDietary = companion ? dietaryText(view.plusOneDietary) : "";
  return (
    <Card className="text-center">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-gradient-to-b from-[#d9b877] to-[#bf9650] text-white shadow-[0_10px_24px_-12px_rgba(120,86,30,0.75)]">
        {going ? <PartyPopper className="size-7" aria-hidden /> : <Check className="size-7" aria-hidden />}
      </span>
      <h2 className="mt-4 font-[family-name:var(--font-festa-display)] text-[2.6rem] leading-none text-[#cfab68]">
        {going ? "Presença confirmada!" : "Resposta registrada"}
      </h2>
      <p className="mx-auto mt-3 max-w-sm text-[15px] leading-7 text-[#3a3f45]">
        {going
          ? "Nos vemos no dia 17 de dezembro, às 18h, na Fazenda Santa Margarida."
          : "Obrigado por avisar! Vamos sentir sua falta nessa comemoração."}
      </p>

      {going && (
        <div className="mx-auto mt-5 max-w-sm space-y-3 text-left">
          {view.plusOneAllowed && (
            <div className="flex items-start gap-3 rounded-2xl border border-[#e6d8bc] bg-white/70 px-4 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f1e6d3] text-[#9c7434]" aria-hidden>
                {companion ? <UserPlus className="size-[18px]" /> : <User className="size-[18px]" />}
              </span>
              <span>
                <span className="block text-[15px] font-semibold text-[#0d1e2e]">
                  {companion ? `Você e ${companion}` : "Sem acompanhante"}
                </span>
                <span className="mt-0.5 block text-[13px] leading-5 text-[#5c6168]">
                  {companion
                    ? companionDietary
                      ? `Restrição de ${firstNameOf(companion)}: ${companionDietary}.`
                      : `${firstNameOf(companion)} já está na lista de entrada.`
                    : view.open
                      ? "Seu convite vale para você e mais 1 acompanhante. Para incluir, toque em Alterar resposta."
                      : "Seu convite valia para você e mais 1 acompanhante."}
                </span>
              </span>
            </div>
          )}
          <div className="flex items-start gap-3 rounded-2xl border border-[#e6d8bc] bg-white/70 px-4 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f1e6d3] text-[#9c7434]" aria-hidden>
              {usesBus ? <Bus className="size-[18px]" /> : <Car className="size-[18px]" />}
            </span>
            <span>
              <span className="block text-[15px] font-semibold text-[#0d1e2e]">
                {usesBus && view.transport ? `Micro-ônibus: ${RSVP_TRANSPORT_LABEL[view.transport].toLowerCase()}` : "Sem micro-ônibus"}
              </span>
              <span className="mt-0.5 block text-[13px] leading-5 text-[#5c6168]">{transportSentence(view.transport, Boolean(companion))}</span>
            </span>
          </div>
          {view.askDietary && (
            <div className="flex items-start gap-3 rounded-2xl border border-[#e6d8bc] bg-white/70 px-4 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f1e6d3] text-[#9c7434]" aria-hidden>
                <UtensilsCrossed className="size-[18px]" />
              </span>
              <span>
                <span className="block text-[15px] font-semibold text-[#0d1e2e]">Restrição alimentar</span>
                <span className="mt-0.5 block text-[13px] leading-5 text-[#5c6168]">{ownDietary || "Nenhuma restrição"}</span>
              </span>
            </div>
          )}
          {!usesBus && (
            <p className="rounded-2xl bg-[#0d1e2e] px-4 py-3 text-center text-[13px] font-semibold leading-5 text-[#f3e7d3]">
              Se beber, não dirija!
              {view.open ? " Se quiser usar o micro-ônibus, é só alterar a resposta aqui embaixo." : ""}
            </p>
          )}
          <div className="rounded-2xl border border-[#e6d8bc] bg-white/70 px-4 py-3">
            <p className="flex items-center gap-2 text-[15px] font-semibold text-[#0d1e2e]">
              <CalendarPlus className="size-[18px] text-[#9c7434]" aria-hidden />
              Salve na sua agenda
            </p>
            <div className="mt-3 grid gap-2">
              <a href={googleCalendarUrl(view.transport)} target="_blank" rel="noreferrer" className={CALENDAR_BUTTON}>
                Google Agenda
                <ExternalLink className="size-3.5 opacity-70" aria-hidden />
              </a>
              <a href={outlookCalendarUrl(view.transport)} target="_blank" rel="noreferrer" className={CALENDAR_BUTTON}>
                Outlook (e-mail do escritório)
                <ExternalLink className="size-3.5 opacity-70" aria-hidden />
              </a>
              <a href={FESTA_ICS_PATH} download="festa-10-anos.ics" className={CALENDAR_BUTTON}>
                iPhone, Android e outras agendas
                <Download className="size-3.5 opacity-70" aria-hidden />
              </a>
            </div>
          </div>
          <Link
            href="/dress-code"
            className="flex items-center gap-3 rounded-2xl border border-[#e6d8bc] bg-white/70 px-4 py-3 transition hover:border-[#cfb27a] hover:bg-[#fdf8ee]"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f1e6d3] text-[#9c7434]" aria-hidden>
              <Shirt className="size-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-[#0d1e2e]">Dress code: esporte fino</span>
              <span className="block text-[13px] text-[#5c6168]">Veja as referências de looks em azul e areia</span>
            </span>
            <ArrowRight className="size-4 text-[#9c7434]" aria-hidden />
          </Link>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {view.open ? (
          <>
            <button type="button" onClick={onEdit} className={OUTLINE_BUTTON}>
              Alterar resposta
            </button>
            {view.closesAt && (
              <p className="text-xs text-[#5c6168]">Você pode mudar a resposta até {formatRsvpDeadline(view.closesAt)}.</p>
            )}
          </>
        ) : (
          <p className="text-xs text-[#5c6168]">
            O prazo para responder terminou{view.closesAt ? ` em ${formatRsvpDeadline(view.closesAt)}` : ""}. Para mudar, fale
            com a organização da festa.
          </p>
        )}
        {preview ? (
          <p className="text-xs font-semibold text-[#9c7434]">Prévia: nada foi gravado.</p>
        ) : (
          view.respondedAt && <p className="text-xs text-[#7b7f85]">Respondido em {formatRespondedAt(view.respondedAt)}.</p>
        )}
      </div>
    </Card>
  );
}

export function ConfirmarPresencaClient({ preview, previewCompanion = false }: { preview: boolean; previewCompanion?: boolean }) {
  const [view, setView] = useState<RsvpView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attending, setAttending] = useState<boolean | null>(null);
  const [transport, setTransport] = useState<RsvpTransport | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previewAnswer, setPreviewAnswer] = useState<
    ({ attending: boolean; transport: RsvpTransport | null } & CompanionFields) | null
  >(null);
  const [plusOne, setPlusOne] = useState<boolean | null>(null);
  const [plusOneName, setPlusOneName] = useState("");
  const [plusOneDietary, setPlusOneDietary] = useState<DietaryChoice>(DIETARY_NO_RESTRICTION);
  const [ownDietary, setOwnDietary] = useState<DietaryChoice>(DIETARY_NO_RESTRICTION);
  const fieldId = useId();

  const fillForm = useCallback((answer: Pick<RsvpView, "respondedAt" | "attending" | "transport"> & CompanionFields) => {
    const answered = Boolean(answer.respondedAt);
    setAttending(answered ? answer.attending : null);
    setTransport(answered ? answer.transport : null);
    setPlusOne(answered && answer.attending ? answer.plusOne : null);
    setPlusOneName(answer.plusOneName ?? "");
    setPlusOneDietary(answer.plusOneDietary ?? DIETARY_NO_RESTRICTION);
    setOwnDietary(answer.ownDietary ?? DIETARY_NO_RESTRICTION);
  }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const loaded = await requestJson<RsvpView>(API);
      // Prévia da pergunta do acompanhante para quem organiza (nada é gravado na prévia).
      const data = previewCompanion ? { ...loaded, plusOneAllowed: true } : loaded;
      setView(data);
      fillForm(data);
      setEditing(!data.respondedAt);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Não foi possível carregar.");
    }
  }, [fillForm, previewCompanion]);

  useEffect(() => {
    void load();
  }, [load]);

  const plusOneAllowed = view?.plusOneAllowed ?? false;
  const askDietary = view?.askDietary ?? false;
  const companionOk =
    !plusOneAllowed ||
    plusOne === false ||
    (plusOne === true && plusOneName.trim().length >= 2 && dietaryReady(plusOneDietary));
  const ready =
    attending === false ||
    (attending === true && transport !== null && companionOk && (!askDietary || dietaryReady(ownDietary)));

  const clean = (choice: DietaryChoice): DietaryChoice => ({ ...choice, notes: choice.notes?.trim() || null });

  const submit = async () => {
    if (!ready || attending === null) return;
    const withCompanion = attending && plusOneAllowed && plusOne === true;
    await send({
      attending,
      transport: attending ? transport : null,
      plusOne: withCompanion,
      plusOneName: withCompanion ? plusOneName.replace(/\s+/g, " ").trim() : null,
      plusOneDietary: withCompanion ? clean(plusOneDietary) : null,
      dietary: attending && askDietary ? clean(ownDietary) : null,
    });
  };

  /** Quem já confirmou só responde sobre o acompanhante: presença e micro-ônibus continuam como estavam. */
  const companionReady =
    plusOne === false || (plusOne === true && plusOneName.trim().length >= 2 && dietaryReady(plusOneDietary));
  const submitCompanion = async () => {
    if (!view || !companionReady) return;
    const withCompanion = plusOne === true;
    await send({
      attending: true,
      transport: view.transport ?? "nao",
      plusOne: withCompanion,
      plusOneName: withCompanion ? plusOneName.replace(/\s+/g, " ").trim() : null,
      plusOneDietary: withCompanion ? clean(plusOneDietary) : null,
      dietary: view.askDietary ? view.ownDietary : null,
    });
  };

  const send = async (body: {
    attending: boolean;
    transport: RsvpTransport | null;
    plusOne: boolean;
    plusOneName: string | null;
    plusOneDietary: DietaryChoice | null;
    dietary: DietaryChoice | null;
  }) => {
    const { attending } = body;
    setSaveError(null);
    if (preview) {
      setPreviewAnswer({
        attending,
        transport: body.transport,
        plusOne: body.plusOne,
        plusOneName: body.plusOneName,
        plusOneDietary: body.plusOneDietary,
        ownDietary: body.dietary,
      });
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const data = await requestJson<RsvpView>(API, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setView(data);
      setEditing(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Não foi possível registrar a sua resposta.");
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <Shell>
        <Card className="text-center">
          <p className="text-[15px] leading-7 text-[#3a3f45]">{loadError}</p>
          <button type="button" onClick={() => void load()} className={cn(OUTLINE_BUTTON, "mt-4")}>
            Tentar de novo
          </button>
        </Card>
      </Shell>
    );
  }

  if (!view) {
    return (
      <Shell>
        <Card>
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-[#5c6168]" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Carregando sua confirmação…
          </div>
        </Card>
      </Shell>
    );
  }

  if (!view.eligible && !preview) {
    return (
      <Shell firstName={view.firstName}>
        <Card className="text-center">
          <p className="text-[15px] leading-7 text-[#3a3f45]">
            Esta confirmação é só para a equipe do escritório e não encontramos o seu nome na lista. Se você faz parte da
            equipe, fale com a organização da festa.
          </p>
        </Card>
      </Shell>
    );
  }

  const shownAnswer = preview && previewAnswer ? { ...view, ...previewAnswer, open: true } : view;
  const answered = preview ? Boolean(previewAnswer) : Boolean(view.respondedAt);
  const canEdit = view.open || preview;

  // Confirmou antes de o acompanhante ser liberado (ex.: sócios de área): pergunta só pelo acompanhante.
  const companionStep =
    !editing &&
    !(preview && previewAnswer) &&
    (view.open || preview) &&
    view.plusOneAllowed &&
    view.attending === true &&
    Boolean(view.respondedAt) &&
    view.plusOne === null;

  if (companionStep) {
    const usesBus = usesOutbound(view.transport) || usesReturn(view.transport);
    return (
      <Shell
        firstName={view.firstName}
        title="Leve um acompanhante"
        message="Sua presença na festa de 10 anos já está confirmada, e o seu convite agora vale para você e mais 1 pessoa."
      >
        <Card>
          {preview && (
            <p className="mb-5 rounded-full bg-[#f1e6d3] px-4 py-2 text-center text-xs font-semibold text-[#7a5a26]">
              Prévia: as respostas não são gravadas.
            </p>
          )}
          <p className="mx-auto flex w-fit items-center gap-2 rounded-full bg-[#eef6ee] px-4 py-1.5 text-[13px] font-semibold text-[#2f6b3a]">
            <Check className="size-4" strokeWidth={3} aria-hidden />
            Presença confirmada · 17/12, às 18h
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submitCompanion();
            }}
            className="mt-6 space-y-6"
          >
            <fieldset>
              <legend className="w-full text-center">
                <span className="block text-xl font-semibold text-[#0d1e2e]">Vai levar um acompanhante?</span>
                <span className="mx-auto mt-2 block max-w-sm text-[14px] leading-6 text-[#5c6168]">
                  Se for levar alguém, informe o nome para a lista de entrada e a restrição alimentar, se houver.
                </span>
              </legend>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <ChoiceCard
                  name="acompanhante"
                  checked={plusOne === true}
                  onChange={() => setPlusOne(true)}
                  icon={UserPlus}
                  title="Sim, com 1 acompanhante"
                  hint="Informo o nome abaixo"
                  compact
                />
                <ChoiceCard
                  name="acompanhante"
                  checked={plusOne === false}
                  onChange={() => setPlusOne(false)}
                  icon={User}
                  title="Não, vou sozinho"
                  hint="Sem acompanhante"
                  compact
                />
              </div>
              {plusOne === true && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label htmlFor={`${fieldId}-nome-acompanhante`} className="block text-[14px] font-semibold text-[#0d1e2e]">
                      Nome completo do acompanhante
                    </label>
                    <input
                      id={`${fieldId}-nome-acompanhante`}
                      type="text"
                      value={plusOneName}
                      onChange={(event) => setPlusOneName(event.target.value)}
                      maxLength={80}
                      autoComplete="off"
                      placeholder="Nome e sobrenome"
                      className={FIELD}
                    />
                    <p className="mt-1.5 text-[12px] leading-5 text-[#5c6168]">O nome vai para a lista de entrada da festa.</p>
                  </div>
                  <DietaryPicker
                    legend={`Restrição alimentar de ${plusOneName.trim() ? firstNameOf(plusOneName) : "seu acompanhante"}`}
                    value={plusOneDietary}
                    onChange={setPlusOneDietary}
                  />
                </div>
              )}
            </fieldset>

            <div className="flex items-start gap-3 rounded-2xl border border-[#e6d8bc] bg-white/70 px-4 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f1e6d3] text-[#9c7434]" aria-hidden>
                {usesBus ? <Bus className="size-[18px]" /> : <Car className="size-[18px]" />}
              </span>
              <span>
                <span className="block text-[15px] font-semibold text-[#0d1e2e]">
                  {usesBus && view.transport ? `Micro-ônibus: ${RSVP_TRANSPORT_LABEL[view.transport].toLowerCase()}` : "Sem micro-ônibus"}
                </span>
                <span className="mt-0.5 block text-[13px] leading-5 text-[#5c6168]">
                  {plusOne === true
                    ? `${transportSentence(view.transport, true)} O acompanhante segue a sua escolha.`
                    : `${transportSentence(view.transport)} Se levar alguém, o acompanhante segue a mesma escolha.`}
                </span>
              </span>
            </div>

            <div className="flex flex-col items-center gap-3 pt-1">
              {saveError && (
                <p className="w-full rounded-2xl bg-[#fbeaea] px-4 py-3 text-center text-sm text-[#8a2b2b]" role="alert">
                  {saveError}
                </p>
              )}
              <button type="submit" disabled={!companionReady || saving} className={cn(GOLD_BUTTON, "w-full sm:w-auto sm:min-w-72")}>
                {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
                {saving ? "Enviando…" : "Enviar"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSaveError(null);
                  setEditing(true);
                }}
                className={cn("text-sm font-semibold underline-offset-4 hover:underline", GOLD_TEXT)}
              >
                Mudar a presença ou o micro-ônibus
              </button>
              {view.closesAt && (
                <p className="text-center text-xs font-semibold text-[#0d1e2e]">
                  Responda até {formatRsvpDeadline(view.closesAt)}.
                </p>
              )}
            </div>
          </form>
        </Card>
      </Shell>
    );
  }

  if (answered && !editing) {
    return (
      <Shell firstName={view.firstName}>
        <Summary
          view={shownAnswer}
          preview={preview}
          onEdit={() => {
            fillForm({ ...shownAnswer, respondedAt: shownAnswer.respondedAt ?? "previa" });
            // Quem pode levar acompanhante e ainda não disse: a pergunta aparece em aberto.
            if (shownAnswer.attending && shownAnswer.plusOneAllowed && !shownAnswer.plusOne) setPlusOne(null);
            setEditing(true);
          }}
        />
      </Shell>
    );
  }

  if (!canEdit) {
    return (
      <Shell firstName={view.firstName}>
        <Card className="text-center">
          <CalendarX2 className="mx-auto size-8 text-[#c49a52]" aria-hidden />
          <p className="mt-3 text-[15px] leading-7 text-[#3a3f45]">
            O prazo para confirmar terminou{view.closesAt ? ` em ${formatRsvpDeadline(view.closesAt)}` : ""}. Se ainda
            precisa responder, fale com a organização da festa.
          </p>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell firstName={view.firstName}>
      <Card>
        {preview && (
          <p className="mb-5 rounded-full bg-[#f1e6d3] px-4 py-2 text-center text-xs font-semibold text-[#7a5a26]">
            Prévia: as respostas não são gravadas.
          </p>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="space-y-8"
        >
          <fieldset>
            <legend className="w-full text-center">
              <span className="block text-xl font-semibold text-[#0d1e2e]">Você vai à festa?</span>
            </legend>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <ChoiceCard
                name="presenca"
                checked={attending === true}
                onChange={() => setAttending(true)}
                icon={PartyPopper}
                title="Sim, estarei lá!"
                hint="Conte comigo para brindar"
              />
              <ChoiceCard
                name="presenca"
                checked={attending === false}
                onChange={() => setAttending(false)}
                icon={CalendarX2}
                title="Não vou poder ir"
                hint="Desta vez vou ficar de fora"
              />
            </div>
          </fieldset>

          <AnimatePresence initial={false}>
            {attending === true && (
              <motion.div
                key="transporte"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <Ornament />
                {plusOneAllowed && (
                  <>
                    <fieldset>
                      <legend className="w-full text-center">
                        <span className="block text-xl font-semibold text-[#0d1e2e]">Vai levar um acompanhante?</span>
                        <span className="mx-auto mt-2 block max-w-sm text-[14px] leading-6 text-[#5c6168]">
                          Seu convite vale para você e mais 1 pessoa.
                        </span>
                      </legend>
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <ChoiceCard
                          name="acompanhante"
                          checked={plusOne === true}
                          onChange={() => setPlusOne(true)}
                          icon={UserPlus}
                          title="Sim, com 1 acompanhante"
                          hint="Informo o nome abaixo"
                          compact
                        />
                        <ChoiceCard
                          name="acompanhante"
                          checked={plusOne === false}
                          onChange={() => setPlusOne(false)}
                          icon={User}
                          title="Não, vou sozinho"
                          hint="Sem acompanhante"
                          compact
                        />
                      </div>
                      {plusOne === true && (
                        <div className="mt-4 space-y-4">
                          <div>
                            <label htmlFor={`${fieldId}-nome`} className="block text-[14px] font-semibold text-[#0d1e2e]">
                              Nome completo do acompanhante
                            </label>
                            <input
                              id={`${fieldId}-nome`}
                              type="text"
                              value={plusOneName}
                              onChange={(event) => setPlusOneName(event.target.value)}
                              maxLength={80}
                              autoComplete="off"
                              placeholder="Nome e sobrenome"
                              className={FIELD}
                            />
                            <p className="mt-1.5 text-[12px] leading-5 text-[#5c6168]">O nome vai para a lista de entrada da festa.</p>
                          </div>
                          <DietaryPicker
                            legend={`Restrição alimentar de ${plusOneName.trim() ? firstNameOf(plusOneName) : "seu acompanhante"}`}
                            value={plusOneDietary}
                            onChange={setPlusOneDietary}
                          />
                        </div>
                      )}
                    </fieldset>
                    <Ornament />
                  </>
                )}
                <fieldset>
                  <legend className="w-full text-center">
                    <span className="block text-xl font-semibold text-[#0d1e2e]">Vai precisar do transporte?</span>
                    <span className="mx-auto mt-2 block max-w-sm text-[14px] leading-6 text-[#5c6168]">
                      Vamos disponibilizar um micro-ônibus com saída do escritório até a festa e retorno ao final do
                      evento.
                      {plusOneAllowed && plusOne === true ? " A escolha vale para você e seu acompanhante." : ""}
                    </span>
                  </legend>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {TRANSPORT_OPTIONS.map((option) => (
                      <ChoiceCard
                        key={option.value}
                        name="transporte"
                        checked={transport === option.value}
                        onChange={() => setTransport(option.value)}
                        icon={option.icon}
                        title={option.title}
                        hint={option.hint}
                        compact
                      />
                    ))}
                  </div>
                </fieldset>
                <p className="rounded-2xl bg-[#0d1e2e] px-5 py-4 text-center text-[14px] font-semibold leading-6 text-[#f3e7d3]">
                  Reforçamos: se beber, não dirija! Aproveite o transporte oferecido pelo escritório e curta a celebração
                  sem preocupações.
                </p>
                <p className="text-center text-[12px] font-medium leading-5 text-[#5c6168]">
                  * No dia da festa, o micro-ônibus estará disponível apenas para quem indicar aqui a necessidade de
                  transporte.
                </p>
                {askDietary ? (
                  <div>
                    <p className="text-center text-xl font-semibold text-[#0d1e2e]">Alguma restrição alimentar?</p>
                    <p className="mx-auto mt-2 max-w-sm text-center text-[14px] leading-6 text-[#5c6168]">
                      Marque o que se aplica e nós avisamos o buffet.
                    </p>
                    <div className="mt-4">
                      <DietaryPicker legend={null} value={ownDietary} onChange={setOwnDietary} />
                    </div>
                  </div>
                ) : (
                  <DietaryNote dietary={view.dietary} />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col items-center gap-3 pt-1">
            {saveError && (
              <p className="w-full rounded-2xl bg-[#fbeaea] px-4 py-3 text-center text-sm text-[#8a2b2b]" role="alert">
                {saveError}
              </p>
            )}
            <button type="submit" disabled={!ready || saving} className={cn(GOLD_BUTTON, "w-full sm:w-auto sm:min-w-72")}>
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
              {saving ? "Enviando…" : attending === true ? "Confirmar presença" : "Enviar resposta"}
            </button>
            {answered && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setSaveError(null);
                }}
                className={cn("text-sm font-semibold underline-offset-4 hover:underline", GOLD_TEXT)}
              >
                Voltar sem alterar
              </button>
            )}
            {view.closesAt && (
              <p className="text-center text-xs font-semibold text-[#0d1e2e]">
                Responda até {formatRsvpDeadline(view.closesAt)}. Até lá, você pode mudar a resposta quando quiser.
              </p>
            )}
          </div>
        </form>
      </Card>
    </Shell>
  );
}
