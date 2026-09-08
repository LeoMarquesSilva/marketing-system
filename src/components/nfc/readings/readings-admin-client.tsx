"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Check,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  EyeOff,
  ImagePlus,
  LoaderCircle,
  Save,
  Search,
  Sparkles,
} from "lucide-react";
import { NfcPageHeading } from "@/components/nfc/nfc-page-heading";
import { NfcSubnav } from "@/components/nfc/nfc-subnav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  ReadingRecommendation,
  ReadingRecommendationsResult,
} from "@/lib/reading-trajectories/types";

const PUBLIC_PATH = "/leituras";

type EditorState = {
  publicName: string;
  practiceArea: string;
  roleOverride: string;
  photoOverrideUrl: string;
  bookTitle: string;
  bookAuthor: string;
  bookCoverUrl: string;
  recommendationText: string;
  trajectoryNote: string;
  bookLink: string;
  displayOrder: number;
  isVisible: boolean;
};

function toEditor(item: ReadingRecommendation): EditorState {
  return {
    publicName: item.publicName,
    practiceArea: item.practiceArea,
    roleOverride: item.roleOverride ?? "",
    photoOverrideUrl: item.photoOverrideUrl ?? "",
    bookTitle: item.bookTitle ?? "",
    bookAuthor: item.bookAuthor ?? "",
    bookCoverUrl: item.bookCoverUrl ?? "",
    recommendationText: item.recommendationText ?? "",
    trajectoryNote: item.trajectoryNote ?? "",
    bookLink: item.bookLink ?? "",
    displayOrder: item.displayOrder,
    isVisible: item.isVisible,
  };
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function Summary({ data }: { data: ReadingRecommendationsResult }) {
  const cards = [
    { label: "Profissionais", value: data.summary.total, tone: "text-[#285f73]" },
    { label: "Histórias prontas", value: data.summary.complete, tone: "text-emerald-700" },
    { label: "Indicações pendentes", value: data.summary.pending, tone: "text-amber-700" },
    { label: "Visíveis na página", value: data.summary.visible, tone: "text-[#285f73]" },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-2xl border border-[#dce9eb] bg-white px-4 py-3 shadow-sm">
          <dt className="text-xs text-muted-foreground">{card.label}</dt>
          <dd className={cn("mt-1 text-2xl font-semibold tabular-nums", card.tone)}>{card.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PersonPhoto({ item }: { item: ReadingRecommendation }) {
  if (item.photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.photoUrl} alt="" className="size-14 rounded-2xl object-cover shadow-sm" />;
  }
  return <span className="grid size-14 place-items-center rounded-2xl bg-[#eaf5f7] font-semibold text-[#285f73]">{initials(item.publicName)}</span>;
}

function RecommendationEditor({
  item,
  onSaved,
}: {
  item: ReadingRecommendation;
  onSaved: (item: ReadingRecommendation) => void;
}) {
  const [state, setState] = useState(() => toEditor(item));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const complete = Boolean(state.bookTitle.trim() && state.recommendationText.trim());

  const update = <K extends keyof EditorState>(key: K, value: EditorState[K]) => {
    setState((current) => ({ ...current, [key]: value }));
  };

  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/nfc/leituras/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...state, photoOverrideUrl: state.photoOverrideUrl }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível salvar.");
      onSaved(body.item);
      setState(toEditor(body.item));
      setMessage("Alterações salvas.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    setBusy(true); setError(""); setMessage("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch(`/api/nfc/leituras/${item.id}/cover`, { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível enviar a capa.");
      onSaved(body.item);
      setState(toEditor(body.item));
      setMessage("Capa enviada e salva.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Não foi possível enviar a capa.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <details className="group overflow-hidden rounded-2xl border border-[#dce9eb] bg-white shadow-sm open:shadow-md">
      <summary className="flex cursor-pointer list-none items-center gap-4 p-4 marker:hidden sm:p-5 [&::-webkit-details-marker]:hidden">
        <PersonPhoto item={{ ...item, publicName: state.publicName }} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold">{state.publicName}</h3>
            <Badge variant="outline" className={complete ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
              {complete ? "História pronta" : "Pendente"}
            </Badge>
            {!state.isVisible && <Badge variant="outline"><EyeOff className="mr-1 size-3" /> Oculto</Badge>}
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">{state.practiceArea} · {state.roleOverride || item.role}</p>
          <p className="mt-1 truncate text-sm text-[#285f73]">{state.bookTitle || "Livro ainda não informado"}</p>
        </div>
        <span className="text-xs font-semibold text-[#347796] group-open:hidden">Editar</span>
        <span className="hidden text-xs font-semibold text-[#347796] group-open:inline">Fechar</span>
      </summary>

      <div className="border-t border-[#e7eff0] bg-[#fbfdfd] p-4 sm:p-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_230px]">
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Nome público</Label><Input value={state.publicName} onChange={(event) => update("publicName", event.target.value)} /></div>
              <div><Label>Área de atuação</Label><Input value={state.practiceArea} onChange={(event) => update("practiceArea", event.target.value)} /></div>
              <div><Label>Cargo</Label><Input value={state.roleOverride} onChange={(event) => update("roleOverride", event.target.value)} /><p className="mt-1 text-xs text-muted-foreground">Preenchido inicialmente pelo cadastro de colaboradores.</p></div>
              <div><Label>Ordem</Label><Input type="number" min={1} max={99} value={state.displayOrder} onChange={(event) => update("displayOrder", Number(event.target.value))} /></div>
              <div className="sm:col-span-2"><Label>Foto alternativa (URL)</Label><Input value={state.photoOverrideUrl} onChange={(event) => update("photoOverrideUrl", event.target.value)} placeholder="Vazio mantém a foto oficial do colaborador" /></div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Livro</Label><Input value={state.bookTitle} onChange={(event) => update("bookTitle", event.target.value)} placeholder="Nome completo do livro" /></div>
              <div><Label>Autor</Label><Input value={state.bookAuthor} onChange={(event) => update("bookAuthor", event.target.value)} placeholder="Autor ou autores" /></div>
              <div><Label>Link do livro</Label><Input value={state.bookLink} onChange={(event) => update("bookLink", event.target.value)} placeholder="https://…" /></div>
              <div><Label>URL da capa</Label><Input value={state.bookCoverUrl} onChange={(event) => update("bookCoverUrl", event.target.value)} placeholder="https://…" /></div>
            </div>

            <div><Label>Por que esta leitura?</Label><Textarea rows={10} value={state.recommendationText} onChange={(event) => update("recommendationText", event.target.value)} placeholder="Cole aqui o texto completo, preservando os parágrafos." /></div>
            <div><Label>Nota de trajetória</Label><Textarea rows={3} value={state.trajectoryNote} onChange={(event) => update("trajectoryNote", event.target.value)} placeholder="Uma memória pessoal ou conexão entre profissionais — opcional." /></div>

            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-[#dce9eb] bg-white px-4 py-3">
              <span><span className="block text-sm font-semibold">Visível na página pública</span><span className="block text-xs text-muted-foreground">Itens pendentes aparecem como “indicação em preparação”.</span></span>
              <input type="checkbox" checked={state.isVisible} onChange={(event) => update("isVisible", event.target.checked)} className="size-5 accent-[#347796]" />
            </label>
          </div>

          <aside className="space-y-3">
            <div className="overflow-hidden rounded-2xl border border-[#dce9eb] bg-[#f2ede5] p-4">
              <div className="mx-auto aspect-[2/3] max-w-40 overflow-hidden rounded-md bg-[#0d1e2e] shadow-[0_14px_30px_rgba(13,30,46,.25)]">
                {state.bookCoverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={state.bookCoverUrl} alt="Prévia da capa" className="size-full object-cover" />
                ) : <span className="grid size-full place-items-center px-4 text-center text-xs text-white/60"><BookOpen className="mb-2 size-7" />Capa pendente</span>}
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
            <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={() => fileRef.current?.click()}><ImagePlus /> Enviar capa</Button>
            <p className="text-center text-[11px] leading-4 text-muted-foreground">JPG, PNG ou WebP · até 8 MB</p>
          </aside>
        </div>

        <div className="mt-6 flex flex-col-reverse items-stretch justify-between gap-3 border-t border-[#dce9eb] pt-5 sm:flex-row sm:items-center">
          <div aria-live="polite" className={cn("text-sm", error ? "text-red-600" : "text-emerald-700")}>{error || message}</div>
          <Button onClick={save} disabled={busy}>{busy ? <LoaderCircle className="animate-spin" /> : <Save />} Salvar indicação</Button>
        </div>
      </div>
    </details>
  );
}

export function ReadingsAdminClient({ initialData }: { initialData: ReadingRecommendationsResult }) {
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "complete" | "pending" | "hidden">("all");
  const [copied, setCopied] = useState(false);

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return data.items.filter((item) => {
      const matchesText = !term || [item.publicName, item.practiceArea, item.bookTitle, item.bookAuthor].filter(Boolean).some((value) => String(value).toLocaleLowerCase("pt-BR").includes(term));
      const matchesFilter = filter === "all" || (filter === "complete" && item.isComplete) || (filter === "pending" && !item.isComplete) || (filter === "hidden" && !item.isVisible);
      return matchesText && matchesFilter;
    });
  }, [data.items, filter, search]);

  function replaceItem(next: ReadingRecommendation) {
    setData((current) => {
      const items = current.items.map((item) => item.id === next.id ? next : item).sort((a, b) => a.displayOrder - b.displayOrder);
      return { items, summary: { total: items.length, visible: items.filter((item) => item.isVisible).length, complete: items.filter((item) => item.isComplete).length, pending: items.filter((item) => !item.isComplete).length } };
    });
  }

  async function copyPublicLink() {
    await navigator.clipboard.writeText(`${window.location.origin}${PUBLIC_PATH}`);
    setCopied(true); window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <NfcPageHeading title="Leituras que formam trajetórias" description="Gerencie os livros, relatos, capas e a ordem da experiência pública acessada pela etiqueta NFC." />
      <NfcSubnav />

      <section className="relative overflow-hidden rounded-[26px] bg-[#0d2636] px-5 py-6 text-white shadow-[0_22px_60px_rgba(13,38,54,.18)] sm:px-7">
        <div aria-hidden className="absolute -right-12 -top-20 size-64 rounded-full border border-[#e1b16d]/20" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#e1b16d] text-[#0d2636]"><Sparkles className="size-5" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#edca91]">Experiência pública NFC</p><h2 className="mt-2 text-xl font-semibold sm:text-2xl">Uma única tag, oito trajetórias</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">Fotos e cargos partem do cadastro oficial. Aqui você controla o conteúdo editorial que o estudante verá.</p></div></div>
          <div className="flex flex-col gap-2 sm:flex-row"><Button variant="outline" onClick={copyPublicLink} className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">{copied ? <Check /> : <Clipboard />}{copied ? "Link copiado" : "Copiar link da NFC"}</Button><Button asChild className="bg-[#e1b16d] text-[#0d2636] hover:bg-[#edca91]"><Link href={PUBLIC_PATH} target="_blank"><ExternalLink /> Abrir página pública</Link></Button></div>
        </div>
      </section>

      <Summary data={data} />

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar profissional, área ou livro" className="pl-9" /></div>
        <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="h-10 rounded-lg border border-input bg-white px-3 text-sm"><option value="all">Todas as indicações</option><option value="complete">Histórias prontas</option><option value="pending">Pendentes</option><option value="hidden">Ocultas</option></select>
      </div>

      <div className="space-y-3">
        {visible.map((item) => <RecommendationEditor key={item.id} item={item} onSaved={replaceItem} />)}
        {visible.length === 0 && <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">Nenhuma indicação encontrada com esses filtros.</div>}
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800"><CheckCircle2 className="size-4 shrink-0" />Os textos são publicados exatamente como salvos, com os parágrafos preservados.</div>
    </div>
  );
}
