"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  THESIS_CONVICTION_LABELS,
  THESIS_CONVICTIONS,
  THESIS_STATUS_LABELS,
  THESIS_STATUSES,
  filterTheses,
  type GustavoThesis,
  type ThesisConviction,
  type ThesisStatus,
} from "@/lib/gustavo-content/theses";

type ThesisForm = {
  title: string;
  thesis: string;
  explanation: string;
  business_importance: string;
  counterpoint: string;
  applications: string;
  tags: string;
  gustavo_phrases: string;
  conviction: ThesisConviction;
  status: ThesisStatus;
};

const EMPTY_FORM: ThesisForm = {
  title: "",
  thesis: "",
  explanation: "",
  business_importance: "",
  counterpoint: "",
  applications: "",
  tags: "",
  gustavo_phrases: "",
  conviction: "contextual",
  status: "pending",
};

function toForm(thesis: GustavoThesis): ThesisForm {
  return {
    title: thesis.title,
    thesis: thesis.thesis,
    explanation: thesis.explanation ?? "",
    business_importance: thesis.business_importance ?? "",
    counterpoint: thesis.counterpoint ?? "",
    applications: thesis.applications.join(", "),
    tags: thesis.tags.join(", "),
    gustavo_phrases: thesis.gustavo_phrases.join("\n"),
    conviction: thesis.conviction,
    status: thesis.status,
  };
}

function statusTone(status: ThesisStatus) {
  if (status === "validated") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "disabled") return "border-black/10 bg-black/[0.04] text-muted-foreground";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

