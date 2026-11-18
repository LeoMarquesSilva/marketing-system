"use client";

import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Building2, Check, ChevronDown, Search, SearchX, type LucideIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconeArea, SeloArea, useLogosGrupos } from "@/components/operacoes-legais/vistagem/marcas";
import { chaveGrupo, iniciaisDoGrupo } from "@/lib/vistagem/logos";
import { fetchActiveUsers } from "@/lib/users";
import { supabase } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import {
  EMAIL_CONTACT_STATUS_LABEL,
  type EmailContact,
  type EmailContactStatus,
} from "@/lib/email-marketing";

/* Vocabulário visual do e-mail marketing: logo do cliente (o mesmo do ICP e da Vistagem), foto da equipe,
   ícone da área e a faixa de números que também filtra. */

export { IconeArea, SeloArea };

/* ----------------------------------------------------------------- clientes */

/** Logo pelo grupo do cliente e, sem ele, pelo nome da empresa (alguns contatos do RD só têm a empresa). */
function logoDe(mapa: Record<string, string>, group?: string | null, company?: string | null): string | undefined {
  for (const nome of [group, company]) {
    if (!nome) continue;
    const url = mapa[chaveGrupo(nome)];
    if (url) return url;
  }
  return undefined;
}

export function useHasClientLogo(): (group?: string | null, company?: string | null) => boolean {
  const mapa = useLogosGrupos();
  return useCallback((group?: string | null, company?: string | null) => Boolean(logoDe(mapa, group, company)), [mapa]);
}

const LOGO_SIZE = {
  xs: "size-5 text-[8px]",
  sm: "size-7 text-[10px]",
  md: "size-9 text-xs",
  lg: "size-11 text-sm",
  xl: "size-14 text-base",
} as const;

export type LogoSize = keyof typeof LOGO_SIZE;

