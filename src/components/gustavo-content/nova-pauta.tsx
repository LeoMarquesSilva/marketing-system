"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

export function NovaPautaButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"link" | "idea">("link");
  const [url, setUrl] = useState("");
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        mode === "link" ? "/api/gustavo-content/from-link" : "/api/gustavo-content/from-idea",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mode === "link" ? { url } : { idea }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Não foi possível criar a pauta.");
      }
      setOpen(false);
      setUrl("");
      setIdea("");
      router.push(`/conteudo/gustavo/producao/${data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar pauta.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Nova pauta
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova pauta</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("link")}
              className={`rounded-full px-3 py-1.5 text-sm ${
                mode === "link"
                  ? "bg-[#04202f] text-white"
                  : "bg-black/[0.04] text-muted-foreground"
              }`}
            >
              Link
            </button>
            <button
              type="button"
              onClick={() => setMode("idea")}
              className={`rounded-full px-3 py-1.5 text-sm ${
                mode === "idea"
                  ? "bg-[#04202f] text-white"
                  : "bg-black/[0.04] text-muted-foreground"
              }`}
            >
              Ideia própria
            </button>
          </div>
          {mode === "link" ? (
            <div className="space-y-2">
              <Label htmlFor="gustavo-link">Link da matéria</Label>
              <Input
                id="gustavo-link"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="gustavo-idea">Sobre o que você quer falar?</Label>
              <Textarea
                id="gustavo-idea"
                value={idea}
                onChange={(event) => setIdea(event.target.value)}
                rows={5}
                placeholder="Quero falar sobre empresas que esperam o banco executar todas as garantias antes de começar uma reestruturação."
              />
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? "Analisando…" : "Criar pauta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