export function TesesLibrary() {
  const router = useRouter();
  const [theses, setTheses] = useState<GustavoThesis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [tag, setTag] = useState<string>("all");
  const [editing, setEditing] = useState<GustavoThesis | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<ThesisForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<GustavoThesis | null>(null);
  const [creatingContent, setCreatingContent] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gustavo-content/theses", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível carregar as teses.");
      setTheses(data as GustavoThesis[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar teses.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const thesis of theses) {
      for (const value of [...thesis.tags, ...thesis.applications]) set.add(value);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [theses]);

  const visible = useMemo(
    () =>
      filterTheses(theses, {
        query,
        status: status === "all" ? undefined : status,
        tag: tag === "all" ? undefined : tag,
      }),
    [theses, query, status, tag]
  );

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
    setCreating(true);
  };

  const openEdit = (thesis: GustavoThesis) => {
    setForm(toForm(thesis));
    setEditing(thesis);
    setCreating(true);
    setSelected(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        editing ? `/api/gustavo-content/theses/${editing.id}` : "/api/gustavo-content/theses",
        {
          method: editing ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível salvar a tese.");
      await load();
      setCreating(false);
      setSelected(data as GustavoThesis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const patchStatus = async (thesis: GustavoThesis, next: ThesisStatus) => {
    setError(null);
    const res = await fetch(`/api/gustavo-content/theses/${thesis.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...toForm(thesis), status: next }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Não foi possível atualizar o status.");
      return;
    }
    await load();
    setSelected(data as GustavoThesis);
  };

  const createContent = async (thesis: GustavoThesis) => {
    setCreatingContent(true);
    setError(null);
    try {
      const res = await fetch(`/api/gustavo-content/theses/${thesis.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_content" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível criar o conteúdo.");
      router.push(`/conteudo/gustavo/producao/${data.itemId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar conteúdo.");
    } finally {
      setCreatingContent(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#347796]">
            Biblioteca de teses
          </p>
          <h3 className="mt-1 text-xl font-semibold text-[#04202f]">
            Opiniões que a IA pode usar
          </h3>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Sem tese validada, o sistema não inventa o pensamento do Gustavo.
            Ele pergunta.
          </p>
        </div>
        <Button onClick={openCreate}>Nova tese</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar título ou tese"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {THESIS_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {THESIS_STATUS_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tag} onValueChange={setTag}>
          <SelectTrigger>
            <SelectValue placeholder="Tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as tags</SelectItem>
            {tags.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando teses…</p>
      ) : theses.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-[#04202f]/15 bg-[#04202f]/[0.02] px-5 py-10">
          <h4 className="text-lg font-semibold text-[#04202f]">
            A Biblioteca de Teses ainda está vazia.
          </h4>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Cadastre as primeiras posições do Gustavo para melhorar a qualidade
            dos conteúdos.
          </p>
        </section>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma tese corresponde aos filtros atuais.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((thesis) => (
            <button
              key={thesis.id}
              type="button"
              onClick={() => setSelected(thesis)}
              className="rounded-2xl border border-black/[0.06] bg-white p-5 text-left shadow-[0_1px_0_rgba(4,32,47,0.03)] transition-colors hover:border-[#47cdd0]/50"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", statusTone(thesis.status))}>
                  {THESIS_STATUS_LABELS[thesis.status]}
                </span>
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {THESIS_CONVICTION_LABELS[thesis.conviction]}
                </span>
              </div>
              <h4 className="mt-3 text-base font-semibold text-[#04202f]">{thesis.title}</h4>
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                {thesis.thesis}
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {thesis.tags.slice(0, 4).map((value) => (
                  <span key={value} className="rounded-full bg-[#04202f]/5 px-2 py-0.5 text-[11px] text-[#04202f]">
                    {value}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                {thesis.usage_count} conteúdo{thesis.usage_count === 1 ? "" : "s"}
                {thesis.last_used_at
                  ? ` · último uso ${format(new Date(thesis.last_used_at), "dd MMM yyyy", { locale: ptBR })}`
                  : ""}
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
                <DialogTitle>{selected.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap gap-2">
                  <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", statusTone(selected.status))}>
                    {THESIS_STATUS_LABELS[selected.status]}
                  </span>
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {THESIS_CONVICTION_LABELS[selected.conviction]}
                  </span>
                </div>
                <p className="leading-relaxed text-[#04202f]">{selected.thesis}</p>
                {selected.counterpoint && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#347796]">
                      Contraponto
                    </p>
                    <p className="mt-1 text-muted-foreground">{selected.counterpoint}</p>
                  </div>
                )}
                {selected.gustavo_phrases.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#347796]">
                      Frases do Gustavo
                    </p>
                    <ul className="mt-1 space-y-1 text-muted-foreground">
                      {selected.gustavo_phrases.map((phrase) => (
                        <li key={phrase}>“{phrase}”</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Usada em {selected.usage_count} conteúdo{selected.usage_count === 1 ? "" : "s"}.
                </p>
              </div>
              <DialogFooter className="flex-wrap gap-2">
                <Button variant="outline" onClick={() => openEdit(selected)}>
                  Editar
                </Button>
                {selected.status !== "validated" && (
                  <Button variant="secondary" onClick={() => patchStatus(selected, "validated")}>
                    Validar
                  </Button>
                )}
                {selected.status !== "disabled" && (
                  <Button variant="outline" onClick={() => patchStatus(selected, "disabled")}>
                    Desativar
                  </Button>
                )}
                <Button
                  onClick={() => createContent(selected)}
                  disabled={creatingContent || selected.status === "disabled"}
                >
                  {creatingContent ? "Criando…" : "Criar conteúdo com esta tese"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={creating} onOpenChange={(open) => !open && setCreating(false)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar tese" : "Nova tese"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="thesis-title">Título</Label>
              <Input
                id="thesis-title"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="thesis-body">Tese</Label>
              <Textarea
                id="thesis-body"
                rows={4}
                value={form.thesis}
                onChange={(event) => setForm((current) => ({ ...current, thesis: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="thesis-counter">Contraponto</Label>
              <Textarea
                id="thesis-counter"
                rows={2}
                value={form.counterpoint}
                onChange={(event) =>
                  setForm((current) => ({ ...current, counterpoint: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="thesis-apps">Aplicações</Label>
                <Input
                  id="thesis-apps"
                  value={form.applications}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, applications: event.target.value }))
                  }
                  placeholder="stay period, liquidez"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="thesis-tags">Tags</Label>
                <Input
                  id="thesis-tags"
                  value={form.tags}
                  onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="thesis-phrases">Frases do Gustavo</Label>
              <Textarea
                id="thesis-phrases"
                rows={2}
                value={form.gustavo_phrases}
                onChange={(event) =>
                  setForm((current) => ({ ...current, gustavo_phrases: event.target.value }))
                }
                placeholder="Uma por linha ou separadas por vírgula"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Convicção</Label>
                <Select
                  value={form.conviction}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, conviction: value as ThesisConviction }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THESIS_CONVICTIONS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {THESIS_CONVICTION_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, status: value as ThesisStatus }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THESIS_STATUSES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {THESIS_STATUS_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="thesis-why">Por que importa para o empresário</Label>
              <Textarea
                id="thesis-why"
                rows={2}
                value={form.business_importance}
                onChange={(event) =>
                  setForm((current) => ({ ...current, business_importance: event.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Salvando…" : "Salvar tese"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