/** Logo do cliente; sem logo, as iniciais do grupo (ou da empresa); sem nenhum dos dois, o prédio. */
export function ClientLogo({
  group,
  company,
  size = "sm",
  className,
}: {
  group?: string | null;
  company?: string | null;
  size?: LogoSize;
  className?: string;
}) {
  const mapa = useLogosGrupos();
  /** URL que não carregou (a lista reaproveita o componente para outro cliente, então guarda qual foi). */
  const [falhou, setFalhou] = useState<string | null>(null);
  const url = logoDe(mapa, group, company);
  const nome = group || company;
  const caixa = cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md", LOGO_SIZE[size], className);
  if (url && falhou !== url) {
    return (
      <span className={cn(caixa, "bg-white ring-1 ring-[#dce9eb]", (size === "lg" || size === "xl") && "p-0.5")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" loading="lazy" className="size-full object-contain" onError={() => setFalhou(url)} />
      </span>
    );
  }
  if (!nome) {
    return (
      <span aria-hidden className={cn(caixa, "bg-[#f1f5f7] text-[#8aa0aa]")}>
        <Building2 className="size-[55%]" />
      </span>
    );
  }
  return (
    <span aria-hidden className={cn(caixa, "bg-[#04202f]/[0.06] font-semibold text-[#04202f]/70")}>
      {iniciaisDoGrupo(nome)}
    </span>
  );
}

export interface ClientRef {
  key: string;
  group: string | null;
  company: string | null;
  /** Quantos contatos daquele cliente (para ordenar e para o texto "N contatos"). */
  count: number;
}

/** Cliente do contato: o grupo do SIOE e, sem grupo, a empresa. */
export function clientOf(contact: Pick<EmailContact, "clientGroupId" | "clientGroupName" | "companyName" | "company">): Omit<ClientRef, "count"> | null {
  const group = contact.clientGroupName?.trim() || null;
  const company = (contact.companyName ?? contact.company)?.trim() || null;
  if (contact.clientGroupId || group) return { key: `g:${contact.clientGroupId ?? chaveGrupo(group)}`, group, company };
  if (company) return { key: `c:${chaveGrupo(company)}`, group: null, company };
  return null;
}

export function clientLabel(client: Pick<ClientRef, "group" | "company">): string {
  return client.group ?? client.company ?? "Sem cliente vinculado";
}

/** Clientes de um conjunto de contatos, do que tem mais contatos para o que tem menos. */
export function summarizeClients(contacts: EmailContact[]): { clients: ClientRef[]; withoutClient: number } {
  const map = new Map<string, ClientRef>();
  let withoutClient = 0;
  for (const contact of contacts) {
    const client = clientOf(contact);
    if (!client) {
      withoutClient++;
      continue;
    }
    const current = map.get(client.key);
    if (current) {
      current.count++;
      if (!current.company && client.company) current.company = client.company;
    } else map.set(client.key, { ...client, count: 1 });
  }
  const clients = Array.from(map.values()).sort(
    (a, b) => b.count - a.count || clientLabel(a).localeCompare(clientLabel(b), "pt-BR")
  );
  return { clients, withoutClient };
}

/** Logos lado a lado (os que têm logo primeiro) e "+N" no fim. */
export function ClientLogoStack({
  clients,
  max = 5,
  size = "sm",
  className,
}: {
  clients: ClientRef[];
  max?: number;
  size?: LogoSize;
  className?: string;
}) {
  const mapa = useLogosGrupos();
  const ordenados = useMemo(
    () =>
      clients
        .map((client, index) => ({ client, index, logo: logoDe(mapa, client.group, client.company) ? 0 : 1 }))
        .sort((a, b) => a.logo - b.logo || a.index - b.index)
        .map((item) => item.client),
    [clients, mapa]
  );
  if (!clients.length) return null;
  const shown = ordenados.slice(0, max);
  const rest = clients.length - shown.length;
  return (
    <div className={cn("flex items-center", className)}>
      {shown.map((client, index) => (
        <span key={client.key} title={clientLabel(client)} className={cn("rounded-md ring-2 ring-white", index > 0 && "-ml-1.5")}>
          <ClientLogo group={client.group} company={client.company} size={size} />
        </span>
      ))}
      {rest > 0 && <span className="ml-1.5 text-xs font-medium tabular-nums text-[#3b5560]">+{rest}</span>}
    </div>
  );
}

/** Logo + nome do cliente + empresa em cinza (célula de lista). */
export function ClientCell({
  group,
  company,
  size = "sm",
  className,
}: {
  group?: string | null;
  company?: string | null;
  size?: LogoSize;
  className?: string;
}) {
  const nome = group || company;
  const empresa = group && company && chaveGrupo(company) !== chaveGrupo(group) ? company : null;
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <ClientLogo group={group} company={company} size={size} />
      <div className="min-w-0">
        <p className={cn("truncate text-sm", nome ? "font-medium text-[#0d2a38]" : "text-muted-foreground")}>{nome ?? "Sem cliente vinculado"}</p>
        {empresa && <p className="truncate text-xs text-muted-foreground">{empresa}</p>}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- grupos (SIOE) */

export interface ClientGroupMeta {
  id: string;
  name: string;
  responsibleArea: string | null;
  responsibleUserIds: string[];
  /** ativo/inativo segundo o gestor da atividade (null = ainda não classificado). */
  gestorAtividade: string | null;
}

const SEM_GRUPOS = new Map<string, ClientGroupMeta>();
let grupos: Map<string, ClientGroupMeta> | null = null;
let pedidoGrupos: Promise<void> | null = null;
const ouvintesGrupos = new Set<() => void>();

function carregarGrupos() {
  pedidoGrupos ??= Promise.resolve(
    supabase.from("email_client_groups").select("id, name, responsible_area, responsible_user_ids, gestor_atividade")
  )
    .then(({ data, error }) => {
      if (error) throw error;
      return new Map(
        ((data ?? []) as Record<string, unknown>[]).map((row) => [
          row.id as string,
          {
            id: row.id as string,
            name: row.name as string,
            responsibleArea: (row.responsible_area as string | null) ?? null,
            responsibleUserIds: (row.responsible_user_ids as string[] | null) ?? [],
            gestorAtividade: (row.gestor_atividade as string | null) ?? null,
          },
        ])
      );
    })
    .catch(() => SEM_GRUPOS)
    .then((valor) => {
      grupos = valor;
      ouvintesGrupos.forEach((avisar) => avisar());
    });
}

/** Área responsável, responsáveis e situação de cada grupo de cliente (lido uma vez por página). */
export function useClientGroupsMeta(): Map<string, ClientGroupMeta> {
  return useSyncExternalStore(
    (avisar) => {
      ouvintesGrupos.add(avisar);
      carregarGrupos();
      return () => ouvintesGrupos.delete(avisar);
    },
    () => grupos ?? SEM_GRUPOS,
    () => SEM_GRUPOS
  );
}

/* -------------------------------------------------------------------- equipe */

export interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  photo: string | null;
  department: string | null;
}

const SEM_EQUIPE = new Map<string, TeamMember>();
let equipe: Map<string, TeamMember> | null = null;
let pedidoEquipe: Promise<void> | null = null;
const ouvintesEquipe = new Set<() => void>();

function carregarEquipe() {
  pedidoEquipe ??= fetchActiveUsers()
    .then(
      (users) =>
        new Map(
          users.map((user) => [
            user.id,
            { id: user.id, name: user.name, email: user.email, photo: user.avatar_url, department: user.department || null },
          ])
        )
    )
    .catch(() => SEM_EQUIPE)
    .then((valor) => {
      equipe = valor;
      ouvintesEquipe.forEach((avisar) => avisar());
    });
}

/** A mesma leitura do useTeam, para quem precisa esperar os nomes antes de montar a tela. */
export function fetchTeam(): Promise<Map<string, TeamMember>> {
  carregarEquipe();
  return pedidoEquipe!.then(() => equipe ?? SEM_EQUIPE);
}

/** Pessoas ativas do escritório com a foto (lido uma vez por página). */
export function useTeam(): Map<string, TeamMember> {
  return useSyncExternalStore(
    (avisar) => {
      ouvintesEquipe.add(avisar);
      carregarEquipe();
      return () => ouvintesEquipe.delete(avisar);
    },
    () => equipe ?? SEM_EQUIPE,
    () => SEM_EQUIPE
  );
}

export function teamMemberByEmail(team: Map<string, TeamMember>, email: string | null | undefined): TeamMember | null {
  const alvo = email?.trim().toLowerCase();
  if (!alvo) return null;
  for (const member of team.values()) if (member.email?.toLowerCase() === alvo) return member;
  return null;
}

function chavePessoa(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Quem da equipe assina a campanha: pelo e-mail (bpplaw.com.br é o domínio antigo de bismarchipires.com.br)
 * e, sem e-mail que bata, pelo nome do remetente.
 */
export function teamMemberFor(team: Map<string, TeamMember>, emails: (string | null | undefined)[], name?: string | null): TeamMember | null {
  for (const email of emails) {
    const direto = teamMemberByEmail(team, email);
    if (direto) return direto;
    const novo = email?.toLowerCase().replace(/@bpplaw\.com\.br$/, "@bismarchipires.com.br");
    const pelo = novo && novo !== email?.toLowerCase() ? teamMemberByEmail(team, novo) : null;
    if (pelo) return pelo;
  }
  if (!name?.trim()) return null;
  const alvo = chavePessoa(name);
  const partes = alvo.split(" ");
  let porPartes: TeamMember | null = null;
  for (const member of team.values()) {
    const chave = chavePessoa(member.name);
    if (chave === alvo) return member;
    const doMembro = chave.split(" ");
    // Primeiro nome igual e o segundo nome do remetente aparece no nome do colaborador ("Daniel Pressatto ...").
    if (!porPartes && doMembro[0] === partes[0] && partes.length > 1 && doMembro.includes(partes[1])) porPartes = member;
  }
  return porPartes;
}

/** "Ana Carolina de Souza Lima" → "Ana Lima". */
export function shortName(name: string): string {
  const partes = name.trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 2) return partes.join(" ");
  return `${partes[0]} ${partes[partes.length - 1]}`;
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  return (partes.length > 1 ? `${partes[0][0]}${partes[partes.length - 1][0]}` : (partes[0] ?? "?").slice(0, 2)).toUpperCase();
}

const PHOTO_SIZE = { xs: "size-5 text-[8px]", sm: "size-7 text-[10px]", md: "size-9 text-xs", lg: "size-11 text-sm" } as const;

/** Foto do colaborador (ou as iniciais). */
export function PersonPhoto({
  name,
  photo,
  size = "sm",
  className,
}: {
  name: string;
  photo?: string | null;
  size?: keyof typeof PHOTO_SIZE;
  className?: string;
}) {
  return (
    <Avatar className={cn("shrink-0 ring-1 ring-black/5", PHOTO_SIZE[size], className)}>
      {photo ? <AvatarImage src={photo} alt="" /> : null}
      <AvatarFallback className="bg-[#e8f1f5] font-semibold text-[#315f73]">{iniciais(name)}</AvatarFallback>
    </Avatar>
  );
}

/** Fotos sobrepostas, com o nome no title de cada uma. */
export function PeopleStack({
  people,
  max = 4,
  size = "sm",
  className,
}: {
  people: TeamMember[];
  max?: number;
  size?: keyof typeof PHOTO_SIZE;
  className?: string;
}) {
  if (!people.length) return null;
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className={cn("flex items-center", className)}>
      {shown.map((person, index) => (
        <span key={person.id} title={person.name} className={cn("rounded-full ring-2 ring-white", index > 0 && "-ml-1.5")}>
          <PersonPhoto name={person.name} photo={person.photo} size={size} className="ring-0" />
        </span>
      ))}
      {rest > 0 && <span className="ml-1.5 text-xs font-medium tabular-nums text-[#3b5560]">+{rest}</span>}
    </div>
  );
}

