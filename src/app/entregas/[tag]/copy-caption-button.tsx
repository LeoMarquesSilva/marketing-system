"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyCaptionButton({
  text,
  label = "Copiar legenda",
  copiedLabel = "Legenda copiada",
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="inline-flex items-center gap-1.5 rounded-full bg-[#10263b] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1b3a55] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c79b4a]"
    >
      {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      {copied ? copiedLabel : label}
    </button>
  );
}
