"use client";

import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  Check,
  Eye,
  FilePenLine,
  Plus,
  Quote,
  Save,
  Target,
  Trash2,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  EditorialError,
  EditorialLoading,
} from "@/components/gustavo-content/editorial-states";
import type {
  GustavoStrategy,
  StrategyChannelRole,
  StrategyPillar,
} from "@/lib/gustavo-content/strategy";

const FLOW = ["Notícia", "Fato", "Problema", "Tese", "Implicação", "Conteúdo"];

function copyStrategy(strategy: GustavoStrategy): GustavoStrategy {
  return JSON.parse(JSON.stringify(strategy)) as GustavoStrategy;
}

function updateListItem<T extends object>(
  list: T[],
  index: number,
  field: keyof T,
  value: string
): T[] {
  return list.map((item, itemIndex) =>
    itemIndex === index ? ({ ...item, [field]: value } as T) : item
  );
}

export function StrategyBoard() {
  const [strategy, setStrategy] = useState<GustavoStrategy | null>(null);
  const [draft, setDraft] = useState<GustavoStrategy | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/gustavo-content/strategy", {
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Não foi possível carregar a estratégia.");
      }
      setStrategy(data as GustavoStrategy);
      setDraft(copyStrategy(data as GustavoStrategy));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar a estratégia.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/gustavo-content/strategy", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Não foi possível salvar a estratégia.");
      setStrategy(data as GustavoStrategy);
      setDraft(copyStrategy(data as GustavoStrategy));
      setEditing(false);
      setNotice("Estratégia atualizada. A nova direção já passa a orientar a geração editorial.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar a estratégia.");
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    if (strategy) setDraft(copyStrategy(strategy));
    setEditing(false);
    setError(null);
  };

  if (loading) return <EditorialLoading label="Abrindo o documento estratégico" />;
  if (error && !strategy) return <EditorialError message={error} onRetry={() => void load()} />;
  if (!strategy || !draft) return null;

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-5 border-b border-[#04202f]/10 pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="editorial-kicker font-mono text-[11px] font-semibold uppercase text-[#347796]">
            Carta de posicionamento · documento vivo
          </p>
          <h3 className="editorial-display mt-3 text-[2rem] font-semibold leading-[1.02] text-[#04202f] sm:text-[2.75rem]">
            Por que estamos construindo autoridade assim
          </h3>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#4b6873]">
            O raciocínio por trás do público, das pautas, dos canais e das escolhas editoriais —
            organizado para apresentar ao Gustavo e orientar quem produz.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <Button variant="outline" onClick={cancel} disabled={saving}>
                <Eye /> Voltar à apresentação
              </Button>
              <Button onClick={() => void save()} disabled={saving}>
                <Save /> {saving ? "Salvando…" : "Salvar estratégia"}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <FilePenLine /> Editar documento
            </Button>
          )}
        </div>
      </header>

      {notice && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {editing ? (
        <StrategyEditor draft={draft} onChange={setDraft} />
      ) : (
        <StrategyPresentation strategy={strategy} />
      )}
    </div>
  );
}

