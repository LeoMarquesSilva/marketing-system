"use client";

import { Building2, UserRound } from "lucide-react";
import type { PessoaResumo } from "@/lib/processos/types";
import { cn } from "@/lib/utils";

/** Ícone de pessoa física ou jurídica, no quadrado dos logos da Vistagem. */
export function IconePessoa({ tipo, className }: { tipo: PessoaResumo["tipo"]; className?: string }) {
  const Icone = tipo === "juridica" ? Building2 : UserRound;
  return (
    <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-[#e8f8f8] text-[#3e84a8] ring-1 ring-[#47cdd0]/25", className)} aria-hidden>
      <Icone className="size-4" />
    </span>
  );
}

export function tomDaCategoria(categoria: string | null): "sucesso" | "marca" | "neutro" {
  if (!categoria) return "neutro";
  if (/cliente ativo/i.test(categoria)) return "sucesso";
  return /cliente/i.test(categoria) ? "marca" : "neutro";
}
