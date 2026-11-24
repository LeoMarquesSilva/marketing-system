"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlarmClock,
  CalendarClock,
  ClipboardList,
  Globe2,
  HandHeart,
  Inbox,
  MessageSquareHeart,
  MessageSquarePlus,
  Send,
  Sparkles,
  Sprout,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { coverageBand, type CoverageBand } from "@/lib/rh/feedback/rules";
import type { CoverageRow, FeedbackKind, FeedbackOverview, FeedbackRequest, FeedbackSummary } from "@/lib/rh/feedback/types";
import { CIVIL_LABELS } from "@/lib/rh/pdi/civil";
import { cn } from "@/lib/utils";
import { ChoiceChips } from "../form-controls";
import { AreaTile, PersonPhoto, formatDate } from "../pdi/pdi-visuals";
import { FeedbackDetailDialog } from "./feedback-detail-dialog";
import { BODY, CARD, EmptyState, FeedbackCard, INK, MUTED, ValueSeal, formatWhen } from "./feedback-visuals";
import { GiveFeedbackDialog } from "./give-feedback-dialog";
import { RequestFeedbackDialog } from "./request-feedback-dialog";

type Tab = "recebidos" | "enviados" | "pedidos" | "mural" | "equipe";
type KindFilter = "todos" | FeedbackKind;

export const BAND_STYLE: Record<CoverageBand, { label: (days: number | null) => string; className: string }> = {
  ok: { label: (days) => (days === 0 ? "hoje" : `há ${days} ${days === 1 ? "dia" : "dias"}`), className: "bg-emerald-50 text-emerald-700 ring-emerald-600/15" },
  "30": { label: (days) => `há ${days} dias`, className: "bg-amber-50 text-amber-800 ring-amber-600/20" },
  "60": { label: (days) => `há ${days} dias`, className: "bg-orange-50 text-orange-800 ring-orange-600/20" },
  "90": { label: (days) => `há ${days} dias`, className: "bg-red-50 text-red-700 ring-red-600/20" },
  nunca: { label: () => "nunca", className: "bg-[#f1f5f6] text-[#5a717b] ring-[#cfdadd]" },
};

export function BandPill({ days, limit }: { days: number | null; limit: number }) {
  const band = coverageBand(days, limit);
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", BAND_STYLE[band].className)}>{BAND_STYLE[band].label(days)}</span>;
}

function Stat({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: number; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-[#e3ecef] bg-white px-3 py-3 sm:flex-row sm:items-start sm:gap-3 sm:px-4 sm:py-3.5">
      <Icon className="size-5 shrink-0 text-[#1d7086] sm:mt-0.5" aria-hidden />
      <div className="min-w-0">
        <p className={cn("text-xs leading-snug sm:text-sm", MUTED)}>{label}</p>
        <p className={cn("text-xl font-semibold leading-tight tabular-nums", INK)}>{value}</p>
        {hint && <p className={cn("mt-0.5 text-xs leading-snug", MUTED)}>{hint}</p>}
      </div>
    </div>
  );
}

function RequestCard({ request, mine, onAnswer, onChanged }: { request: FeedbackRequest; mine: boolean; onAnswer: () => void; onChanged: () => void }) {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const person = mine ? request.giver : request.requester;
  const status =
    request.status === "respondido"
      ? { label: "Respondido", className: "bg-emerald-50 text-emerald-700 ring-emerald-600/15" }
      : request.status === "recusado"
        ? { label: "Não vai responder", className: "bg-[#f1f5f6] text-[#5a717b] ring-[#cfdadd]" }
        : request.overdue
          ? { label: "Prazo passou", className: "bg-red-50 text-red-700 ring-red-600/20" }
          : { label: "Aberto", className: "bg-[#eaf4f6] text-[#1d5670] ring-[#1d7086]/15" };

  async function decline() {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/feedback/pedidos/${request.id}/recusar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: reason.trim() || null }) });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(body.error ?? "Não foi possível recusar.");
      return;
    }
    onChanged();
  }

  return (
    <li className={cn(CARD, "flex flex-col gap-3 p-4")}>
      <div className="flex items-start gap-3">
        <PersonPhoto person={person} size="md" className="size-11" />
        <div className="min-w-0 flex-1">
          <p className={cn("text-[15px] font-semibold", INK)}>
            {mine ? (
              <>
                <span className="font-normal text-[#7b929c]">Você pediu a</span> {person.name}
              </>
            ) : (
              <>
                {person.name} <span className="font-normal text-[#7b929c]">pediu seu feedback</span>
              </>
            )}
            {request.subject.id !== request.requester.id && <span className="font-normal text-[#7b929c]"> sobre {request.subject.name}</span>}
          </p>
          <p className={cn("mt-1 whitespace-pre-line text-sm leading-6", BODY)}>{request.message}</p>
          <p className={cn("mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs", MUTED)}>
            <span className={cn("rounded-full px-2 py-0.5 font-medium ring-1 ring-inset", status.className)}>{status.label}</span>
            <span>pedido em {formatWhen(request.created_at)}</span>
            {request.due_date && (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="size-3.5" aria-hidden />
                até {formatDate(request.due_date)}
              </span>
            )}
            {request.decline_reason && <span>“{request.decline_reason}”</span>}
          </p>
        </div>
      </div>
      {!mine && request.status === "aberto" && (
        <div className="space-y-2 border-t border-[#eef3f5] pt-3">
          {declining ? (
            <div className="space-y-2">
              <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} placeholder="Motivo (opcional): ex.: não acompanhei esse trabalho." className="resize-none rounded-xl border-[#dce6e9] text-sm" />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={decline} disabled={busy}>
                  Confirmar que não vou responder
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDeclining(false)} disabled={busy}>
                  Voltar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={onAnswer} className="bg-[#0f5f70] hover:bg-[#0c5262]">
                <Send className="size-4" aria-hidden />
                Responder com um feedback
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDeclining(true)}>
                <X className="size-4" aria-hidden />
                Não vou conseguir
              </Button>
            </div>
          )}
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
      )}
    </li>
  );
}

