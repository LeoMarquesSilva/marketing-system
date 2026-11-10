"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";
import { formatAwardDateTime } from "@/lib/rh/bp-awards/format";
import { AWARDS_LOGO_SRC, AWARDS_VOTING_PATH, type AwardInviteStatus } from "@/lib/rh/bp-awards/types";

const CHECKED_KEY = "bp-awards:convite-conferido";
const DISMISSED_KEY = "bp-awards:convite-adiado";

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
 * Convite do BP Awards: enquanto a votação está aberta e o colaborador não
 * enviou, aparece uma vez por dia ao entrar no sistema. Confere o status uma
 * vez por sessão do navegador (cada chamada conta CPU na Vercel).
 */
export function BpAwardsInvite() {
  const router = useRouter();
  const { profile } = useAuth();
  const [status, setStatus] = useState<AwardInviteStatus | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;
    if (readStorage("local", DISMISSED_KEY) === today()) return;
    const sessionKey = `${CHECKED_KEY}:${profile.id}`;
    if (readStorage("session", sessionKey)) return;
    let cancelled = false;
    void fetch("/api/bp-awards/status", { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<AwardInviteStatus>) : null))
      .then((data) => {
        if (cancelled || !data) return;
        writeStorage("session", sessionKey, "1");
        if (data.pending) {
          setStatus(data);
          setOpen(true);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [profile]);

  if (!status) return null;

  const postpone = () => {
    writeStorage("local", DISMISSED_KEY, today());
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : postpone())}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md" showCloseButton={false}>
        <div className="flex justify-center bg-[#0f1f2e] bg-[url('/bp-awards/fundo-awards.webp')] bg-cover bg-center px-6 py-7">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={AWARDS_LOGO_SRC} alt="Bismarchi | Pires Awards" width={900} height={869} className="h-32 w-auto" />
        </div>
        <div className="space-y-3 px-6 pb-2 pt-6">
          <DialogTitle className="text-xl">BP Awards: sua indicação está aberta</DialogTitle>
          <DialogDescription className="text-[0.95rem] leading-6 text-foreground/80">
            Indique quem do seu hub representa cada valor do CIVIL e conte uma situação concreta. Os vencedores serão
            revelados na festa de 10 anos. Salva sozinho, então dá para parar e continuar depois.
          </DialogDescription>
          <p className="text-sm text-muted-foreground">
            {status.closesAt ? `Até ${formatAwardDateTime(status.closesAt)}.` : null}
            {status.filled > 0 ? ` Você já preencheu ${status.filled} de ${status.total} indicações.` : null}
          </p>
        </div>
        <DialogFooter className="gap-2 px-6 pb-6 pt-4 sm:gap-2">
          <Button type="button" variant="outline" onClick={postpone}>
            Agora não
          </Button>
          <Button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push(AWARDS_VOTING_PATH);
            }}
          >
            {status.filled > 0 ? "Continuar" : "Votar agora"}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
