"use client";

import Image from "next/image";
import { Link2, Scale, Settings, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { resolveCanonicalAreaLabel } from "@/lib/ferias/filters";
import { AreaIcon, getAreaIconStyle } from "@/lib/area-icons";
import { AUDIENCE_ALL, AUDIENCE_OPTIONS, audienceLabel } from "@/lib/rh/welcome/audience";
import { toolLogoFor } from "@/lib/rh/welcome/tool-logos";
import { cn } from "@/lib/utils";

/** Logo oficial do sistema do link (VIOS, Responsum, Excel…), num quadro branco; sem logo, ícone genérico. */
export function ToolLogo({ url, size = 40, className }: { url: string; size?: number; className?: string }) {
  const logo = toolLogoFor(url);
  const padding = Math.round(size * 0.16);
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl border bg-white",
        !logo && "bg-[#e8f8f8] text-[#285f7a]",
        className
      )}
      style={{ width: size, height: size }}
      title={logo?.name}
    >
      {logo ? (
        <Image
          src={logo.src}
          alt={logo.name}
          width={size - padding * 2}
          height={size - padding * 2}
          className="object-contain"
          unoptimized
        />
      ) : (
        <Link2 className="size-1/2" aria-hidden />
      )}
    </span>
  );
}

/** Peças comuns da aba Boas-vindas (Dados cadastrais). */

export function formatDay(iso: string | null): string {
  if (!iso) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

/** Área do colaborador com o ícone e a cor usados no resto do RH. */
export function AreaChip({ department, className }: { department: string | null; className?: string }) {
  const area = resolveCanonicalAreaLabel(department);
  if (!area) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1",
        getAreaIconStyle(area),
        className
      )}
    >
      <AreaIcon area={area} className="size-3" aria-hidden />
      {area}
    </span>
  );
}

/** Ícone do público de um link (todos, divisão ou equipe). */
export function AudienceIcon({ audience, className }: { audience: string; className?: string }) {
  if (audience === AUDIENCE_ALL) return <Users className={className} aria-hidden />;
  if (audience === "juridica") return <Scale className={className} aria-hidden />;
  if (audience === "operacoes-legais") return <Settings className={className} aria-hidden />;
  return <AreaIcon area={audienceLabel(audience)} className={className} aria-hidden />;
}

export function audienceIconStyle(audience: string): string {
  if (audience === AUDIENCE_ALL) return "bg-[#e8f8f8] text-[#285f7a] ring-[#47cdd0]/30";
  if (audience === "juridica") return "bg-violet-100 text-violet-700 ring-violet-200/60";
  if (audience === "operacoes-legais") return "bg-emerald-100 text-emerald-700 ring-emerald-200/60";
  return getAreaIconStyle(audienceLabel(audience));
}

const DIVISIONS = [...new Set(AUDIENCE_OPTIONS.map((option) => option.division).filter(Boolean))];

/** Seletor de público agrupado por divisão do organograma. */
export function AudienceSelect({
  value,
  onChange,
  includeAll = true,
  placeholder = "Escolha",
  id,
}: {
  value: string | null;
  onChange: (value: string) => void;
  includeAll?: boolean;
  placeholder?: string;
  id?: string;
}) {
  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {includeAll && (
          <SelectItem value={AUDIENCE_ALL}>{audienceLabel(AUDIENCE_ALL)}</SelectItem>
        )}
        {DIVISIONS.map((division) => (
          <SelectGroup key={division}>
            <SelectLabel>{division}</SelectLabel>
            {AUDIENCE_OPTIONS.filter((option) => option.division === division).map((option) => (
              <SelectItem key={option.key} value={option.key}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
