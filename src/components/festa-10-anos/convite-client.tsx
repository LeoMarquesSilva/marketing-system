"use client";

import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarPlus,
  CalendarX2,
  Check,
  Download,
  ExternalLink,
  Loader2,
  PartyPopper,
  Shirt,
  Ticket,
  User,
  UserPlus,
  UtensilsCrossed,
} from "lucide-react";
import { LOOKS_ELAS, LOOKS_ELES, PALETA } from "@/app/dress-code/looks";
import { cn } from "@/lib/utils";
import { firstNameOf, formatRsvpDeadline } from "@/lib/event-rsvp";
import {
  CONVITE_SAMPLE_TOKEN,
  DIETARY_NO_RESTRICTION,
  GUEST_DIETARY_OPTIONS,
  dietaryNeedsDetail,
  dietaryText,
  inviteUrl,
  toggleDietary,
  type DietaryChoice,
  type GuestAnswer,
  type GuestInviteView,
} from "@/lib/festa-convite";
import { FESTA_GUEST_ICS_PATH, guestGoogleCalendarUrl, guestOutlookCalendarUrl } from "@/lib/festa-10-anos-agenda";
import {
  CALENDAR_BUTTON,
  ChoiceCard,
  EYEBROW,
  FestaCard,
  FestaShell,
  GOLD_BUTTON,
  GOLD_TEXT,
  OUTLINE_BUTTON,
  Ornament,
  formatRespondedAt,
  requestJson,
} from "./festa-ui";

const FIELD =
  "mt-2 h-12 w-full rounded-2xl border border-[#e6d8bc] bg-white px-4 text-[15px] text-[#0d1e2e] outline-none transition placeholder:text-[#9aa0a6] focus:border-[#c49a52] focus:shadow-[0_0_0_1px_#c49a52]";

/** Quatro referências da página de dress code (duas de cada galeria) para dar o tom. */
const DRESS_PREVIEW = [LOOKS_ELAS[0], LOOKS_ELES[0], LOOKS_ELAS[1], LOOKS_ELES[1]].filter(Boolean);

/** Plaquinha do convite: a logo da empresa (quando temos) ao lado do nome do convidado. */
function Nameplate({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  return (
    <div className="mx-auto mb-6 flex w-fit max-w-full items-center gap-4 rounded-[24px] border border-[#dcc59a] bg-[#fdfbf7] py-3 pl-3 pr-6 text-left shadow-[0_14px_30px_-24px_rgba(120,86,30,0.6)]">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          width={64}
          height={64}
          className="size-16 shrink-0 rounded-2xl border border-[#e6d8bc] bg-white object-contain"
        />
      ) : (
        <span className="grid size-16 shrink-0 place-items-center rounded-2xl border border-[#e6d8bc] bg-[#f6efe2] text-[#9c7434]" aria-hidden>
          <Ticket className="size-6" />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#9c7434]">Convite para</p>
        <p className="mt-1 text-[19px] font-semibold leading-tight text-[#0d1e2e]">{name}</p>
      </div>
    </div>
  );
}

function Shell({ view, children }: { view?: GuestInviteView; children: ReactNode }) {
  const firstName = view?.firstName ?? "";
  return (
    <FestaShell
      title="Celebre conosco"
      intro={
        <>
          {view?.name ? <Nameplate name={view.name} logoUrl={view.logoUrl} /> : null}
          <p>
            {firstName ? <strong className="font-semibold text-[#0d1e2e]">{firstName}, </strong> : null}
            {firstName ? "o" : "O"} Bismarchi | Pires completa 10 anos. Essa trajetória foi construída com a confiança de
            quem caminhou ao nosso lado, e você faz parte dela.
          </p>
          <p className="mt-3">Será uma honra receber você na noite em que vamos celebrar essa conquista.</p>
        </>
      }
      footer={<>Bismarchi | Pires Sociedade de Advogados</>}
    >
      {children}
    </FestaShell>
  );
}

function PlusOneNotice() {
  return (
    <p className="flex items-center justify-center gap-3 rounded-2xl bg-[#0d1e2e] px-5 py-4 text-center text-[14px] font-semibold leading-6 text-[#f3e7d3]">
      <Ticket className="size-5 shrink-0 text-[#d9b877]" aria-hidden />
      O convite é pessoal e vale para você e mais 1 convidado.
    </p>
  );
}

function DressCode() {
  return (
    <FestaCard className="text-center">
      <p className={EYEBROW}>Dress code</p>
      <h2 className="mt-2 text-xl font-semibold text-[#0d1e2e]">Esporte fino</h2>
      <p className="mx-auto mt-2 max-w-sm text-[14px] leading-6 text-[#5c6168]">
        Para um entardecer na fazenda, sugerimos a cartela azul e areia: tons neutros, terrosos e nuances de azul.
        Reunimos algumas referências para inspirar a sua escolha.
      </p>
      <ul className="mx-auto mt-5 flex max-w-sm justify-center gap-1.5" aria-label="Paleta de cores">
        {PALETA.map((swatch) => (
          <li key={swatch.name} className="flex-1">
            <span
              className="block aspect-square w-full rounded-full border border-[#e6dccb]"
              style={{ backgroundColor: swatch.hex }}
              role="img"
              aria-label={swatch.name}
              title={swatch.name}
            />
          </li>
        ))}
      </ul>
      <div className="mt-5 grid grid-cols-4 gap-2 sm:gap-3">
        {DRESS_PREVIEW.map((look) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={look.src}
            src={look.src}
            alt={look.caption}
            className="aspect-[3/5] w-full rounded-2xl border border-[#e6d8bc] object-cover object-top"
          />
        ))}
      </div>
      <a href="/dress-code" target="_blank" rel="noreferrer" className={cn(OUTLINE_BUTTON, "mt-5")}>
        <Shirt className="size-4" aria-hidden />
        Ver referências de looks
      </a>
    </FestaCard>
  );
}

