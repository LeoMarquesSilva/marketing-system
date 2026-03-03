"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AuthGuard } from "@/components/auth/auth-guard";
import { TimerProvider } from "@/contexts/timer-context";
import { FloatingTimer } from "@/components/timer/floating-timer";

const PUBLIC_PATHS = ["/login"];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  return (
    <AuthGuard>
      {isLogin ? (
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
