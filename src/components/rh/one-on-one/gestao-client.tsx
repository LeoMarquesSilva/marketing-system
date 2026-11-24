"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlarmClock,
  CalendarCheck2,
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  Check,
  ChevronRight,
  History,
  ListTodo,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Star,
  Tags,
  Trash2,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterMenu, type FilterMenuOption } from "@/components/ui/filter-menu";
import { ratingAverage } from "@/lib/rh/one-on-one/rules";
import type { OneOnOneCategory, OneOnOneHrOverview, OneOnOnePairSummary, OneOnOneSettings, PrivateNotesReaders } from "@/lib/rh/one-on-one/types";
import type { PdiPerson } from "@/lib/rh/pdi/types";
import { cn } from "@/lib/utils";
import { ChoiceCards, ChoiceChips, Stepper, Switch, SwitchRow, type ChoiceOption } from "../form-controls";
import { BODY, INK, MUTED, PersonLine, PersonPhoto, SURFACE, StatTile } from "../pdi/pdi-visuals";
import { Stars } from "./meeting-card";
import { CadenceBadge, CategoryIcon, DateBlock, MeetingStatusBadge, formatDayShort, formatTime } from "./one-on-one-visuals";

type Tab = "cobertura" | "historico" | "configuracoes";
type HistoryRow = OneOnOneHrOverview["history"][number];
type HistoryStatus = "todas" | "agendada" | "atrasada" | "realizada" | "cancelada";
const SEM_CATEGORIA = "Conversa livre";
const HISTORY_STATUS: Record<HistoryStatus, { label: string; icon: LucideIcon }> = {
  todas: { label: "Todas", icon: History },
  agendada: { label: "Agendadas", icon: CalendarClock },
  atrasada: { label: "Não finalizadas", icon: AlarmClock },
  realizada: { label: "Realizadas", icon: CalendarCheck2 },
  cancelada: { label: "Canceladas", icon: CalendarX2 },
};

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function SectionHeader({ icon: Icon, tone, title, subtitle, children }: { icon: typeof Lock; tone: string; title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6eff1] px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", tone)}>
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className={cn("text-base font-semibold", INK)}>{title}</h2>
          {subtitle && <p className={cn("text-xs", MUTED)}>{subtitle}</p>}
        </div>
      </div>
      {children}
    </header>
  );
}

/* ---------------------------------------------------------------- cobertura */