function StrategyPresentation({ strategy }: { strategy: GustavoStrategy }) {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[1.75rem] bg-[#04202f] px-6 py-8 text-white shadow-[0_30px_80px_rgba(4,32,47,0.16)] sm:px-9 sm:py-10 lg:grid lg:grid-cols-[0.72fr_1.28fr] lg:gap-12">
        <div className="relative z-10">
          <div className="flex size-11 items-center justify-center rounded-full border border-white/15 bg-white/10">
            <Target className="size-5 text-[#47cdd0]" />
          </div>
          <p className="editorial-kicker mt-5 font-mono text-[10px] uppercase text-[#8ee5e7]">
            North star
          </p>
          <p className="mt-2 text-sm leading-6 text-white/60">A percepção que queremos construir</p>
        </div>
        <div className="relative z-10 mt-8 lg:mt-0">
          <Quote className="mb-4 size-7 text-[#47cdd0]" />
          <h4 className="editorial-display text-2xl font-medium leading-tight text-white sm:text-[2rem]">
            {strategy.positioning}
          </h4>
          <div className="mt-7 border-l border-[#47cdd0]/60 pl-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8ee5e7]">
              Nossa promessa editorial
            </p>
            <p className="mt-2 text-base leading-7 text-white/80">{strategy.editorial_promise}</p>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full border border-[#47cdd0]/10" />
        <div className="pointer-events-none absolute -right-8 -top-8 size-52 rounded-full border border-[#47cdd0]/10" />
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-[1.5rem] bg-[#e2f5f3] p-6 sm:p-8">
          <p className="editorial-kicker font-mono text-[10px] uppercase text-[#347796]">
            O porquê
          </p>
          <h4 className="editorial-display mt-3 text-2xl font-semibold text-[#04202f]">
            A lacuna que queremos ocupar
          </h4>
          <p className="mt-5 text-base leading-7 text-[#294d5a]">{strategy.strategic_rationale}</p>
        </article>

        <article className="rounded-[1.5rem] bg-white/85 p-6 shadow-[0_18px_50px_rgba(4,32,47,0.06)] sm:p-8">
          <div className="flex items-center gap-3">
            <UsersRound className="size-5 text-[#347796]" />
            <p className="editorial-kicker font-mono text-[10px] uppercase text-[#347796]">
              ICP prioritário
            </p>
          </div>
          <h4 className="editorial-display mt-3 text-2xl font-semibold text-[#04202f]">
            Para quem essa leitura precisa importar
          </h4>
          <div className="mt-5 flex flex-wrap gap-2">
            {strategy.icp.map((audience) => (
              <span
                key={audience}
                className="rounded-full border border-[#347796]/15 bg-[#347796]/[0.06] px-3 py-1.5 text-sm font-medium text-[#285f7a]"
              >
                {audience}
              </span>
            ))}
          </div>
          {strategy.icp_context && (
            <p className="mt-5 border-t border-[#04202f]/8 pt-4 text-sm leading-6 text-[#56707a]">
              {strategy.icp_context}
            </p>
          )}
        </article>
      </section>

      <section className="rounded-[1.5rem] border border-[#04202f]/8 bg-white/55 px-5 py-7 sm:px-8">
        <div className="max-w-2xl">
          <p className="editorial-kicker font-mono text-[10px] uppercase text-[#347796]">
            Método editorial
          </p>
          <h4 className="editorial-display mt-3 text-2xl font-semibold text-[#04202f]">
            A notícia inicia o raciocínio. Ela não encerra o conteúdo.
          </h4>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {FLOW.map((step, index) => (
            <div key={step} className="relative rounded-xl bg-[#04202f]/[0.045] px-3 py-4">
              <span className="font-mono text-[10px] text-[#347796]">0{index + 1}</span>
              <p className="mt-5 text-sm font-semibold text-[#04202f]">{step}</p>
              {index < FLOW.length - 1 && (
                <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden size-4 -translate-y-1/2 text-[#47cdd0] lg:block" />
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="max-w-2xl">
          <p className="editorial-kicker font-mono text-[10px] uppercase text-[#347796]">
            Arquitetura editorial
          </p>
          <h4 className="editorial-display mt-3 text-2xl font-semibold text-[#04202f]">
            O que escolhemos sustentar — e por quê
          </h4>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {strategy.content_pillars.map((pillar, index) => (
            <article
              key={`${pillar.title}-${index}`}
              className="group rounded-[1.35rem] bg-white/85 p-6 shadow-[0_16px_45px_rgba(4,32,47,0.045)]"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="font-mono text-xs text-[#347796]">0{index + 1}</span>
                <ArrowDown className="size-4 text-[#47cdd0] transition-transform group-hover:translate-y-1" />
              </div>
              <h5 className="mt-5 text-lg font-semibold text-[#04202f]">{pillar.title}</h5>
              <p className="mt-2 text-sm leading-6 text-[#56707a]">{pillar.description}</p>
              <div className="mt-5 border-t border-[#04202f]/8 pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#347796]">
                  Por que fazemos assim
                </p>
                <p className="mt-2 text-sm leading-6 text-[#294d5a]">{pillar.reason}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {strategy.channel_roles.map((channel, index) => (
          <article
            key={`${channel.channel}-${index}`}
            className={
              index % 2 === 0
                ? "rounded-[1.5rem] bg-[#347796] p-7 text-white"
                : "rounded-[1.5rem] bg-[#dbeeed] p-7 text-[#04202f]"
            }
          >
            <p className={index % 2 === 0 ? "text-xs text-[#bceff0]" : "text-xs text-[#347796]"}>
              O papel do canal
            </p>
            <h5 className="editorial-display mt-2 text-2xl font-semibold">{channel.channel}</h5>
            <p className={index % 2 === 0 ? "mt-4 leading-7 text-white/85" : "mt-4 leading-7 text-[#294d5a]"}>
              {channel.role}
            </p>
            <p className={index % 2 === 0 ? "mt-6 border-t border-white/15 pt-4 text-sm text-white/65" : "mt-6 border-t border-[#04202f]/10 pt-4 text-sm text-[#56707a]"}>
              <strong>Por quê:</strong> {channel.reason}
            </p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 rounded-[1.5rem] bg-[#04202f] p-6 text-white sm:p-8 lg:grid-cols-2">
        <StrategyList title="Regras de decisão" items={strategy.editorial_principles} positive />
        <StrategyList title="O que conscientemente evitamos" items={strategy.avoidances} />
      </section>

      <section className="rounded-[1.5rem] border border-[#347796]/15 bg-white/70 p-6 sm:p-8">
        <p className="editorial-kicker font-mono text-[10px] uppercase text-[#347796]">
          Definição de sucesso
        </p>
        <h4 className="editorial-display mt-3 text-2xl font-semibold text-[#04202f]">
          O resultado não é apenas publicar mais
        </h4>
        <div className="mt-6 grid gap-x-8 gap-y-4 md:grid-cols-2">
          {strategy.success_signals.map((signal) => (
            <div key={signal} className="flex gap-3 text-sm leading-6 text-[#294d5a]">
              <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#47cdd0]/20">
                <Check className="size-3 text-[#285f7a]" />
              </span>
              {signal}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StrategyList({
  title,
  items,
  positive = false,
}: {
  title: string;
  items: string[];
  positive?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8ee5e7]">
        {title}
      </p>
      <div className="mt-5 space-y-3">
        {items.map((item, index) => (
          <div key={item} className="flex gap-3 text-sm leading-6 text-white/75">
            <span className={positive ? "font-mono text-[#47cdd0]" : "font-mono text-white/30"}>
              {positive ? "✓" : `0${index + 1}`}
            </span>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function StrategyEditor({
  draft,
  onChange,
}: {
  draft: GustavoStrategy;
  onChange: (strategy: GustavoStrategy) => void;
}) {
  const patch = <K extends keyof GustavoStrategy>(field: K, value: GustavoStrategy[K]) =>
    onChange({ ...draft, [field]: value });

  return (
    <div className="space-y-6">
      <section className="grid gap-5 rounded-[1.5rem] bg-white/80 p-5 shadow-[0_18px_50px_rgba(4,32,47,0.05)] sm:p-7">
        <EditorHeading number="01" title="A percepção que queremos construir" />
        <Field label="Posicionamento desejado" hint="Complete: Gustavo deve ser reconhecido como…">
          <Textarea rows={4} value={draft.positioning} onChange={(e) => patch("positioning", e.target.value)} />
        </Field>
        <Field label="Promessa editorial" hint="A transformação recorrente que cada conteúdo entrega.">
          <Textarea rows={3} value={draft.editorial_promise} onChange={(e) => patch("editorial_promise", e.target.value)} />
        </Field>
        <Field label="Por que essa estratégia existe" hint="A lacuna de mercado e o raciocínio por trás das escolhas.">
          <Textarea rows={5} value={draft.strategic_rationale} onChange={(e) => patch("strategic_rationale", e.target.value)} />
        </Field>
      </section>

      <section className="grid gap-5 rounded-[1.5rem] bg-white/80 p-5 sm:p-7">
        <EditorHeading number="02" title="Para quem estamos falando" />
        <Field label="ICP" hint="Um público por linha.">
          <Textarea rows={5} value={draft.icp.join("\n")} onChange={(e) => patch("icp", e.target.value.split("\n"))} />
        </Field>
        <Field label="Contexto do ICP" hint="Porte, momento empresarial, dores e nível de decisão.">
          <Textarea rows={4} value={draft.icp_context} onChange={(e) => patch("icp_context", e.target.value)} />
        </Field>
      </section>

      <StructuredEditor<StrategyPillar>
        number="03"
        title="Pilares e justificativas"
        items={draft.content_pillars}
        empty={{ title: "", description: "", reason: "" }}
        addLabel="Adicionar pilar"
        fields={[
          { key: "title", label: "Pilar", placeholder: "Ex.: Decisões sob pressão" },
          { key: "description", label: "O que abordamos", placeholder: "Qual território este pilar cobre?", multiline: true },
          { key: "reason", label: "Por que fazemos assim", placeholder: "Como isso contribui para o posicionamento?", multiline: true },
        ]}
        onChange={(items) => patch("content_pillars", items)}
      />

      <StructuredEditor<StrategyChannelRole>
        number="04"
        title="Papel de cada canal"
        items={draft.channel_roles}
        empty={{ channel: "", role: "", reason: "" }}
        addLabel="Adicionar canal"
        fields={[
          { key: "channel", label: "Canal", placeholder: "Ex.: LinkedIn" },
          { key: "role", label: "Papel estratégico", placeholder: "Qual trabalho este canal realiza?", multiline: true },
          { key: "reason", label: "Por que usamos assim", placeholder: "Por que esse papel faz sentido para o ICP?", multiline: true },
        ]}
        onChange={(items) => patch("channel_roles", items)}
      />

      <section className="grid gap-5 rounded-[1.5rem] bg-white/80 p-5 sm:p-7 lg:grid-cols-3">
        <div className="lg:col-span-3"><EditorHeading number="05" title="Critérios e resultado esperado" /></div>
        <ListField label="Princípios editoriais" items={draft.editorial_principles} onChange={(items) => patch("editorial_principles", items)} />
        <ListField label="O que evitamos" items={draft.avoidances} onChange={(items) => patch("avoidances", items)} />
        <ListField label="Sinais de sucesso" items={draft.success_signals} onChange={(items) => patch("success_signals", items)} />
      </section>
    </div>
  );
}

function EditorHeading({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-[#04202f]/8 pb-4">
      <span className="font-mono text-[11px] text-[#347796]">{number}</span>
      <h4 className="text-lg font-semibold text-[#04202f]">{title}</h4>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {children}
    </div>
  );
}

function ListField({ label, items, onChange }: { label: string; items: string[]; onChange: (items: string[]) => void }) {
  return (
    <Field label={label} hint="Um item por linha.">
      <Textarea rows={9} value={items.join("\n")} onChange={(e) => onChange(e.target.value.split("\n"))} />
    </Field>
  );
}

function StructuredEditor<T extends object>({
  number,
  title,
  items,
  empty,
  addLabel,
  fields,
  onChange,
}: {
  number: string;
  title: string;
  items: T[];
  empty: T;
  addLabel: string;
  fields: Array<{ key: keyof T; label: string; placeholder: string; multiline?: boolean }>;
  onChange: (items: T[]) => void;
}) {
  return (
    <section className="space-y-5 rounded-[1.5rem] bg-white/80 p-5 sm:p-7">
      <EditorHeading number={number} title={title} />
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={index} className="relative grid gap-4 rounded-xl border border-[#04202f]/8 bg-[#f8fbfa] p-4 lg:grid-cols-3">
            {fields.map((field) => (
              <div key={String(field.key)} className="space-y-1.5">
                <Label>{field.label}</Label>
                {field.multiline ? (
                  <Textarea
                    rows={4}
                    value={String(item[field.key] ?? "")}
                    placeholder={field.placeholder}
                    onChange={(e) => onChange(updateListItem(items, index, field.key, e.target.value))}
                  />
                ) : (
                  <Input
                    value={String(item[field.key] ?? "")}
                    placeholder={field.placeholder}
                    onChange={(e) => onChange(updateListItem(items, index, field.key, e.target.value))}
                  />
                )}
              </div>
            ))}
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              className="absolute right-2 top-2"
              aria-label={`Remover item ${index + 1}`}
              onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" onClick={() => onChange([...items, { ...empty }])}>
        <Plus /> {addLabel}
      </Button>
    </section>
  );
}