/** Restrição alimentar em botões: "Nenhuma" já vem marcada; alergia, religiosa e outra pedem o detalhe. */
function DietaryPicker({
  legend,
  value,
  onChange,
}: {
  legend: string | null;
  value: DietaryChoice;
  onChange: (next: DietaryChoice) => void;
}) {
  const id = useId();
  const needsDetail = dietaryNeedsDetail(value);
  return (
    <fieldset>
      {legend && <legend className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#9c7434]">{legend}</legend>}
      <div className={cn("flex flex-wrap gap-2", legend && "mt-2.5")}>
        {GUEST_DIETARY_OPTIONS.map((option) => {
          const checked = value.restrictions.includes(option.value);
          return (
            <label
              key={option.value}
              className={cn(
                "inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-[14px] transition",
                checked
                  ? "border-[#c49a52] bg-[#fbf3e3] font-semibold text-[#7a5a26] shadow-[0_0_0_1px_#c49a52]"
                  : "border-[#e6d8bc] bg-white/70 text-[#3a3f45] hover:border-[#cfb27a] hover:bg-[#fdf8ee]",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#9c7434]"
              )}
            >
              <input
                type="checkbox"
                value={option.label}
                checked={checked}
                onChange={() => onChange(toggleDietary(value, option.value))}
                className="sr-only"
              />
              {checked && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
              {option.label}
            </label>
          );
        })}
      </div>
      {needsDetail && (
        <>
          <label htmlFor={`${id}-qual`} className="sr-only">
            Qual é a restrição{legend ? ` (${legend})` : ""}?
          </label>
          <input
            id={`${id}-qual`}
            type="text"
            value={value.notes ?? ""}
            onChange={(event) => onChange({ ...value, notes: event.target.value })}
            maxLength={120}
            autoComplete="off"
            placeholder="Conte qual é. Ex.: alergia a camarão"
            className={FIELD}
          />
        </>
      )}
    </fieldset>
  );
}

function dietaryReady(choice: DietaryChoice): boolean {
  return !dietaryNeedsDetail(choice) || (choice.notes ?? "").trim().length >= 2;
}

function Row({ icon: Icon, title, children }: { icon: typeof User; title: string; children?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[#e6d8bc] bg-white/70 px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f1e6d3] text-[#9c7434]" aria-hidden>
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-[#0d1e2e]">{title}</span>
        {children && <span className="mt-0.5 block text-[13px] leading-5 text-[#5c6168]">{children}</span>}
      </span>
    </div>
  );
}

function Summary({
  answer,
  view,
  calendarLink,
  onEdit,
}: {
  answer: GuestAnswer;
  view: GuestInviteView;
  calendarLink: string | null;
  onEdit: () => void;
}) {
  const going = answer.attending;
  const own = dietaryText(answer.dietary);
  const companion = answer.plusOne ? dietaryText(answer.plusOneDietary) : "";
  const companionName = answer.plusOneName ? firstNameOf(answer.plusOneName) : "Convidado";
  const name = view.firstName ? `${view.firstName}, ` : "";
  return (
    <FestaCard className="text-center">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-gradient-to-b from-[#d9b877] to-[#bf9650] text-white shadow-[0_10px_24px_-12px_rgba(120,86,30,0.75)]">
        {going ? <PartyPopper className="size-7" aria-hidden /> : <Check className="size-7" aria-hidden />}
      </span>
      <h2 className="mt-4 font-[family-name:var(--font-festa-display)] text-[2.6rem] leading-none text-[#cfab68]">
        {going ? "Presença confirmada!" : "Resposta registrada"}
      </h2>
      <p className="mx-auto mt-3 max-w-sm text-[15px] leading-7 text-[#3a3f45]">
        {going
          ? `${name ? `${name}será` : "Será"} uma honra receber você no dia 17 de dezembro, às 18h, na Fazenda Santa Margarida.`
          : `${name ? `${name}agradecemos` : "Agradecemos"} o retorno. Sentiremos a sua falta nessa noite.`}
      </p>

      {going && (
        <div className="mx-auto mt-5 max-w-sm space-y-3 text-left">
          {answer.plusOne && answer.plusOneName ? (
            <Row icon={UserPlus} title={`Você e ${answer.plusOneName}`}>
              Os dois nomes estarão na lista de entrada.
            </Row>
          ) : (
            <Row icon={User} title="Apenas você">
              {view.open ? "Se decidir trazer um convidado, é só alterar a resposta." : null}
            </Row>
          )}
          <Row icon={UtensilsCrossed} title={own || companion ? "Restrição alimentar" : "Sem restrição alimentar"}>
            {own || companion ? (
              <>
                {own ? <span className="block">{answer.plusOne ? `Você: ${own}` : own}</span> : null}
                {companion ? <span className="block">{`${companionName}: ${companion}`}</span> : null}
                <span className="block">Vamos avisar o buffet.</span>
              </>
            ) : null}
          </Row>
          <div className="rounded-2xl border border-[#e6d8bc] bg-white/70 px-4 py-3">
            <p className="flex items-center gap-2 text-[15px] font-semibold text-[#0d1e2e]">
              <CalendarPlus className="size-[18px] text-[#9c7434]" aria-hidden />
              Salve na sua agenda
            </p>
            <div className="mt-3 grid gap-2">
              <a href={guestGoogleCalendarUrl(calendarLink)} target="_blank" rel="noreferrer" className={CALENDAR_BUTTON}>
                Google Agenda
                <ExternalLink className="size-3.5 opacity-70" aria-hidden />
              </a>
              <a href={guestOutlookCalendarUrl(calendarLink, "empresa")} target="_blank" rel="noreferrer" className={CALENDAR_BUTTON}>
                Outlook
                <ExternalLink className="size-3.5 opacity-70" aria-hidden />
              </a>
              <a href={FESTA_GUEST_ICS_PATH} download="festa-10-anos-bismarchi-pires.ics" className={CALENDAR_BUTTON}>
                iPhone, Android e outras agendas
                <Download className="size-3.5 opacity-70" aria-hidden />
              </a>
            </div>
          </div>
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
            com o seu contato no Bismarchi | Pires.
          </p>
        )}
        {view.sample ? (
          <p className="text-xs font-semibold text-[#9c7434]">Prévia: nada foi gravado.</p>
        ) : (
          view.respondedAt && <p className="text-xs text-[#7b7f85]">Respondido em {formatRespondedAt(view.respondedAt)}.</p>
        )}
      </div>
    </FestaCard>
  );
}

export function ConviteClient({ token, preview }: { token: string; preview: boolean }) {
  const api = `/api/convite/${encodeURIComponent(token)}`;
  const fieldId = useId();
  const [view, setView] = useState<GuestInviteView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attending, setAttending] = useState<boolean | null>(null);
  const [plusOne, setPlusOne] = useState<boolean | null>(null);
  const [plusOneName, setPlusOneName] = useState("");
  const [dietary, setDietary] = useState<DietaryChoice>(DIETARY_NO_RESTRICTION);
  const [plusOneDietary, setPlusOneDietary] = useState<DietaryChoice>(DIETARY_NO_RESTRICTION);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sampleAnswer, setSampleAnswer] = useState<GuestAnswer | null>(null);

  const fillForm = useCallback((answer: Pick<GuestInviteView, "attending" | "plusOne" | "plusOneName" | "dietary" | "plusOneDietary"> | null) => {
    setAttending(answer ? answer.attending : null);
    setPlusOne(answer?.attending ? answer.plusOne : null);
    setPlusOneName(answer?.plusOneName ?? "");
    setDietary(answer?.dietary ?? DIETARY_NO_RESTRICTION);
    setPlusOneDietary(answer?.plusOneDietary ?? DIETARY_NO_RESTRICTION);
  }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await requestJson<GuestInviteView>(`${api}${preview ? "?previa=1" : ""}`);
      setView(data);
      fillForm(data.respondedAt ? data : null);
      setEditing(!data.respondedAt);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Não foi possível carregar o convite.");
    }
  }, [api, preview, fillForm]);

  useEffect(() => {
    void load();
  }, [load]);

  const nameOk = plusOneName.trim().length >= 2;
  const ready =
    attending === false ||
    (attending === true &&
      plusOne !== null &&
      (!plusOne || nameOk) &&
      dietaryReady(dietary) &&
      (!plusOne || dietaryReady(plusOneDietary)));

  const submit = async () => {
    if (!ready || attending === null || !view) return;
    setSaveError(null);
    const clean = (choice: DietaryChoice): DietaryChoice => ({
      restrictions: choice.restrictions,
      notes: dietaryNeedsDetail(choice) ? (choice.notes ?? "").replace(/\s+/g, " ").trim() : null,
    });
    const answer: GuestAnswer = attending
      ? {
          attending: true,
          plusOne: plusOne === true,
          plusOneName: plusOne ? plusOneName.replace(/\s+/g, " ").trim() : null,
          dietary: clean(dietary),
          plusOneDietary: plusOne ? clean(plusOneDietary) : null,
        }
      : { attending: false, plusOne: false, plusOneName: null, dietary: null, plusOneDietary: null };
    if (view.sample) {
      setSampleAnswer(answer);
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      setView(await requestJson<GuestInviteView>(api, { method: "POST", body: JSON.stringify(answer) }));
      setEditing(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Não foi possível registrar a sua resposta.");
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <Shell>
        <FestaCard className="text-center">
          <p className="text-[15px] leading-7 text-[#3a3f45]">{loadError}</p>
          <button type="button" onClick={() => void load()} className={cn(OUTLINE_BUTTON, "mt-4")}>
            Tentar de novo
          </button>
        </FestaCard>
      </Shell>
    );
  }

  if (!view) {
    return (
      <Shell>
        <FestaCard>
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-[#5c6168]" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Carregando o seu convite…
          </div>
        </FestaCard>
      </Shell>
    );
  }

  const saved: GuestAnswer | null = view.sample
    ? sampleAnswer
    : view.respondedAt && view.attending !== null
      ? {
          attending: view.attending,
          plusOne: view.plusOne === true,
          plusOneName: view.plusOneName,
          dietary: view.dietary,
          plusOneDietary: view.plusOneDietary,
        }
      : null;
  const calendarLink = view.sample || token === CONVITE_SAMPLE_TOKEN ? null : inviteUrl(token);
  const companionLabel = plusOneName.trim() ? firstNameOf(plusOneName) : "Seu convidado";

  let body: ReactNode;
  if (saved && !editing) {
    body = (
      <Summary
        answer={saved}
        view={view}
        calendarLink={calendarLink}
        onEdit={() => {
          fillForm(saved);
          setEditing(true);
        }}
      />
    );
  } else if (!view.open) {
    body = (
      <FestaCard className="text-center">
        <CalendarX2 className="mx-auto size-8 text-[#c49a52]" aria-hidden />
        <p className="mt-3 text-[15px] leading-7 text-[#3a3f45]">
          O prazo para confirmar terminou{view.closesAt ? ` em ${formatRsvpDeadline(view.closesAt)}` : ""}. Se ainda quiser
          responder, fale com o seu contato no Bismarchi | Pires.
        </p>
      </FestaCard>
    );
  } else {
    body = (
      <FestaCard>
        {view.sample && (
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
              <span className="block text-xl font-semibold text-[#0d1e2e]">Podemos contar com a sua presença?</span>
            </legend>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <ChoiceCard
                name="presenca"
                checked={attending === true}
                onChange={() => setAttending(true)}
                icon={PartyPopper}
                title="Sim, estarei presente"
                hint="Confirmo a minha presença"
              />
              <ChoiceCard
                name="presenca"
                checked={attending === false}
                onChange={() => setAttending(false)}
                icon={CalendarX2}
                title="Não poderei comparecer"
                hint="Agradeço o convite"
              />
            </div>
          </fieldset>

          <AnimatePresence initial={false}>
            {attending === true && (
              <motion.div
                key="convidado"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-7"
              >
                <Ornament />
                <fieldset>
                  <legend className="w-full text-center">
                    <span className="block text-xl font-semibold text-[#0d1e2e]">Você trará um convidado?</span>
                    <span className="mx-auto mt-2 block max-w-sm text-[14px] leading-6 text-[#5c6168]">
                      O convite vale para você e mais 1 pessoa.
                    </span>
                  </legend>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <ChoiceCard
                      name="convidado"
                      checked={plusOne === true}
                      onChange={() => setPlusOne(true)}
                      icon={UserPlus}
                      title="Sim, com 1 convidado"
                      hint="Informo o nome abaixo"
                      compact
                    />
                    <ChoiceCard
                      name="convidado"
                      checked={plusOne === false}
                      onChange={() => setPlusOne(false)}
                      icon={User}
                      title="Não, apenas eu"
                      hint="Vou sem convidado"
                      compact
                    />
                  </div>
                  {plusOne === true && (
                    <div className="mt-4">
                      <label htmlFor={`${fieldId}-nome`} className="block text-[14px] font-semibold text-[#0d1e2e]">
                        Nome completo do seu convidado
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
                  )}
                </fieldset>

                {plusOne !== null && (
                  <>
                    <Ornament />
                    <div>
                      <p className="text-center text-xl font-semibold text-[#0d1e2e]">Alguma restrição alimentar?</p>
                      <p className="mx-auto mt-2 max-w-sm text-center text-[14px] leading-6 text-[#5c6168]">
                        Marque o que se aplica e nós avisamos o buffet.
                      </p>
                      <div className="mt-5 space-y-5">
                        <DietaryPicker legend={plusOne ? "Você" : null} value={dietary} onChange={setDietary} />
                        {plusOne && <DietaryPicker legend={companionLabel} value={plusOneDietary} onChange={setPlusOneDietary} />}
                      </div>
                    </div>
                  </>
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
              {saving ? "Enviando…" : attending === false ? "Enviar resposta" : "Confirmar presença"}
            </button>
            {saved && (
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
                Pedimos a gentileza de responder até {formatRsvpDeadline(view.closesAt)}. Até lá, você pode alterar a resposta.
              </p>
            )}
          </div>
        </form>
      </FestaCard>
    );
  }

  return (
    <Shell view={view}>
      <div className="space-y-5">
        <PlusOneNotice />
        <DressCode />
        {body}
        <p className="text-center text-[12px] text-[#7b7f85]">Dúvidas? Fale com o seu contato no Bismarchi | Pires.</p>
      </div>
    </Shell>
  );
}
