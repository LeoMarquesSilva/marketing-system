"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { plannerTitle } from "@/lib/estudio/domain";
import { getCollection } from "@/lib/estudio/templates";
import type { PieceKind, StudioSlide } from "@/lib/estudio/types";
import { attachToRequest, fetchOpenPostRequests, fetchTagRequests, sendAsNewRequest, suggestCode, type TagRequest } from "./planner-send";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: string;
  kind: PieceKind;
  titulo: string;
  slides: StudioSlide[];
  legenda: string;
  linkedRequestId: string | null;
  user: { id: string; name: string } | null;
  renderFiles: () => Promise<Blob[]>;
  onSent: (requestId: string) => void;
}

/**
 * Montado só enquanto está aberto (o editor renderiza condicionalmente): o estado
 * inicial vem das props na abertura e não é zerado quando a peça ganha o
 * `linkedRequestId` logo depois do envio.
 */
export function SendToPlannerDialog({ open, onOpenChange, tag, kind, titulo, slides, legenda, linkedRequestId, user, renderFiles, onSent }: Props) {
  const [initialTarget] = useState(linkedRequestId);
  // posts do escritório: título livre e as tarefas de post em aberto; campanhas: "[TAG] F06 Feed — Nome"
  const byTag = getCollection(tag)?.planner !== "posts";
  const [requests, setRequests] = useState<TagRequest[]>([]);
  const [mode, setMode] = useState<"nova" | "existente">(linkedRequestId ? "existente" : "nova");
  const [code, setCode] = useState("");
  const [name, setName] = useState(titulo);
  const [deadline, setDeadline] = useState("");
  const [targetId, setTargetId] = useState(linkedRequestId ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (byTag ? fetchTagRequests(tag) : fetchOpenPostRequests(initialTarget))
      .then((list) => {
        if (!alive) return;
        setRequests(list);
        if (byTag) setCode(suggestCode(list, tag, kind));
        setTargetId((current) => current || initialTarget || list[0]?.id || "");
      })
      .catch((err) => alive && setError(err instanceof Error ? err.message : "Falha ao carregar o planner."));
    return () => {
      alive = false;
    };
  }, [tag, kind, initialTarget, byTag]);

  const newTitle = byTag ? plannerTitle(tag, code.trim().toUpperCase() || "?", kind, name) : name.trim();

  async function submit() {
    if (!user) return setError("Faça login de novo para enviar ao planner.");
    setError(null);
    try {
      setBusy("Gerando as artes…");
      const files = await renderFiles();
      setBusy("Enviando para o planner…");
      let requestId: string;
      if (mode === "nova") {
        if (byTag && !/^[A-Z]\d{2,}$/i.test(code.trim())) throw new Error("Use um código como F06, C04 ou S11.");
        if (!name.trim()) throw new Error("Dê um nome para a tarefa.");
        requestId = await sendAsNewRequest({ tag, kind, slides, legenda, files, user, title: newTitle, deadline: deadline || null, requests });
      } else {
        if (!targetId) throw new Error("Escolha a solicitação.");
        await attachToRequest(targetId, { kind, files, user });
        requestId = targetId;
      }
      setDoneId(requestId);
      onSent(requestId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar ao planner.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar ao planner</DialogTitle>
          <DialogDescription>
            {byTag
              ? `As artes vão em PNG para a tarefa e aparecem em /entregas/${tag.toLowerCase()} assim que a tarefa estiver em revisão.`
              : "As artes vão em PNG para a tarefa do post no planner, na ordem dos slides."}
          </DialogDescription>
        </DialogHeader>

        {doneId ? (
          <div className="flex items-start gap-3 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="space-y-1">
              <p className="font-medium">Artes enviadas.</p>
              <Link href={`/planner?tarefa=${doneId}`} className="text-emerald-800 underline underline-offset-2">
                Abrir a tarefa no planner
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Destino">
              {(["nova", "existente"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => setMode(m)}
                  disabled={m === "existente" && requests.length === 0}
                  className={cn(
                    "border px-3 py-2 text-left text-sm transition disabled:opacity-40",
                    mode === m ? "border-[#04202f] bg-[#04202f] text-white" : "border-black/[0.12] bg-white hover:border-[#347796]/50"
                  )}
                >
                  {m === "nova" ? "Nova solicitação" : "Anexar a uma existente"}
                </button>
              ))}
            </div>

            {mode === "nova" ? (
              <div className="space-y-3">
                <div className={cn("grid gap-3", byTag && "grid-cols-[110px_1fr]")}>
                  {byTag && (
                    <label className="space-y-1.5 text-xs font-medium">
                      Código
                      <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={5} className="h-9 bg-white" />
                    </label>
                  )}
                  <label className="space-y-1.5 text-xs font-medium">
                    Nome da peça
                    <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={90} className="h-9 bg-white" />
                  </label>
                </div>
                <label className="block space-y-1.5 text-xs font-medium">
                  Data de publicação
                  <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="h-9 w-48 bg-white" />
                </label>
                <p className="text-xs text-muted-foreground">
                  Vai criar <span className="font-medium text-foreground">{newTitle || "?"}</span> em revisão, atribuída a você, com o texto de cada slide no checklist.
                </p>
              </div>
            ) : (
              <label className="block space-y-1.5 text-xs font-medium">
                Solicitação
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-white px-2 text-sm"
                >
                  {requests.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
                <span className="block font-normal text-muted-foreground">As artes entram depois dos arquivos que a tarefa já tem.</span>
              </label>
            )}

            {error && <p className="border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          {doneId ? (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          ) : (
            <Button onClick={() => void submit()} disabled={Boolean(busy) || !user}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
              {busy ?? "Enviar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
