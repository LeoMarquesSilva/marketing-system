"use client";

import { createContext, createElement, useContext, useMemo, type ReactNode } from "react";
import {
  Bath,
  Car,
  Cigarette,
  CigaretteOff,
  LampDesk,
  Laptop,
  Library,
  Lightbulb,
  Package,
  Presentation,
  Shapes,
  ShieldCheck,
  Shirt,
  Sofa,
  Tag,
  Thermometer,
  UsersRound,
  UtensilsCrossed,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAreaIcon, getAreaIconStyle } from "@/lib/area-icons";
import { getInitials } from "@/lib/ferias/filters";
import type { FeedbackPerson, GoodPracticeFeedback } from "@/lib/rh/boas-praticas/types";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ pessoas */

const PeopleContext = createContext<Map<string, FeedbackPerson>>(new Map());

export function FeedbackPeopleProvider({ people, children }: { people: FeedbackPerson[]; children: ReactNode }) {
  const index = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  return <PeopleContext.Provider value={index}>{children}</PeopleContext.Provider>;
}

export function usePeopleIndex(): Map<string, FeedbackPerson> {
  return useContext(PeopleContext);
}

export interface PersonRef {
  name: string;
  person: FeedbackPerson | null;
  isTeam: boolean;
}

/** Quem recebeu e quem é o gestor, já com foto e nome curto do cadastro. */
export function useFeedbackPeople(item: GoodPracticeFeedback): { employee: PersonRef; manager: PersonRef } {
  const index = usePeopleIndex();
  const employee = item.employee_id ? (index.get(item.employee_id) ?? null) : null;
  const manager = item.manager_employee_id ? (index.get(item.manager_employee_id) ?? null) : null;
  return {
    employee: { name: employee?.short_name ?? item.employee_name, person: employee, isTeam: item.is_team },
    manager: { name: manager?.short_name ?? item.manager_name, person: manager, isTeam: false },
  };
}

const AVATAR_SIZE = {
  xs: "size-6 text-xs",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-base",
} as const;

export function PersonAvatar({
  name,
  person,
  isTeam = false,
  size = "sm",
  className,
}: {
  name: string;
  person?: FeedbackPerson | null;
  isTeam?: boolean;
  size?: keyof typeof AVATAR_SIZE;
  className?: string;
}) {
  if (isTeam) {
    return (
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-full bg-[#e8f1f5] text-[#315f73] ring-1 ring-inset ring-[#3e84a8]/15",
          AVATAR_SIZE[size],
          className
        )}
        title={name}
        aria-hidden
      >
        <UsersRound className={size === "lg" ? "size-6" : size === "xs" ? "size-3" : "size-4"} />
      </span>
    );
  }
  return (
    <Avatar className={cn("shrink-0 ring-1 ring-black/5", AVATAR_SIZE[size], className)} title={name}>
      {person?.avatar_url && <AvatarImage src={person.avatar_url} alt="" />}
      <AvatarFallback className="bg-[#e8f1f5] font-semibold text-[#315f73]">{getInitials(name || "?")}</AvatarFallback>
    </Avatar>
  );
}

/** Foto + nome + linha de apoio (cargo, área). */
export function PersonLine({
  person,
  subtitle,
  size = "sm",
  className,
}: {
  person: PersonRef;
  subtitle?: ReactNode;
  size?: keyof typeof AVATAR_SIZE;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <PersonAvatar name={person.name} person={person.person} isTeam={person.isTeam} size={size} />
      <span className="min-w-0">
        <span className="block truncate font-medium text-foreground">{person.name}</span>
        {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
      </span>
    </span>
  );
}

/* --------------------------------------------------------------- categorias */

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "Uso consciente da sala de reunião": Presentation,
  "Uso consciente dos banheiros": Bath,
  "Cigarro eletrônico": CigaretteOff,
  "Local correto para fumar": Cigarette,
  "Saúde e comportamento no ambiente de trabalho": Thermometer,
  "Uso da cozinha": UtensilsCrossed,
  "Volume de conversas": Volume2,
  "Dress code": Shirt,
  "Organização do ambiente de trabalho": LampDesk,
  "Segurança e confidencialidade": ShieldCheck,
  "Recebimento de encomendas particulares": Package,
  Biblioteca: Library,
  "Uso e transporte de equipamentos do escritório": Laptop,
  "Local adequado para descanso": Sofa,
  "Luz, ar e equipamentos ligados ao sair": Lightbulb,
  Estacionamento: Car,
  Outros: Shapes,
};

export function getCategoryIcon(category: string): LucideIcon {
  return CATEGORY_ICONS[category] ?? Tag;
}

/** Só o ícone da categoria (createElement: o ícone é escolhido pelo nome, não criado no render). */
export function CategoryGlyph({ category, className }: { category: string; className?: string }) {
  return createElement(getCategoryIcon(category), { className, "aria-hidden": true });
}

export function CategoryIcon({ category, className }: { category: string; className?: string }) {
  return (
    <span
      className={cn("grid size-8 shrink-0 place-items-center rounded-md bg-[#eef6f8] text-[#285f7a]", className)}
      aria-hidden
    >
      <CategoryGlyph category={category} className="size-4" />
    </span>
  );
}

/* -------------------------------------------------------------------- áreas */

export function AreaGlyph({ area, className }: { area: string; className?: string }) {
  return createElement(getAreaIcon(area), { className, "aria-hidden": true });
}

export function AreaIconTile({ area, className }: { area: string; className?: string }) {
  return (
    <span className={cn("grid size-7 shrink-0 place-items-center rounded-md ring-1 ring-inset", getAreaIconStyle(area), className)} aria-hidden>
      <AreaGlyph area={area} className="size-3.5" />
    </span>
  );
}

export function AreaChip({ area, className }: { area: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        getAreaIconStyle(area),
        className
      )}
    >
      <AreaGlyph area={area} className="size-3 shrink-0" />
      <span className="truncate">{area}</span>
    </span>
  );
}
