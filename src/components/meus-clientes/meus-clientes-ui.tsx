"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Layers,
  Pencil,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  type EmailCompany,
  type EmailContact,
  type EmailPerson,
} from "@/lib/email-marketing";
import type { MeusClientesSyncMeta } from "@/lib/meus-clientes-server";
import { formatCargoDisplay } from "@/lib/cargo-options";
import {
  clientProfileIsIncomplete,
  contactToClientProfile,
  getProfileCargo,
  listClientMissingFieldLabels,
  personToClientProfile,
} from "@/lib/email-marketing-enrichment";
import {
  type AreaSummaryGroup,
  type EnrichmentTotals,
  countGroupPendingMembers,
  groupHasNoContacts,
  mergeGroupMembers,
} from "@/lib/meus-clientes";
import { AreaIcon, getAreaIconStyle } from "@/lib/area-icons";
import { getPartyInviteTipoDescription, getPartyInviteTipoLabel } from "@/lib/party-invite-types";
import type { PartyInviteTipo } from "@/lib/party-invite-types";
import {
  groupAtividadeTooltip,
  isGestorStatusPending,
  resolveGroupAtividade,
  type ClientGroupGestorStatus,
} from "@/lib/client-group-gestor-status";
import {
  resolveClienteCategoriaAtividade,
  resolveClienteFaturamentoIndicios,
  resolveClientePrevistoDate,
  type SioeClienteAtividade,
  type SioeClienteAtividadeIndex,
} from "@/lib/sioe-cliente-atividade";

export const SEM_GRUPO_KEY = "__sem_grupo__";
export const FILTER_SEM_AREA = "__sem_area__";

export type StatusFilter = "all" | "pending" | "complete";
export type AtividadeFilter = "all" | "ativo" | "inativo";
export type FaturamentoPrevistoFilter = "all" | "com" | "sem";
export type InviteFilter = "all" | "party" | "nps" | "both" | "none" | "not_party" | "not_nps";
export type SelectKey = `c:${string}` | `p:${string}`;

export interface ClientGroupBucket {
  key: string;
  name: string;
  clientGroupId: string | null;
  companies: EmailCompany[];
  groupPeople: EmailPerson[];
}

export function contactSelectKey(id: string): SelectKey {
  return `c:${id}`;
}

export function personSelectKey(id: string): SelectKey {
  return `p:${id}`;
}

export function parseSelectKey(key: string): { type: "contact" | "person"; id: string } | null {
  if (key.startsWith("c:")) return { type: "contact", id: key.slice(2) };
  if (key.startsWith("p:")) return { type: "person", id: key.slice(2) };
  return null;
}