function TeamCoverage({ rows, limit, onGive }: { rows: CoverageRow[]; limit: number; onGive: (id: string) => void }) {
  const stale = rows.filter((row) => coverageBand(row.days_from_me, limit) !== "ok").length;
  return (
    <section className={cn(CARD, "overflow-hidden")}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6eff1] px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[#eaf4f6] text-[#1d7086]">
            <Users className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className={cn("text-base font-semibold", INK)}>Cobertura da equipe</h2>
            <p className={cn("text-sm", MUTED)}>
              {stale ? `${stale} ${stale === 1 ? "pessoa está" : "pessoas estão"} há mais de ${limit} dias sem feedback seu.` : `Todo mundo recebeu feedback seu nos últimos ${limit} dias.`}
            </p>
          </div>
        </div>
      </header>
      <ul className="divide-y divide-[#eef3f5]">
        {rows
          .slice()
          .sort((a, b) => (b.days_from_me ?? 9999) - (a.days_from_me ?? 9999))
          .map((row) => (
            <li key={row.person.id} className="grid items-center gap-3 px-5 py-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
              <span className="flex min-w-0 items-center gap-3">
                <PersonPhoto person={row.person} size="md" />
                <span className="min-w-0">
                  <span className={cn("block truncate text-sm font-semibold", INK)}>{row.person.name}</span>
                  <span className={cn("flex min-w-0 items-center gap-1.5 text-xs", MUTED)}>
                    {row.person.department && <AreaTile area={row.person.department} className="size-4 rounded [&_svg]:size-3" />}
                    <span className="truncate">{row.person.position ?? row.person.department ?? ""}</span>
                  </span>
                </span>
              </span>
              <span className={cn("flex items-center gap-1.5 text-xs", MUTED)}>
                Seu último: <BandPill days={row.days_from_me} limit={limit} />
              </span>
              <span className={cn("flex items-center gap-1.5 text-xs", MUTED)}>
                De qualquer pessoa: <BandPill days={row.days_received} limit={limit} />
              </span>
              <Button size="sm" variant="outline" onClick={() => onGive(row.person.id)}>
                <MessageSquarePlus className="size-4" aria-hidden />
                Dar feedback
              </Button>
            </li>
          ))}
      </ul>
    </section>
  );
}

