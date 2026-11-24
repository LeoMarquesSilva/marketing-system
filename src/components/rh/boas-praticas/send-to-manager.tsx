"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Eye, Loader2, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { goodPracticeSentByFeedz } from "@/lib/rh/feedback/rules";
import { cn } from "@/lib/utils";

type Status = { feedback_id: string; sent_at: string; read_at: string | null; replies: number } | null;

const shortDate = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(new Date(iso));

/**
 * Envio da ocorrência ao gestor pelo ORQESTRAI (feedback do tipo "Boa prática"), no lugar do Feedz.
 * Quando o gestor abre, o "visualizado" do registro se marca sozinho; a resposta dele vira o retorno.
 */
export function SendToManager({
  goodPracticeId,
  managerName,
  sentOn,
  className,
}: {
  goodPracticeId: string;
  managerName: string | null;
  /** Data de envio do registro: antes do ORQESTRAI, o envio foi pelo Feedz. */
  sentOn?: string | null;
  className?: string;
}) {
  const [status, setStatus] = useState<Status | undefined>(undefined);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/rh/feedback/boas-praticas/situacao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [goodPracticeId] }) });
    if (!response.ok) {
      // Sem acesso ao feedback (trava de lançamento) ou falha: não mostra o botão.
      setStatus(null);
      setError(response.status === 403 ? "hidden" : null);
      return;
    }
    const body = (await response.json()) as Record<string, NonNullable<Status>>;
    setStatus(body[goodPracticeId] ?? null);
  }, [goodPracticeId]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/rh/feedback/boas-praticas/situacao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [goodPracticeId] }) })
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setStatus(null);
          setError(response.status === 403 ? "hidden" : null);
          return;
        }
        const body = (await response.json()) as Record<string, NonNullable<Status>>;
        if (!cancelled) setStatus(body[goodPracticeId] ?? null);
      })
      .catch(() => !cancelled && setStatus(null));
    return () => {
      cancelled = true;
    };
  }, [goodPracticeId]);

  async function send() {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/rh/feedback/boas-praticas/${goodPracticeId}`, { method: "POST" });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    setAsking(false);
    if (!response.ok) {
      setError(body.error ?? "Não foi possível enviar.");
      return;
    }
    await load();
  }

  if (status === undefined || error === "hidden") return null;

  if (status) {
    return (
      <Link
        href={`/feedback?f=${status.feedback_id}`}
        className={cn("inline-flex items-center gap-2 rounded-lg border border-[#dce9eb] bg-white px-3 py-1.5 text-xs text-[#3b5560] hover:bg-[#f4fafb]", className)}
      >
        <Check className="size-3.5 text-emerald-600" aria-hidden />
        Enviado ao gestor em {shortDate(status.sent_at)}
        <span className="inline-flex items-center gap-1">
          <Eye className="size-3.5" aria-hidden />
          {status.read_at ? `lido em ${shortDate(status.read_at)}` : "ainda não lido"}
        </span>
        {status.replies > 0 && (
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="size-3.5" aria-hidden />
            {status.replies}
          </span>
        )}
      </Link>
    );
  }

  if (goodPracticeSentByFeedz(sentOn)) {
    return (
      <span className={cn("inline-flex items-center gap-2 rounded-lg border border-[#dce9eb] bg-white px-3 py-1.5 text-xs text-[#3b5560]", className)}>
        <Check className="size-3.5 text-emerald-600" aria-hidden />
        Enviado pelo Feedz em {shortDate(`${String(sentOn).slice(0, 10)}T12:00:00-03:00`)}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-2", className)}>
      {asking ? (
        <>
          <span className="text-sm text-[#0d2a38]">
            Enviar para {managerName?.split(" ")[0] ?? "o gestor"} pelo ORQESTRAI?
            <span className="block text-xs text-[#5a717b]">Se já saiu pelo Feedz, não precisa.</span>
          </span>
          <Button type="button" size="sm" onClick={send} disabled={busy} className="bg-[#0f5f70] hover:bg-[#0c5262]">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
            Enviar
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setAsking(false)} disabled={busy}>
            Voltar
          </Button>
        </>
      ) : (
        <Button type="button" variant="outline" className="gap-2" onClick={() => setAsking(true)}>
          <Send className="size-4" aria-hidden />
          Enviar ao gestor
        </Button>
      )}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