export function formatSyncDate(iso: string | null): string {
  if (!iso) return "nunca";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function personInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

export function isContactPending(contact: EmailContact): boolean {
  return clientProfileIsIncomplete(contactToClientProfile(contact));
}

export function isPersonPending(person: EmailPerson): boolean {
  return clientProfileIsIncomplete(personToClientProfile(person));
}

function profileCargoLabel(entity: {
  cargo?: string | null;
  customFields?: Record<string, unknown>;
}): string | null {
  const raw = entity.cargo ?? getProfileCargo(entity);
  return formatCargoDisplay(raw);
}

export function contactSearchHaystack(contact: EmailContact): string {
  const cf = contact.customFields ?? {};
  return [
    contact.name,
    contact.email,
    contact.phone,
    contact.cargo,
    contact.customFields?.rd_cargo_e_book,
    contact.company,
    cf.rd_grupo_empresa,
    cf.rd_cnpj,
    cf.rd_empresa,
  ]
    .filter((v) => typeof v === "string" && v.trim())
    .join(" ")
    .toLowerCase();
}

export function highlightMatch(text: string, query: string): ReactNode {
  if (!query.trim() || !text) return text;
  const q = query.trim().toLowerCase();
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-amber-200/80 px-0.5 text-inherit">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

function AreaBadges({ areas, compact }: { areas: string[]; compact?: boolean }) {
  if (areas.length === 0) return null;
  const shown = compact ? areas.slice(0, 2) : areas;
  return (
    <>
      {shown.map((area) => (
        <Badge key={area} variant="outline" className="text-[10px] text-sky-700 border-sky-200 bg-sky-50">
          {area}
        </Badge>
      ))}
      {compact && areas.length > 2 && (
        <Badge variant="outline" className="text-[10px]">
          +{areas.length - 2}
        </Badge>
      )}
    </>
  );
}

function PartyInviteBadge({ partyInviteTipo }: { partyInviteTipo?: PartyInviteTipo | null }) {
  const label = getPartyInviteTipoLabel(partyInviteTipo);
  const description = getPartyInviteTipoDescription(partyInviteTipo);
  const badge = (
    <Badge
      variant="outline"
      className="text-[10px] text-violet-700 border-violet-200 bg-violet-50"
    >
      Festa
      {label ? `: ${label}` : ""}
    </Badge>
  );

  if (!label || !description) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{badge}</span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-sm font-semibold leading-snug text-violet-100">{label}</p>
        <p className="mt-1.5 text-xs leading-relaxed text-white/75">{description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function memberMatchesInviteFilter(
  member: {
    npsEligible: boolean;
    partyInvite: boolean;
    partyInviteTipo?: PartyInviteTipo | null;
  },
  inviteFilter: InviteFilter,
  partyTipoFilter: PartyInviteTipo | "all"
): boolean {
  if (partyTipoFilter !== "all" && member.partyInviteTipo !== partyTipoFilter) return false;
  if (inviteFilter === "party") return member.partyInvite;
  if (inviteFilter === "nps") return member.npsEligible;
  if (inviteFilter === "both") return member.partyInvite && member.npsEligible;
  if (inviteFilter === "none") return !member.partyInvite && !member.npsEligible;
  if (inviteFilter === "not_party") return !member.partyInvite;
  if (inviteFilter === "not_nps") return !member.npsEligible;
  return true;
}

function ClienteAtividadeBadge({
  status,
  tooltip,
  compact,
  pending,
  tone,
  labelOverride,
  tooltipTitle,
}: {
  status?: SioeClienteAtividade | null;
  tooltip?: string;
  compact?: boolean;
  pending?: boolean;
  tone?: "green" | "red" | "amber";
  labelOverride?: string;
  tooltipTitle?: string;
}) {
  if (pending && !status) {
    return (
      <Badge
        variant="outline"
        className={`text-[10px] text-amber-700 border-amber-200 bg-amber-50 ${compact ? "px-1.5 py-0" : ""}`}
        title="Confirme se o grupo está ativo ou inativo"
      >
        Status pendente
      </Badge>
    );
  }
  if (!status) return null;
  const isAtivo = status === "ativo";
  const label =
    labelOverride ??
    (pending
      ? `Indício: ${isAtivo ? "ativo" : "inativo"}`
      : isAtivo
        ? "Ativo"
        : "Inativo");
  const title = tooltip;
  const badgeTone = tone ?? (isAtivo ? "green" : "red");
  const toneClass =
    badgeTone === "amber"
      ? "text-amber-800 border-amber-300 bg-amber-50"
      : badgeTone === "green"
        ? "text-emerald-700 border-emerald-200 bg-emerald-50"
        : "text-red-700 border-red-200 bg-red-50";
  const badge = (
    <Badge
      variant="outline"
      className={`inline-flex items-center gap-1 text-[10px] ${toneClass} ${compact ? "px-1.5 py-0" : ""}`}
    >
      {label}
      <CircleHelp className="h-3 w-3 opacity-70" aria-hidden />
      {pending && <span className="hidden sm:inline opacity-70">ver critério</span>}
    </Badge>
  );
  if (!title) return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-help">{badge}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="text-sm font-semibold leading-snug">
          {tooltipTitle ?? (isAtivo ? "Indício de cliente ativo" : "Indício de cliente inativo")}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-white/75">{title}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function EditableRow({
  title,
  subtitle,
  line2,
  npsEligible,
  partyInvite,
  partyInviteTipo,
  areas,
  missing,
  pending,
  onEdit,
  selectable,
  selected,
  onSelectedChange,
  compact,
  searchQuery,
  tourContactEdit,
}: {
  title: string;
  subtitle: string;
  line2?: string;
  source?: string | null;
  npsEligible: boolean;
  partyInvite: boolean;
  partyInviteTipo?: PartyInviteTipo | null;
  areas?: string[];
  missing: string[];
  pending?: boolean;
  onEdit: () => void;
  selectable?: boolean;
  selected?: boolean;
  onSelectedChange?: (checked: boolean) => void;
  compact?: boolean;
  searchQuery?: string;
  tourContactEdit?: boolean;
}) {
  const q = searchQuery ?? "";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("input,button")) return;
        onEdit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit();
        }
      }}
      className={`flex cursor-pointer items-center gap-2.5 rounded-xl border bg-card transition-colors hover:bg-muted/30 ${
        compact ? "px-2.5 py-2" : "px-3 py-2.5"
      } ${selected ? "border-primary/40 bg-primary/5" : pending ? "border-amber-200/80 bg-amber-50/30" : ""}`}
    >
      {selectable && (
        <input
          type="checkbox"
          checked={selected ?? false}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onSelectedChange?.(e.target.checked)}
          className="h-4 w-4 shrink-0 rounded border-border accent-primary cursor-pointer"
          aria-label={`Selecionar ${title}`}
        />
      )}
      <span
        className={`relative flex shrink-0 items-center justify-center rounded-full bg-violet-100 font-semibold text-violet-700 ring-2 ring-violet-200/60 ${
          compact ? "h-7 w-7 text-[9px]" : "h-8 w-8 text-[10px]"
        }`}
      >
        {personInitials(title)}
        {pending && (
          <span
            className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-card"
            title={`Falta: ${missing.join(", ")}`}
          />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`truncate font-medium flex items-center gap-1.5 flex-wrap ${compact ? "text-xs" : "text-sm"}`}>
          {highlightMatch(title, q)}
          {!compact && npsEligible && (
            <Badge variant="outline" className="text-[10px] text-blue-700 border-blue-200 bg-blue-50">
              NPS
            </Badge>
          )}
          {!compact && partyInvite && (
            <PartyInviteBadge partyInviteTipo={partyInviteTipo} />
          )}
          <AreaBadges areas={areas ?? []} compact={compact} />
        </p>
        <p className={`truncate text-muted-foreground ${compact ? "text-[10px]" : "text-xs"}`}>
          {highlightMatch(subtitle, q)}
        </p>
        {line2 && (
          <p className={`truncate text-muted-foreground/80 ${compact ? "text-[10px]" : "text-xs"}`}>
            {highlightMatch(line2, q)}
          </p>
        )}
      </div>
      {missing.length > 0 && (
        <Badge
          variant="outline"
          className={`shrink-0 text-amber-700 border-amber-200 bg-amber-50 ${
            compact ? "max-w-[88px] truncate text-[9px] px-1.5 py-0" : "text-[10px]"
          }`}
          title={`Falta: ${missing.join(", ")}`}
        >
          {compact ? `${missing.length} pend.` : `Falta: ${missing.join(", ")}`}
        </Badge>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        className="shrink-0"
        {...(tourContactEdit ? { "data-tour": "mc-contact-edit" } : {})}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function GroupSection({
  group,
  groupContacts,
  personAreas,
  open,
  onOpenChange,
  isAdmin,
  selectedKeys,
  onToggleSelect,
  onToggleSelectAllInGroup,
  onEditContact,
  onEditPerson,
  onAddContact,
  clienteAtividadeIndex,
  gestorStatus,
  onEditGroupStatus,
  compact,
  searchQuery,
  inviteFilter = "all",
  partyTipoFilter = "all",
  tourGroupSample,
  tourContactEdit,
}: {
  group: ClientGroupBucket;
  groupContacts: EmailContact[];
  personAreas: Map<string, string[]>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin?: boolean;
  selectedKeys: Set<string>;
  onToggleSelect: (key: SelectKey, checked: boolean) => void;
  onToggleSelectAllInGroup: (keys: SelectKey[], checked: boolean) => void;
  onEditContact: (contact: EmailContact) => void;
  onEditPerson: (person: EmailPerson) => void;
  onAddContact: (group: ClientGroupBucket) => void;
  clienteAtividadeIndex?: SioeClienteAtividadeIndex | null;
  gestorStatus?: ClientGroupGestorStatus | null;
  onEditGroupStatus?: (group: ClientGroupBucket) => void;
  compact?: boolean;
  searchQuery?: string;
  inviteFilter?: InviteFilter;
  partyTipoFilter?: PartyInviteTipo | "all";
  tourGroupSample?: boolean;
  tourContactEdit?: boolean;
}) {
  const { contacts: mergedContacts, people: mergedPeople } = mergeGroupMembers(
    groupContacts,
    group.groupPeople
  );
  const noContacts = groupHasNoContacts(mergedPeople, mergedContacts);
  const pendingCount = noContacts ? 1 : countGroupPendingMembers(mergedPeople, mergedContacts);

  const groupAreas = useMemo(() => {
    const set = new Set<string>();
    for (const company of group.companies) {
      for (const area of company.legalAreas) set.add(area);
    }
    for (const person of group.groupPeople) {
      for (const area of personAreas.get(person.id) ?? []) set.add(area);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [group.companies, group.groupPeople, personAreas]);

  const sortedContacts = useMemo(
    () =>
      mergedContacts
        .filter((contact) => memberMatchesInviteFilter(contact, inviteFilter, partyTipoFilter))
        .slice()
        .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email, "pt-BR")),
    [mergedContacts, inviteFilter, partyTipoFilter]
  );
  const sortedPeople = useMemo(
    () =>
      mergedPeople
        .filter((person) => memberMatchesInviteFilter(person, inviteFilter, partyTipoFilter))
        .slice()
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "pt-BR")),
    [mergedPeople, inviteFilter, partyTipoFilter]
  );

  const allMembers = useMemo(
    () => [
      ...sortedContacts.map((c) => ({ type: "contact" as const, data: c })),
      ...sortedPeople.map((p) => ({ type: "person" as const, data: p })),
    ],
    [sortedContacts, sortedPeople]
  );
  const displayedMemberCount = allMembers.length;

  const groupSelectKeys = useMemo(() => {
    const keys: SelectKey[] = [];
    for (const contact of sortedContacts) keys.push(contactSelectKey(contact.id));
    for (const person of sortedPeople) keys.push(personSelectKey(person.id));
    return keys;
  }, [sortedContacts, sortedPeople]);

  const selectedInGroup = groupSelectKeys.filter((k) => selectedKeys.has(k)).length;
  const allSelectedInGroup =
    groupSelectKeys.length > 0 && selectedInGroup === groupSelectKeys.length;

  const groupAtividade = resolveGroupAtividade(
    { name: group.name, clientGroupId: group.clientGroupId },
    gestorStatus,
    clienteAtividadeIndex
  );
  const statusPending = Boolean(group.clientGroupId && isGestorStatusPending(gestorStatus));
  const statusBadgePending = group.clientGroupId
    ? statusPending
    : Boolean(groupAtividade && isGestorStatusPending(gestorStatus));
  const canEditGroupStatus = Boolean(group.clientGroupId && onEditGroupStatus);
  const showStatusArea = canEditGroupStatus || Boolean(groupAtividade);
  const groupPrevistoDate = clienteAtividadeIndex
    ? resolveClientePrevistoDate(clienteAtividadeIndex, { grupoName: group.name })
    : null;
  const groupFaturamentoIndicios = clienteAtividadeIndex
    ? resolveClienteFaturamentoIndicios(clienteAtividadeIndex, { grupoName: group.name })
    : { ultimoFaturamentoDate: null, proximoPrevistoDate: null, anyDate: null };
  const groupCategoriaAtividade = clienteAtividadeIndex
    ? resolveClienteCategoriaAtividade(clienteAtividadeIndex, { grupoName: group.name })
    : null;
  const hasConfirmedStatus = Boolean(gestorStatus?.gestorAtividade);
  const activeWithoutBilling =
    !hasConfirmedStatus &&
    groupCategoriaAtividade === "ativo" &&
    !groupFaturamentoIndicios.ultimoFaturamentoDate &&
    !groupFaturamentoIndicios.proximoPrevistoDate;
  const inactiveWithBilling =
    !hasConfirmedStatus &&
    groupCategoriaAtividade === "inativo" &&
    Boolean(
      groupFaturamentoIndicios.ultimoFaturamentoDate ||
        groupFaturamentoIndicios.proximoPrevistoDate
    );
  const badgeTone = activeWithoutBilling
    ? "amber"
    : groupAtividade === "ativo"
      ? "green"
      : "red";
  const badgeLabel = activeWithoutBilling
    ? "Cliente sem faturamento no último mês"
    : undefined;
  const badgeTooltipTitle = activeWithoutBilling
    ? "Cliente ativo sem faturamento"
    : inactiveWithBilling
      ? "Cadastro inativo com faturamento"
      : undefined;
  const atividadeTooltip = groupAtividadeTooltip(
    groupAtividade,
    gestorStatus,
    clienteAtividadeIndex?.mesReferencia,
    groupPrevistoDate,
    groupCategoriaAtividade,
    groupFaturamentoIndicios.ultimoFaturamentoDate,
    groupFaturamentoIndicios.proximoPrevistoDate
  );

  return (
    <section
      className={`rounded-lg border bg-card shadow-sm overflow-hidden ${
        pendingCount > 0 ? "border-amber-200/70" : "border-border/80"
      }`}
      {...(tourGroupSample ? { "data-tour": "mc-group-sample" } : {})}
    >
      <div className="flex items-stretch gap-2 px-2 py-2 sm:px-3 sm:py-3">
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted/20 transition-colors sm:px-3"
        >
          <span
            className={`flex shrink-0 items-center justify-center rounded-xl ${
              pendingCount > 0
                ? "bg-amber-500/10 text-amber-700"
                : "bg-violet-500/10 text-violet-700"
            } ${compact ? "h-9 w-9" : "h-11 w-11"}`}
          >
            <Layers className={compact ? "h-4 w-4" : "h-5 w-5"} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className={`block font-semibold leading-snug ${compact ? "text-sm" : "text-base"}`}>
                {searchQuery ? highlightMatch(group.name, searchQuery) : group.name}
              </span>
              {pendingCount > 0 && (
                <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-200 bg-amber-50">
                  {noContacts
                    ? "Sem contatos"
                    : `${pendingCount} pendência${pendingCount === 1 ? "" : "s"}`}
                </Badge>
              )}
              <AreaBadges areas={groupAreas} />
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {displayedMemberCount} contato{displayedMemberCount === 1 ? "" : "s"}
            </span>
          </span>
          {open ? (
            <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          )}
        </button>

        {showStatusArea && (
          <div className="my-1 flex shrink-0 flex-col items-end justify-center gap-1.5">
            <ClienteAtividadeBadge
              status={groupAtividade}
              tooltip={atividadeTooltip}
              pending={statusBadgePending}
              tone={badgeTone}
              labelOverride={badgeLabel}
              tooltipTitle={badgeTooltipTitle}
            />
            {canEditGroupStatus && (
              <Button
                type="button"
                variant={statusPending ? "default" : "outline"}
                size="sm"
                className={`shrink-0 ${
                  statusPending
                    ? "bg-amber-600 text-white hover:bg-amber-700 border-amber-600"
                    : ""
                }`}
                onClick={() => onEditGroupStatus?.(group)}
                {...(tourGroupSample ? { "data-tour": "mc-group-status" } : {})}
              >
                {statusPending ? "Confirmar status" : "Editar status"}
              </Button>
            )}
          </div>
        )}
      </div>

      {open && (
        <div className="border-t px-4 py-4 space-y-4 bg-muted/5">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-3">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  Contatos
                </p>
                {isAdmin && displayedMemberCount > 0 && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => onToggleSelectAllInGroup(groupSelectKeys, !allSelectedInGroup)}
                  >
                    {allSelectedInGroup ? "Desmarcar todos" : "Selecionar todos"}
                  </button>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-7 text-xs"
                onClick={() => onAddContact(group)}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Adicionar
              </Button>
            </div>
            {displayedMemberCount === 0 ? (
              <p className="text-xs text-amber-800 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-4 text-center">
                Nenhum contato cadastrado neste grupo. Adicione pelo botão acima.
              </p>
            ) : (
              <div className={`space-y-1.5 ${compact ? "space-y-1" : ""}`}>
                {allMembers.map((item, memberIndex) => {
                  const showTourEdit = Boolean(tourContactEdit && memberIndex === 0);
                  if (item.type === "contact") {
                    const contact = item.data;
                    const missing = listClientMissingFieldLabels(contactToClientProfile(contact));
                    const pending = isContactPending(contact);
                    return (
                      <EditableRow
                        key={`c-${contact.id}`}
                        title={contact.name ?? contact.email}
                        subtitle={[profileCargoLabel(contact), contact.email].filter(Boolean).join(" · ")}
                        line2={contact.phone ?? undefined}
                        source={contact.source}
                        npsEligible={contact.npsEligible}
                        partyInvite={contact.partyInvite}
                        partyInviteTipo={contact.partyInviteTipo}
                        missing={missing}
                        pending={pending}
                        onEdit={() => onEditContact(contact)}
                        selectable={isAdmin}
                        selected={selectedKeys.has(contactSelectKey(contact.id))}
                        onSelectedChange={(checked) =>
                          onToggleSelect(contactSelectKey(contact.id), checked)
                        }
                        compact={compact}
                        searchQuery={searchQuery}
                        tourContactEdit={showTourEdit}
                      />
                    );
                  }
                  const person = item.data;
                  const missing = listClientMissingFieldLabels(personToClientProfile(person));
                  const pending = isPersonPending(person);
                  return (
                    <EditableRow
                      key={`p-${person.id}`}
                      title={person.name}
                      subtitle={[profileCargoLabel(person), person.email].filter(Boolean).join(" · ")}
                      line2={person.phone ?? undefined}
                      source={person.source ?? "sioe"}
                      npsEligible={person.npsEligible}
                      partyInvite={person.partyInvite}
                      partyInviteTipo={person.partyInviteTipo}
                      areas={personAreas.get(person.id) ?? []}
                      missing={missing}
                      pending={pending}
                      onEdit={() => onEditPerson(person)}
                      selectable={isAdmin}
                      selected={selectedKeys.has(personSelectKey(person.id))}
                      onSelectedChange={(checked) =>
                        onToggleSelect(personSelectKey(person.id), checked)
                      }
                      compact={compact}
                      searchQuery={searchQuery}
                      tourContactEdit={showTourEdit}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export function MeusClientesSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-muted" />
      <div className="h-4 w-96 max-w-full rounded bg-muted" />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-10 rounded-lg bg-muted" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-16 rounded-lg bg-muted" />
      ))}
    </div>
  );
}

export function FixedToast({
  toast,
  onDismiss,
}: {
  toast: { type: "success" | "error"; text: string } | null;
  onDismiss: () => void;
}) {
  if (!toast) return null;
  return (
    <div
      className={`fixed bottom-6 right-6 z-[60] flex max-w-sm items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg ${
        toast.type === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-red-200 bg-red-50 text-red-900"
      }`}
    >
      <span className="flex-1">{toast.text}</span>
      <button type="button" onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function DeleteConfirmDialog({
  open,
  count,
  loading,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  count: number;
  loading?: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir {count} item{count === 1 ? "" : "s"}?</DialogTitle>
          <DialogDescription>
            Esta ação não pode ser desfeita. Os contatos selecionados serão removidos permanentemente.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? "Excluindo…" : "Excluir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProgressBarCard({
  complete,
  total,
  onShowPending,
}: {
  complete: number;
  total: number;
  onShowPending?: () => void;
}) {
  const pct = total > 0 ? Math.round((complete / total) * 100) : 100;
  const pending = total - complete;
  return (
    <div className="rounded-xl border border-border/80 bg-card px-4 py-3 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium">Progresso do cadastro</span>
        <span className="text-muted-foreground">
          {complete} de {total} ({pct}%)
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {pending > 0 && onShowPending && (
        <button
          type="button"
          onClick={onShowPending}
          className="mt-2 text-xs text-primary hover:underline"
        >
          Ver {pending} pendência{pending === 1 ? "" : "s"}
        </button>
      )}
    </div>
  );
}

export function HealthPanel({
  syncMeta,
  clienteAtividade,
}: {
  syncMeta: MeusClientesSyncMeta;
  clienteAtividade?: SioeClienteAtividadeIndex | null;
}) {
  const ativos = clienteAtividade
    ? Object.values(clienteAtividade.byGrupoKey).filter((s) => s === "ativo").length
    : 0;
  const inativos = clienteAtividade
    ? Object.values(clienteAtividade.byGrupoKey).filter((s) => s === "inativo").length
    : 0;

  return (
    <div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3 text-xs">
      <p className="mb-2 font-medium uppercase tracking-wide text-muted-foreground">Saúde dos dados</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
        <span>Última sync: {formatSyncDate(syncMeta.lastSyncedAt)}</span>
        {clienteAtividade && (ativos > 0 || inativos > 0) && (
          <span>
            Status comercial:{" "}
            <span className="text-emerald-700">{ativos} ativo(s)</span>
            {inativos > 0 && (
              <>
                {" · "}
                <span className="text-slate-600">{inativos} inativo(s)</span>
              </>
            )}
          </span>
        )}
        {syncMeta.groupsWithoutArea > 0 && (
          <span className="text-amber-700">{syncMeta.groupsWithoutArea} grupo(s) sem área</span>
        )}
      </div>
    </div>
  );
}

export function FilterChips({
  filterArea,
  filterGestor,
  filterStatus,
  filterAtividade,
  filterFaturamentoPrevisto,
  filterInvite,
  filterPartyTipo,
  gestorName,
  filterResultCount,
  onClearArea,
  onClearGestor,
  onClearStatus,
  onClearAtividade,
  onClearFaturamentoPrevisto,
  onClearInvite,
  onClearPartyTipo,
}: {
  filterArea: string;
  filterGestor: string;
  filterStatus: StatusFilter;
  filterAtividade?: AtividadeFilter;
  filterFaturamentoPrevisto?: FaturamentoPrevistoFilter;
  filterInvite?: InviteFilter;
  filterPartyTipo?: PartyInviteTipo | "all";
  gestorName?: string;
  filterResultCount?: number;
  onClearArea: () => void;
  onClearGestor: () => void;
  onClearStatus: () => void;
  onClearAtividade?: () => void;
  onClearFaturamentoPrevisto?: () => void;
  onClearInvite?: () => void;
  onClearPartyTipo?: () => void;
}) {
  const chips: { label: string; onClear: () => void }[] = [];
  if (filterArea) {
    chips.push({
      label: filterArea === FILTER_SEM_AREA ? "Sem área" : `Área: ${filterArea}`,
      onClear: onClearArea,
    });
  }
  if (filterGestor) {
    chips.push({
      label: `Gestor: ${gestorName ?? filterGestor}`,
      onClear: onClearGestor,
    });
  }
  if (filterStatus !== "all") {
    chips.push({
      label: filterStatus === "pending" ? "Pendentes" : "Completos",
      onClear: onClearStatus,
    });
  }
  if (filterAtividade && filterAtividade !== "all") {
    chips.push({
      label: filterAtividade === "ativo" ? "Status: ativo" : "Status: inativo",
      onClear: onClearAtividade ?? (() => {}),
    });
  }
  if (filterFaturamentoPrevisto && filterFaturamentoPrevisto !== "all") {
    chips.push({
      label:
        filterFaturamentoPrevisto === "com"
          ? "Faturamento: com indício"
          : "Faturamento: sem indício",
      onClear: onClearFaturamentoPrevisto ?? (() => {}),
    });
  }
  if (filterInvite && filterInvite !== "all") {
    const inviteLabels: Record<InviteFilter, string> = {
      all: "NPS/Festa: todos",
      party: "Festa: sim",
      nps: "NPS: sim",
      both: "NPS + Festa",
      none: "Sem NPS/Festa",
      not_party: "Festa: não",
      not_nps: "NPS: não",
    };
    chips.push({
      label: inviteLabels[filterInvite],
      onClear: onClearInvite ?? (() => {}),
    });
  }
  if (filterPartyTipo && filterPartyTipo !== "all") {
    chips.push({
      label: `Critério: ${getPartyInviteTipoLabel(filterPartyTipo) ?? filterPartyTipo}`,
      onClear: onClearPartyTipo ?? (() => {}),
    });
  }
  if (chips.length === 0 && filterResultCount === undefined) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {filterResultCount !== undefined && (
        <Badge variant="outline" className="text-xs tabular-nums font-normal">
          {filterResultCount} grupo{filterResultCount === 1 ? "" : "s"}
        </Badge>
      )}
      {chips.map((chip) => (
        <Badge key={chip.label} variant="secondary" className="gap-1 pr-1 text-xs">
          {chip.label}
          <button type="button" onClick={chip.onClear} className="rounded p-0.5 hover:bg-muted">
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}

export function StatusToggle({
  value,
  onChange,
  counts,
}: {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
  counts?: { all: number; pending: number; complete: number };
}) {
  const options: { id: StatusFilter; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "pending", label: "Pendentes" },
    { id: "complete", label: "Completos" },
  ];
  return (
    <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
      {options.map((opt) => {
        const count = counts?.[opt.id];
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              value === opt.id
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
            {count !== undefined && (
              <span className="ml-1 tabular-nums text-muted-foreground">({count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({
  variant,
  onClearSearch,
  onClearFilters,
  isAdmin,
}: {
  variant: "no-scope" | "no-search" | "all-complete";
  onClearSearch?: () => void;
  onClearFilters?: () => void;
  isAdmin?: boolean;
}) {
  const config = {
    "no-scope": {
      title: "Nenhum cliente vinculado a você",
      desc: isAdmin
        ? "Avise o admin para vincular seu usuário aos processos do SIOE em Configurações → E-mail Marketing."
        : "Se você é responsável por clientes e não vê nada aqui, avise o administrador para vincular seu usuário.",
      action: null as ReactNode,
    },
    "no-search": {
      title: "Nenhum resultado",
      desc: "Tente outro termo ou limpe os filtros.",
      action: (
        <div className="flex gap-2">
          {onClearSearch && (
            <Button variant="outline" size="sm" onClick={onClearSearch}>
              Limpar busca
            </Button>
          )}
          {onClearFilters && (
            <Button variant="ghost" size="sm" onClick={onClearFilters}>
              Limpar filtros
            </Button>
          )}
        </div>
      ),
    },
    "all-complete": {
      title: "Tudo completo!",
      desc: "Todos os cadastros visíveis estão preenchidos.",
      action: null,
    },
  }[variant];

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center text-muted-foreground">
      {variant === "all-complete" ? (
        <CheckCircle2 className="h-10 w-10 text-emerald-500/60" />
      ) : (
        <Users className="h-9 w-9 opacity-40" />
      )}
      <p className="text-sm font-medium text-foreground">{config.title}</p>
      <p className="text-xs max-w-sm">{config.desc}</p>
      {config.action}
    </div>
  );
}

export function FilterUserAvatar({
  name,
  avatarUrl,
  size = "sm",
}: {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "default";
}) {
  return (
    <Avatar size={size} title={name}>
      <AvatarImage src={avatarUrl || undefined} alt={name} />
      <AvatarFallback className="text-[10px] font-semibold">{personInitials(name)}</AvatarFallback>
    </Avatar>
  );
}

export function FilterAreaIcon({ area, size = "md" }: { area: string; size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const icon = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-lg ring-1 ${box} ${getAreaIconStyle(area)}`}
      aria-hidden
    >
      <AreaIcon area={area} className={icon} />
    </span>
  );
}

function AreaGroupCard({
  group,
  userAvatarById,
  onAreaClick,
  onGestorClick,
}: {
  group: AreaSummaryGroup;
  userAvatarById: Map<string, string | null>;
  onAreaClick?: (area: string) => void;
  onGestorClick?: (userId: string) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-xl border bg-card/80 overflow-hidden">
      <button
        type="button"
        onClick={() => {
          onAreaClick?.(group.area);
          setOpen((v) => !v);
        }}
        className="flex w-full flex-wrap items-center gap-2.5 px-3.5 py-3 text-left hover:bg-muted/20 transition-colors"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <FilterAreaIcon area={group.area} />
        <span className="text-sm font-semibold">{group.area}</span>
        <Badge variant="outline" className="text-[11px]">
          {group.groupsCount} grupo{group.groupsCount === 1 ? "" : "s"}
        </Badge>
        {group.profilesPending > 0 && (
          <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-200 bg-amber-50">
            {group.profilesPending} pendente{group.profilesPending === 1 ? "" : "s"}
          </Badge>
        )}
        {group.managers.length > 0 && (
          <span className="ml-auto hidden sm:inline-flex items-center -space-x-2">
            {group.managers.slice(0, 4).map((m) => (
              <span key={m.userId} title={`${m.userName} · ${m.adjustedCount} ajustados`}>
                <FilterUserAvatar
                  name={m.userName}
                  avatarUrl={userAvatarById.get(m.userId)}
                  size="sm"
                />
              </span>
            ))}
          </span>
        )}
      </button>
      {open && group.managers.length > 0 && (
        <div className="overflow-x-auto border-t">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Gestor</th>
                <th className="px-3 py-2 text-right font-medium">Ajustados</th>
                <th className="px-3 py-2 text-right font-medium">Completos</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {group.managers.map((m) => (
                <tr
                  key={m.userId}
                  className="cursor-pointer hover:bg-muted/10"
                  onClick={() => onGestorClick?.(m.userId)}
                >
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <FilterUserAvatar
                        name={m.userName}
                        avatarUrl={userAvatarById.get(m.userId)}
                        size="sm"
                      />
                      <span className="font-medium">{m.userName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">{m.adjustedCount}</td>
                  <td className="px-3 py-2 text-right text-emerald-700 font-medium">{m.adjustedComplete}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ManagerSummaryTable({
  groups,
  totals,
  totalsTitle,
  userAvatarById,
  onAreaClick,
  onGestorClick,
}: {
  groups: AreaSummaryGroup[];
  totals: EnrichmentTotals;
  totalsTitle: string;
  userAvatarById: Map<string, string | null>;
  onAreaClick?: (area: string) => void;
  onGestorClick?: (userId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  if (groups.length === 0) return null;

  return (
    <section className="rounded-lg border border-border/80 bg-card shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/20 transition-colors"
      >
        <span className="text-sm font-semibold">
          Visão por área e gestor ({groups.length} área{groups.length === 1 ? "" : "s"})
        </span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && (
        <div className="border-t p-3 space-y-2.5 bg-muted/5">
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">{totalsTitle}</p>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <Badge variant="outline">{totals.groupsCount} grupos</Badge>
              <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50">
                {totals.profilesComplete} completos
              </Badge>
              {totals.profilesPending > 0 && (
                <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">
                  {totals.profilesPending} pendentes
                </Badge>
              )}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">Clique em uma área ou gestor para filtrar a lista abaixo.</p>
          {groups.map((group) => (
            <AreaGroupCard
              key={group.area}
              group={group}
              userAvatarById={userAvatarById}
              onAreaClick={onAreaClick}
              onGestorClick={onGestorClick}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function ClickableStatCard({
  label,
  value,
  onClick,
  active,
  variant,
}: {
  label: string;
  value: number;
  onClick?: () => void;
  active?: boolean;
  variant?: "default" | "success" | "warning";
}) {
  const border =
    variant === "success"
      ? "border-emerald-200"
      : variant === "warning"
        ? "border-amber-200"
        : "border-border/80";
  const activeRing = active ? "ring-2 ring-primary/30" : "";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-xl border bg-card px-4 py-3 text-left shadow-sm transition-colors ${border} ${activeRing} ${
        onClick ? "hover:bg-muted/20 cursor-pointer" : "cursor-default"
      }`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </button>
  );
}
