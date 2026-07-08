"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ContentCollaboratorTour } from "@/components/conteudo/content-collaborator-tour";
import { TimerProvider } from "@/contexts/timer-context";
import { FloatingTimer } from "@/components/timer/floating-timer";

/** Telas sem chrome (sidebar/header) nem tour. */
const BARE_LAYOUT_PATHS = ["/login", "/alterar-senha"];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isBareLayout = BARE_LAYOUT_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  return (
    <AuthGuard>
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
          <Sidebar />
          {/* On mobile: no sidebar padding. On md+: pl-16 for fixed sidebar */}
          <div className="pl-0 md:pl-16">
            <Header />
            <main className="p-4 md:p-6">{children}</main>
          </div>
          <FloatingTimer />
        </TimerProvider>
      )}
    </AuthGuard>
  );
}
