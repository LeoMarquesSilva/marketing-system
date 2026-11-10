"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";
import { FESTA_10_ANOS_PATH, formatRsvpDeadline } from "@/lib/event-rsvp";

const CHECKED_KEY = "festa-10-anos:convite-conferido";
const DISMISSED_KEY = "festa-10-anos:convite-adiado";

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
    // Navegador sem armazenamento: o aviso só volta a aparecer.
  }
}

/**
 * Aviso da festa de 10 anos: enquanto a confirmação está aberta e a pessoa da
 * equipe não respondeu, aparece uma vez por dia ao entrar no sistema.
 * Confere uma vez por sessão do navegador (cada chamada conta CPU na Vercel).
 */
export function FestaRsvpInvite() {
  const router = useRouter();
  const pathname = usePathname();
  const { profile } = useAuth();
  const [closesAt, setClosesAt] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;
    if (pathname.startsWith(FESTA_10_ANOS_PATH)) return;
    if (readStorage("local", DISMISSED_KEY) === today()) return;
    const sessionKey = `${CHECKED_KEY}:${profile.id}`;
    if (readStorage("session", sessionKey)) return;
    let cancelled = false;
    let timer: number | undefined;
    // Outro aviso aberto (pesquisa, BP Awards, RH): espera ele fechar para não empilhar modais.
    const showWhenFree = () => {
      if (cancelled) return;
      if (document.querySelector('[role="dialog"]')) {
        timer = window.setTimeout(showWhenFree, 1500);
        return;
      }
      setOpen(true);
    };
    void fetch(`/api${FESTA_10_ANOS_PATH}?convite=1`, { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<{ pending: boolean; closesAt: string | null }>) : null))
      .then((data) => {
        if (cancelled || !data) return;
        writeStorage("session", sessionKey, "1");
        if (data.pending) {
          setClosesAt(data.closesAt);
          timer = window.setTimeout(showWhenFree, 1000);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // Só na entrada: trocar de página não dispara de novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const postpone = () => {
    writeStorage("local", DISMISSED_KEY, today());
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : postpone())}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md" showCloseButton={false}>
        <div className="flex justify-center bg-[#fbf8f2] bg-[radial-gradient(ellipse_at_top_left,#f3e7d3_0%,transparent_60%)] px-6 pb-5 pt-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/dress-code/10-anos/logo-10-anos.png"
            alt="Bismarchi | Pires — 10 anos"
            width={640}
            height={527}
            className="h-20 w-auto"
          />
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-[#cfab68] to-transparent" aria-hidden />
        <div className="space-y-3 px-6 pb-2 pt-5">
          <DialogTitle className="text-xl">A festa de 10 anos está chegando!</DialogTitle>
          <DialogDescription className="text-[0.95rem] leading-6 text-foreground/80">
            Confirme sua presença{closesAt ? ` até ${formatRsvpDeadline(closesAt)}` : ""} e diga se vai precisar do
            micro-ônibus do escritório. Leva menos de um minuto.
          </DialogDescription>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden />
              17/12, às 18h
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden />
              Fazenda Santa Margarida
            </span>
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
              router.push(FESTA_10_ANOS_PATH);
            }}
          >
            Responder
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
