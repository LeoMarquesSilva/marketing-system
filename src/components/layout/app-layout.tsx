"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MotionConfig } from "framer-motion";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ContentCollaboratorTour } from "@/components/conteudo/content-collaborator-tour";
import { TimerProvider } from "@/contexts/timer-context";
import { FloatingTimer } from "@/components/timer/floating-timer";

/** Telas sem chrome (sidebar/header) nem tour. */
const BARE_LAYOUT_PATHS = [
  "/login",
  "/alterar-senha",
  "/completar-qualificacao",
  "/t",
  "/nps",
];

function isBareLayoutPath(pathname: string): boolean {
  if (BARE_LAYOUT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  // Perfil profissional público NFC — sem shell do ORQESTRAI.
  return /^\/perfil\/[^/]+(?:\/contato)?\/?$/.test(pathname);
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const isBareLayout = isBareLayoutPath(pathname);

  const handleSidebarExpandedChange = (expanded: boolean) => {
    setSidebarExpanded(expanded);
  };

  return (
    <AuthGuard>
      <MotionConfig reducedMotion="user">
        {/* Tour só no app autenticado com senha já definida — nunca em /alterar-senha. */}
        {!isBareLayout && (
          <Suspense fallback={null}>
            <ContentCollaboratorTour />
          </Suspense>
        )}
        {isBareLayout ? (
          children
        ) : (
          <TimerProvider>
            <Sidebar
              expanded={sidebarExpanded}
              onExpandedChange={handleSidebarExpandedChange}
            />
            <div
              className="relative min-h-screen pl-0 md:pl-[var(--app-sidebar-width)]"
              style={
                {
                  "--app-sidebar-width": "72px",
                } as React.CSSProperties
              }
            >
              <Header />
              <main className="relative isolate min-h-[calc(100vh-3.5rem)] overflow-hidden p-4 pb-20 md:p-6">
                <div
                  className="pointer-events-none fixed bottom-5 right-5 z-0 hidden select-none opacity-[0.055] lg:block"
                  aria-hidden="true"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/ORQESTRAI/identidade-visual/logos/orquestrai-symbol-dark.svg"
                    alt=""
                    className="h-28 w-28 object-contain"
                  />
                </div>
                <div className="relative z-10">{children}</div>
              </main>
            </div>
            <FloatingTimer />
          </TimerProvider>
        )}
      </MotionConfig>
    </AuthGuard>
  );
}
