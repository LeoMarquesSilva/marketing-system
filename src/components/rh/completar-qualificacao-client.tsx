"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { QualificacaoForm } from "@/components/rh/qualificacao-form";
import { Button } from "@/components/ui/button";
import type { HrQualification } from "@/lib/rh/qualifications/types";

export function CompletarQualificacaoClient() {
  const { profile, refreshProfile } = useAuth();
  const [qualification, setQualification] = useState<HrQualification | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadQualification = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/rh/qualificacoes/me");
      if (!response.ok) throw new Error("Falha ao carregar");
      const data = (await response.json()) as {
        qualification: HrQualification | null;
      };
      setQualification(data.qualification);
    } catch {
      setLoadError("Não foi possível carregar o formulário. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQualification();
  }, []);

  const handleSaved = async (saved: HrQualification) => {
    if (saved.status !== "completo") return;
    await refreshProfile();
    window.location.replace("/");
  };

  return (
    <main className="min-h-screen bg-[#f4f8f9] px-4 py-8 sm:px-6 lg:py-12">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8 flex flex-col gap-5 border-b border-[#dce9eb] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/ORQESTRAI/identidade-visual/logos/orquestrai-logo-horizontal-color.svg"
              alt="ORQESTRAI"
              className="mb-6 h-9 w-auto"
            />
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#3e84a8]">
              <ShieldCheck className="h-4 w-4" />
              Pendência cadastral
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Complete sua qualificação
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Estes dados são necessários para documentos jurídicos e ficam
              disponíveis somente para você e para o RH. Após concluir, seu
              acesso ao sistema será liberado automaticamente.
            </p>
          </div>
        </div>

        <section className="rounded-2xl border border-[#dce9eb] bg-white p-5 shadow-[0_12px_36px_rgba(3,32,47,0.07)] sm:p-8">
          {loading ? (
            <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando seus dados...
            </div>
          ) : loadError ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
              <p className="text-sm text-destructive">{loadError}</p>
              <Button type="button" variant="outline" onClick={loadQualification}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <QualificacaoForm
              initial={qualification}
              fallbackName={profile?.name ?? ""}
              onSaved={handleSaved}
            />
          )}
        </section>
      </div>
    </main>
  );
}
