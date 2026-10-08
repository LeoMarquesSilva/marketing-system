"use client";

import type { CSSProperties } from "react";
import { Pencil } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ORG_LEVELS, roleLevel, type OrgLevel, type OrgMember } from "@/lib/rh/org-chart";
import { cn } from "@/lib/utils";

/** Cores da legenda de níveis do onboarding, em tons discretos. */
export const LEVEL_STYLE: Record<OrgLevel, { dot: string; tint: string; border: string }> = {
  lideranca: { dot: "#04202f", tint: "#04202f", border: "#04202f" },
  coordenacao: { dot: "#3e84a8", tint: "#e7f2f8", border: "#bcdaea" },
  supervisao: { dot: "#c06a7b", tint: "#faeaed", border: "#efc9d1" },
  pleno: { dot: "#4c9670", tint: "#e8f4ed", border: "#c1dfcd" },
  junior: { dot: "#ad8747", tint: "#f7efe1", border: "#e6d4b0" },
  auxiliar: { dot: "#2ea5aa", tint: "#e2f5f6", border: "#b5e2e4" },
  estagio: { dot: "#9668ad", tint: "#f2e9f7", border: "#dcc9e8" },
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function OrgAvatar({
  name,
  photoUrl,
  size,
  ring,
  className,
}: {
  name: string;
  photoUrl: string | null;
  size: number;
  /** Cor do anel (nível). */
  ring?: string;
  className?: string;
}) {
  const style: CSSProperties = { width: size, height: size };
  if (ring) style.boxShadow = `0 0 0 2px var(--card, #fff), 0 0 0 3.5px ${ring}`;
  return (
    <Avatar className={cn("shrink-0", className)} style={style}>
      {photoUrl && <AvatarImage src={photoUrl} alt="" />}
      <AvatarFallback
        className="bg-[#e6eff1] font-semibold text-[#285f7a]"
        style={{ fontSize: Math.max(11, Math.round(size * 0.34)) }}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

export function LevelLegend({ levels, className }: { levels?: OrgLevel[]; className?: string }) {
  const shown = ORG_LEVELS.filter((l) => !levels || levels.includes(l.key));
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)} aria-label="Legenda de níveis">
      {shown.map((level) => (
        <li key={level.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{ background: LEVEL_STYLE[level.key].dot }}
          />
          {level.label}
        </li>
      ))}
    </ul>
  );
}

/** Barra fina com a composição de níveis da equipe. */
export function LevelBar({ members, className }: { members: OrgMember[]; className?: string }) {
  if (members.length === 0) return null;
  const counts = new Map<OrgLevel, number>();
  for (const m of members) counts.set(roleLevel(m.role), (counts.get(roleLevel(m.role)) ?? 0) + 1);
  return (
    <div aria-hidden className={cn("flex h-1 w-full gap-px overflow-hidden rounded-sm", className)}>
      {ORG_LEVELS.filter((l) => counts.has(l.key)).map((level) => (
        <span
          key={level.key}
          style={{ flexGrow: counts.get(level.key), background: LEVEL_STYLE[level.key].dot }}
          className="opacity-80"
        />
      ))}
    </div>
  );
}

export function AvatarStack({ members, max = 3 }: { members: OrgMember[]; max?: number }) {
  const shown = members.slice(0, max);
  const rest = members.length - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((m) => (
        <span key={m.id} className="rounded-full ring-2 ring-card">
          <OrgAvatar name={m.name} photoUrl={m.photoUrl} size={26} />
        </span>
      ))}
      {rest > 0 && (
        <span className="flex size-[26px] items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground ring-2 ring-card">
          +{rest}
        </span>
      )}
    </div>
  );
}

type PersonProps = {
  member: OrgMember;
  highlighted?: boolean;
  editing?: boolean;
  onSelect?: (member: OrgMember) => void;
};

