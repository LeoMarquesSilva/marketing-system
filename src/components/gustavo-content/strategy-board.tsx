"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, FilePenLine, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  EditorialError,
  EditorialLoading,
} from "@/components/gustavo-content/editorial-states";
import { StrategyPresentation } from "@/components/gustavo-content/strategy-presentation";
import {
  pillarsMissingTheses,
  strategyOperatingPulse,
} from "@/lib/gustavo-content/strategy-insights";
import type {
  GustavoStrategy,
  StrategyChannelRole,
  StrategyPillar,
} from "@/lib/gustavo-content/strategy";
import type { GustavoThesis } from "@/lib/gustavo-content/theses";
import type { GustavoContentItem } from "@/lib/gustavo-content/types";
import type { GustavoVoiceSample } from "@/lib/gustavo-content/voice";

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

async function readJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function StrategyBoard({ canEdit }: { canEdit: boolean }) {
  const [strategy, setStrategy] = useState<GustavoStrategy | null>(null);
  const [draft, setDraft] = useState<GustavoStrategy | null>(null);
  const [theses, setTheses] = useState<GustavoThesis[]>([]);
  const [voice, setVoice] = useState<GustavoVoiceSample[]>([]);
  const [items, setItems] = useState<GustavoContentItem[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [strategyRes, thesesRes, voiceRes, itemsRes] = await Promise.all([
        fetch("/api/gustavo-content/strategy", { credentials: "include" }),
        readJson<GustavoThesis[]>("/api/gustavo-content/theses"),
        readJson<GustavoVoiceSample[]>("/api/gustavo-content/voice"),
        readJson<GustavoContentItem[]>("/api/gustavo-content/items"),
      ]);
      const data = await strategyRes.json().catch(() => ({}));
      if (!strategyRes.ok) {
        throw new Error(data.error ?? "Não foi possível carregar a estratégia.");
      }
      setStrategy(data as GustavoStrategy);
      setDraft(copyStrategy(data as GustavoStrategy));
      setTheses(Array.isArray(thesesRes) ? thesesRes : []);
      setVoice(Array.isArray(voiceRes) ? voiceRes : []);
      setItems(Array.isArray(itemsRes) ? itemsRes : []);
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

  const pulse = useMemo(() => strategyOperatingPulse({ theses, voice, items }), [theses, voice, items]);
  const missingPillars = useMemo(
    () => (strategy ? pillarsMissingTheses(strategy.content_pillars, theses) : []),
    [strategy, theses]
  );

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
            {editing ? "Revisar a direção" : "Por que estamos construindo autoridade assim"}
          </h3>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#4b6873]">
            {editing
              ? "Os mesmos capítulos da carta. O que mudar aqui passa a orientar score, ângulos e rascunho."
              : "O raciocínio por trás do público, das pautas, dos canais e das escolhas — apresentado como carta, não como formulário."}
          </p>
        </div>
        {canEdit && (
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
        )}
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
        <StrategyPresentation
          strategy={strategy}
          theses={theses}
          pulse={pulse}
          missingPillars={missingPillars}
        />
      )}
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
      <p className="rounded-[1.25rem] bg-[#04202f] px-5 py-4 text-sm leading-6 text-white/75">
        <span className="font-semibold text-white">Documento em revisão.</span> Os capítulos abaixo
        são os mesmos da carta. Ao salvar, a IA passa a usar esta direção no score, nos ângulos e no
        rascunho.
      </p>

      <section className="strategy-memo grid gap-5 rounded-[1.5rem] p-5 sm:p-7">
        <EditorHeading number="01" title="Norte — a percepção que queremos construir" />
        <Field label="Posicionamento desejado" hint="Complete: Gustavo deve ser reconhecido como…">
          <Textarea
            rows={4}
            value={draft.positioning}
            onChange={(e) => patch("positioning", e.target.value)}
          />
        </Field>
        <Field label="Promessa editorial" hint="A transformação recorrente que cada conteúdo entrega.">
          <Textarea
            rows={3}
            value={draft.editorial_promise}
            onChange={(e) => patch("editorial_promise", e.target.value)}
          />
        </Field>
      </section>

      <section className="strategy-memo grid gap-5 rounded-[1.5rem] p-5 sm:p-7">
        <EditorHeading number="02" title="Porquê — a lacuna que queremos ocupar" />
        <Field
          label="Por que essa estratégia existe"
          hint="A lacuna de mercado e o raciocínio por trás das escolhas."
        >
          <Textarea
            rows={5}
            value={draft.strategic_rationale}
            onChange={(e) => patch("strategic_rationale", e.target.value)}
          />
        </Field>
      </section>

      <section className="strategy-memo grid gap-5 rounded-[1.5rem] p-5 sm:p-7">
        <EditorHeading number="03" title="ICP — para quem essa leitura precisa importar" />
        <Field label="ICP" hint="Um público por linha.">
          <Textarea
            rows={5}
            value={draft.icp.join("\n")}
            onChange={(e) => patch("icp", e.target.value.split("\n"))}
          />
        </Field>
        <Field label="Contexto do ICP" hint="Porte, momento empresarial, dores e nível de decisão.">
          <Textarea
            rows={4}
            value={draft.icp_context}
            onChange={(e) => patch("icp_context", e.target.value)}
          />
        </Field>
      </section>

      <section className="strategy-memo rounded-[1.5rem] p-5 sm:p-7">
        <EditorHeading number="04" title="Método — a notícia não encerra o conteúdo" />
        <p className="text-sm leading-6 text-[#4b6873]">
          O método é fixo: notícia → fato → problema → tese → implicação → conteúdo. Ele não se
          edita aqui porque é a regra da mesa, não uma preferência de campanha.
        </p>
      </section>

      <StructuredEditor<StrategyPillar>
        number="05"
        title="Pilares — o que escolhemos sustentar"
        items={draft.content_pillars}
        empty={{ title: "", description: "", reason: "" }}
        addLabel="Adicionar pilar"
        fields={[
          { key: "title", label: "Pilar", placeholder: "Ex.: Decisões sob pressão" },
          {
            key: "description",
            label: "O que abordamos",
            placeholder: "Qual território este pilar cobre?",
            multiline: true,
          },
          {
            key: "reason",
            label: "Por que fazemos assim",
            placeholder: "Como isso contribui para o posicionamento?",
            multiline: true,
          },
        ]}
        onChange={(items) => patch("content_pillars", items)}
      />

      <StructuredEditor<StrategyChannelRole>
        number="06"
        title="Canais — o papel de cada um"
        items={draft.channel_roles}
        empty={{ channel: "", role: "", reason: "" }}
        addLabel="Adicionar canal"
        fields={[
          { key: "channel", label: "Canal", placeholder: "Ex.: LinkedIn" },
          {
            key: "role",
            label: "Papel estratégico",
            placeholder: "Qual trabalho este canal realiza?",
            multiline: true,
          },
          {
            key: "reason",
            label: "Por que usamos assim",
            placeholder: "Por que esse papel faz sentido para o ICP?",
            multiline: true,
          },
        ]}
        onChange={(items) => patch("channel_roles", items)}
      />

      <section className="strategy-memo grid gap-5 rounded-[1.5rem] p-5 sm:p-7 lg:grid-cols-3">
        <div className="lg:col-span-3">
          <EditorHeading number="07" title="Regras, limites e definição de sucesso" />
        </div>
        <ListField
          label="Princípios editoriais"
          items={draft.editorial_principles}
          onChange={(items) => patch("editorial_principles", items)}
        />
        <ListField
          label="O que evitamos"
          items={draft.avoidances}
          onChange={(items) => patch("avoidances", items)}
        />
        <ListField
          label="Sinais de sucesso"
          items={draft.success_signals}
          onChange={(items) => patch("success_signals", items)}
        />
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

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {children}
    </div>
  );
}

function ListField({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  return (
    <Field label={label} hint="Um item por linha.">
      <Textarea
        rows={9}
        value={items.join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n"))}
      />
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
    <section className="strategy-memo space-y-5 rounded-[1.5rem] p-5 sm:p-7">
      <EditorHeading number={number} title={title} />
      <div className="space-y-4">
        {items.map((item, index) => (
          <div
            key={index}
            className="relative grid gap-4 rounded-xl border border-[#04202f]/8 bg-white/70 p-4 lg:grid-cols-3"
          >
            {fields.map((field) => (
              <div key={String(field.key)} className="space-y-1.5">
                <Label>{field.label}</Label>
                {field.multiline ? (
                  <Textarea
                    rows={4}
                    value={String(item[field.key] ?? "")}
                    placeholder={field.placeholder}
                    onChange={(e) =>
                      onChange(updateListItem(items, index, field.key, e.target.value))
                    }
                  />
                ) : (
                  <Input
                    value={String(item[field.key] ?? "")}
                    placeholder={field.placeholder}
                    onChange={(e) =>
                      onChange(updateListItem(items, index, field.key, e.target.value))
                    }
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
