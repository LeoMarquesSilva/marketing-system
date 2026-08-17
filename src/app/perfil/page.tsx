"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { ProfileForm } from "@/components/perfil/profile-form";
import { ChangePasswordForm } from "@/components/perfil/change-password-form";
import { QualificacaoForm } from "@/components/rh/qualificacao-form";
import { useRouter } from "next/navigation";
import type { HrQualification } from "@/lib/rh/qualifications/types";
import { IdCard, ShieldCheck, User } from "lucide-react";
import { resolveCanonicalAreaLabel } from "@/lib/ferias/filters";
import { cn } from "@/lib/utils";

type TabId = "conta" | "qualificacao";

export default function PerfilPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("conta");
  const [qualification, setQualification] = useState<HrQualification | null>(null);
  const [qualLoading, setQualLoading] = useState(false);
  const [qualLoaded, setQualLoaded] = useState(false);

  useEffect(() => {
    if (!loading && !profile) {
      router.replace("/login");
    }
  }, [loading, profile, router]);

  const openQualificationTab = async () => {
    setTab("qualificacao");
    if (qualLoaded || !profile) return;
    setQualLoading(true);
    try {
      const res = await fetch("/api/rh/qualificacoes/me");
      if (!res.ok) throw new Error("fail");
      const data = await res.json();
      setQualification(data.qualification ?? null);
      setQualLoaded(true);
    } catch {
      setQualification(null);
      setQualLoaded(true);
    } finally {
      setQualLoading(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <div className="h-44 animate-pulse rounded-2xl bg-muted" />
        <div className="h-14 w-72 animate-pulse rounded-xl bg-muted" />
        <div className="h-96 animate-pulse rounded-2xl bg-muted">
          <p className="sr-only">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  const canonicalArea =
    resolveCanonicalAreaLabel(profile.department) ?? "Sem área";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-[#0d4253] bg-[#04202f] px-6 py-7 text-white shadow-[0_18px_48px_rgba(3,32,47,0.18)] sm:px-8">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[#47cdd0]/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#47cdd0]">
              Conta e cadastro
            </p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Meu Perfil
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-white/65">
              Gerencie seus dados de acesso e mantenha sua qualificação
              jurídica atualizada para os documentos do escritório.
            </p>
          </div>
          <div className="grid min-w-0 gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm sm:min-w-72">
            <p className="truncate font-semibold text-white">{profile.name}</p>
            <p className="truncate text-xs text-white/55">
              {profile.email || "E-mail não informado"}
            </p>
            <p className="mt-1 text-xs font-medium text-[#47cdd0]">
              {canonicalArea}
            </p>
          </div>
        </div>
      </header>

      <div
        className="inline-flex w-full flex-col gap-1 rounded-xl border border-[#dce9eb] bg-card p-1.5 shadow-[0_4px_16px_rgba(3,32,47,0.05)] sm:w-auto sm:flex-row"
        role="tablist"
        aria-label="Seções do perfil"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "conta"}
          onClick={() => setTab("conta")}
          className={cn(
            "flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
            tab === "conta"
              ? "bg-[#04202f] text-white shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <User className="h-4 w-4" />
          Dados da conta
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "qualificacao"}
          onClick={() => void openQualificationTab()}
          className={cn(
            "flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
            tab === "qualificacao"
              ? "bg-[#04202f] text-white shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <IdCard className="h-4 w-4" />
          Qualificação
        </button>
      </div>

      {tab === "conta" && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
          <section className="rounded-2xl border border-[#dce9eb] bg-card p-5 shadow-[0_8px_28px_rgba(3,32,47,0.05)] sm:p-7">
            <div className="mb-6 border-b border-[#e7eff0] pb-5">
              <h2 className="text-lg font-semibold text-foreground">
                Informações pessoais
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Atualize sua identificação, foto e área de atuação.
              </p>
            </div>
            <ProfileForm profile={profile} />
          </section>
          <aside className="space-y-4">
            <div className="rounded-xl border border-[#bfeaec] bg-[#eefdfe] p-4 text-sm text-[#174f58]">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#258b91]" />
                <div>
                  <p className="font-semibold">Segurança da conta</p>
                  <p className="mt-1 text-xs leading-relaxed text-[#174f58]/75">
                    Use uma senha exclusiva e evite compartilhá-la com outras
                    pessoas.
                  </p>
                </div>
              </div>
            </div>
            <ChangePasswordForm />
          </aside>
        </div>
      )}

      {tab === "qualificacao" && (
        <section className="w-full">
          <div className="mb-5 flex flex-col gap-2 rounded-xl border border-[#dce9eb] bg-card px-5 py-4 shadow-[0_4px_16px_rgba(3,32,47,0.04)] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Qualificação jurídica
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Dados restritos, visíveis somente para você e para o RH.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-[#258b91]">
              <ShieldCheck className="h-4 w-4" />
              Dados protegidos
            </div>
          </div>
          {qualLoading ? (
            <div className="h-96 animate-pulse rounded-2xl bg-muted" />
          ) : (
            <QualificacaoForm initial={qualification} fallbackName={profile.name} />
          )}
        </section>
      )}
    </div>
  );
}
