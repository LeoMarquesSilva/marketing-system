"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";

export function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    const role = (profile?.role ?? "").toLowerCase();
    if (role !== "admin") {
      router.replace("/");
      return;
    }
  }, [loading, user, profile?.role, router]);

  if (loading || !user || (profile?.role ?? "").toLowerCase() !== "admin") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Carregando...</p>
      </div>
    );
  }

  return <>{children}</>;
}