/* ------------------------------------------------------------- status do contato */

const CONTACT_STATUS_STYLE: Record<EmailContactStatus, { pill: string; dot: string }> = {
  subscribed: { pill: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500" },
  unsubscribed: { pill: "bg-[#eef2f4] text-[#4b5b66] ring-[#dce3e7]", dot: "bg-[#8aa0aa]" },
  bounced: { pill: "bg-red-50 text-red-800 ring-red-200", dot: "bg-red-500" },
  complained: { pill: "bg-red-50 text-red-800 ring-red-200", dot: "bg-red-500" },
};

export function ContactStatusPill({ status, className }: { status: EmailContactStatus; className?: string }) {
  const style = CONTACT_STATUS_STYLE[status];
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2 text-xs font-medium ring-1 ring-inset", style.pill, className)}>
      <span className={cn("size-1.5 rounded-full", style.dot)} aria-hidden />
      {EMAIL_CONTACT_STATUS_LABEL[status]}
    </span>
  );
}

/* --------------------------------------------------------- faixa de números */

export interface Metric {
  id: string;
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Alerta (âmbar) quando o número pede atenção. */
  warn?: boolean;
}

/**
 * Os números da tela num painel só, separados por divisores (como o "Onde estão as publicações" da Vistagem).
 * Com `onSelect`, cada número também filtra a lista e o escolhido fica escuro.
 */