function Coverage({ pairs, overdueDays }: { pairs: OneOnOnePairSummary[]; overdueDays: number }) {
  const [query, setQuery] = useState("");
  const [cadence, setCadence] = useState<"todas" | OneOnOnePairSummary["cadence"]>("todas");
  const needle = normalize(query);
  const searched = pairs.filter((pair) => !needle || normalize(`${pair.leader.full_name} ${pair.member.full_name} ${pair.member.department ?? ""}`).includes(needle));
  const groups = useMemo(() => {
    const map = new Map<string, { leader: PdiPerson; pairs: OneOnOnePairSummary[] }>();
    for (const pair of searched) {
      if (cadence !== "todas" && pair.cadence !== cadence) continue;
      const entry = map.get(pair.leader.id) ?? { leader: pair.leader, pairs: [] };
      entry.pairs.push(pair);
      map.set(pair.leader.id, entry);
    }
    const late = (group: { pairs: OneOnOnePairSummary[] }) => group.pairs.filter((pair) => pair.cadence !== "em_dia").length;
    return [...map.values()].sort((a, b) => late(b) - late(a) || a.leader.name.localeCompare(b.leader.name, "pt-BR"));
  }, [searched, cadence]);

  return (
    <div className="space-y-4">
      <div className={cn(SURFACE, "flex flex-wrap items-center gap-3 px-4 py-3")}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar gestor, pessoa ou área" className="h-9 w-64 pl-8" aria-label="Buscar" />
        </div>
        <ChoiceChips
          label="Situação"
          size="sm"
          value={cadence}
          onChange={setCadence}
          options={[
            { value: "todas", label: "Todas", icon: UsersRound, count: searched.length },
            { value: "atrasada", label: "Atrasadas", icon: AlarmClock, count: searched.filter((pair) => pair.cadence === "atrasada").length },
            { value: "sem_reuniao", label: "Sem nenhuma 1:1", icon: CalendarX2, count: searched.filter((pair) => pair.cadence === "sem_reuniao").length },
            { value: "em_dia", label: "Em dia", icon: CalendarCheck2, count: searched.filter((pair) => pair.cadence === "em_dia").length },
          ]}
        />
      </div>
      {groups.length === 0 && <p className={cn(SURFACE, "px-5 py-10 text-center text-sm", MUTED)}>Nenhuma dupla com esse filtro.</p>}
      <div className="grid gap-4 xl:grid-cols-2">
        {groups.map((group) => {
          const onTrack = group.pairs.filter((pair) => pair.cadence === "em_dia").length;
          return (
            <section key={group.leader.id} className={SURFACE}>
              <header className="flex items-center justify-between gap-3 border-b border-[#e6eff1] px-5 py-3.5">
                <PersonLine person={group.leader} size="md" />
                <span className={cn("shrink-0 text-sm", BODY)}>
                  <span className={cn("font-semibold tabular-nums", onTrack === group.pairs.length ? "text-emerald-700" : INK)}>
                    {onTrack}/{group.pairs.length}
                  </span>{" "}
                  em dia
                </span>
              </header>
              <ul className="divide-y divide-[#eef3f5] px-3 py-1">
                {group.pairs
                  .sort((a, b) => (a.cadence === b.cadence ? a.member.name.localeCompare(b.member.name, "pt-BR") : a.cadence === "em_dia" ? 1 : -1))
                  .map((pair) => (
                    <li key={pair.member.id}>
                      <Link
                        href={`/1-1/${pair.leader.id}/${pair.member.id}`}
                        className="group flex items-center gap-3 rounded-md px-2 py-2.5 outline-none hover:bg-[#f4fafb] focus-visible:bg-[#f4fafb]"
                      >
                        <PersonPhoto person={pair.member} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className={cn("block truncate text-sm font-medium", INK)}>{pair.member.name}</span>
                          <span className={cn("block truncate text-xs", MUTED)}>
                            {pair.next_meeting ? `próxima ${formatDayShort(pair.next_meeting.starts_at)} ${formatTime(pair.next_meeting.starts_at)}` : "sem 1:1 marcada"}
                            {pair.pdi ? ` · PDI ${pair.pdi.progress}%` : ""}
                            {pair.open_actions ? ` · ${pair.open_actions} ações abertas` : ""}
                          </span>
                        </span>
                        <CadenceBadge cadence={pair.cadence} daysSinceLast={pair.days_since_last} overdueDays={overdueDays} />
                        <ChevronRight className="size-4 shrink-0 text-[#7b929c]" aria-hidden />
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- histórico */

function HistoryTab({ history }: { history: OneOnOneHrOverview["history"] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<HistoryStatus>("todas");
  const [categoriesOn, setCategoriesOn] = useState<string[]>([]);
  const [leadersOn, setLeadersOn] = useState<string[]>([]);
  const needle = normalize(query);

  const matches = (row: HistoryRow, skip?: "status" | "categoria" | "gestor") => {
    if (skip !== "status" && status !== "todas" && row.status !== status) return false;
    if (skip !== "categoria" && categoriesOn.length && !categoriesOn.includes(row.category ?? SEM_CATEGORIA)) return false;
    if (skip !== "gestor" && leadersOn.length && !leadersOn.includes(row.leader.id)) return false;
    if (needle && !normalize(`${row.leader.full_name} ${row.member.full_name}`).includes(needle)) return false;
    return true;
  };
  const rows = history.filter((row) => matches(row));

  const forStatus = history.filter((row) => matches(row, "status"));
  const statusOptions: ChoiceOption<HistoryStatus>[] = (Object.keys(HISTORY_STATUS) as HistoryStatus[]).map((key) => ({
    value: key,
    label: HISTORY_STATUS[key].label,
    icon: HISTORY_STATUS[key].icon,
    count: key === "todas" ? forStatus.length : forStatus.filter((row) => row.status === key).length,
  }));

  const forCategory = history.filter((row) => matches(row, "categoria"));
  const categoryNames = [...new Set(history.map((row) => row.category ?? SEM_CATEGORIA))].sort((a, b) =>
    a === SEM_CATEGORIA ? 1 : b === SEM_CATEGORIA ? -1 : a.localeCompare(b, "pt-BR")
  );
  const categoryOptions: FilterMenuOption[] = categoryNames.map((name) => {
    return {
      value: name,
      label: name,
      count: forCategory.filter((row) => (row.category ?? SEM_CATEGORIA) === name).length,
      leading: <CategoryIcon name={name === SEM_CATEGORIA ? null : name} className="size-4 text-[#3e84a8]" />,
    };
  });

  const forLeader = history.filter((row) => matches(row, "gestor"));
  const leaders = [...new Map(history.map((row) => [row.leader.id, row.leader])).values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const leaderOptions: FilterMenuOption[] = leaders.map((leader) => ({
    value: leader.id,
    label: leader.name,
    count: forLeader.filter((row) => row.leader.id === leader.id).length,
    leading: <PersonPhoto person={leader} size="xs" />,
  }));

  const months = new Map<string, HistoryRow[]>();
  for (const row of rows) {
    const key = row.starts_at.slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), row]);
  }
  const monthLabel = (key: string) =>
    new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${key}-15T12:00:00Z`));
  const filtered = status !== "todas" || categoriesOn.length > 0 || leadersOn.length > 0 || query.length > 0;

  return (
    <section className={SURFACE}>
      <SectionHeader icon={History} tone="bg-[#e6f0f5] text-[#285f7a]" title="Histórico de 1:1" subtitle="Todas as reuniões, inclusive as trazidas do Feedz">
        <span className={cn("text-sm", MUTED)}>
          <span className={cn("font-semibold tabular-nums", INK)}>{rows.length}</span> {rows.length === 1 ? "reunião" : "reuniões"}
        </span>
      </SectionHeader>
      <div className="space-y-3 border-b border-[#e6eff1] px-5 py-4">
        <ChoiceChips label="Status" size="sm" value={status} onChange={setStatus} options={statusOptions} />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar pessoa" className="h-9 w-52 pl-8" aria-label="Buscar pessoa" />
          </div>
          <FilterMenu
            label="Gestor"
            options={leaderOptions}
            selected={leadersOn}
            onToggle={(value) => setLeadersOn((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]))}
            onClear={() => setLeadersOn([])}
          />
          <FilterMenu
            label="Categoria"
            width="w-96"
            options={categoryOptions}
            selected={categoriesOn}
            onToggle={(value) => setCategoriesOn((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]))}
            onClear={() => setCategoriesOn([])}
          />
          {filtered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setStatus("todas");
                setCategoriesOn([]);
                setLeadersOn([]);
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className={cn("px-5 py-10 text-center text-sm", MUTED)}>Nenhuma 1:1 com esses filtros.</p>
      ) : (
        <div className="pb-2">
          {[...months.entries()].map(([key, items]) => (
            <div key={key}>
              <h3 className={cn("flex items-center justify-between px-5 pb-1.5 pt-4 text-xs font-semibold", MUTED)}>
                <span className="first-letter:uppercase">{monthLabel(key)}</span>
                <span className="font-medium">
                  {items.length} {items.length === 1 ? "reunião" : "reuniões"}
                </span>
              </h3>
              <ul className="divide-y divide-[#eef3f5] px-3">
                {items.map((row) => {
                  return (
                    <li key={row.id}>
                      <Link
                        href={`/1-1/${row.leader.id}/${row.member.id}`}
                        className="grid items-center gap-3 rounded-md px-2 py-2.5 outline-none hover:bg-[#f4fafb] focus-visible:bg-[#f4fafb] md:grid-cols-[48px_minmax(0,1fr)_minmax(0,1fr)_auto]"
                      >
                        <DateBlock iso={row.starts_at} className="size-11" />
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span className="flex shrink-0 items-center">
                            <PersonPhoto person={row.leader} size="sm" />
                            <PersonPhoto person={row.member} size="sm" className="-ml-2.5 ring-2 ring-white" />
                          </span>
                          <span className="min-w-0">
                            <span className={cn("block truncate text-sm font-medium", INK)}>{row.member.name}</span>
                            <span className={cn("block truncate text-xs", MUTED)}>
                              com {row.leader.name} · {formatTime(row.starts_at)}
                            </span>
                          </span>
                        </span>
                        <span className={cn("flex min-w-0 items-center gap-1.5 text-xs", MUTED)}>
                          <CategoryIcon name={row.category} className="size-3.5 shrink-0 text-[#3e84a8]" />
                          <span className="truncate">{row.category ?? "Conversa livre"}</span>
                          {row.from_feedz && <span className="shrink-0 rounded bg-[#f1f5f6] px-1.5 text-[#5a717b]">Feedz</span>}
                        </span>
                        <span className="flex items-center gap-2 justify-self-start md:justify-self-end">
                          {row.rating ? <Stars value={row.rating} size="sm" /> : null}
                          <MeetingStatusBadge status={row.status} />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ----------------------------------------------------------- configurações */

type CategoryDraft = { id?: string; key: string; name: string; topics: string[]; is_active: boolean; dirty: boolean };

function CategoryCard({ item, saving, onChange, onSave }: { item: CategoryDraft; saving: boolean; onChange: (patch: Partial<CategoryDraft>) => void; onSave: () => void }) {
  const [topic, setTopic] = useState("");
  const addTopic = () => {
    const value = topic.trim();
    if (!value || item.topics.includes(value)) return;
    onChange({ topics: [...item.topics, value], dirty: true });
    setTopic("");
  };
  return (
    <li className={cn("flex flex-col gap-3 rounded-lg border p-4", item.is_active ? "border-[#e6eff1] bg-white" : "border-dashed border-[#d5e1e4] bg-[#fafcfc]")}>
      <div className="flex items-center gap-3">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", item.is_active ? "bg-[#e6f0f5] text-[#285f7a]" : "bg-[#f1f5f6] text-[#9fb1b8]")}>
          <CategoryIcon name={item.name} className="size-4" />
        </span>
        <Input
          value={item.name}
          onChange={(event) => onChange({ name: event.target.value, dirty: true })}
          className="h-9 min-w-0 flex-1 font-medium"
          aria-label="Nome da categoria"
        />
        <Switch checked={item.is_active} onChange={(value) => onChange({ is_active: value, dirty: true })} label={item.is_active ? "Categoria ativa" : "Categoria desativada"} />
      </div>
      <div>
        <p className={cn("mb-1.5 text-xs font-medium", MUTED)}>Tópicos sugeridos na pauta</p>
        <div className="flex flex-wrap gap-1.5">
          {item.topics.map((value) => (
            <span key={value} className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#eef5f7] py-1 pl-2.5 pr-1 text-xs text-[#285f7a]">
              <span className="truncate">{value}</span>
              <button
                type="button"
                aria-label={`Tirar "${value}"`}
                onClick={() => onChange({ topics: item.topics.filter((current) => current !== value), dirty: true })}
                className="grid size-4 place-items-center rounded-full text-[#5a717b] hover:bg-white hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
          <form
            className="inline-flex"
            onSubmit={(event) => {
              event.preventDefault();
              addTopic();
            }}
          >
            <Input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              onBlur={addTopic}
              placeholder="+ tópico"
              className="h-7 w-40 rounded-full px-3 text-xs"
              aria-label="Novo tópico sugerido"
            />
          </form>
        </div>
      </div>
      {item.dirty && (
        <div className="flex items-center justify-end gap-2 border-t border-[#eef3f5] pt-3">
          <span className={cn("mr-auto text-xs", MUTED)}>Alterações não salvas</span>
          <Button size="sm" onClick={onSave} disabled={saving || item.name.trim().length < 2}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
            Salvar categoria
          </Button>
        </div>
      )}
    </li>
  );
}

const READERS: Array<{ value: PrivateNotesReaders; title: string; description: string; icon: LucideIcon }> = [
  { value: "rh", title: "Pessoas e Cultura e administradores", description: "Como no Feedz: quem tem o RH completo lê as anotações dos dois participantes.", icon: UsersRound },
  { value: "admin", title: "Só administradores", description: "O RH acompanha a frequência e a pauta, mas não abre as anotações.", icon: ShieldCheck },
  { value: "nenhum", title: "Ninguém além de quem escreveu", description: "Anotação 100% pessoal: nem o RH nem o administrador leem.", icon: Lock },
];

function SettingsTab({ initial, categories: initialCategories }: { initial: OneOnOneSettings; categories: OneOnOneCategory[] }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [status, setStatus] = useState<{ tone: "ok" | "erro" | "salvando"; text: string } | null>(null);
  const [categories, setCategories] = useState<CategoryDraft[]>(
    initialCategories.map((item) => ({ id: item.id, key: item.id, name: item.name, topics: item.suggested_topics, is_active: item.is_active, dirty: false }))
  );
  const [savingCategory, setSavingCategory] = useState<string | null>(null);

  async function save(patch: Partial<OneOnOneSettings>) {
    setSettings((current) => ({ ...current, ...patch }));
    setStatus({ tone: "salvando", text: "Salvando…" });
    try {
      const response = await fetch("/api/rh/1-1/configuracoes", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível salvar.");
      setStatus({ tone: "ok", text: "Alteração salva" });
      router.refresh();
    } catch (caught) {
      setStatus({ tone: "erro", text: caught instanceof Error ? caught.message : "Não foi possível salvar." });
    }
  }

  async function saveCategory(item: CategoryDraft) {
    setSavingCategory(item.key);
    setStatus(null);
    try {
      const response = await fetch("/api/rh/1-1/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, name: item.name.trim(), is_active: item.is_active, suggested_topics: item.topics }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível salvar a categoria.");
      setCategories((current) => current.map((row) => (row.key === item.key ? { ...row, id: body.id ?? row.id, dirty: false } : row)));
      setStatus({ tone: "ok", text: "Categoria salva" });
      router.refresh();
    } catch (caught) {
      setStatus({ tone: "erro", text: caught instanceof Error ? caught.message : "Não foi possível salvar." });
    } finally {
      setSavingCategory(null);
    }
  }

  const updateCategory = (key: string, patch: Partial<CategoryDraft>) =>
    setCategories((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const updateRoom = (index: number, patch: Partial<OneOnOneSettings["rooms"][number]>) => {
    const room = settings.rooms[index];
    const next = { ...room, ...patch };
    if (!next.label.trim() || !next.email.trim() || (next.label === room.label && next.email === room.email)) return;
    save({ rooms: settings.rooms.map((item, i) => (i === index ? next : item)) });
  };

  return (
    <div className="space-y-4">
      <div className="flex min-h-6 items-center justify-between gap-3">
        <p className={cn("text-sm", BODY)}>As mudanças valem na hora e são salvas sozinhas (categorias: no botão de cada uma).</p>
        {status && (
          <span
            role="status"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              status.tone === "ok" ? "bg-emerald-50 text-emerald-700" : status.tone === "erro" ? "bg-red-50 text-red-700" : "bg-[#eef5f7] text-[#285f7a]"
            )}
          >
            {status.tone === "salvando" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : status.tone === "ok" ? <Check className="size-3.5" aria-hidden /> : null}
            {status.text}
          </span>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className={SURFACE}>
          <SectionHeader icon={Lock} tone="bg-[#ecebf3] text-[#48466e]" title="Anotações privadas" subtitle="O líder nunca vê as do liderado, e o liderado nunca vê as do líder" />
          <div className="px-5 py-4">
            <p className={cn("mb-3 text-sm", BODY)}>Quem mais pode ler as anotações dos dois:</p>
            <ChoiceCards label="Quem lê as anotações privadas" value={settings.private_notes_readers} onChange={(value) => save({ private_notes_readers: value })} options={READERS} />
          </div>
        </section>

        <div className="space-y-4">
          <section className={SURFACE}>
            <SectionHeader icon={Settings2} tone="bg-[#e6f0f5] text-[#285f7a]" title="Regras" />
            <div className="divide-y divide-[#eef3f5] px-5">
              <div className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="flex items-start gap-2.5">
                  <AlarmClock className="mt-0.5 size-4 shrink-0 text-[#3e84a8]" aria-hidden />
                  <span>
                    <span className={cn("block text-sm font-medium", INK)}>1:1 atrasada depois de</span>
                    <span className={cn("block text-xs", MUTED)}>Dias desde a última 1:1 realizada (no Feedz eram 30)</span>
                  </span>
                </span>
                <Stepper label="Dias para 1:1 atrasada" value={settings.overdue_days} min={10} max={180} step={5} suffix="dias" onChange={(value) => save({ overdue_days: value })} />
              </div>
              <SwitchRow className="py-3" icon={CalendarPlus} checked={settings.member_can_schedule} onChange={(value) => save({ member_can_schedule: value })} label="Liderado pode marcar a 1:1" />
              <SwitchRow className="py-3" icon={CalendarClock} checked={settings.member_can_reschedule} onChange={(value) => save({ member_can_reschedule: value })} label="Liderado pode remarcar e cancelar" />
              <SwitchRow className="py-3" icon={Star} checked={settings.member_can_rate} onChange={(value) => save({ member_can_rate: value })} label="Liderado avalia a 1:1" hint="Nota de 1 a 5 depois de finalizada; só o RH vê a média." />
            </div>
          </section>

          <section className={SURFACE}>
            <SectionHeader icon={Mail} tone="bg-[#e3f7f7] text-[#1f7f82]" title="Avisos por e-mail" subtitle="Desligados: por enquanto os avisos ficam só no sistema" />
            <div className="divide-y divide-[#eef3f5] px-5">
              <SwitchRow
                className="py-3"
                icon={ListTodo}
                checked={settings.email_agenda_enabled}
                onChange={(value) => save({ email_agenda_enabled: value })}
                label="Pauta por e-mail antes da reunião"
                hint="Vai para os dois participantes pelo Microsoft 365."
              />
              <SwitchRow
                className="py-3"
                icon={AlarmClock}
                checked={settings.email_reminder_enabled}
                onChange={(value) => save({ email_reminder_enabled: value })}
                label="Lembrete de 1:1 atrasada"
                hint={`Avisa o gestor quando passar de ${settings.overdue_days} dias sem 1:1.`}
              />
            </div>
          </section>
        </div>

        <section className={cn(SURFACE, "xl:col-span-2")}>
          <SectionHeader icon={MapPin} tone="bg-amber-50 text-amber-700" title="Salas" subtitle="Caixas de sala do Microsoft 365 (como no SAMA): a disponibilidade e o convite saem daqui" />
          <ul className="grid gap-3 px-5 py-4 md:grid-cols-2">
            {settings.rooms.map((room, index) => (
              <li key={room.key} className="flex items-center gap-3 rounded-lg border border-[#e6eff1] p-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-700">
                  <MapPin className="size-4" aria-hidden />
                </span>
                <span className="grid min-w-0 flex-1 gap-1.5">
                  <Input defaultValue={room.label} onBlur={(event) => updateRoom(index, { label: event.target.value.trim() })} className="h-8 font-medium" aria-label="Nome da sala" />
                  <Input defaultValue={room.email} onBlur={(event) => updateRoom(index, { email: event.target.value.trim() })} className="h-8 text-xs" aria-label="E-mail da sala" />
                </span>
                <Button variant="ghost" size="icon-sm" aria-label={`Remover ${room.label}`} onClick={() => save({ rooms: settings.rooms.filter((_, i) => i !== index) })}>
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </section>

        <section className={cn(SURFACE, "xl:col-span-2")}>
          <SectionHeader icon={Tags} tone="bg-[#ecebf3] text-[#48466e]" title="Categorias e tópicos sugeridos" subtitle="Ao marcar a 1:1, a categoria escolhida já sugere estes tópicos na pauta">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCategories((current) => [...current, { key: `nova-${Date.now()}`, name: "", topics: [], is_active: true, dirty: true }])}
            >
              <Plus className="size-4" aria-hidden />
              Nova categoria
            </Button>
          </SectionHeader>
          <ul className="grid gap-3 px-5 py-4 lg:grid-cols-2">
            {categories.map((item) => (
              <CategoryCard
                key={item.key}
                item={item}
                saving={savingCategory === item.key}
                onChange={(patch) => updateCategory(item.key, patch)}
                onSave={() => saveCategory(item)}
              />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- página */

export function GestaoClient({ data }: { data: OneOnOneHrOverview }) {
  const [tab, setTab] = useState<Tab>("cobertura");
  const { pairs, history, settings, categories } = data;
  const late = pairs.filter((pair) => pair.cadence === "atrasada").length;
  const never = pairs.filter((pair) => pair.cadence === "sem_reuniao").length;
  const onTrack = pairs.filter((pair) => pair.cadence === "em_dia").length;
  const average = ratingAverage(history.map((row) => row.rating));
  const tabs = [
    { id: "cobertura" as const, label: "Cobertura", icon: UsersRound },
    { id: "historico" as const, label: "Histórico", icon: History },
    { id: "configuracoes" as const, label: "Configurações", icon: Settings2 },
  ];

  return (
    <div className="space-y-6">
      <div className={cn(SURFACE, "inline-flex flex-wrap p-1")} role="tablist" aria-label="Gestão das 1:1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "inline-flex min-h-10 items-center gap-2 rounded-md px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
              tab === item.id ? "bg-[#e8f8f8] text-[#1d5670] shadow-[inset_0_0_0_1px_#47cdd0]" : cn("hover:bg-[#f4fafb]", BODY)
            )}
          >
            <item.icon className="size-4" aria-hidden />
            {item.label}
          </button>
        ))}
      </div>

      {tab !== "configuracoes" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatTile icon={UsersRound} value={pairs.length} label="Duplas líder e liderado" tone="bg-[#e6f0f5] text-[#285f7a]" />
          <StatTile
            icon={CalendarCheck2}
            value={onTrack}
            label={`Em dia (${settings.overdue_days} dias)`}
            hint={pairs.length ? `${Math.round((onTrack / pairs.length) * 100)}% das duplas` : undefined}
            tone="bg-emerald-50 text-emerald-700"
          />
          <StatTile icon={AlarmClock} value={late} label="1:1 atrasadas" tone="bg-red-50 text-red-700" />
          <StatTile icon={CalendarX2} value={never} label="Duplas sem nenhuma 1:1" tone="bg-[#f1f5f6] text-[#3b5560]" />
          <StatTile icon={Star} value={average ?? 0} label={average ? "Nota média dos liderados" : "Sem notas ainda"} tone="bg-amber-50 text-amber-700" />
        </div>
      )}

      {tab === "cobertura" && <Coverage pairs={pairs} overdueDays={settings.overdue_days} />}
      {tab === "historico" && <HistoryTab history={history} />}
      {tab === "configuracoes" && <SettingsTab initial={settings} categories={categories} />}
    </div>
  );
}
