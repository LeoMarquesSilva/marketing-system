import type { ReactNode } from "react";
import Link from "next/link";

const BASE = "/operacoes-legais/vistagem";

const nav = [
  { href: BASE, label: "Central" },
  { href: `${BASE}/controladoria`, label: "Controladoria" },
  { href: `${BASE}/juridico`, label: "Jurídico" },
  { href: `${BASE}/prazos`, label: "Prazos" },
  { href: `${BASE}/catalogo`, label: "Catálogo VIOS" },
  { href: `${BASE}/jobs`, label: "Jobs" },
];

export function VistagemShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#c9a227]/30 bg-[#0b1c2c] text-zinc-100">
      <header className="border-b border-[#c9a227]/30 bg-[#10263a]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <Link
              href="/operacoes-legais"
              className="text-xs tracking-[0.2em] text-[#c9a227] hover:underline"
            >
              BP · LEGAL OPS
            </Link>
            <h1 className="font-serif text-xl text-white">{title}</h1>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md border border-white/10 px-3 py-1.5 text-zinc-200 hover:border-[#c9a227]/60 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <div className="px-4 py-6">{children}</div>
    </div>
  );
}
