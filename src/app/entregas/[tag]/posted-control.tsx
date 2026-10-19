"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, RotateCcw, Send } from "lucide-react";
import { setDeliveryPiecePosted } from "./actions";

function todayInSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function formatDay(isoDate: string): string {
  return isoDate.split("-").reverse().join("/");
}

/** Quem posta informa aqui se a peça já foi publicada (e em que dia). */
export function PostedControl({
  requestId,
  tag,
  postedOn,
}: {
  requestId: string;
  tag: string;
  postedOn: string | null;
}) {
  const [date, setDate] = useState(todayInSaoPaulo);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(next: string | null) {
    setError(null);
    startTransition(async () => {
      const result = await setDeliveryPiecePosted({ requestId, tag, postedOn: next });
      if (result.error) setError(result.error);
    });
  }

  if (postedOn) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Postada em {formatDay(postedOn)}
        </span>
        <button
          type="button"
          onClick={() => save(null)}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RotateCcw className="h-3.5 w-3.5" aria-hidden />}
          Ainda não postei
        </button>
        {error && <p role="alert" className="w-full text-xs font-medium text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#10263b]/10 px-4 py-3">
      <span className="mr-auto text-sm font-semibold">Já postou?</span>
      <label className="sr-only" htmlFor={`postado-em-${requestId}`}>
        Data da postagem
      </label>
      <input
        id={`postado-em-${requestId}`}
        type="date"
        value={date}
        max={todayInSaoPaulo()}
        onChange={(e) => setDate(e.target.value)}
        className="h-9 rounded-lg border border-[#10263b]/15 bg-white px-2 text-sm text-[#10263b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c79b4a]"
      />
      <button
        type="button"
        onClick={() => save(date)}
        disabled={pending || !date}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#10263b] px-4 text-xs font-semibold text-white transition hover:bg-[#1b3a55] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c79b4a] disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Send className="h-3.5 w-3.5" aria-hidden />}
        Marcar como postada
      </button>
      {error && <p role="alert" className="w-full text-xs font-medium text-red-700">{error}</p>}
    </div>
  );
}
