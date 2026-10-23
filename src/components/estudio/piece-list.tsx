"use client";

import { useMemo, useState } from "react";
import { Copy, Loader2, Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PIECE_KIND_LABEL, type PieceKind, type StudioPieceSummary } from "@/lib/estudio/types";
import { ScaledBox, SlideArtboard, slideSize } from "./slide-artboard";

type Situacao = "todas" | "rascunho" | "planner";

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const chip = (active: boolean) =>
  cn("rounded-full border px-3 py-1 text-xs font-medium transition", active ? "border-[#04202f] bg-[#04202f] text-white" : "border-black/[0.12] bg-white hover:border-[#347796]/50");

/** Peças salvas em grade, com miniatura da capa, busca e filtros. */
export function PieceList({
  pieces,
  loading,
  busyId,
  onOpen,
  onDuplicate,
  onRemove,
}: {
  pieces: StudioPieceSummary[];
  loading: boolean;
  busyId: string | null;
  onOpen: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<PieceKind | "todos">("todos");
  const [situacao, setSituacao] = useState<Situacao>("todas");

  const visible = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return pieces.filter(
      (p) =>
        (tipo === "todos" || p.tipo === tipo) &&
        (situacao === "todas" || (situacao === "planner" ? Boolean(p.request_id) : !p.request_id)) &&
        (!q || p.titulo.toLowerCase().includes(q))
    );
  }, [pieces, busca, tipo, situacao]);

  return (
    <section aria-label="Peças salvas" className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h3 className="text-sm font-semibold">
          Peças salvas <span className="font-normal text-muted-foreground">({pieces.length})</span>
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar peça" className="h-8 w-48 bg-white pl-8 text-sm" aria-label="Buscar peça" />
          </label>
          {(["todos", "feed", "carrossel", "stories"] as const).map((k) => (
            <button key={k} type="button" className={chip(tipo === k)} onClick={() => setTipo(k)}>
              {k === "todos" ? "Todos" : PIECE_KIND_LABEL[k]}
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-black/10" aria-hidden />
          {([
            ["todas", "Todas"],
            ["rascunho", "Rascunho"],
            ["planner", "No planner"],
          ] as const).map(([k, label]) => (
            <button key={k} type="button" className={chip(situacao === k)} onClick={() => setSituacao(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">{pieces.length ? "Nenhuma peça com esses filtros." : "Nenhuma peça ainda. Comece por um dos tipos acima."}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((p) => {
            const size = p.capa ? slideSize(p.capa) : { width: 1080, height: 1350 };
            return (
              <li key={p.id} className="group flex flex-col border border-black/[0.1] bg-white">
                <button type="button" onClick={() => onOpen(p.id)} className="relative block overflow-hidden bg-[#e9edef]" aria-label={`Abrir ${p.titulo}`}>
                  {p.capa ? (
                    <ScaledBox artWidth={size.width} artHeight={size.height}>
                      <SlideArtboard slide={p.capa} indice={0} total={p.slides_count} tipo={p.tipo} />
                    </ScaledBox>
                  ) : (
                    <span className="block aspect-[4/5]" />
                  )}
                  <span className={cn("absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-semibold", p.request_id ? "bg-emerald-600 text-white" : "bg-white/90 text-[#04202f]")}>
                    {p.request_id ? "No planner" : "Rascunho"}
                  </span>
                </button>
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <button type="button" onClick={() => onOpen(p.id)} className="line-clamp-2 text-left text-sm font-medium leading-snug hover:underline">
                    {p.titulo}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {PIECE_KIND_LABEL[p.tipo]} · {p.slides_count} {p.slides_count === 1 ? "arte" : "artes"}
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-1">
                    <span className="text-[11px] text-muted-foreground">{formatDate(p.updated_at)}</span>
                    <span className="flex gap-0.5">
                      <button type="button" onClick={() => onDuplicate(p.id)} disabled={busyId === p.id} className="rounded p-1.5 text-muted-foreground hover:bg-black/[0.04] hover:text-foreground disabled:opacity-40" aria-label={`Duplicar ${p.titulo}`} title="Duplicar">
                        {busyId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                      <button type="button" onClick={() => onRemove(p.id)} className="rounded p-1.5 text-muted-foreground hover:bg-black/[0.04] hover:text-destructive" aria-label={`Excluir ${p.titulo}`} title="Excluir">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
