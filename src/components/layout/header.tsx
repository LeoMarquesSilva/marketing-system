"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useEffect, Suspense } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PAGE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/planner": "Planner",
  "/nova-solicitacao": "Nova Solicitação",
  "/solicitacoes": "Solicitações",
  "/vincular-solicitantes": "Vincular Solicitantes",
  "/usuarios": "Usuários",
  "/perfil": "Meu Perfil",
};

function getPageLabel(pathname: string): string {
  if (PAGE_LABELS[pathname]) return PAGE_LABELS[pathname];
  // Match prefix (e.g. /solicitacoes/123)
  for (const [path, label] of Object.entries(PAGE_LABELS)) {
    if (path !== "/" && pathname.startsWith(path)) return label;
  }
  return "Sistema de Marketing";
}

const SEARCHABLE_PAGES = ["/solicitacoes", "/planner", "/usuarios"];

function HeaderInner() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pageLabel = getPageLabel(pathname);

  const isSearchable = SEARCHABLE_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const [search, setSearch] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    setSearch(searchParams.get("q") ?? "");
  }, [searchParams]);

  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value);
      const trimmed = value.trim();
      if (isSearchable) {
        const params = new URLSearchParams(searchParams.toString());
        if (trimmed) params.set("q", trimmed);
        else params.delete("q");
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      } else if (trimmed) {
        router.push(`/solicitacoes?q=${encodeURIComponent(trimmed)}`);
      }
    },
    [pathname, router, searchParams, isSearchable]
  );

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleSearch(search);
      }
    },
    [handleSearch, search]
  );

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center justify-between gap-6 px-6",
        "border-b border-black/[0.06] dark:border-white/[0.06]",
        "bg-white/80 dark:bg-background/80 backdrop-blur-xl",
        "supports-[backdrop-filter]:bg-white/70"
      )}
    >
      {/* Page title */}
      <div className="shrink-0">
        <h1 className="text-sm font-semibold text-foreground tracking-tight">
          {pageLabel}
        </h1>
      </div>

      {/* Search — global: em páginas buscáveis atualiza ?q=; em outras, Enter leva a /solicitacoes?q= */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" aria-hidden />
        <Input
          placeholder={isSearchable ? `Buscar em ${pageLabel.toLowerCase()}...` : "Buscar no sistema..."}
          value={search}
          onChange={(e) => (isSearchable ? handleSearch(e.target.value) : setSearch(e.target.value))}
          onKeyDown={handleSearchKeyDown}
          className={cn(
            "pl-8 h-8 text-sm",
            "rounded-xl border-black/10 dark:border-white/10",
            "bg-black/[0.03] dark:bg-white/[0.04]",
            "placeholder:text-muted-foreground/50",
            "focus-visible:ring-[#101f2e]/20 focus-visible:border-[#101f2e]/30"
          )}
        />
      </div>

      {/* Logo horizontal — âncora direita */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/LOGO HORIZONTAL AZUL.png"
        alt="Bismarchi Pires — Sociedade de Advogados"
        className="h-6 w-auto object-contain select-none shrink-0 opacity-80 hover:opacity-100 transition-opacity"
      />
    </header>
  );
}

export function Header() {
  return (
    <Suspense fallback={null}>
      <HeaderInner />
    </Suspense>
  );
}
