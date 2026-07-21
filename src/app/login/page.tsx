"use client";

import Image from "next/image";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand */}
      <div className="relative hidden overflow-hidden border-r border-white/10 bg-[#03111c] p-12 lg:flex lg:w-1/2 lg:flex-col lg:items-center lg:justify-center">
        <Image
          src="/ORQESTRAI/identidade-visual/logos/orquestrai-symbol-white.svg"
          alt=""
          width={460}
          height={460}
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 -right-28 h-[28rem] w-[28rem] object-contain opacity-[0.035]"
        />

        <div className="relative z-10 flex flex-col items-center gap-8 text-center">
          <Image
            src="/ORQESTRAI/identidade-visual/logos/orquestrai-logo-vertical-color.svg"
            alt="ORQESTRAI"
            width={220}
            height={220}
            className="object-contain drop-shadow-[0_2px_20px_rgba(71,205,208,0.15)]"
            priority
          />
          <div className="space-y-2 max-w-xs">
            <p className="font-brand text-base text-white/90 leading-snug">
              Acesse notícias da sua área, revise posts em carrossel e aprove conteúdos para redes sociais.
            </p>
            <p className="text-[11px] uppercase tracking-[0.15em] text-white/35">by Bismarchi Pires</p>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center bg-white px-5 py-8 sm:p-8">
        {/* Logo mobile (visible only on small screens) */}
        <div className="mb-8 lg:hidden">
          <Image
            src="/ORQESTRAI/identidade-visual/logos/orquestrai-logo-horizontal-ai-color.svg"
            alt="ORQESTRAI"
            width={220}
            height={64}
            className="object-contain"
            priority
          />
        </div>

        <div className="w-full max-w-sm">
          <Suspense fallback={<div className="text-sm text-muted-foreground animate-pulse">Carregando...</div>}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-8 max-w-full text-center text-xs leading-relaxed text-muted-foreground/50">
          © {new Date().getFullYear()} ORQESTRAI — by Bismarchi Pires · Uso interno
        </p>
      </div>
    </div>
  );
}
