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
    <div className="gustavo-editorial editorial-surface relative -mx-3 min-h-[calc(100dvh-5rem)] overflow-hidden rounded-t-[1.75rem] px-4 pb-16 pt-7 sm:-mx-5 sm:px-7 lg:px-10">
      <div className="mx-auto max-w-[1380px] space-y-8">
        <header className="space-y-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl border-l-2 border-[#47cdd0] pl-5">
              <p className="editorial-kicker font-mono text-[11px] font-semibold uppercase text-[#347796]">
                Mesa editorial · thought leadership
              </p>
              <h2 className="editorial-display mt-3 text-[2.35rem] font-semibold leading-[0.96] text-[#04202f] sm:text-[3rem]">
                Posicionamento Gustavo
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-[#36535f] sm:text-[0.95rem]">
                Da evidência à leitura empresarial. O sistema conecta fatos, teses e a voz real
                do Gustavo antes de escrever qualquer conteúdo.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              <div className="rounded-lg bg-[#04202f]/[0.055] px-3 py-2 text-xs text-[#36535f]">
                <span className="font-semibold text-[#04202f]">{firstName}</span>
                <span className="mx-1.5 text-[#04202f]/20">/</span>
                {roleLabel}
              </div>
              <NovaPautaButton />
            </div>
          </div>

          <nav
            aria-label="Seções do posicionamento"
            className="flex gap-1 overflow-x-auto rounded-xl bg-[#04202f]/[0.045] p-1.5"
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
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#347796]",
                    active
                      ? "bg-white text-[#04202f] shadow-[0_8px_24px_rgba(4,32,47,0.08)]"
                      : "text-[#56707a] hover:bg-white/60 hover:text-[#04202f]"
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
