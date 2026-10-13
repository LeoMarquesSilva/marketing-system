"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { buildNav, resolveHeaderContext } from "@/lib/navigation";
import { NavBadgePill, useNavBadges } from "@/components/layout/nav-badges";

export function Header() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const badgeFor = useNavBadges();
  const nav = useMemo(() => buildNav(profile), [profile]);
  const { eyebrow, title, icon: Icon, tabs, activeHref } = resolveHeaderContext(pathname, nav);

  return (
    <header className="sticky top-0 z-30 border-b border-black/[0.07] bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/90">
      <div className="flex flex-wrap items-stretch gap-x-5 px-4 sm:px-6">
        <div className="flex h-16 min-w-0 flex-1 items-center gap-3 lg:flex-initial">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#47cdd0]/15 text-[#347796]"
            aria-hidden
          >
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-[#347796]">{eyebrow}</p>
            <h1 className="truncate text-base font-semibold text-foreground sm:text-lg">{title}</h1>
          </div>
        </div>

        {tabs.length > 1 && (
          <nav
            aria-label={`Páginas de ${title}`}
            className={cn(
              "order-last -mx-4 flex w-[calc(100%+2rem)] items-stretch gap-1 overflow-x-auto border-t border-black/[0.05] px-2.5 sm:-mx-6 sm:w-[calc(100%+3rem)] sm:px-4",
              "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              "lg:order-none lg:mx-0 lg:w-auto lg:min-w-0 lg:flex-1 lg:border-t-0 lg:px-0"
            )}
          >
            <span className="mr-2 hidden h-6 w-px shrink-0 self-center bg-black/[0.08] lg:block" aria-hidden />
            {tabs.map((tab) => {
              const active = tab.href === activeHref;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium outline-none transition-colors lg:h-16",
                    "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#47cdd0]",
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                  <NavBadgePill badge={badgeFor(tab.href)} variant="count" />
                  {active && (
                    <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-t-sm bg-[#347796]" aria-hidden />
                  )}
                </Link>
              );
            })}
          </nav>
        )}

        <div className="ml-auto flex h-16 shrink-0 items-center gap-3">
          <span className="hidden h-6 w-px bg-black/[0.08] sm:block" aria-hidden />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ORQESTRAI/identidade-visual/logos/orquestrai-logo-horizontal-ai-color.svg"
            alt="ORQESTRAI"
            className="hidden h-6 w-auto select-none object-contain sm:block"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ORQESTRAI/identidade-visual/logos/orquestrai-symbol-dark.svg"
            alt="ORQESTRAI"
            className="h-7 w-7 select-none object-contain sm:hidden"
          />
        </div>
      </div>
    </header>
  );
}
