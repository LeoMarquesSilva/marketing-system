"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ExternalLink, KeyRound, Loader2, PartyPopper } from "lucide-react";
import { AudienceIcon, audienceIconStyle, ToolLogo } from "@/components/rh/registration/welcome-ui";
import { toolLogoFor } from "@/lib/rh/welcome/tool-logos";
import type { MyWelcomeLinks, WelcomeLink } from "@/lib/rh/welcome/types";
import { cn } from "@/lib/utils";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function LinkCard({ link }: { link: WelcomeLink }) {
  return (
    <div className="flex flex-col rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <a href={link.url} target="_blank" rel="noreferrer" className="group flex items-start gap-3">
        <ToolLogo url={link.url} size={44} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 font-semibold text-foreground group-hover:text-[#285f7a]">
            {link.title}
            <ExternalLink className="size-3.5 shrink-0 opacity-50" aria-hidden />
          </span>
          {link.description && <span className="mt-0.5 block text-sm text-muted-foreground">{link.description}</span>}
          <span className="mt-1 block truncate text-xs text-muted-foreground/80">
            {toolLogoFor(link.url)?.name ?? hostOf(link.url)}
          </span>
        </span>
      </a>
      {link.internalNote && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <KeyRound className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {link.internalNote}
        </p>
      )}
    </div>
  );
}

/**
 * Boas-vindas de quem acabou de entrar (primeiro acesso ou onboarding concluído
 * há pouco). Texto-base da Isadora e da Catharina, que antes iria no e-mail.
 */
function WelcomeIntro({ firstName, justCreated }: { firstName: string | null; justCreated: boolean }) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="bg-[#0D1E2E] px-6 py-7 sm:px-8">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#E1B16D]">
          <PartyPopper className="size-4" aria-hidden />
          {justCreated ? "Senha criada. " : ""}
          {firstName ? `Olá, ${firstName}!` : "Olá!"}
        </p>
        <h1 className="mt-2 text-2xl font-light lowercase tracking-wide text-white sm:text-3xl">
          seja muito bem-vindo(a) ao time bismarchi | pires
        </h1>
      </div>
      <div className="space-y-3 px-6 py-5 text-sm leading-relaxed text-muted-foreground sm:px-8">
        <p>
          Para apoiar seu início no escritório, reunimos aqui os{" "}
          <strong className="font-semibold text-foreground">links e ferramentas importantes para a sua rotina</strong>,
          de acordo com a sua área. Durante a integração, apresentamos cada ferramenta e as suas funcionalidades.
        </p>
        <p>
          Esta página fica sempre atualizada por Pessoas e Cultura. Para voltar a ela, use o menu do seu perfil, em{" "}
          <strong className="font-semibold text-foreground">Meus links</strong>.
        </p>
        <p className="text-foreground">
          Desejamos a você uma excelente jornada no time Bismarchi | Pires, com muito aprendizado, desenvolvimento e novas conquistas!{" "}
          <span className="font-semibold text-[#9C7434]">#SomosÚnicos</span>
        </p>
      </div>
    </section>
  );
}

function MeusLinksContent() {
  const welcome = useSearchParams().get("boas-vindas") === "1";
  const [data, setData] = useState<MyWelcomeLinks | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/meus-links", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (cancelled) return;
        if (!response.ok) setError(body?.error ?? "Não foi possível carregar os links.");
        else setData(body as MyWelcomeLinks);
      })
      .catch(() => !cancelled && setError("Não foi possível carregar os links."));
    return () => {
      cancelled = true;
    };
  }, []);

  const total = data?.groups.reduce((sum, group) => sum + group.links.length, 0) ?? 0;
  const showWelcome = !!data && (welcome || data.recentWelcome);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {showWelcome ? (
        <WelcomeIntro firstName={data.firstName} justCreated={welcome} />
      ) : (
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meus links</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {data?.firstName ? `Olá, ${data.firstName}. ` : ""}Os links e ferramentas da sua rotina, de acordo com a sua
            área. Pessoas e Cultura mantém esta lista atualizada.
          </p>
        </div>
      )}

      {!data && !error && (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {data && total === 0 && (
        <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
          Ainda não há links para a sua área.
        </p>
      )}

      {data?.groups.map((group) => (
        <section key={group.key} className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <span className={cn("rounded-md p-1.5 ring-1", audienceIconStyle(group.key))}>
              <AudienceIcon audience={group.key} className="size-3.5" />
            </span>
            {group.label}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {group.links.map((link) => (
              <LinkCard key={link.id} link={link} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function MeusLinksPage() {
  return (
    <Suspense fallback={null}>
      <MeusLinksContent />
    </Suspense>
  );
}
