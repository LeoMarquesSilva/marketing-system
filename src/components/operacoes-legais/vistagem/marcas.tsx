"use client";

import { useState, useSyncExternalStore } from "react";
import { AreaIcon, getAreaIconStyle } from "@/lib/area-icons";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import { chaveGrupo, iniciaisDoGrupo } from "@/lib/vistagem/logos";

/* ---------------------------------------------------------- logos dos grupos */

const SEM_LOGOS: Record<string, string> = {};
let logos: Record<string, string> | null = null;
let pedido: Promise<void> | null = null;
const ouvintes = new Set<() => void>();

/** Busca os logos uma vez por sessão da página; todas as telas da Vistagem leem do mesmo lugar. */
function carregarLogos() {
  pedido ??= authFetch("/api/operacoes-legais/vistagem/logos")
    .then(async (resposta) => (resposta.ok ? ((await resposta.json()) as { logos: Record<string, string> }).logos : SEM_LOGOS))
    .catch(() => SEM_LOGOS)
    .then((valor) => {
      logos = valor;
      ouvintes.forEach((avisar) => avisar());
    });
}

export function useLogosGrupos(): Record<string, string> {
  return useSyncExternalStore(
    (avisar) => {
      ouvintes.add(avisar);
      carregarLogos();
      return () => ouvintes.delete(avisar);
    },
    () => logos ?? SEM_LOGOS,
    () => SEM_LOGOS
  );
}

const TAMANHO_LOGO = { xs: "size-5 text-[8px]", sm: "size-7 text-[10px]", md: "size-9 text-xs", lg: "size-11 text-sm" } as const;

/** Logo do grupo do cliente (o mesmo do ICP); sem logo, as iniciais do grupo. */
export function LogoGrupo({ grupo, tamanho = "sm", className }: { grupo: string | null | undefined; tamanho?: keyof typeof TAMANHO_LOGO; className?: string }) {
  const mapa = useLogosGrupos();
  /** URL que não carregou (a lista reaproveita o componente para outro grupo, então guarda qual foi). */
  const [falhou, setFalhou] = useState<string | null>(null);
  const url = grupo ? mapa[chaveGrupo(grupo)] : undefined;
  const caixa = cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md", TAMANHO_LOGO[tamanho], className);
  if (url && falhou !== url) {
    return (
      <span className={cn(caixa, "bg-white ring-1 ring-[#dce9eb]")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" loading="lazy" className="size-full object-contain" onError={() => setFalhou(url)} />
      </span>
    );
  }
  return (
    <span aria-hidden className={cn(caixa, "bg-[#04202f]/[0.06] font-semibold text-[#04202f]/70")}>
      {grupo ? iniciaisDoGrupo(grupo) : "—"}
    </span>
  );
}

/* ----------------------------------------------------------------- áreas */

const TAMANHO_AREA = { xs: "size-5 [&_svg]:size-3", sm: "size-6 [&_svg]:size-3.5", md: "size-8 [&_svg]:size-4" } as const;

/** Ícone da área na cor dela (a mesma do resto do Orquestra). */
export function IconeArea({ area, tamanho = "xs", className }: { area: string; tamanho?: keyof typeof TAMANHO_AREA; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded ring-1", getAreaIconStyle(area), TAMANHO_AREA[tamanho], className)} aria-hidden>
      {/* "text-current" mantém a cor da área dentro de listas que pintam os ícones de cinza. */}
      <AreaIcon area={area} className="text-current" />
    </span>
  );
}

/** Selo da área com ícone, no lugar do texto solto. */
export function SeloArea({ area, className }: { area: string; className?: string }) {
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1 rounded-full py-0.5 pl-1 pr-2 text-xs font-medium ring-1 ring-inset", getAreaIconStyle(area), className)}>
      <AreaIcon area={area} className="size-3 shrink-0 text-current" aria-hidden />
      <span className="truncate">{area}</span>
    </span>
  );
}
