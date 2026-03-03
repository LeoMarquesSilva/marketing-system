"use client";

import Image from "next/image";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center bg-gradient-to-br from-[#101f2e] via-[#0d1a26] to-[#0a141c] relative overflow-hidden p-12">
        {/* Decorative circles */}
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-white/[0.03] blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-white/[0.03] blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center gap-8 text-center">
          <Image
            src="/LOGO HORIZONTAL AZUL.png"
            alt="Bismarchi Pires — Sociedade de Advogados"
            width={340}
            height={100}
            className="object-contain brightness-0 invert drop-shadow-[0_2px_12px_rgba(0,0,0,0.3)]"
            priority
          />
          <p className="text-sm text-white/40 max-w-xs leading-relaxed">
            Portal interno de gestão e acompanhamento de demandas de marketing.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white p-8">
        {/* Logo mobile (visible only on small screens) */}
        <div className="mb-8 lg:hidden">
          <Image
            src="/LOGO HORIZONTAL AZUL.png"
            alt="Bismarchi Pires"
            width={220}
            height={64}
            className="object-contain"
            priority
          />
        </div>

        <div className="w-full max-w-sm">
          <LoginForm />
        </div>

        <p className="mt-8 text-xs text-muted-foreground/50">
          © {new Date().getFullYear()} Bismarchi Pires — Uso interno
        </p>
      </div>
    </div>
  );
}