export function MetricBand({
  metrics,
  active,
  onSelect,
  className,
}: {
  metrics: Metric[];
  active?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const cols = { 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5", 6: "lg:grid-cols-6" }[metrics.length] ?? "lg:grid-cols-4";
  return (
    <div className={cn("grid grid-cols-2 overflow-hidden rounded-lg border border-[#dce9eb] bg-white shadow-sm", cols, className)}>
      {metrics.map((metric, index) => {
        const isActive = active === metric.id;
        const Icon = metric.icon;
        const body = (
          <>
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-md",
                  isActive ? "bg-white/10 text-[#47cdd0]" : metric.warn ? "bg-amber-50 text-amber-700" : "bg-[#eaf2f5] text-[#285f7a]"
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className={cn("text-xs font-medium", isActive ? "text-white/80" : "text-[#3b5560]")}>{metric.label}</span>
            </span>
            <span className={cn("mt-2 block text-xl font-semibold tabular-nums sm:text-2xl", isActive ? "text-white" : "text-[#0d2a38]")}>
              {metric.value}
            </span>
            {metric.hint && (
              <span className={cn("mt-0.5 block text-xs", isActive ? "text-white/70" : "text-[#5a717b]")}>{metric.hint}</span>
            )}
          </>
        );
        const cell = cn(
          "min-w-0 border-[#eaf2f5] px-3 py-3 text-left sm:px-4 sm:py-3.5",
          // divisores: à direita na coluna 1 do celular; no desktop entre todos.
          index % 2 === 0 && "border-r",
          index >= 2 && "border-t",
          "lg:border-t-0",
          index < metrics.length - 1 ? "lg:border-r" : "lg:border-r-0",
          // número ímpar de células: a última ocupa a linha inteira no celular.
          metrics.length % 2 === 1 && index === metrics.length - 1 && "col-span-2 border-r-0 lg:col-span-1",
          isActive ? "bg-[#04202f]" : onSelect && "transition-colors hover:bg-[#f5f9fa]"
        );
        return onSelect ? (
          <button key={metric.id} type="button" aria-pressed={isActive} onClick={() => onSelect(metric.id)} className={cn(cell, "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#47cdd0]")}>
            {body}
          </button>
        ) : (
          <div key={metric.id} className={cell}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------- título de bloco */

/** Cabeçalho de bloco: ícone, título, uma linha de explicação e a ação à direita. */
export function BlockHeader({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {Icon && (
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-[#eaf2f5] text-[#285f7a]">
            <Icon className="size-4" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[#0d2a38]">{title}</h2>
          {description && <p className="text-xs text-[#5a717b]">{description}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------- filtro de cliente com busca */

export interface ClientOption {
  key: string;
  group: string | null;
  company: string | null;
  count: number;
}

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Escolha do cliente com busca e logo em cada opção ("__all__" = todos). */
export function ClientPicker({
  options,
  value,
  onChange,
  className,
}: {
  options: ClientOption[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.key === value) ?? null;
  const filtered = useMemo(() => {
    const termos = normalizar(query).split(/\s+/).filter(Boolean);
    const base = termos.length
      ? options.filter((option) => termos.every((termo) => normalizar(`${option.group ?? ""} ${option.company ?? ""}`).includes(termo)))
      : options;
    return base.slice(0, 120);
  }, [options, query]);

  const choose = (key: string) => {
    onChange(key);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full min-w-0 items-center gap-2 rounded-md border border-input bg-white px-2.5 text-left text-sm shadow-xs transition-colors",
            "hover:bg-[#f5f9fa] focus-visible:border-[#47cdd0] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/30",
            className
          )}
          aria-label="Filtrar por cliente"
        >
          {selected ? (
            <ClientLogo group={selected.group} company={selected.company} size="xs" />
          ) : (
            <Building2 className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className={cn("min-w-0 flex-1 truncate", !selected && "text-muted-foreground")}>
            {selected ? clientLabel(selected) : "Todos os clientes"}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] rounded-lg p-0">
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente..."
            aria-label="Buscar cliente"
            className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-1" role="listbox" aria-label="Clientes">
          {!query && (
            <button
              type="button"
              role="option"
              aria-selected={value === "__all__"}
              onClick={() => choose("__all__")}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[#eaf2f5]"
            >
              <span className="flex size-6 items-center justify-center rounded-md bg-[#eaf2f5] text-[#285f7a]">
                <Building2 className="size-3.5" />
              </span>
              <span className="flex-1">Todos os clientes</span>
              {value === "__all__" && <Check className="size-4 text-[#347796]" />}
            </button>
          )}
          {filtered.length === 0 ? (
            <p className="flex items-center gap-2 px-2 py-6 text-sm text-muted-foreground">
              <SearchX className="size-4" /> Nenhum cliente com esse nome.
            </p>
          ) : (
            filtered.map((option) => (
              <button
                key={option.key}
                type="button"
                role="option"
                aria-selected={value === option.key}
                onClick={() => choose(option.key)}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[#eaf2f5]"
              >
                <ClientLogo group={option.group} company={option.company} size="xs" className="size-6" />
                <span className="min-w-0 flex-1 truncate">{clientLabel(option)}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{option.count}</span>
                {value === option.key && <Check className="size-4 text-[#347796]" />}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
