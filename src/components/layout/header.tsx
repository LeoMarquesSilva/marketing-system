"use client";

import { usePathname } from "next/navigation";

type PageMeta = {
  label: string;
  section: string;
};

const PAGE_META: Record<string, PageMeta> = {
  "/": { label: "Dashboard", section: "Visão geral" },
  "/planner": { label: "Planner", section: "Operação" },
  "/nova-solicitacao": { label: "Nova solicitação", section: "Operação" },
  "/solicitacoes": { label: "Solicitações", section: "Operação" },
  "/conteudo/inicio": { label: "Conteúdo", section: "Conteúdo" },
  "/conteudo/roteiros": { label: "Conteúdo para posts", section: "Conteúdo" },
  "/conteudo/boletim": { label: "Newsletter", section: "Conteúdo" },
  "/conteudo/reels": { label: "Roteiros de Reels", section: "Conteúdo" },
  "/instagram-insights": { label: "Instagram Insights", section: "Performance" },
  "/linkedin-insights": { label: "LinkedIn Insights", section: "Performance" },
  "/trafego-pago": { label: "Tráfego pago", section: "Performance" },
  "/email-marketing": { label: "E-mail marketing", section: "Relacionamento" },
  "/nfc": { label: "NFC Hub", section: "Automações" },
  "/meus-clientes": { label: "Meus clientes", section: "Relacionamento" },
  "/clima": { label: "Clima", section: "Pessoas" },
  "/fotos-colaboradores": { label: "Fotos dos colaboradores", section: "Pessoas" },
  "/usuarios": { label: "Usuários", section: "Pessoas" },
  "/vios-tarefas": { label: "Tarefas VIOS", section: "Operação" },
  "/eventos": { label: "Eventos", section: "Eventos" },
  "/custos-projetos": { label: "Custos de projetos", section: "Gestão" },
  "/perfil": { label: "Meu perfil", section: "Conta" },
  "/admin": { label: "Configurações", section: "Administração" },
};

function getPageMeta(pathname: string): PageMeta {
  if (PAGE_META[pathname]) return PAGE_META[pathname];

  for (const [path, meta] of Object.entries(PAGE_META)) {
    if (path !== "/" && pathname.startsWith(`${path}/`)) return meta;
  }

  return { label: "Sistema de Marketing", section: "ORQESTRAI" };
}

export function Header() {
  const pathname = usePathname();
  const pageMeta = getPageMeta(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-black/[0.07] bg-white/95 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-white/90 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <span className="h-8 w-1 shrink-0 rounded-full bg-[#47cdd0]" aria-hidden />
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-[#347796]">{pageMeta.section}</p>
          <h1 className="truncate text-base font-semibold text-foreground sm:text-lg">
            {pageMeta.label}
          </h1>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
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
    </header>
  );
}
