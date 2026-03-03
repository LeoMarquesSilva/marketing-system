"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { ProfileForm } from "@/components/perfil/profile-form";
import { ChangePasswordForm } from "@/components/perfil/change-password-form";
import { useRouter } from "next/navigation";

export default function PerfilPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !loading && !profile) {
      router.replace("/login");
    }
  }, [mounted, loading, profile, router]);

  if (loading || !profile) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Meu Perfil</h2>
          <p className="text-sm text-muted-foreground mt-1">Ajuste suas informações pessoais</p>
        </div>
        <div className="rounded-2xl border border-white/40 bg-white/70 backdrop-blur-sm p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)]">
          <p className="text-center text-sm text-muted-foreground py-8">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Meu Perfil</h2>
        <p className="text-sm text-muted-foreground mt-1">Ajuste suas informações pessoais</p>
      </div>

      <div className="rounded-2xl border border-white/40 bg-white/70 backdrop-blur-sm p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] space-y-1">
        <p className="text-sm font-semibold text-foreground">Informações do usuário</p>
        <p className="text-xs text-muted-foreground mb-4">Atualize seu nome, e-mail, foto e departamento</p>
        <ProfileForm profile={profile} />
      </div>

      <ChangePasswordForm />
    </div>
  );
}
