"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, ClipboardList, Clock3, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";
import { conviteConferidoHaPouco, marcarConviteConferido } from "@/lib/convite-conferido";
import { ANSWER_PATH_PREFIX, SURVEY_BRAND_LOGOS, answerPath, formatSurveyDate, type SurveyBrand } from "@/lib/pesquisas/types";

const CHECKED_KEY = "pesquisas:convite-conferido";
const DISMISSED_KEY = "pesquisas:convite-adiado";

type PendingSurvey = {
  slug: string;
  title: string;
  brand: SurveyBrand | null;
  closes_at: string | null;
  anonymous: boolean;
  question_count: number;
};

function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function readStorage(storage: "local" | "session", key: string): string | null {
  try {
    return (storage === "local" ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage: "local" | "session", key: string, value: string) {
  try {
    (storage === "local" ? window.localStorage : window.sessionStorage).setItem(key, value);
  } catch {
    // Navegador sem armazenamento: o convite só volta a aparecer.
  }
}

/**
 * Convite das pesquisas com a equipe: enquanto uma pesquisa está aberta para a
 * área da pessoa e ela não respondeu, aparece uma vez por dia ao entrar.
 * Confere no servidor no máximo a cada 2 horas, em todas as abas (cada chamada
 * conta CPU na Vercel; ver convite-conferido.ts).
 */
export function TeamSurveyInvite() {
  const router = useRouter();
  const pathname = usePathname();
  const { profile } = useAuth();
  const profileId = profile?.id ?? null;
  const [survey, setSurvey] = useState<PendingSurvey | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!profileId) return;
    if (pathname.startsWith(`${ANSWER_PATH_PREFIX}/`)) return;
    if (readStorage("local", DISMISSED_KEY) === today()) return;
    const sessionKey = `${CHECKED_KEY}:${profileId}`;
    if (conviteConferidoHaPouco(sessionKey)) return;
    let cancelled = false;
    let timer: number | undefined;
    // Outro aviso aberto (BP Awards, RH): espera ele fechar para não empilhar modais.
    const showWhenFree = () => {
      if (cancelled) return;
      if (document.querySelector('[role="dialog"]')) {
        timer = window.setTimeout(showWhenFree, 1500);
        return;
      }
      setOpen(true);
    };
    void fetch("/api/pesquisas/convite", { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<{ surveys: PendingSurvey[] }>) : null))
      .then((data) => {
        if (cancelled || !data) return;
        marcarConviteConferido(sessionKey);
        const first = data.surveys[0];
        if (first) {
          setSurvey(first);
          timer = window.setTimeout(showWhenFree, 800);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // Só na entrada (pelo id: o perfil é recriado ao renovar a sessão): trocar de página não dispara de novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  if (!survey) return null;

  const postpone = () => {
    writeStorage("local", DISMISSED_KEY, today());
    setOpen(false);
  };
  const logo = survey.brand ? SURVEY_BRAND_LOGOS[survey.brand] : null;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : postpone())}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md" showCloseButton={false}>
        <div className="flex justify-center border-b border-[#e6eef0] bg-white px-6 py-6">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo.src} alt="Planejamento Estratégico 2027" width={logo.width} height={logo.height} className="h-16 w-auto" />
          ) : (
            <span className="flex size-14 items-center justify-center rounded-lg bg-[#e8f8f8] text-[#285f7a]">
              <ClipboardList className="size-7" aria-hidden />
            </span>
          )}
        </div>
        {survey.brand === "pe27" && <div className="h-0.5 bg-gradient-to-r from-transparent via-[#d5b371] to-transparent" aria-hidden />}
        <div className="space-y-3 px-6 pb-2 pt-5">
          <DialogTitle className="text-xl">Sua equipe quer te ouvir</DialogTitle>
          <DialogDescription className="text-[0.95rem] leading-6 text-foreground/80">{survey.title}</DialogDescription>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="size-4" aria-hidden />
              {survey.question_count} perguntas
            </span>
            {survey.anonymous && (
              <span className="inline-flex items-center gap-1.5">
                <EyeOff className="size-4" aria-hidden />
                Anônima
              </span>
            )}
            {survey.closes_at && <span>Até {formatSurveyDate(survey.closes_at, true)}</span>}
          </div>
        </div>
        <DialogFooter className="gap-2 px-6 pb-6 pt-4 sm:gap-2">
          <Button type="button" variant="outline" onClick={postpone}>
            Agora não
          </Button>
          <Button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push(answerPath(survey.slug));
            }}
          >
            Responder agora
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
