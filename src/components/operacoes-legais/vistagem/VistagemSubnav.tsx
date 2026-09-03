"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Building2,
  CalendarClock,
  LayoutDashboard,
  Scale,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = "/operacoes-legais/vistagem";

export const VISTAGEM_SUBNAV_ITEMS = [
  { href: BASE, label: "Central", icon: LayoutDashboard, exact: true },
  { href: `${BASE}/controladoria`, label: "Controladoria", icon: Building2 },
  { href: `${BASE}/juridico`, label: "Jurídico", icon: Scale },
  { href: `${BASE}/prazos`, label: "Prazos", icon: CalendarClock },
  { href: `${BASE}/catalogo`, label: "Catálogo VIOS", icon: BookOpen },
  { href: `${BASE}/jobs`, label: "Jobs", icon: Workflow },
];

export function VistagemSubnav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegação da vistagem"
      className="flex gap-1 overflow-x-auto border-b border-[#dce9eb] pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {VISTAGEM_SUBNAV_ITEMS.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-h-11 shrink-0 items-center gap-2 px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
              active ? "text-[#285f7a]" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4" aria-hidden />
            {item.label}
            {active && <span className="absolute inset-x-2 bottom-[-1px] h-0.5 bg-[#347796]" />}
          </Link>
        );
      })}
    </nav>
  );
}
