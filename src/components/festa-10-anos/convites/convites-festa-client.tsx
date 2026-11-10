"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Check,
  CheckCheck,
  Copy,
  Download,
  ExternalLink,
  Eye,
  LoaderCircle,
  Mail,
  MessageCircle,
  PartyPopper,
  Phone,
  RefreshCw,
  Search,
  Send,
  UserRoundCog,
  UserRoundX,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PersonFace } from "@/components/pesquisas/shared";
import { getInitials } from "@/lib/ferias/filters";
import { cn } from "@/lib/utils";
import { formatRsvpDeadline } from "@/lib/event-rsvp";
import {
  CONVITE_SAMPLE_TOKEN,
  buildInviteMessage,
  countBoard,
  invitePath,
  inviteUrl,
  stageOf,
  whatsappUrl,
  type BoardAction,
  type BoardInvite,
  type BoardPerson,
  type ConvitesBoard,
  type InviteStage,
} from "@/lib/festa-convite";
import { DeadlineDialog, InviteDialog, SenderDialog } from "./convites-dialogs";

const API = "/api/festa-10-anos/convites";

export const STAGE_LABEL: Record<InviteStage, string> = {
  sem_remetente: "Sem remetente",
  a_enviar: "A enviar",
  enviado: "Enviado",
  abriu: "Abriu o convite",
  confirmado: "Vai",
  recusado: "Não vai",
};

const STAGE_STYLE: Record<InviteStage, string> = {
  sem_remetente: "bg-amber-50 text-amber-800 ring-amber-200",
  a_enviar: "bg-slate-50 text-slate-700 ring-slate-200",
  enviado: "bg-[#eaf2f5] text-[#285f7a] ring-[#3e84a8]/25",
  abriu: "bg-[#48466e]/8 text-[#48466e] ring-[#48466e]/20",
  confirmado: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  recusado: "bg-rose-50 text-rose-800 ring-rose-200",
};

type Filter = "todos" | "a_enviar" | "aguardando" | "confirmado" | "recusado";

const NO_SENDER = "__sem__";
const ALL_SENDERS = "__todos__";

export function StageBadge({ stage }: { stage: InviteStage }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", STAGE_STYLE[stage])}>
      {STAGE_LABEL[stage]}
    </span>
  );
}

/** Logo da empresa do cliente (quando temos); apagada quando está oculta no convite. Sem logo, as iniciais. */
export function ClientFace({ invite, size = "md" }: { invite: BoardInvite; size?: "md" | "lg" }) {
  const box = size === "lg" ? "size-11" : "size-10";
  if (invite.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={invite.logoUrl}
        alt=""
        className={cn(box, "shrink-0 rounded-md border border-[#dce9eb] bg-white object-contain", !invite.showLogo && "opacity-40 grayscale")}
      />
    );
  }
  return (
    <Avatar className={cn(box, "shrink-0 ring-1 ring-black/5")}>
      <AvatarFallback className="bg-[#fbf3e3] text-sm font-semibold text-[#7a5a26]">{getInitials(invite.name)}</AvatarFallback>
    </Avatar>
  );
}

export function formatDay(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt("Copie o texto:", text);
    return false;
  }
}

/** Mensagem do convite com o nome de quem envia (o remetente definido; sem ele, sai sem a apresentação). */
export function messageFor(invite: BoardInvite, board: ConvitesBoard): string {
  const sender =
    invite.senderUserId === board.viewer.userId
      ? board.viewer.firstName
      : (board.people.find((person) => person.userId === invite.senderUserId)?.firstName ?? "");
  return buildInviteMessage({
    guestFirstName: invite.firstName,
    senderFirstName: sender,
    closesAt: board.closesAt,
    link: inviteUrl(invite.token),
  });
}

function timeline(invite: BoardInvite): string {
  if (invite.attending === true) {
    return invite.plusOne && invite.plusOneName ? `Com ${invite.plusOneName}` : "Sem convidado";
  }
  if (invite.attending === false) return `Respondeu em ${formatDay(invite.respondedAt)}`;
  const parts: string[] = [];
  if (invite.sentAt) parts.push(`Enviado em ${formatDay(invite.sentAt)}`);
  if (invite.openedAt) parts.push(`abriu em ${formatDay(invite.openedAt)}`);
  return parts.join(" · ");
}