function EditBadge() {
  return (
    <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-[#347796] text-white shadow-sm">
      <Pencil className="size-3" aria-hidden />
    </span>
  );
}

/** Cartão da visão por equipe. Liderança (sócio/gerente) ganha superfície escura. */
export function OrgPersonCard({ member, highlighted, editing, onSelect }: PersonProps) {
  const level = roleLevel(member.role);
  const lead = level === "lideranca";
  return (
    <button
      type="button"
      data-employee={member.employeeId}
      onClick={() => onSelect?.(member)}
      aria-label={`${member.name}, ${member.role}${editing ? " — ajustar posição" : " — abrir ficha"}`}
      className={cn(
        "group relative flex w-[232px] items-center gap-3 rounded-lg border px-3 py-3 text-left transition-[transform,box-shadow,border-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orquestrai-cyan focus-visible:ring-offset-2",
        lead
          ? "border-transparent bg-[linear-gradient(160deg,var(--orquestrai-surface-from),var(--orquestrai-surface-to))] text-white shadow-[0_10px_24px_-14px_rgba(4,32,47,0.8)] hover:-translate-y-0.5"
          : "border-[#dce9eb] bg-card shadow-[0_1px_2px_rgba(4,32,47,0.06)] hover:-translate-y-0.5 hover:border-[#47cdd0]/50 hover:shadow-[0_10px_22px_-14px_rgba(4,32,47,0.45)]",
        highlighted && "ring-2 ring-orquestrai-cyan ring-offset-2 ring-offset-background"
      )}
    >
      {editing && <EditBadge />}
      <OrgAvatar
        name={member.name}
        photoUrl={member.photoUrl}
        size={lead ? 54 : 46}
        ring={lead ? "rgba(71,205,208,0.55)" : LEVEL_STYLE[level].dot}
      />
      <span className="min-w-0">
        <span className={cn("block text-sm font-semibold leading-tight", lead ? "text-white" : "text-foreground")}>
          {member.name}
        </span>
        <span className={cn("mt-0.5 block text-xs leading-snug", lead ? "text-white/65" : "text-muted-foreground")}>
          {member.role}
        </span>
      </span>
    </button>
  );
}

/** Pílula compacta do organograma completo, colorida pelo nível (como no PPT). */
export function OrgPill({ member, highlighted, editing, onSelect }: PersonProps) {
  const level = roleLevel(member.role);
  const lead = level === "lideranca";
  const style = LEVEL_STYLE[level];
  return (
    <button
      type="button"
      data-employee={member.employeeId}
      onClick={() => onSelect?.(member)}
      title={`${member.name} — ${member.role}`}
      aria-label={`${member.name}, ${member.role}${editing ? " — ajustar posição" : " — abrir ficha"}`}
      style={lead ? undefined : { background: style.tint, borderColor: style.border }}
      className={cn(
        "relative flex w-[188px] items-center gap-2 rounded-md border py-1.5 pl-1.5 pr-2.5 text-left transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-[0_6px_14px_-8px_rgba(4,32,47,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orquestrai-cyan focus-visible:ring-offset-1",
        lead && "border-transparent bg-[var(--orquestrai-surface-to)] text-white",
        highlighted && "ring-2 ring-orquestrai-cyan ring-offset-2"
      )}
    >
      {editing && <EditBadge />}
      <OrgAvatar name={member.name} photoUrl={member.photoUrl} size={30} />
      <span className="min-w-0">
        <span className={cn("block truncate text-[13px] font-semibold leading-tight", lead ? "text-white" : "text-[#1c1c1c]")}>
          {member.name}
        </span>
        <span className={cn("block truncate text-xs leading-tight", lead ? "text-white/65" : "text-[#1c1c1c]/60")}>
          {member.role}
        </span>
      </span>
    </button>
  );
}

/** Retrato grande dos sócios patrimoniais, sobre a faixa escura. */
export function PartnerPortrait({ member, highlighted, editing, onSelect }: PersonProps) {
  return (
    <button
      type="button"
      data-employee={member.employeeId}
      onClick={() => onSelect?.(member)}
      aria-label={`${member.name}, ${member.role}${editing ? " — ajustar posição" : " — abrir ficha"}`}
      className={cn(
        "group relative flex flex-col items-center gap-3 rounded-lg px-4 py-2 text-center transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orquestrai-cyan",
        highlighted && "ring-2 ring-orquestrai-cyan"
      )}
    >
      {editing && <EditBadge />}
      <span className="rounded-full bg-[conic-gradient(from_200deg,rgba(71,205,208,0.9),rgba(62,132,168,0.35),rgba(71,205,208,0.9))] p-[2px]">
        <span className="block rounded-full bg-[var(--orquestrai-surface-to)] p-[3px]">
          <OrgAvatar name={member.name} photoUrl={member.photoUrl} size={84} />
        </span>
      </span>
      <span>
        <span className="block text-[15px] font-semibold leading-tight text-white">{member.name}</span>
        <span className="mt-0.5 block text-xs text-white/60">{member.role}</span>
      </span>
    </button>
  );
}
