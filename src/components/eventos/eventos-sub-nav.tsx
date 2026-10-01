"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarRange, TrendingUp, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

const SUB_NAV_ITEMS = [
  { href: "/eventos", label: "Visão geral", icon: CalendarRange },
  { href: "/eventos/planejamento", label: "Planejamento anual", icon: TrendingUp },
  { href: "/eventos/prestadores", label: "Prestadores", icon: Truck },
];

export function EventosSubNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-1 border-b border-border/60">
      {SUB_NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/eventos"
            ? pathname === "/eventos"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            aria-current={isActive ? "page" : undefined}
            href={item.href}
            className={cn(
              "inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