function Stat({
  icon: Icon,
  label,
  value,
  detail,
  tone,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  detail?: string;
  tone: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex min-h-[68px] items-center gap-3 rounded-md border bg-white p-3 text-left transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/40",
        active ? "border-[#347796] bg-[#f3fafb]" : "border-[#dce9eb] hover:border-[#47cdd0]/70"
      )}
    >
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-md", tone)} aria-hidden>
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl font-semibold leading-none tabular-nums text-foreground">{value}</span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">
          {label}
          {detail ? ` · ${detail}` : ""}
        </span>
      </span>
    </button>
  );
}

async function exportExcel(board: ConvitesBoard) {
  const XLSX = await import("xlsx");
  const senderName = (id: string | null) => board.people.find((person) => person.userId === id)?.name ?? "";
  const header = ["Cliente", "Empresa", "Área", "Remetente", "Situação", "Enviado em", "Abriu em", "Convidado", "Restrição alimentar", "Celular", "E-mail"];
  const rows = board.invites.map((invite) => [
    invite.name,
    invite.company ?? "",
    invite.area ?? "",
    senderName(invite.senderUserId),
    STAGE_LABEL[stageOf(invite)],
    formatDay(invite.sentAt),
    formatDay(invite.openedAt),
    invite.attending && invite.plusOne ? (invite.plusOneName ?? "") : "",
    invite.dietary ?? "",
    invite.phone.display ?? "",
    invite.email ?? "",
  ]);
  const entrance = board.invites
    .filter((invite) => invite.attending === true)
    .flatMap((invite) => [
      [invite.name, invite.company ?? "", "Cliente"],
      ...(invite.plusOne && invite.plusOneName ? [[invite.plusOneName, invite.company ?? "", `Convidado de ${invite.name}`]] : []),
    ]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([header, ...rows]), "Convites");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Nome", "Empresa", "Tipo"], ...entrance]), "Lista de entrada");
  XLSX.writeFile(book, "convites-clientes-festa-10-anos.xlsx");
}

