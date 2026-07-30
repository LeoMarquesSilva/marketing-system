"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, Link2, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface GeneratedRoteiro {
  id: string;
  title: string;
  area: string;
  post: string;
  link: string;
}

/**
 * Cola um link de notícia e a IA monta o post: detecta a área pelo conteúdo e
 * gera o carrossel, sem depender de tema/RSS cadastrado.
 */
export function ManualLinkCard({ onCreated }: { onCreated: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedRoteiro | null>(null);

  async function handleGenerate() {
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Cole o link da notícia.");
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/content-roteiros/from-link", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Não foi possível gerar o post.");
      }
      setResult(payload.roteiro as GeneratedRoteiro);
      setUrl("");
      await onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível gerar o post.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-muted/30"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="text-sm font-medium">Gerar post a partir de um link</span>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      {open && (
        <CardContent className="border-t px-5 pb-5 pt-0">
          <p className="mb-4 mt-4 text-sm text-muted-foreground">
            Cole o link de uma notícia. A IA lê a matéria, identifica a área do
            escritório e monta o carrossel — o post entra como{" "}
            <strong>aguardando aprovação</strong>, igual aos que vêm do RSS.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="url"
              inputMode="url"
              placeholder="https://… link da notícia"
              aria-label="Link da notícia"
              value={url}
              disabled={busy}
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !busy) void handleGenerate();
              }}
            />
            <Button
              onClick={() => void handleGenerate()}
              disabled={busy || !url.trim()}
              className="h-9 shrink-0 gap-2"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Gerando…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" aria-hidden />
                  Gerar post
                </>
              )}
            </Button>
          </div>

          {busy && (
            <p className="mt-3 text-xs text-muted-foreground">
              Lendo a matéria e escrevendo o carrossel. Pode levar até um minuto.
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {error}
            </p>
          )}

          {result && (
            <div role="status" className="mt-4 rounded-md border border-emerald-200 bg-emerald-50/60 p-3">
              <p className="text-sm font-medium text-emerald-900">Post gerado</p>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-muted-foreground">Área detectada:</dt>
                  <dd className="font-medium text-foreground">{result.area}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Título:</dt>
                  <dd className="text-foreground">{result.title}</dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-muted-foreground">
                Confira a área e o texto na lista abaixo antes de aprovar.
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
