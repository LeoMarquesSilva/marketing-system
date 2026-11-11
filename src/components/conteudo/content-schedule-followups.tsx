"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlarmClock,
  BellRing,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Film,
  Hourglass,
  Loader2,
  Mail,
  MessageCircle,
  MessagesSquare,
  RefreshCw,
  Send,
  Target,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { FollowupChannel, FollowupStatus, PautaStage } from "@/lib/content-schedule/followups";
import type { FollowupBoardItem, FollowupBoardResponse } from "@/lib/content-schedule/followups-server";
import { cn } from "@/lib/utils";
import { AreaMark, CollaboratorAvatar } from "./content-schedule-visuals";

const CHANNELS: Record<FollowupChannel, { label: string; Icon: typeof Mail }> = {
  teams: { label: "Teams", Icon: MessagesSquare },
  email: { label: "E-mail", Icon: Mail },
  whatsapp: { label: "WhatsApp", Icon: MessageCircle },
  pessoalmente: { label: "Pessoalmente", Icon: Users },
  outro: { label: "Outro", Icon: Send },
};

const STATUS: Record<FollowupStatus, { label: string; Icon: typeof Mail; tone: string }> = {
  cobrar: { label: "Vencida, sem cobrança", Icon: BellRing, tone: "border-red-200 bg-red-50 text-red-800" },
  retorno_vencido: { label: "Retorno vencido", Icon: AlarmClock, tone: "border-red-200 bg-red-50 text-red-800" },
  aguardando_retorno: { label: "Cobrada, aguardando", Icon: Hourglass, tone: "border-amber-200 bg-amber-50 text-amber-900" },
  no_prazo: { label: "No prazo", Icon: Clock3, tone: "border-slate-200 bg-slate-50 text-slate-700" },
  entregue_apos_cobranca: { label: "Entregue após cobrança", Icon: CheckCircle2, tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  entregue: { label: "Entregue", Icon: CheckCircle2, tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
};

const STAGES: Record<PautaStage, string> = {
  aguardando_envio: "Aguardando envio",
  em_revisao: "Em revisão",
  em_protocolo: "Em protocolo",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
};

const GROUPS: { key: string; title: string; hint: string; statuses: FollowupStatus[] }[] = [
  { key: "agir", title: "Para cobrar agora", hint: "Venceu e ninguém cobrou, ou o retorno combinado já passou.", statuses: ["cobrar", "retorno_vencido"] },
  { key: "aguardando", title: "Cobradas, aguardando retorno", hint: "Já falamos com a pessoa e o prazo de retorno ainda não venceu.", statuses: ["aguardando_retorno"] },
  { key: "prazo", title: "No prazo", hint: "Ainda não venceram.", statuses: ["no_prazo"] },
  { key: "entregues", title: "Entregues", hint: "Tarefa principal concluída no VIOS, como conta o indicador do SIOE.", statuses: ["entregue_apos_cobranca", "entregue"] },
];

function shortDate(value: string | null) {
  if (!value) return "Não informado";
  const [, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}`;
}

async function readError(response: Response) {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error || "Não foi possível concluir a operação.";
}

function GoalCard({ label, value, target, helper, Icon }: { label: string; value: number; target: number; helper: string; Icon: typeof Target }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div className="rounded-xl border border-[#dce9eb] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500"><Icon className="size-4 text-[#347796]" />{label}</span>
        <span className="text-xs font-medium tabular-nums text-slate-500">{pct}%</span>
      </div>
      <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-[#183f50]">{value}<span className="text-lg font-normal text-slate-400"> / {target}</span></p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e8f0f2]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={cn("h-full rounded-full", pct >= 100 ? "bg-emerald-500" : "bg-[#347796]")} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function FollowupRow({ item, onOpen }: { item: FollowupBoardItem; onOpen: () => void }) {
  const status = STATUS[item.status];
  const last = item.followups.at(-1);
  const delivered = item.status === "entregue" || item.status === "entregue_apos_cobranca";
  const FormatIcon = item.format === "reel" ? Film : FileText;
  return (
    <li className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(220px,1.1fr)_minmax(150px,0.7fr)_minmax(200px,1fr)_auto] lg:items-center">
      <div className="flex min-w-0 items-center gap-3">
        {item.person
          ? <CollaboratorAvatar person={{ name: item.person.name, avatarUrl: item.person.avatarUrl }} className="size-10" />
          : <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400"><UserRound className="size-4" /></span>}
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{item.person?.name ?? "Responsável não informado"}{item.secondPerson ? ` e ${item.secondPerson.name}` : ""}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <AreaMark area={item.area} compact />
            {item.format && <span className="flex items-center gap-1"><FormatIcon className="size-3.5" />{item.format === "reel" ? "Reel" : "Post"}</span>}
            {item.personSource === "cronograma" && <span title="Nome da vaga do cronograma ligada a esta tarefa. Confira no VIOS antes de cobrar.">nome pelo cronograma</span>}
          </div>
        </div>
      </div>

      <div className="text-sm">
        <p className="font-medium text-slate-800">{delivered ? `Entregue em ${shortDate(item.completedAt)}` : `Prazo ${shortDate(item.dueDate)}`}</p>
        <p className={cn("text-xs", item.daysLate > 0 ? "font-medium text-red-700" : "text-slate-500")}>
          {item.daysLate > 0 ? `${item.daysLate} ${item.daysLate === 1 ? "dia" : "dias"} de atraso` : STAGES[item.stage]}
        </p>
      </div>

      <div className="min-w-0 space-y-1">
        <Badge variant="outline" className={cn("gap-1.5", status.tone)}><status.Icon className="size-3.5" />{status.label}</Badge>
        <p className="truncate text-xs text-slate-500">
          {last
            ? `${item.followups.length}ª cobrança por ${CHANNELS[last.channel].label} em ${shortDate(last.sentAt)}${last.returnDue ? `, retorno até ${shortDate(last.returnDue)}` : ""}`
            : item.contentTitle ? `Conteúdo: ${item.contentTitle}` : "Nenhuma cobrança registrada"}
        </p>
      </div>

      <div className="flex items-center gap-2 lg:justify-end">
        <Button asChild variant="ghost" size="sm" className="text-slate-600"><a href={item.viosUrl} target="_blank" rel="noreferrer" aria-label={`Abrir a tarefa ${item.ci} no VIOS`}><ExternalLink />VIOS</a></Button>
        <Button size="sm" variant={delivered ? "outline" : "default"} className={cn(!delivered && "bg-[#347796] text-white hover:bg-[#285f7a]")} onClick={onOpen}>
          {delivered ? "Histórico" : item.followups.length ? "Cobrar de novo" : "Registrar cobrança"}
        </Button>
      </div>
    </li>
  );
}

function FollowupDialog({ item, today, onClose, onChanged }: { item: FollowupBoardItem; today: string; onClose: () => void; onChanged: () => Promise<void> }) {
  const [channel, setChannel] = useState<FollowupChannel>("teams");
  const [sentOn, setSentOn] = useState(today);
  const [returnDue, setReturnDue] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const delivered = item.status === "entregue" || item.status === "entregue_apos_cobranca";

  async function save() {
    setSaving(true); setError(null);
    const response = await fetch("/api/content-schedule/followups", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({
        ci: item.ci, channel, note: note.trim() || null, returnDue: returnDue || null, sentOn,
        collaboratorId: item.person?.id ?? null, collaboratorName: item.person?.name ?? "Não informado",
        area: item.area, dueDate: item.dueDate, slotId: item.slotId,
      }),
    });
    setSaving(false);
    if (!response.ok) { setError(await readError(response)); return; }
    await onChanged();
    onClose();
  }

  async function remove(id: string) {
    setSaving(true); setError(null);
    const response = await fetch(`/api/content-schedule/followups?id=${id}`, { method: "DELETE", credentials: "include" });
    setSaving(false);
    if (!response.ok) { setError(await readError(response)); return; }
    await onChanged();
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{item.person?.name ?? "Responsável não informado"}</DialogTitle>
          <DialogDescription>{item.area} · prazo {shortDate(item.dueDate)} · tarefa {item.ci} no VIOS · {STAGES[item.stage].toLocaleLowerCase("pt-BR")}</DialogDescription>
        </DialogHeader>

        <section aria-label="Histórico de cobranças">
          <h4 className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Histórico</h4>
          {item.followups.length === 0
            ? <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">Nenhuma cobrança registrada para esta pauta.</p>
            : (
              <ol className="mt-2 space-y-2">
                {item.followups.map((entry, index) => {
                  const channelInfo = CHANNELS[entry.channel];
                  return (
                    <li key={entry.id} className="rounded-md border border-[#e8f0f2] bg-white px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="flex items-center gap-2 text-sm font-medium text-slate-900"><channelInfo.Icon className="size-4 text-[#347796]" />{index + 1}ª cobrança · {channelInfo.label} · {shortDate(entry.sentAt)}</p>
                        <Button variant="ghost" size="icon" className="size-7 text-slate-400 hover:text-red-700" disabled={saving} onClick={() => void remove(entry.id)} aria-label={`Excluir a ${index + 1}ª cobrança`}><Trash2 className="size-3.5" /></Button>
                      </div>
                      <p className="text-xs text-slate-500">{entry.sentByName ? `Por ${entry.sentByName}` : "Autor não informado"}{entry.returnDue ? ` · retorno combinado até ${shortDate(entry.returnDue)}` : ""}</p>
                      {entry.note && <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-700">{entry.note}</p>}
                    </li>
                  );
                })}
              </ol>
            )}
        </section>

        {!delivered && (
          <section aria-label="Nova cobrança" className="space-y-3 border-t border-[#e8f0f2] pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Registrar nova cobrança</h4>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="followup-channel">Canal</Label>
                <Select value={channel} onValueChange={(value) => setChannel(value as FollowupChannel)}>
                  <SelectTrigger id="followup-channel" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CHANNELS).map(([value, info]) => <SelectItem key={value} value={value}>{info.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label htmlFor="followup-sent">Cobrei em</Label><Input id="followup-sent" type="date" max={today} value={sentOn} onChange={(event) => setSentOn(event.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="followup-return">Retorno até</Label><Input id="followup-return" type="date" min={sentOn} value={returnDue} onChange={(event) => setReturnDue(event.target.value)} /></div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="followup-note">O que foi combinado</Label>
              <Textarea id="followup-note" rows={3} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex.: pediu mais uma semana; vai mandar um áudio com os pontos." />
            </div>
          </section>
        )}

        {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          {!delivered && <Button className="bg-[#347796] text-white hover:bg-[#285f7a]" disabled={saving || !sentOn} onClick={() => void save()}>{saving ? <Loader2 className="animate-spin" /> : <BellRing />}Registrar cobrança</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ContentScheduleFollowups({ month }: { month: string }) {
  const [data, setData] = useState<FollowupBoardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCi, setOpenCi] = useState<number | null>(null);

  const fetchBoard = useCallback(async () => {
    const response = await fetch(`/api/content-schedule/followups?month=${month}`, { credentials: "include" });
    return response.ok
      ? { board: await response.json() as FollowupBoardResponse, error: null }
      : { board: null, error: await readError(response) };
  }, [month]);

  const apply = useCallback((result: { board: FollowupBoardResponse | null; error: string | null }) => {
    if (result.board) setData(result.board);
    setError(result.error);
    setLoading(false);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    apply(await fetchBoard());
  }, [apply, fetchBoard]);

  useEffect(() => {
    let active = true;
    void fetchBoard().then((result) => { if (active) apply(result); });
    return () => { active = false; };
  }, [apply, fetchBoard]);

  const groups = useMemo(() => {
    // Vencidas de meses anteriores, nunca cobradas, ficam à parte: no SIOE elas seguem abertas
    // até alguém dar baixa na tarefa do VIOS, mesmo que o conteúdo já tenha sido entregue.
    const isOld = (item: FollowupBoardItem) => item.status === "cobrar" && Boolean(item.dueDate && item.dueDate < `${month}-01`);
    const sorted = [...(data?.items ?? [])].sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
    return [
      ...GROUPS.map((group) => ({ ...group, items: sorted.filter((item) => group.statuses.includes(item.status) && !isOld(item)) })),
      {
        key: "antigas", title: "Sem baixa no VIOS, de meses anteriores",
        hint: "A tarefa segue aberta no VIOS. Confira se o conteúdo já foi entregue antes de cobrar.",
        statuses: ["cobrar"] as FollowupStatus[], items: sorted.filter(isOld),
      },
    ];
  }, [data, month]);
  const openItem = data?.items.find((item) => item.ci === openCi) ?? null;

  if (loading && !data) return <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-sm text-slate-500"><Loader2 className="size-6 animate-spin text-[#347796]" /><span>Carregando acompanhamento…</span></div>;
  if (error && !data) return <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 text-center"><p role="alert" className="text-sm text-red-800">{error}</p><Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw />Tentar de novo</Button></div>;
  if (!data) return null;

  const { pautas, posts } = data.goals;
  return (
    <div className="space-y-5 p-3 sm:p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <GoalCard Icon={Target} label="Pautas entregues no mês" value={pautas.delivered} target={pautas.target}
          helper={`Mesma regra do SIOE: tarefa principal concluída no VIOS. ${pautas.awaiting} ${pautas.awaiting === 1 ? "pauta do mês aguarda" : "pautas do mês aguardam"} envio e ${pautas.overdue} ${pautas.overdue === 1 ? "está vencida" : "estão vencidas"}.`} />
        <GoalCard Icon={Send} label="Publicações no Instagram" value={posts.published} target={posts.target} helper="Posts publicados no mês, contra a meta mensal definida em Instagram." />
      </div>

      <div className="flex items-start justify-between gap-3">
        <p className="max-w-3xl text-xs text-slate-500">Pautas com prazo neste mês e as vencidas de meses anteriores ainda sem entrega. Prazo e baixa vêm do SIOE, que guarda o prazo original da tarefa e só informa o responsável depois da conclusão: confira no VIOS antes de cobrar.</p>
        <Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}>{loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}Atualizar</Button>
      </div>
      {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

      {data.items.length === 0 && <p className="rounded-xl border border-dashed border-[#dce9eb] px-4 py-10 text-center text-sm text-slate-500">Nenhuma pauta com prazo neste mês.</p>}

      {groups.filter((group) => group.items.length > 0).map((group) => (
        <section key={group.key} aria-labelledby={`followup-group-${group.key}`} className="overflow-hidden rounded-xl border border-[#dce9eb] bg-white">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#e8f0f2] bg-[#f8fbfb] px-4 py-2.5">
            <h3 id={`followup-group-${group.key}`} className="font-semibold text-[#183f50]">{group.title} <span className="ml-1 rounded-full border border-[#dce9eb] bg-white px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">{group.items.length}</span></h3>
            <p className="text-xs text-slate-500">{group.hint}</p>
          </div>
          <ul className="divide-y divide-[#e8f0f2]">
            {group.items.map((item) => <FollowupRow key={item.ci} item={item} onOpen={() => setOpenCi(item.ci)} />)}
          </ul>
        </section>
      ))}

      {openItem && <FollowupDialog key={openItem.ci} item={openItem} today={data.today} onClose={() => setOpenCi(null)} onChanged={load} />}
    </div>
  );
}