export function FeedbackClient({ initial, initialTab, initialFeedbackId }: { initial: FeedbackOverview; initialTab?: string; initialFeedbackId?: string | null }) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<Tab>(() => {
    const allowed: Tab[] = ["recebidos", "enviados", "pedidos", "mural", "equipe"];
    const wanted = allowed.find((item) => item === initialTab);
    return wanted === "equipe" && !initial.isLeader ? "recebidos" : wanted ?? "recebidos";
  });
  const [kindFilter, setKindFilter] = useState<KindFilter>("todos");
  const [openId, setOpenId] = useState<string | null>(initialFeedbackId ?? null);
  const [giving, setGiving] = useState<{ to?: string | null; request?: FeedbackRequest | null } | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const response = await fetch("/api/feedback");
    if (response.ok) setData((await response.json()) as FeedbackOverview);
  }, []);

  const teamPeople = useMemo(() => data.team_coverage.map((row) => row.person), [data.team_coverage]);
  const openReceived = data.requests_received.filter((request) => request.status === "aberto");
  const totalValues = data.values.reduce((sum, item) => sum + item.company, 0);
  const myValues = data.values.reduce((sum, item) => sum + item.mine, 0);

  const filterList = (list: FeedbackSummary[]) => (kindFilter === "todos" ? list : list.filter((item) => item.kind === kindFilter));
  const kindOptions = (list: FeedbackSummary[]) => {
    const count = (kind: FeedbackKind) => list.filter((item) => item.kind === kind).length;
    const options: Array<{ value: KindFilter; label: string; icon?: LucideIcon; count: number }> = [{ value: "todos", label: "Todos", count: list.length }];
    if (count("reconhecimento")) options.push({ value: "reconhecimento", label: "Reconhecimento", icon: HandHeart, count: count("reconhecimento") });
    if (count("desenvolvimento")) options.push({ value: "desenvolvimento", label: "Desenvolvimento", icon: Sprout, count: count("desenvolvimento") });
    if (count("sem_tipo")) options.push({ value: "sem_tipo", label: "Do Feedz", count: count("sem_tipo") });
    if (count("boa_pratica")) options.push({ value: "boa_pratica", label: "Boas práticas", icon: ClipboardList, count: count("boa_pratica") });
    return options;
  };

  const tabs: Array<{ id: Tab; label: string; icon: LucideIcon; badge?: number }> = [
    { id: "recebidos", label: "Recebidos", icon: Inbox, badge: data.unread },
    { id: "enviados", label: "Enviados", icon: Send },
    { id: "pedidos", label: "Pedidos", icon: MessageSquarePlus, badge: openReceived.length },
    ...(data.settings.mural_enabled ? [{ id: "mural" as const, label: "Mural", icon: Globe2 }] : []),
    ...(data.isLeader ? [{ id: "equipe" as const, label: "Minha equipe", icon: Users }] : []),
  ];

  function list(items: FeedbackSummary[], perspective: "from" | "to" | "both", empty: { icon: LucideIcon; title: string; text: string; action?: { label: string; onClick: () => void } }) {
    const filtered = filterList(items);
    return (
      <div className="space-y-3">
        {items.length > 0 && <ChoiceChips label="Tipo" size="sm" value={kindFilter} onChange={setKindFilter} options={kindOptions(items)} />}
        {filtered.length === 0 ? (
          <EmptyState {...empty} />
        ) : (
          <div className="grid gap-3">
            {filtered.map((item) => (
              <FeedbackCard key={item.id} item={item} perspective={perspective} onOpen={() => setOpenId(item.id)} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!data.me) {
    return <p className={cn(CARD, "px-5 py-8 text-sm", BODY)}>Seu usuário ainda não está ligado a um cadastro de colaborador. Fale com Pessoas e Cultura.</p>;
  }

  return (
    <div className="space-y-6">
      <section className={cn(CARD, "relative overflow-hidden")}>
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-40 h-80 w-[44rem] rounded-full bg-[radial-gradient(closest-side,#dcf1f1,rgba(220,241,241,0))]" />
        <div className="relative grid gap-6 px-6 pb-5 pt-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="min-w-0 xl:border-r xl:border-[#e6eef0] xl:pr-6">
            <div className="flex items-center gap-4">
              <PersonPhoto person={data.me} size="lg" className="size-14 shrink-0 ring-2 ring-[#E1B16D] ring-offset-[3px] ring-offset-white sm:size-20" />
              <div className="min-w-0">
                <h1 className={cn("text-xl font-semibold leading-tight sm:text-2xl", INK)}>Feedback</h1>
                <p className={cn("mt-1 text-sm sm:text-[15px]", MUTED)}>Reconhecer o que deu certo e conversar sobre o que pode melhorar, no dia a dia.</p>
              </div>
            </div>
            {/* No celular os botões ocupam a largura toda; do tablet em diante ficam sob o texto. */}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-3 sm:flex sm:flex-wrap sm:pl-24">
              <Button onClick={() => setGiving({})} className="h-10 rounded-xl bg-[#0f5f70] px-4 hover:bg-[#0c5262]">
                <MessageSquareHeart className="size-4" aria-hidden />
                Dar feedback
              </Button>
              <Button variant="outline" onClick={() => setRequesting(true)} className="h-10 rounded-xl border-[#d5e3e7] px-4 text-[#1d5670]">
                <MessageSquarePlus className="size-4" aria-hidden />
                Pedir feedback
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 xl:w-[38rem]">
            <Stat icon={Inbox} label="Recebidos" value={data.received.length} hint={data.unread ? `${data.unread} não ${data.unread === 1 ? "lido" : "lidos"}` : "todos lidos"} />
            <Stat icon={Send} label="Enviados" value={data.sent.length} />
            <Stat icon={AlarmClock} label="Pedidos para você" value={openReceived.length} hint={openReceived.some((request) => request.overdue) ? "há pedido com prazo vencido" : undefined} />
          </div>
        </div>
        {totalValues > 0 && (
          <div className="relative border-t border-[#e6eef0] bg-white/70 px-6 py-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
              <p className={cn("flex items-center gap-1.5 text-sm", MUTED)}>
                <Sparkles className="size-4 text-[#b07d3a]" aria-hidden />
                Valores CIVIL nos feedbacks {myValues ? "que você recebeu" : "da empresa"}
              </p>
              {myValues > 0 && (
                <p className={cn("flex items-center gap-3 text-xs", MUTED)}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-4 rounded-full bg-[linear-gradient(90deg,#2bb3b1,#0f6f80)]" aria-hidden />
                    Você
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-4 rounded-full bg-[#b9c8cd]" aria-hidden />
                    Empresa
                  </span>
                </p>
              )}
            </div>
            <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2 xl:grid-cols-5">
              {data.values.map((item) => {
                const company = totalValues ? Math.round((item.company / totalValues) * 100) : 0;
                const mine = myValues ? Math.round((item.mine / myValues) * 100) : 0;
                return (
                  <li key={item.value} className="flex items-center gap-2.5">
                    <ValueSeal value={item.value} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-xs font-medium leading-tight", INK)}>{CIVIL_LABELS[item.value]}</span>
                      {myValues > 0 && (
                        <span className="mt-1.5 flex items-center gap-2">
                          <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-[#e6eef0]">
                            <span className="block h-full rounded-full bg-[linear-gradient(90deg,#2bb3b1,#0f6f80)]" style={{ width: `${mine}%` }} />
                          </span>
                          <span className={cn("w-8 text-right text-xs font-semibold tabular-nums", INK)} aria-label={`Você: ${mine}%`}>
                            {mine}%
                          </span>
                        </span>
                      )}
                      <span className="mt-1 flex items-center gap-2">
                        <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-[#eef2f3]">
                          <span className="block h-full rounded-full bg-[#b9c8cd]" style={{ width: `${company}%` }} />
                        </span>
                        <span className={cn("w-8 text-right text-xs tabular-nums", MUTED)} aria-label={`Empresa: ${company}%`}>
                          {company}%
                        </span>
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {toast && (
        <p className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
          {toast}
          <button type="button" onClick={() => setToast(null)} className="rounded p-1 hover:bg-emerald-100" aria-label="Fechar">
            <X className="size-4" aria-hidden />
          </button>
        </p>
      )}

      <div className={cn(CARD, "flex max-w-full gap-1 overflow-x-auto p-1 [mask-image:linear-gradient(to_right,#000_88%,transparent)] [scrollbar-width:none] sm:inline-flex sm:[mask-image:none]")} role="tablist" aria-label="Feedback">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => {
              setTab(item.id);
              setKindFilter("todos");
            }}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
              tab === item.id ? "bg-[#e8f8f8] text-[#1d5670] shadow-[inset_0_0_0_1px_#47cdd0]" : "text-[#3b5560] hover:bg-[#f4fafb]"
            )}
          >
            <item.icon className="size-4" aria-hidden />
            {item.label}
            {item.badge ? <span className="rounded-full bg-[#1f9ea1] px-1.5 text-xs font-semibold leading-5 text-white tabular-nums">{item.badge}</span> : null}
          </button>
        ))}
      </div>

      {tab === "recebidos" &&
        list(data.received, "from", { icon: Inbox, title: "Nenhum feedback recebido ainda", text: "Que tal pedir? O pedido vai direto para quem você escolher.", action: { label: "Pedir feedback", onClick: () => setRequesting(true) } })}
      {tab === "enviados" &&
        list(data.sent, "to", { icon: Send, title: "Você ainda não deu feedback", text: "Reconhecer algo que deu certo leva dois minutos e faz diferença.", action: { label: "Dar feedback", onClick: () => setGiving({}) } })}
      {tab === "pedidos" && (
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className={cn("text-base font-semibold", INK)}>Para você responder</h2>
            {data.requests_received.length === 0 ? (
              <EmptyState icon={MessageSquarePlus} title="Nenhum pedido para você" text="Quando alguém pedir seu feedback, o pedido aparece aqui e no sino." />
            ) : (
              <ul className="grid gap-3">
                {data.requests_received.map((request) => (
                  <RequestCard key={request.id} request={request} mine={false} onAnswer={() => setGiving({ request })} onChanged={reload} />
                ))}
              </ul>
            )}
          </section>
          <section className="space-y-3">
            <h2 className={cn("text-base font-semibold", INK)}>Que você pediu</h2>
            {data.requests_sent.length === 0 ? (
              <EmptyState icon={MessageSquarePlus} title="Você ainda não pediu feedback" text="Pedir é o jeito mais rápido de saber como está indo um trabalho." action={{ label: "Pedir feedback", onClick: () => setRequesting(true) }} />
            ) : (
              <ul className="grid gap-3">
                {data.requests_sent.map((request) => (
                  <RequestCard key={request.id} request={request} mine onAnswer={() => undefined} onChanged={reload} />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
      {tab === "mural" &&
        (data.mural.length === 0 ? (
          <EmptyState icon={Globe2} title="O mural ainda está vazio" text="Reconhecimentos enviados para todos aparecem aqui." action={{ label: "Dar um reconhecimento", onClick: () => setGiving({}) }} />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {data.mural.map((item) => (
              <FeedbackCard key={item.id} item={item} perspective="both" onOpen={() => setOpenId(item.id)} />
            ))}
          </div>
        ))}
      {tab === "equipe" && (
        <div className="space-y-6">
          <TeamCoverage rows={data.team_coverage} limit={data.settings.coverage_days} onGive={(id) => setGiving({ to: id })} />
          <section className="space-y-3">
            <h2 className={cn("text-base font-semibold", INK)}>Feedbacks que a equipe recebeu com cópia para o gestor</h2>
            {list(data.team_feedbacks, "both", { icon: Users, title: "Nada por aqui ainda", text: "Quando alguém der feedback a uma pessoa da sua equipe escolhendo “a pessoa e o gestor”, ele aparece aqui." })}
          </section>
        </div>
      )}

      {openId && (
        <FeedbackDetailDialog
          id={openId}
          onClose={() => {
            setOpenId(null);
            // Veio pelo link do aviso (?f=): limpa para não reabrir ao atualizar a página.
            const params = new URLSearchParams(window.location.search);
            if (params.has("f")) {
              params.delete("f");
              const rest = params.toString();
              window.history.replaceState(null, "", rest ? `${window.location.pathname}?${rest}` : window.location.pathname);
            }
          }}
          onChanged={reload}
        />
      )}
      {giving && (
        <GiveFeedbackDialog
          people={data.people}
          templates={data.templates}
          settings={data.settings}
          initialTo={giving.to ?? null}
          request={giving.request ?? null}
          onClose={() => setGiving(null)}
          onDone={async () => {
            setGiving(null);
            setToast("Feedback enviado. A pessoa recebe o aviso no sino.");
            setTab("enviados");
            await reload();
          }}
        />
      )}
      {requesting && (
        <RequestFeedbackDialog
          people={data.people}
          team={teamPeople}
          me={data.me}
          onClose={() => setRequesting(false)}
          onDone={async (count) => {
            setRequesting(false);
            setToast(count === 1 ? "Pedido enviado." : `Pedido enviado para ${count} pessoas.`);
            setTab("pedidos");
            await reload();
          }}
        />
      )}
    </div>
  );
}
