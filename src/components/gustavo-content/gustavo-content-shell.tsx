"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { GustavoMemberRole } from "@/lib/gustavo-content/access";
import { NovaPautaButton } from "@/components/gustavo-content/nova-pauta";

const TABS = [
  { href: "/conteudo/gustavo", label: "Visão geral", exact: true },
  { href: "/conteudo/gustavo/radar", label: "Radar" },
  { href: "/conteudo/gustavo/producao", label: "Produção" },
  { href: "/conteudo/gustavo/teses", label: "Teses" },
  { href: "/conteudo/gustavo/voz", label: "Voz" },
  { href: "/conteudo/gustavo/historico", label: "Histórico" },
] as const;

export function GustavoContentShell({
  actorName,
  isAdmin,
  memberRole,
  children,
}: {
  actorName: string;
  isAdmin: boolean;
  memberRole: GustavoMemberRole | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const firstName = actorName.split(" ")[0] ?? actorName;
  const roleLabel = isAdmin ? "Admin" : memberRole === "owner" ? "Gustavo" : "Editor";

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12">
      <header className="space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#347796]">
          Thought leadership
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-[#04202f] sm:text-[2rem]">
              Posicionamento Gustavo
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              A notícia é matéria-prima. Aqui o sistema identifica o problema
              empresarial, cruza com as teses do Gustavo e transforma opinião
              real em autoridade — não em resumo de jornal.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <NovaPautaButton />
            <p className="text-xs text-muted-foreground">
              {firstName}
              <span className="mx-1.5 text-black/20">·</span>
              {roleLabel}
            </p>
          </div>
        </div>

        <nav
          aria-label="Seções do posicionamento"
          className="flex gap-1 overflow-x-auto border-b border-black/[0.06] pb-px"
        >
          {TABS.map((tab) => {
            const exact = "exact" in tab && tab.exact;
            const active = exact
              ? pathname === tab.href
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "relative shrink-0 px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "font-medium text-[#04202f]"
                    : "text-muted-foreground hover:text-[#04202f]"
                )}
              >
                {tab.label}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#47cdd0]"
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </header>
      {children}
    </div>
  );
}
