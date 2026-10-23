"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileInput, GalleryHorizontalEnd, Loader2, Plus, RectangleVertical, Square, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { starterSlides } from "@/lib/estudio/domain";
import { STUDIO_COLLECTIONS, templatesFor } from "@/lib/estudio/templates";
import { PIECE_KIND_LABEL, type PieceKind, type StudioPiece, type StudioPieceSummary } from "@/lib/estudio/types";
import { PieceEditor } from "./piece-editor";
import { PostImportDialog } from "./post-import-dialog";

const TAG_KEY = "estudio:colecao";

function rememberedTag(): string {
  const fallback = STUDIO_COLLECTIONS[0]?.tag ?? "";
  try {
    const saved = window.localStorage.getItem(TAG_KEY);
    return saved && STUDIO_COLLECTIONS.some((c) => c.tag === saved) ? saved : fallback;
  } catch {
    return fallback;
  }
}

const KIND_ICON: Record<PieceKind, typeof Square> = { feed: Square, carrossel: GalleryHorizontalEnd, stories: RectangleVertical };

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function EstudioClient() {
  const router = useRouter();
  const params = useSearchParams();
  const openId = params.get("peca");
  const [pieces, setPieces] = useState<StudioPieceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tag, setTagState] = useState(STUDIO_COLLECTIONS[0]?.tag ?? "");
  const [creating, setCreating] = useState<PieceKind | null>(null);
  const [openPiece, setOpenPiece] = useState<StudioPiece | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    // preferência do navegador, lida depois de montar
    setTagState(rememberedTag());
  }, []);

  function setTag(next: string) {
    setTagState(next);
    try {
      window.localStorage.setItem(TAG_KEY, next);
    } catch {
      // sem armazenamento: só não lembra a escolha
    }
  }

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/estudio/pecas", { credentials: "include", cache: "no-store" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Não foi possível carregar as peças.");
      setPieces(body.pieces);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as peças.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!openId) {
      setOpenPiece(null);
      void loadList();
      return;
    }
    let alive = true;
    fetch(`/api/estudio/pecas/${openId}`, { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error ?? "Peça não encontrada.");
        if (alive) setOpenPiece(body.piece);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Peça não encontrada.");
        router.replace("/conteudo/estudio");
      });
    return () => {
      alive = false;
    };
  }, [openId, loadList, router]);

  async function create(kind: PieceKind) {
    setCreating(kind);
    setError(null);
    try {
      const res = await fetch("/api/estudio/pecas", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag, tipo: kind, titulo: `${PIECE_KIND_LABEL[kind]} novo`, slides: starterSlides(tag, kind), legenda: "" }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Não foi possível criar a peça.");
      router.push(`/conteudo/estudio?peca=${body.piece.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a peça.");
    } finally {
      setCreating(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Excluir esta peça do Estúdio? A tarefa no planner, se houver, continua.")) return;
    const res = await fetch(`/api/estudio/pecas/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) setPieces((list) => list.filter((p) => p.id !== id));
  }

  if (openId) {
    if (!openPiece || openPiece.id !== openId) {
      return (
        <div className="flex items-center gap-2 py-20 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Abrindo a peça…
        </div>
      );
    }
    return <PieceEditor key={openPiece.id} piece={openPiece} onBack={() => router.push("/conteudo/estudio")} />;
  }

  const collection = STUDIO_COLLECTIONS.find((c) => c.tag === tag);
  const visible = pieces.filter((p) => p.tag === tag);

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-8">
      <section className="flex flex-col gap-5 border-b border-black/[0.08] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[#347796]">
            <Wand2 className="h-4 w-4" aria-hidden />
            <span className="text-xs font-semibold">Produção de artes</span>
          </div>
          <h2 className="text-2xl font-semibold text-foreground">Estúdio de peças</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Monte posts, carrosséis e stories a partir dos modelos do Illustrator: edite os campos, peça ajustes à IA, baixe o PNG ou mande para a tarefa do planner.
          </p>
        </div>
        {STUDIO_COLLECTIONS.length > 1 && (
          <select value={tag} onChange={(e) => setTag(e.target.value)} className="h-9 rounded-md border border-input bg-white px-2 text-sm" aria-label="Coleção de modelos">
            {STUDIO_COLLECTIONS.map((c) => (
              <option key={c.tag} value={c.tag}>[{c.tag}] {c.nome}</option>
            ))}
          </select>
        )}
      </section>

      <section className="border-y border-[#47cdd0]/30 bg-[#04202f] px-5 py-6 text-white">
        <p className="text-xs font-semibold text-[#8ae5e6]">NOVA PEÇA · [{tag}] {collection?.nome}</p>
        {collection?.importaPosts && (
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="mt-4 flex w-full items-center gap-3 border border-[#8ae5e6]/40 bg-[#8ae5e6]/10 px-4 py-3 text-left transition hover:bg-[#8ae5e6]/15"
          >
            <FileInput className="h-5 w-5 text-[#8ae5e6]" aria-hidden />
            <span>
              <span className="block text-sm font-semibold">Montar a partir de um post do Gerador</span>
              <span className="block text-xs text-white/60">Escolha o post aprovado e a IA distribui o texto nos slides do escritório.</span>
            </span>
          </button>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(["feed", "carrossel", "stories"] as PieceKind[]).map((kind) => {
            const Icon = KIND_ICON[kind];
            const count = templatesFor(tag, kind).length;
            return (
              <button
                key={kind}
                type="button"
                disabled={count === 0 || Boolean(creating)}
                onClick={() => void create(kind)}
                className="flex items-center gap-3 border border-white/15 bg-white/[0.04] px-4 py-3 text-left transition hover:border-[#8ae5e6]/60 hover:bg-white/[0.08] disabled:opacity-40"
              >
                {creating === kind ? <Loader2 className="h-5 w-5 animate-spin text-[#8ae5e6]" /> : <Icon className="h-5 w-5 text-[#8ae5e6]" aria-hidden />}
                <span>
                  <span className="block text-sm font-semibold">{PIECE_KIND_LABEL[kind]}</span>
                  <span className="block text-xs text-white/60">{count} {count === 1 ? "modelo" : "modelos"}</span>
                </span>
                <Plus className="ml-auto h-4 w-4 text-white/50" aria-hidden />
              </button>
            );
          })}
        </div>
      </section>

      {error && <p className="border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}

      {importOpen && <PostImportDialog open onOpenChange={setImportOpen} />}

      <section aria-label="Peças salvas" className="space-y-3">
        <h3 className="text-sm font-semibold">Peças salvas</h3>
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma peça ainda. Comece por um dos tipos acima.</p>
        ) : (
          <ul className="divide-y divide-black/[0.06] border border-black/[0.1] bg-white">
            {visible.map((p) => {
              const Icon = KIND_ICON[p.tipo];
              return (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <Icon className="h-4 w-4 shrink-0 text-[#347796]" aria-hidden />
                  <button type="button" onClick={() => router.push(`/conteudo/estudio?peca=${p.id}`)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-medium hover:underline">{p.titulo}</span>
                    <span className="block text-xs text-muted-foreground">
                      {PIECE_KIND_LABEL[p.tipo]} · {p.slides_count} {p.slides_count === 1 ? "arte" : "artes"} · editada em {formatDate(p.updated_at)}
                    </span>
                  </button>
                  <span className={cn("text-xs", p.request_id ? "text-emerald-700" : "text-muted-foreground")}>
                    {p.request_id ? "No planner" : "Rascunho"}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => void remove(p.id)} aria-label={`Excluir ${p.titulo}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