/** Quem envia para cada área (só para quem gerencia): define o remetente de todos os clientes da área de uma vez. */
function AreaSenders({
  board,
  onPick,
  onFilter,
}: {
  board: ConvitesBoard;
  onPick: (title: string, invites: BoardInvite[]) => void;
  onFilter: (senderId: string) => void;
}) {
  const areas = useMemo(() => {
    const map = new Map<string, BoardInvite[]>();
    for (const invite of board.invites) {
      const key = invite.area ?? "Sem área no cadastro";
      map.set(key, [...(map.get(key) ?? []), invite]);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [board.invites]);

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center gap-2.5 border-b border-[#e6eef0] px-4 py-3">
        <UserRoundCog className="size-4 shrink-0 text-[#3e84a8]" aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">Quem envia</h3>
        <p className="ml-auto hidden text-xs text-muted-foreground sm:block">Sócio da área ou sócios patrimoniais: troque quando quiser.</p>
      </div>
      <ul className="divide-y divide-[#e6eef0]">
        {areas.map(([area, invites]) => {
          const senderIds = [...new Set(invites.map((invite) => invite.senderUserId))];
          const senders = senderIds.filter(Boolean).map((id) => board.people.find((person) => person.userId === id)).filter(Boolean) as BoardPerson[];
          const missing = invites.filter((invite) => !invite.senderUserId).length;
          const sent = invites.filter((invite) => invite.sentAt).length;
          return (
            <li key={area} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-40 flex-1">
                <p className="text-sm font-medium text-foreground">{area}</p>
                <p className="text-xs text-muted-foreground">
                  {invites.length} {invites.length === 1 ? "cliente" : "clientes"} · {sent} enviados
                </p>
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
                {senders.map((person) => (
                  <button
                    key={person.userId}
                    type="button"
                    onClick={() => onFilter(person.userId)}
                    className="flex items-center gap-2 rounded-md p-1 pr-2 text-left outline-none transition-colors hover:bg-[#47cdd0]/10 focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/40"
                    title={`Ver os convites de ${person.name}`}
                  >
                    <PersonFace person={{ short_name: person.name, avatar_url: person.avatarUrl }} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">{person.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{person.position ?? ""}</span>
                    </span>
                  </button>
                ))}
                {missing > 0 && (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
                    {missing === invites.length ? "A definir" : `${missing} sem remetente`}
                  </span>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => onPick(area, invites)}>
                {senders.length ? "Trocar" : "Definir"}
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function ConvitesFestaClient() {
  const [board, setBoard] = useState<ConvitesBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "erro"; text: string } | null>(null);
  const [filter, setFilter] = useState<Filter>("todos");
  const [senderFilter, setSenderFilter] = useState<string>(ALL_SENDERS);
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ title: string; inviteIds: string[]; current: string | null; returnTo?: string } | null>(null);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(API, { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as (ConvitesBoard & { error?: string }) | null;
      if (!response.ok || !data) throw new Error(data?.error ?? "Não foi possível carregar os convites.");
      setBoard(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os convites.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(async (action: BoardAction, success?: string): Promise<boolean> => {
    setBusy(true);
    try {
      const response = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) });
      const data = (await response.json().catch(() => null)) as (ConvitesBoard & { error?: string }) | null;
      if (!response.ok || !data) throw new Error(data?.error ?? "Não foi possível salvar. Tente de novo.");
      setBoard(data);
      setNotice(success ? { tone: "ok", text: success } : null);
      return true;
    } catch (actionError) {
      setNotice({ tone: "erro", text: actionError instanceof Error ? actionError.message : "Não foi possível salvar." });
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const flashCopied = (key: string) => {
    setCopied(key);
    window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 2000);
  };

  const sendWhatsapp = (invite: BoardInvite) => {
    if (!board || !invite.phone.waNumber) return;
    window.open(whatsappUrl(invite.phone.waNumber, messageFor(invite, board)), "_blank", "noopener,noreferrer");
    void act({ action: "mark_sent", inviteId: invite.id, channel: "whatsapp" }, `Convite de ${invite.firstName} marcado como enviado.`);
  };

  const copyMessage = async (invite: BoardInvite) => {
    if (!board) return;
    await copyText(messageFor(invite, board));
    flashCopied(`msg:${invite.id}`);
    // Sem celular no cadastro: a cópia é o envio (a pessoa cola no contato que tiver).
    if (invite.senderUserId === board.viewer.userId && !invite.phone.waNumber && !invite.sentAt) {
      void act({ action: "mark_sent", inviteId: invite.id, channel: "copia" });
    }
  };

  const invites = useMemo(() => board?.invites ?? [], [board]);
  const scoped = useMemo(() => {
    if (senderFilter === ALL_SENDERS) return invites;
    if (senderFilter === NO_SENDER) return invites.filter((invite) => !invite.senderUserId);
    return invites.filter((invite) => invite.senderUserId === senderFilter);
  }, [invites, senderFilter]);
  const counts = useMemo(() => countBoard(scoped), [scoped]);
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return scoped.filter((invite) => {
      const stage = stageOf(invite);
      if (filter === "a_enviar" && stage !== "a_enviar" && stage !== "sem_remetente") return false;
      if (filter === "aguardando" && stage !== "enviado" && stage !== "abriu") return false;
      if (filter === "confirmado" && stage !== "confirmado") return false;
      if (filter === "recusado" && stage !== "recusado") return false;
      if (!term) return true;
      return invite.name.toLowerCase().includes(term) || (invite.company ?? "").toLowerCase().includes(term);
    });
  }, [scoped, filter, search]);

  if (error && !board) {
    return (
      <Card className="items-center gap-3 px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={() => void load()}>
          Tentar de novo
        </Button>
      </Card>
    );
  }

  if (!board) {
    return (
      <Card className="items-center px-6 py-12" role="status">
        <LoaderCircle className="size-5 animate-spin text-[#3e84a8]" aria-hidden />
        <p className="text-sm text-muted-foreground">Carregando os convites…</p>
      </Card>
    );
  }

  const opened = openId ? (invites.find((invite) => invite.id === openId) ?? null) : null;
  const toSend = counts.total - counts.sent;
  const waiting = scoped.filter((invite) => invite.sentAt && invite.attending === null).length;
  const senderOptions = board.people.filter((person) => invites.some((invite) => invite.senderUserId === person.userId));
  const toggle = (next: Filter) => setFilter((current) => (current === next ? "todos" : next));

  return (
    <div className="space-y-4">
      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3 px-4 py-4 sm:px-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-md bg-[#fbf3e3] text-[#9c7434]" aria-hidden>
            <PartyPopper className="size-5" />
          </span>
          <div className="min-w-56 flex-1">
            <h2 className="text-base font-semibold text-foreground">Envie pelo seu WhatsApp</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              17/12, às 18h, na Fazenda Santa Margarida. Cada cliente tem um link pessoal com o dress code e a confirmação,
              e pode levar 1 convidado. A mensagem já vem pronta: é só conferir e enviar pelo seu WhatsApp.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={invitePath(CONVITE_SAMPLE_TOKEN)} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" aria-hidden />
                Ver o convite
              </a>
            </Button>
            {board.manager && (
              <Button variant="outline" size="sm" onClick={() => void exportExcel(board)}>
                <Download className="size-4" aria-hidden />
                Excel
              </Button>
            )}
            <Button variant="ghost" size="icon-sm" aria-label="Atualizar" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[#e6eef0] px-4 py-2.5 text-sm sm:px-5">
          <CalendarClock className="size-4 shrink-0 text-[#3e84a8]" aria-hidden />
          <span className="text-foreground">
            {board.closesAt ? (
              <>
                Confirmação até <strong className="font-semibold">{formatRsvpDeadline(board.closesAt)}</strong>
              </>
            ) : (
              "Sem prazo de confirmação na mensagem"
            )}
          </span>
          {board.manager && (
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setDeadlineOpen(true)}>
              {board.closesAt ? "Alterar" : "Definir prazo"}
            </Button>
          )}
        </div>
      </Card>

      {notice && (
        <p
          role={notice.tone === "erro" ? "alert" : "status"}
          className={cn(
            "rounded-md border px-4 py-2.5 text-sm",
            notice.tone === "erro" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"
          )}
        >
          {notice.text}
        </p>
      )}

      {board.manager && invites.length > 0 && (
        <AreaSenders
          board={board}
          onPick={(title, areaInvites) =>
            setPicker({
              title: `Quem envia para ${title}`,
              inviteIds: areaInvites.map((invite) => invite.id),
              current: areaInvites.every((invite) => invite.senderUserId === areaInvites[0].senderUserId) ? areaInvites[0].senderUserId : null,
            })
          }
          onFilter={(senderId) => setSenderFilter((current) => (current === senderId ? ALL_SENDERS : senderId))}
        />
      )}

      {invites.length === 0 ? (
        <Card className="items-center gap-2 px-6 py-12 text-center">
          <UsersRound className="size-6 text-[#3e84a8]" aria-hidden />
          <p className="text-sm font-medium text-foreground">Nenhum convite está com você</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Quando um cliente for atribuído a você, ele aparece aqui com a mensagem pronta para enviar.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={Send} label="A enviar" value={toSend} detail={counts.noSender ? `${counts.noSender} sem remetente` : undefined} tone="bg-slate-100 text-slate-600" active={filter === "a_enviar"} onClick={() => toggle("a_enviar")} />
            <Stat icon={Eye} label="Aguardando resposta" value={waiting} detail={`${counts.opened} abriram`} tone="bg-[#eaf2f5] text-[#285f7a]" active={filter === "aguardando"} onClick={() => toggle("aguardando")} />
            <Stat icon={CheckCheck} label="Confirmados" value={counts.confirmed} detail={counts.confirmed ? `${counts.headcount} pessoas com os convidados` : undefined} tone="bg-emerald-50 text-emerald-700" active={filter === "confirmado"} onClick={() => toggle("confirmado")} />
            <Stat icon={UserRoundX} label="Não vão" value={counts.declined} tone="bg-rose-50 text-rose-700" active={filter === "recusado"} onClick={() => toggle("recusado")} />
          </div>

          <Card className="gap-0 py-0">
            <div className="flex flex-wrap items-center gap-2 border-b border-[#e6eef0] px-4 py-3">
              <h3 className="mr-auto text-sm font-semibold text-foreground">
                {visible.length} {visible.length === 1 ? "cliente" : "clientes"}
                {filter !== "todos" || senderFilter !== ALL_SENDERS || search ? ` de ${invites.length}` : ""}
              </h3>
              {board.manager && (
                <select
                  aria-label="Filtrar por remetente"
                  value={senderFilter}
                  onChange={(event) => setSenderFilter(event.target.value)}
                  className="h-9 rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/40"
                >
                  <option value={ALL_SENDERS}>Todos os remetentes</option>
                  {senderOptions.map((person) => (
                    <option key={person.userId} value={person.userId}>
                      {person.name}
                    </option>
                  ))}
                  {invites.some((invite) => !invite.senderUserId) && <option value={NO_SENDER}>Sem remetente</option>}
                </select>
              )}
              <div className="relative w-full sm:w-60">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input aria-label="Buscar cliente ou empresa" placeholder="Buscar cliente ou empresa" value={search} onChange={(event) => setSearch(event.target.value)} className="h-9 pl-9" />
              </div>
            </div>

            {visible.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhum cliente nesta lista.</p>
            ) : (
              <ul className="divide-y divide-[#e6eef0]">
                {visible.map((invite) => {
                  const stage = stageOf(invite);
                  const mine = invite.senderUserId === board.viewer.userId;
                  const sender = board.people.find((person) => person.userId === invite.senderUserId);
                  const detail = timeline(invite);
                  return (
                    <li key={invite.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                      <ClientFace invite={invite} />
                      <button
                        type="button"
                        onClick={() => setOpenId(invite.id)}
                        className="min-w-40 flex-1 rounded-md text-left outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/40"
                      >
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-sm font-medium text-foreground">{invite.name}</span>
                          <StageBadge stage={stage} />
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {[invite.company, detail].filter(Boolean).join(" · ")}
                        </span>
                      </button>
                      <div className="hidden w-44 shrink-0 text-xs text-muted-foreground lg:block">
                        <span className="flex items-center gap-1.5">
                          <Phone className="size-3.5 shrink-0" aria-hidden />
                          <span className="truncate">
                            {invite.phone.kind === "celular"
                              ? invite.phone.display
                              : invite.phone.kind === "fixo"
                                ? "Só telefone fixo"
                                : invite.phone.kind === "revisar"
                                  ? "Celular a revisar"
                                  : "Sem celular"}
                          </span>
                        </span>
                        {invite.email && (
                          <span className="mt-0.5 flex items-center gap-1.5">
                            <Mail className="size-3.5 shrink-0" aria-hidden />
                            <span className="truncate">{invite.email}</span>
                          </span>
                        )}
                      </div>
                      {board.manager && (
                        <div className="hidden w-9 shrink-0 justify-center md:flex" title={sender ? `Envia: ${sender.name}` : "Sem remetente"}>
                          {sender ? (
                            <PersonFace person={{ short_name: sender.name, avatar_url: sender.avatarUrl }} />
                          ) : (
                            <span className="grid size-8 place-items-center rounded-full border border-dashed border-amber-300 text-amber-700" aria-label="Sem remetente">
                              <UserRoundCog className="size-4" aria-hidden />
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex shrink-0 items-center gap-2">
                        {mine && invite.phone.waNumber && invite.attending === null && (
                          <Button size="sm" variant={invite.sentAt ? "outline" : "default"} onClick={() => sendWhatsapp(invite)} disabled={busy}>
                            <MessageCircle className="size-4" aria-hidden />
                            {invite.sentAt ? "Enviar de novo" : "Enviar no WhatsApp"}
                          </Button>
                        )}
                        {(!mine || !invite.phone.waNumber) && invite.attending === null && (
                          <Button size="sm" variant="secondary" onClick={() => void copyMessage(invite)}>
                            {copied === `msg:${invite.id}` ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                            {copied === `msg:${invite.id}` ? "Copiada" : "Copiar mensagem"}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setOpenId(invite.id)}>
                          Detalhes
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}

      {opened && (
        <InviteDialog
          invite={opened}
          board={board}
          busy={busy}
          onClose={() => setOpenId(null)}
          onSendWhatsapp={() => sendWhatsapp(opened)}
          onAct={act}
          onChangeSender={() => {
            // Um modal por vez: o detalhe fecha, o seletor abre e, ao terminar, o detalhe volta.
            setPicker({ title: `Quem envia para ${opened.firstName}`, inviteIds: [opened.id], current: opened.senderUserId, returnTo: opened.id });
            setOpenId(null);
          }}
        />
      )}
      {picker && (
        <SenderDialog
          title={picker.title}
          count={picker.inviteIds.length}
          people={board.people}
          current={picker.current}
          busy={busy}
          onClose={() => {
            if (picker.returnTo) setOpenId(picker.returnTo);
            setPicker(null);
          }}
          onPick={async (senderUserId) => {
            const ok = await act({ action: "set_sender", inviteIds: picker.inviteIds, senderUserId }, "Remetente atualizado.");
            if (!ok) return;
            if (picker.returnTo) setOpenId(picker.returnTo);
            setPicker(null);
          }}
        />
      )}
      {deadlineOpen && (
        <DeadlineDialog
          closesAt={board.closesAt}
          busy={busy}
          onClose={() => setDeadlineOpen(false)}
          onSave={async (closesAt) => {
            const ok = await act({ action: "set_deadline", closesAt }, closesAt ? "Prazo atualizado." : "Prazo removido da mensagem.");
            if (ok) setDeadlineOpen(false);
          }}
        />
      )}
    </div>
  );
}
