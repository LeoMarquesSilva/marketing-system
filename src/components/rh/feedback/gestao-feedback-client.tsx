"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ClipboardList,
  FileText,
  Globe2,
  HandHeart,
  History,
  Loader2,
  Lock,
  Mail,
  MessageSquarePlus,
  Plus,
  Search,
  Settings2,
  Sprout,
  Trash2,
  Users,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterMenu, type FilterMenuOption } from "@/components/ui/filter-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { coverageBand } from "@/lib/rh/feedback/rules";
import { FEEDBACK_VALUES, type FeedbackHrOverview, type FeedbackKind, type FeedbackSettings, type FeedbackTemplate } from "@/lib/rh/feedback/types";
import { CIVIL_LABELS } from "@/lib/rh/pdi/civil";
import { cn } from "@/lib/utils";
import { ChoiceChips, Stepper, Switch, SwitchRow } from "../form-controls";
import { AreaTile, PersonPhoto, StatTile } from "../pdi/pdi-visuals";
import { BandPill } from "./feedback-client";
import { FeedbackDetailDialog } from "./feedback-detail-dialog";
import { BODY, CARD, EmptyState, FeedbackCard, INK, MUTED, ValueSeal, formatWhen } from "./feedback-visuals";

type Tab = "cobertura" | "historico" | "pedidos" | "apagados" | "configuracoes";

const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function SectionHeader({ icon: Icon, title, subtitle, children }: { icon: LucideIcon; title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6eff1] px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#eaf4f6] text-[#1d7086]">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className={cn("text-base font-semibold", INK)}>{title}</h2>
          {subtitle && <p className={cn("text-sm", MUTED)}>{subtitle}</p>}
        </div>
      </div>
      {children}
    </header>
  );
}

/* ---------------------------------------------------------------- cobertura */

type CoverageFilter = "todos" | "sem_receber" | "sem_dar" | "nunca";

