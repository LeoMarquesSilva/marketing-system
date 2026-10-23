"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileInput, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PostOption {
  id: string;
  title: string;
  area: string;
  status: string;
  author: string | null;
  date: string;
  hasRequest: boolean;
  pieceId: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  enviado_mkt: "Enviado ao Marketing",
  aprovado: "Aprovado",
  aprovado_revisor: "Aprovado pelo revisor",
};

/** Escolhe um post aprovado do Gerador de conteúdo e monta o carrossel com a IA. */
export function PostImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [posts, setPosts] = useState<PostOption[] | null>(null);
  const [query, setQuery] = useState("");
  const [building, setBuilding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<{ pieceId: string; faltando: string[] } | null>(null);

  useEffect(() => {
    if (!open || posts) return;
    fetch("/api/estudio/posts", { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error ?? "Não foi possível carregar os posts.");
        setPosts(body.posts);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Não foi possível carregar os posts."));
  }, [open, posts]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!posts) return [];
    if (!q) return posts;
    return posts.filter((p) => [p.title, p.area, p.author ?? ""].some((t) => t.toLowerCase().includes(q)));
  }, [posts, query]);

  async function build(post: PostOption) {
    if (post.pieceId) {
      router.push(`/conteudo/estudio?peca=${post.pieceId}`);
      return;
    }
    setBuilding(post.id);
    setError(null);
    try {
      const res = await fetch(`/api/estudio/posts/${post.id}`, { method: "POST", credentials: "include" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Não foi possível montar o carrossel.");
      const faltando: string[] = Array.isArray(body.faltando) ? body.faltando : [];
      if (faltando.length > 0) {
        // o texto foi aprovado pelo advogado: mostra o que ficou de fora antes de abrir
        setReview({ pieceId: body.piece.id, faltando });
        setBuilding(null);
        return;
      }
      router.push(`/conteudo/estudio?peca=${body.piece.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível montar o carrossel.");
      setBuilding(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !building && onOpenChange(v)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Montar carrossel a partir de um post</DialogTitle>
          <DialogDescription>
            A IA distribui o texto aprovado nos modelos do escritório, sem reescrever o conteúdo. Autor e cargo vêm do cadastro do RH; a foto vem da galeria, se houver.
          </DialogDescription>
        </DialogHeader>

        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por título, área ou autor" className="h-9 bg-white pl-8" aria-label="Buscar post" />
        </label>

        {error && <p className="border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}

        {review && (
          <div className="space-y-3 border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            <p className="font-medium">O carrossel foi montado, mas {review.faltando.length === 1 ? "esta frase do post não entrou" : "estas frases do post não entraram"} nos slides:</p>
            <ul className="list-disc space-y-1 pl-5 text-xs">
              {review.faltando.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <p className="text-xs">Confira e acrescente onde fizer sentido (ou peça à IA no editor).</p>
            <button
              type="button"
              onClick={() => router.push(`/conteudo/estudio?peca=${review.pieceId}`)}
              className="inline-flex items-center gap-1.5 bg-[#04202f] px-3 py-1.5 text-xs font-medium text-white"
            >
              Abrir a peça
            </button>
          </div>
        )}

        <div className="max-h-[55vh] overflow-y-auto border border-black/[0.08]">
          {!posts && !error ? (
            <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando posts…
            </p>
          ) : visible.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nenhum post aprovado encontrado.</p>
          ) : (
            <ul className="divide-y divide-black/[0.06]">
              {visible.map((post) => (
                <li key={post.id} className="flex items-start gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug">{post.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {post.area}
                      {post.author ? ` · ${post.author}` : ""} · {STATUS_LABEL[post.status] ?? post.status} ·{" "}
                      {new Date(post.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void build(post)}
                    disabled={Boolean(building)}
                    className="inline-flex shrink-0 items-center gap-1.5 border border-black/[0.12] bg-white px-2.5 py-1.5 text-xs font-medium hover:border-[#347796]/50 disabled:opacity-50"
                  >
                    {building === post.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileInput className="h-3.5 w-3.5" />}
                    {building === post.id ? "Montando…" : post.pieceId ? "Abrir peça" : "Montar"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {building && <p className="text-xs text-muted-foreground">A IA está montando os slides; leva até um minuto.</p>}
      </DialogContent>
    </Dialog>
  );
}
