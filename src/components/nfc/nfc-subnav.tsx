"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, LayoutDashboard, RadioTower, Shapes } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/nfc", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { href: "/nfc/tags", label: "Etiquetas", icon: RadioTower },
  { href: "/nfc/logs", label: "Logs", icon: Activity },
  { href: "/nfc/modelos", label: "Modelos", icon: Shapes },
];

export function NfcSubnav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegação do NFC Hub"
      className="flex gap-1 overflow-x-auto border-b border-[#dce9eb] pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
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