function Coverage({ data }: { data: FeedbackHrOverview }) {
  const limit = data.settings.coverage_days;
  const [filter, setFilter] = useState<CoverageFilter>("todos");
  const [query, setQuery] = useState("");
  const needle = normalize(query);
  const searched = data.coverage.filter((row) => !needle || normalize(`${row.person.full_name} ${row.person.department ?? ""}`).includes(needle));
  const semReceber = searched.filter((row) => coverageBand(row.days_received, limit) !== "ok");
  const semDar = searched.filter((row) => coverageBand(row.days_given, limit) !== "ok");
  const nunca = searched.filter((row) => row.days_received === null);
  const rows = filter === "sem_receber" ? semReceber : filter === "sem_dar" ? semDar : filter === "nunca" ? nunca : searched;
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const area = row.person.department ?? "Sem área";
    groups.set(area, [...(groups.get(area) ?? []), row]);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Users} value={data.coverage.length} label="Pessoas ativas" tone="bg-[#eaf4f6] text-[#1d7086]" />
        <StatTile icon={HandHeart} value={data.coverage.length - data.coverage.filter((row) => coverageBand(row.days_received, limit) !== "ok").length} label={`Receberam nos últimos ${limit} dias`} tone="bg-emerald-50 text-emerald-700" />
        <StatTile icon={MessageSquarePlus} value={data.coverage.filter((row) => coverageBand(row.days_given, limit) === "ok").length} label={`Deram nos últimos ${limit} dias`} tone="bg-[#e9eef8] text-[#34507e]" />
        <StatTile icon={Lock} value={data.coverage.filter((row) => row.days_received === null).length} label="Nunca receberam" tone="bg-[#f1f5f6] text-[#3b5560]" />
      </div>
      <div className={cn(CARD, "flex flex-wrap items-center gap-3 px-4 py-3")}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar pessoa ou área" className="h-9 w-60 pl-8" aria-label="Buscar" />
        </div>
        <ChoiceChips
          label="Situação"
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "todos", label: "Todos", count: searched.length },
            { value: "sem_receber", label: `Sem receber há +${limit} dias`, count: semReceber.length },
            { value: "sem_dar", label: `Sem dar há +${limit} dias`, count: semDar.length },
            { value: "nunca", label: "Nunca receberam", count: nunca.length },
          ]}
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {[...groups.entries()]
          .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
          .map(([area, items]) => (
            <section key={area} className={cn(CARD, "overflow-hidden")}>
              <header className="flex items-center gap-2.5 border-b border-[#e6eff1] px-5 py-3">
                <AreaTile area={area} className="size-7" />
                <h3 className={cn("text-sm font-semibold", INK)}>{area}</h3>
                <span className={cn("ml-auto text-xs", MUTED)}>
                  {items.length} {items.length === 1 ? "pessoa" : "pessoas"}
                </span>
              </header>
              <ul className="divide-y divide-[#eef3f5]">
                {items.map((row) => (
                  <li key={row.person.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-2.5">
                    <PersonPhoto person={row.person} size="sm" />
                    <span className={cn("min-w-0 flex-1 truncate text-sm font-medium", INK)}>{row.person.name}</span>
                    <span className={cn("flex items-center gap-1 text-xs", MUTED)}>
                      Recebeu <BandPill days={row.days_received} limit={limit} />
                    </span>
                    <span className={cn("flex items-center gap-1 text-xs", MUTED)}>
                      Deu <BandPill days={row.days_given} limit={limit} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- histórico */

const PAGE = 40;

function HistoryTab({ items, onOpen, deleted }: { items: FeedbackHrOverview["feedbacks"]; onOpen: (id: string) => void; deleted?: boolean }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"todos" | FeedbackKind>("todos");
  const [areasOn, setAreasOn] = useState<string[]>([]);
  const [valuesOn, setValuesOn] = useState<string[]>([]);
  const [shown, setShown] = useState(PAGE);
  const needle = normalize(query);
  const base = items.filter((item) => {
    if (needle && !normalize(`${item.from.full_name} ${item.to.full_name} ${item.message}`).includes(needle)) return false;
    if (areasOn.length && !areasOn.includes(item.to.department ?? "Sem área")) return false;
    if (valuesOn.length && !item.civil_values.some((value) => valuesOn.includes(value))) return false;
    return true;
  });
  const rows = kind === "todos" ? base : base.filter((item) => item.kind === kind);
  const count = (value: FeedbackKind) => base.filter((item) => item.kind === value).length;
  const areas = useMemo(() => [...new Set(items.map((item) => item.to.department ?? "Sem área"))].sort((a, b) => a.localeCompare(b, "pt-BR")), [items]);
  const areaOptions: FilterMenuOption[] = areas.map((area) => ({ value: area, label: area, count: items.filter((item) => (item.to.department ?? "Sem área") === area).length, leading: <AreaTile area={area} className="size-5 rounded [&_svg]:size-3" /> }));
  const valueOptions: FilterMenuOption[] = FEEDBACK_VALUES.map((value) => ({ value, label: CIVIL_LABELS[value], count: items.filter((item) => item.civil_values.includes(value)).length, leading: <ValueSeal value={value} /> }));
  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (value: string) => setter((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));

  return (
    <section className={cn(CARD, "overflow-hidden")}>
      <SectionHeader
        icon={deleted ? Trash2 : History}
        title={deleted ? "Apagados" : "Histórico de feedbacks"}
        subtitle={deleted ? "Apagados pelo autor (até 24 h) ou pelo RH. Só Pessoas e Cultura vê." : "Todos os feedbacks, inclusive os trazidos do Feedz."}
      >
        <span className={cn("text-sm", MUTED)}>
          <span className={cn("font-semibold tabular-nums", INK)}>{rows.length}</span> {rows.length === 1 ? "feedback" : "feedbacks"}
        </span>
      </SectionHeader>
      <div className="space-y-3 border-b border-[#e6eff1] px-5 py-4">
        <ChoiceChips
          label="Tipo"
          size="sm"
          value={kind}
          onChange={(value) => {
            setKind(value);
            setShown(PAGE);
          }}
          options={[
            { value: "todos" as const, label: "Todos", count: base.length },
            { value: "reconhecimento" as const, label: "Reconhecimento", icon: HandHeart, count: count("reconhecimento") },
            { value: "desenvolvimento" as const, label: "Desenvolvimento", icon: Sprout, count: count("desenvolvimento") },
            { value: "sem_tipo" as const, label: "Do Feedz", count: count("sem_tipo") },
            { value: "boa_pratica" as const, label: "Boas práticas", icon: ClipboardList, count: count("boa_pratica") },
          ].filter((option) => option.value === "todos" || option.value === kind || option.count > 0)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pessoa ou palavra do texto" className="h-9 w-64 pl-8" aria-label="Buscar" />
          </div>
          <FilterMenu label="Área de quem recebeu" options={areaOptions} selected={areasOn} onToggle={toggle(setAreasOn)} onClear={() => setAreasOn([])} />
          <FilterMenu label="Valor CIVIL" options={valueOptions} selected={valuesOn} onToggle={toggle(setValuesOn)} onClear={() => setValuesOn([])} />
        </div>
      </div>
      <div className="space-y-3 p-4">
        {rows.length === 0 ? (
          <EmptyState icon={FileText} title="Nada com esses filtros" text="Tire algum filtro para ver mais." />
        ) : (
          <>
            {rows.slice(0, shown).map((item) => (
              <FeedbackCard key={item.id} item={item} perspective="both" onOpen={() => onOpen(item.id)} />
            ))}
            {rows.length > shown && (
              <div className="flex justify-center pt-1">
                <Button variant="outline" onClick={() => setShown((value) => value + PAGE)}>
                  Mostrar mais {Math.min(PAGE, rows.length - shown)}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- configurações */

function TemplateCard({ template, onSaved }: { template: FeedbackTemplate | null; onSaved: () => void }) {
  const [name, setName] = useState(template?.name ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [kind, setKind] = useState<"todos" | "reconhecimento" | "desenvolvimento">(template?.kind ?? "todos");
  const [active, setActive] = useState(template?.is_active ?? true);
  const [state, setState] = useState<"idle" | "saving" | "saved" | string>("idle");
  const dirty = !template || name !== template.name || body !== template.body || (kind === "todos" ? null : kind) !== template.kind || active !== template.is_active;

  async function save() {
    setState("saving");
    const response = await fetch("/api/rh/feedback/modelos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: template?.id, name: name.trim(), body, kind: kind === "todos" ? null : kind, is_active: active }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setState(result.error ?? "Não foi possível salvar.");
      return;
    }
    setState("saved");
    onSaved();
  }

  return (
    <li className={cn("flex flex-col gap-3 rounded-xl border p-4", active ? "border-[#e6eff1] bg-white" : "border-dashed border-[#d5e1e4] bg-[#fafcfc]")}>
      <div className="flex items-center gap-2">
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do modelo" className="h-9 min-w-0 flex-1 font-medium" aria-label="Nome do modelo" />
        <span className="flex shrink-0 items-center gap-2">
          <span className={cn("text-xs font-medium", active ? "text-[#1d5670]" : "text-[#7b929c]")}>{active ? "Em uso" : "Fora de uso"}</span>
          <Switch checked={active} onChange={setActive} label={active ? "Modelo em uso" : "Modelo fora de uso"} />
        </span>
      </div>
      <ChoiceChips
        label="Vale para"
        size="sm"
        value={kind}
        onChange={setKind}
        options={[
          { value: "todos", label: "Os dois tipos" },
          { value: "reconhecimento", label: "Reconhecimento", icon: HandHeart },
          { value: "desenvolvimento", label: "Desenvolvimento", icon: Sprout },
        ]}
      />
      <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={4} placeholder="Texto que entra no feedback ao escolher o modelo" className="resize-none rounded-xl border-[#dce6e9] text-sm" aria-label="Texto do modelo" />
      {(dirty || state !== "idle") && (
        <div className="flex items-center justify-end gap-2 border-t border-[#eef3f5] pt-3">
          <span className={cn("mr-auto text-xs", state !== "idle" && state !== "saving" && state !== "saved" ? "text-red-700" : MUTED)}>
            {state === "saved" ? "Salvo" : state === "saving" ? "Salvando…" : state === "idle" ? "Alterações não salvas" : state}
          </span>
          <Button size="sm" onClick={save} disabled={state === "saving" || name.trim().length < 2 || !dirty}>
            {state === "saving" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
            Salvar modelo
          </Button>
        </div>
      )}
    </li>
  );
}

function SettingsTab({ initial, templates }: { initial: FeedbackSettings; templates: FeedbackTemplate[] }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [adding, setAdding] = useState(0);

  async function save(patch: Partial<FeedbackSettings>) {
    setSettings((current) => ({ ...current, ...patch }));
    setStatus("Salvando…");
    const response = await fetch("/api/rh/feedback/configuracoes", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const body = await response.json().catch(() => ({}));
    setStatus(response.ok ? "Alteração salva" : body.error ?? "Não foi possível salvar.");
    if (response.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex min-h-6 items-center justify-between gap-3">
        <p className={cn("text-sm", BODY)}>As mudanças valem na hora (os modelos, no botão de cada um).</p>
        {status && <span className="rounded-full bg-[#eef5f7] px-2.5 py-1 text-xs font-medium text-[#285f7a]">{status}</span>}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className={CARD}>
          <SectionHeader icon={Settings2} title="Regras" />
          <div className="divide-y divide-[#eef3f5] px-5">
            <div className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span>
                <span className={cn("block text-sm font-medium", INK)}>Prazo da cobertura</span>
                <span className={cn("block text-xs", MUTED)}>Depois disso a pessoa aparece como “sem feedback”, e o gestor recebe o aviso</span>
              </span>
              <Stepper label="Dias da cobertura" value={settings.coverage_days} min={10} max={180} step={5} suffix="dias" onChange={(value) => save({ coverage_days: value })} />
            </div>
            <SwitchRow className="py-3" icon={Lock} checked={settings.hr_reads_content} onChange={(value) => save({ hr_reads_content: value })} label="Pessoas e Cultura lê o texto dos feedbacks" hint="Desligado, o RH vê só quem deu, quando e os valores." />
            <SwitchRow className="py-3" icon={Globe2} checked={settings.mural_enabled} onChange={(value) => save({ mural_enabled: value })} label="Mural de reconhecimentos" hint="Permite enviar reconhecimento para todos verem." />
            <SwitchRow className="py-3" icon={Wand2} checked={settings.ai_enabled} onChange={(value) => save({ ai_enabled: value })} label="Ajuda da IA para escrever" hint="Botão “Melhorar com IA” no envio (OpenAI, conta do escritório)." />
          </div>
        </section>
        <section className={CARD}>
          <SectionHeader icon={Mail} title="Avisos" subtitle="O sino do ORQESTRAI avisa sempre" />
          <div className="px-5">
            <SwitchRow className="py-3" icon={Mail} checked={settings.email_enabled} onChange={(value) => save({ email_enabled: value })} label="Também por e-mail" hint="Feedback recebido, pedido de feedback e Boas práticas para o gestor, pelo Microsoft 365. O e-mail leva só o aviso; o texto fica no ORQESTRAI." />
          </div>
        </section>
        <section className={cn(CARD, "xl:col-span-2")}>
          <SectionHeader icon={FileText} title="Modelos de texto" subtitle="Aparecem como sugestão no envio, filtrados pelo tipo">
            <Button size="sm" variant="secondary" onClick={() => setAdding((value) => value + 1)}>
              <Plus className="size-4" aria-hidden />
              Novo modelo
            </Button>
          </SectionHeader>
          <ul className="grid gap-3 px-5 py-4 lg:grid-cols-2">
            {Array.from({ length: adding }, (_, index) => (
              <TemplateCard key={`novo-${index}`} template={null} onSaved={() => router.refresh()} />
            ))}
            {templates.map((template) => (
              <TemplateCard key={template.id} template={template} onSaved={() => router.refresh()} />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- página */

export function GestaoFeedbackClient({ data }: { data: FeedbackHrOverview }) {
  const [tab, setTab] = useState<Tab>("cobertura");
  const [openId, setOpenId] = useState<string | null>(null);
  const router = useRouter();
  const openRequests = data.requests.filter((request) => request.status === "aberto");
  const tabs: Array<{ id: Tab; label: string; icon: LucideIcon; count?: number }> = [
    { id: "cobertura", label: "Cobertura", icon: Users },
    { id: "historico", label: "Histórico", icon: History, count: data.feedbacks.length },
    { id: "pedidos", label: "Pedidos", icon: MessageSquarePlus, count: openRequests.length },
    { id: "apagados", label: "Apagados", icon: Trash2, count: data.deleted.length },
    { id: "configuracoes", label: "Configurações", icon: Settings2 },
  ];

  return (
    <div className="space-y-6">
      <div className={cn(CARD, "flex max-w-full gap-1 overflow-x-auto p-1 [mask-image:linear-gradient(to_right,#000_88%,transparent)] [scrollbar-width:none] sm:inline-flex sm:[mask-image:none]")} role="tablist" aria-label="Gestão do feedback">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
              tab === item.id ? "bg-[#e8f8f8] text-[#1d5670] shadow-[inset_0_0_0_1px_#47cdd0]" : "text-[#3b5560] hover:bg-[#f4fafb]"
            )}
          >
            <item.icon className="size-4" aria-hidden />
            {item.label}
            {item.count ? <span className="rounded-full bg-[#eef5f7] px-1.5 text-xs font-semibold leading-5 text-[#3b5560] tabular-nums">{item.count}</span> : null}
          </button>
        ))}
      </div>

      {tab === "cobertura" && <Coverage data={data} />}
      {tab === "historico" && <HistoryTab items={data.feedbacks} onOpen={setOpenId} />}
      {tab === "apagados" && <HistoryTab items={data.deleted} onOpen={setOpenId} deleted />}
      {tab === "pedidos" && (
        <section className={cn(CARD, "overflow-hidden")}>
          <SectionHeader icon={MessageSquarePlus} title="Pedidos de feedback" subtitle={`${openRequests.length} em aberto`} />
          {data.requests.length === 0 ? (
            <p className={cn("px-5 py-10 text-center text-sm", MUTED)}>Nenhum pedido ainda.</p>
          ) : (
            <ul className="divide-y divide-[#eef3f5]">
              {data.requests.map((request) => (
                <li key={request.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <span className="flex shrink-0">
                    <PersonPhoto person={request.requester} size="sm" className="ring-2 ring-white" />
                    <PersonPhoto person={request.giver} size="sm" className="-ml-2 ring-2 ring-white" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm", INK)}>
                      <span className="font-semibold">{request.requester.name.split(" ")[0]}</span> pediu a <span className="font-semibold">{request.giver.name}</span>
                      {request.subject.id !== request.requester.id && <span className={MUTED}> sobre {request.subject.name}</span>}
                    </span>
                    <span className={cn("block truncate text-xs", MUTED)}>{request.message}</span>
                  </span>
                  <span className={cn("text-xs tabular-nums", MUTED)}>{formatWhen(request.created_at)}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                      request.status === "respondido"
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-600/15"
                        : request.status === "recusado"
                          ? "bg-[#f1f5f6] text-[#5a717b] ring-[#cfdadd]"
                          : request.overdue
                            ? "bg-red-50 text-red-700 ring-red-600/20"
                            : "bg-[#eaf4f6] text-[#1d5670] ring-[#1d7086]/15"
                    )}
                  >
                    {request.status === "respondido" ? "Respondido" : request.status === "recusado" ? "Recusado" : request.overdue ? "Prazo passou" : "Aberto"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {tab === "configuracoes" && <SettingsTab initial={data.settings} templates={data.templates} />}

      {openId && <FeedbackDetailDialog id={openId} onClose={() => setOpenId(null)} onChanged={() => router.refresh()} />}
    </div>
  );
}
