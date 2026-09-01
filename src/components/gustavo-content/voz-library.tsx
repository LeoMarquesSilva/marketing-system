"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  VOICE_AUTHENTICITIES,
  VOICE_AUTH_LABELS,
  VOICE_SOURCE_LABELS,
  VOICE_SOURCE_TYPES,
  excerptVoice,
  type GustavoVoiceSample,
  type VoiceAuthenticity,
  type VoiceSourceType,
} from "@/lib/gustavo-content/voice";

type VoiceForm = {
  original_text: string;
  source_type: VoiceSourceType;
  source_url: string;
  published_at: string;
  authenticity: VoiceAuthenticity;
  is_active: boolean;
};

const EMPTY_FORM: VoiceForm = {
  original_text: "",
  source_type: "manual",
  source_url: "",
  published_at: "",
  authenticity: "gustavo_original",
  is_active: true,
};

function toForm(sample: GustavoVoiceSample): VoiceForm {
  return {
    original_text: sample.original_text,
    source_type: sample.source_type,
    source_url: sample.source_url ?? "",
    published_at: sample.published_at ? sample.published_at.slice(0, 10) : "",
    authenticity: sample.authenticity,
    is_active: sample.is_active,
  };
}

export function VozLibrary() {
  const [samples, setSamples] = useState<GustavoVoiceSample[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<GustavoVoiceSample | null>(null);
  const [selected, setSelected] = useState<GustavoVoiceSample | null>(null);
  const [form, setForm] = useState<VoiceForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gustavo-content/voice", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível carregar as amostras.");
      setSamples(data as GustavoVoiceSample[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar a voz.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
    setCreating(true);
  };

  const openEdit = (sample: GustavoVoiceSample) => {
    setForm(toForm(sample));
    setEditing(sample);
    setCreating(true);
    setSelected(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        editing ? `/api/gustavo-content/voice/${editing.id}` : "/api/gustavo-content/voice",
        {
          method: editing ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível salvar a amostra.");
      await load();
      setCreating(false);
      setSelected(data as GustavoVoiceSample);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (sample: GustavoVoiceSample) => {
    const res = await fetch(`/api/gustavo-content/voice/${sample.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...toForm(sample), is_active: !sample.is_active }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Não foi possível atualizar a amostra.");
      return;
    }
    await load();
    setSelected(data as GustavoVoiceSample);
  };

  const remove = async (sample: GustavoVoiceSample) => {
    if (!window.confirm("Excluir esta amostra de voz?")) return;
    const res = await fetch(`/api/gustavo-content/voice/${sample.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível excluir.");
      return;
    }
    setSelected(null);
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#347796]">
            Voz do Gustavo
          </p>
          <h3 className="mt-1 text-xl font-semibold text-[#04202f]">
            Textos reais, não scraping
          </h3>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Cole posts que o Gustavo escreveu ou aprovou. O texto original é a
            fonte. A análise da IA, se existir, fica em segundo plano.
          </p>
        </div>
        <Button onClick={openCreate}>Nova amostra</Button>
      </div>

      {error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando amostras…</p>
      ) : samples.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-[#04202f]/15 bg-[#04202f]/[0.02] px-5 py-10">
          <h4 className="text-lg font-semibold text-[#04202f]">
            Nenhuma amostra de voz cadastrada.
          </h4>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Cole o texto de um post antigo, a data e se é original do Gustavo.
            Sem isso, a geração tende a soar genérica.
          </p>
        </section>
      ) : (
        <div className="space-y-3">
          {samples.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => setSelected(sample)}
              className={cn(
                "w-full rounded-2xl border bg-white p-5 text-left transition-colors",
                sample.is_active
                  ? "border-black/[0.06] hover:border-[#47cdd0]/50"
                  : "border-dashed border-black/10 opacity-70"
              )}
            >
              <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                <span>{VOICE_SOURCE_LABELS[sample.source_type]}</span>
                <span>·</span>
                <span>{VOICE_AUTH_LABELS[sample.authenticity]}</span>
                {sample.published_at && (
                  <>
                    <span>·</span>
                    <span>
                      {format(new Date(sample.published_at), "dd MMM yyyy", { locale: ptBR })}
                    </span>
                  </>
                )}
                {!sample.is_active && <span className="text-amber-700">inativa</span>}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[#04202f]">
                {excerptVoice(sample.original_text)}
              </p>
            </button>
          ))}
        </div>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>Texto original</DialogTitle>
              </DialogHeader>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#04202f]">
                {selected.original_text}
              </p>
              {selected.analysis && (
                <div className="rounded-xl bg-[#04202f]/[0.03] px-4 py-3 text-xs text-muted-foreground">
                  Análise automática em segundo plano. O texto acima é a fonte.
                </div>
              )}
              <DialogFooter className="flex-wrap">
                <Button variant="outline" onClick={() => openEdit(selected)}>
                  Editar
                </Button>
                <Button variant="secondary" onClick={() => toggleActive(selected)}>
                  {selected.is_active ? "Desativar" : "Ativar"}
                </Button>
                <Button variant="destructive" onClick={() => remove(selected)}>
                  Excluir
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={creating} onOpenChange={(open) => !open && setCreating(false)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar amostra" : "Nova amostra de voz"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="voice-text">Texto do post</Label>
              <Textarea
                id="voice-text"
                rows={8}
                value={form.original_text}
                onChange={(event) =>
                  setForm((current) => ({ ...current, original_text: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={form.source_type}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, source_type: value as VoiceSourceType }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VOICE_SOURCE_TYPES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {VOICE_SOURCE_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Autenticidade</Label>
                <Select
                  value={form.authenticity}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      authenticity: value as VoiceAuthenticity,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VOICE_AUTHENTICITIES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {VOICE_AUTH_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="voice-url">URL (opcional)</Label>
                <Input
                  id="voice-url"
                  value={form.source_url}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, source_url: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="voice-date">Data</Label>
                <Input
                  id="voice-date"
                  type="date"
                  value={form.published_at}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, published_at: event.target.value }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Salvando…" : "Salvar amostra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
