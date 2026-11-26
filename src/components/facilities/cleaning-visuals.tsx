"use client";

import {
  Bath,
  Briefcase,
  Building2,
  ConciergeBell,
  Coffee,
  CookingPot,
  Crown,
  DoorClosed,
  Footprints,
  Presentation,
  Printer,
  RefreshCw,
  Scale,
  Settings,
  SprayCan,
  Trees,
  type LucideIcon,
} from "lucide-react";
import { createElement } from "react";
import { EmployeeAvatar } from "@/components/ferias/employee-avatar";
import { CLEANING_KIND_INFO, CLEANING_KINDS, type CleaningKind } from "@/lib/facilities/cleaning";
import { cn } from "@/lib/utils";

/** Dourado da Bismarchi | Pires: só nos topos escuros (foto e destaque), como na tela inicial. */
export const GOLD = "#E1B16D";

/** Topo escuro do sistema (o mesmo da tela inicial e do PDI). */
export const DARK_HERO = "bg-[radial-gradient(120%_140%_at_85%_0%,#0b3a52_0%,#04202f_42%,#03070c_100%)]";

/**
 * Intensidade crescente: simples é neutra, média é azul, completa e lavagem
 * (as pesadas) ficam preenchidas para saltarem na lista e na grade.
 */
export const KIND_STYLE: Record<CleaningKind, { tile: string; badge: string; bar: string }> = {
  simples: { tile: "bg-[#eef3f5] text-[#3b5560] ring-[#d6e3e7]", badge: "bg-[#eef3f5] text-[#3b5560]", bar: "bg-[#b9cdd5]" },
  media: { tile: "bg-[#dcebf3] text-[#1f5a78] ring-[#a9cbdc]", badge: "bg-[#dcebf3] text-[#1f5a78]", bar: "bg-[#3e84a8]" },
  completa: { tile: "bg-[#48466e] text-white ring-[#48466e]", badge: "bg-[#48466e] text-white", bar: "bg-[#48466e]" },
  lavagem: { tile: "bg-[#13676a] text-white ring-[#13676a]", badge: "bg-[#13676a] text-white", bar: "bg-[#13676a]" },
};

/** Letra do cronograma (S, M, C, L) num quadradinho com a cor do tipo. */
export function KindLetter({ kind, size = "md", muted = false, className }: { kind: CleaningKind | null; size?: "sm" | "md" | "lg"; muted?: boolean; className?: string }) {
  const sizes = { sm: "size-6 text-xs", md: "size-9 text-sm", lg: "size-11 text-base" };
  if (!kind) {
    return (
      <span className={cn("grid shrink-0 place-items-center rounded-md bg-slate-50 font-semibold text-slate-400 ring-1 ring-inset ring-slate-200", sizes[size], className)}>
        –
      </span>
    );
  }
  return (
    <span
      title={`Limpeza ${CLEANING_KIND_INFO[kind].label.toLowerCase()}`}
      className={cn("grid shrink-0 place-items-center rounded-md font-semibold ring-1 ring-inset", sizes[size], KIND_STYLE[kind].tile, muted && "opacity-45", className)}
    >
      {CLEANING_KIND_INFO[kind].letter}
    </span>
  );
}

/** Tipo por extenso ("Completa"), para quem não decorou as letras. */
export function KindBadge({ kind, className }: { kind: CleaningKind | null; className?: string }) {
  if (!kind) return <span className={cn("rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500", className)}>Sem tipo</span>;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", KIND_STYLE[kind].badge, className)}>
      {CLEANING_KIND_INFO[kind].label}
    </span>
  );
}

export function KindLegend({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1.5", className)} aria-label="Tipos de limpeza">
      {CLEANING_KINDS.map((kind) => (
        <li key={kind} className="flex items-center gap-1.5 text-xs text-[#3b5560]">
          <KindLetter kind={kind} size="sm" />
          {CLEANING_KIND_INFO[kind].label}
        </li>
      ))}
    </ul>
  );
}

/** Ícone de cada ambiente pelo nome (salas das áreas usam o ícone da área do sistema). */
const AREA_RULES: Array<[RegExp, LucideIcon]> = [
  [/recep|biblioteca/i, ConciergeBell],
  [/impressora|outback/i, Printer],
  [/cozinha|copa superior/i, CookingPot],
  [/copa/i, Coffee],
  [/banheiro/i, Bath],
  [/escada/i, Footprints],
  [/jardim|externa/i, Trees],
  [/reuni/i, Presentation],
  [/s[oó]cio/i, Crown],
  [/c[ií]vel/i, Scale],
  [/trabalhista/i, Briefcase],
  [/opera[cç][oõ]es legais/i, Settings],
  [/reestrutura/i, RefreshCw],
  [/^adm|administra/i, Building2],
  [/^sala/i, DoorClosed],
];

export function areaIconFor(name: string): LucideIcon {
  return AREA_RULES.find(([pattern]) => pattern.test(name))?.[1] ?? SprayCan;
}

export function AreaTile({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const sizes = { sm: "size-8 [&_svg]:size-4", md: "size-11 [&_svg]:size-5", lg: "size-12 [&_svg]:size-6" };
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-lg bg-[#eef5f7] text-[#285f7a]", sizes[size], className)} aria-hidden>
      {createElement(areaIconFor(name))}
    </span>
  );
}

/** Foto com anel dourado, para os topos escuros. */
export function GoldRingAvatar({ name, avatar, className }: { name: string; avatar: string | null; className?: string }) {
  return (
    <EmployeeAvatar
      name={name || "?"}
      avatarUrl={avatar}
      className={cn("ring-2 ring-[#E1B16D] ring-offset-4 ring-offset-[#04202f]", className)}
      fallbackClassName="bg-[#0b3347] text-lg text-[#f9f9f9]"
    />
  );
}
