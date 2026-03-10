"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/utils/supabase/client";
import type { AppSettings } from "@/lib/app-settings";
import { AdminClient } from "./admin-client";

export function AdminPageGate() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

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
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setSettingsError("Sessão expirada. Faça login novamente.");
        return;
      }
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: session.access_token,
          refreshToken: session.refresh_token ?? undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSettingsError(data.error ?? "Erro ao carregar configurações.");
        return;
      }
      const data = await res.json();
      setSettings(data as AppSettings);
    })().catch(() => setSettingsError("Erro ao carregar configurações."));
  }, [loading, user, profile?.role, router]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Carregando...</p>
      </div>
    );
  }

  if (!user || (profile?.role ?? "").toLowerCase() !== "admin") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Redirecionando...</p>
      </div>
    );
  }

  if (settingsError) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Configurações</h1>
        <p className="text-destructive">{settingsError}</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Configurações
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Workflow do Kanban, abas do Planner e tipos de conclusão.
        </p>
      </div>
      <AdminClient initialSettings={settings} />
    </div>
  );
}
