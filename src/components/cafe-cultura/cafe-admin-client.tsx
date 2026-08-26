"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  Check,
  Clipboard,
  Coffee,
  ExternalLink,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Users,
} from "lucide-react";
import { CafeAdminPanel } from "@/components/cafe-cultura/cafe-admin-panel";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import type { CafeAdminData, CafeAdminEdition } from "@/lib/cafe-cultura/types";
import { cn } from "@/lib/utils";

const CHECKIN_PATH = "/cafe-com-cultura";

function formatEditionDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function saoPauloToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

export function pickDefaultCafeEdition(editions: CafeAdminEdition[], today = saoPauloToday()) {
  const upcoming = editions
    .filter((edition) => edition.eventDate >= today)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  return upcoming[0] ?? editions[0] ?? null;
}

function EditionCard({
  edition,
  active,
  onSelect,
}: {
  edition: CafeAdminEdition;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "min-w-[230px] rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d9b56c] focus-visible:ring-offset-2",
        active
          ? "border-[#d9b56c] bg-[#10293a] text-white shadow-[0_12px_30px_rgba(12,35,51,.18)]"
          : "border-border/70 bg-white text-foreground hover:-translate-y-0.5 hover:border-[#d9b56c]/70 hover:shadow-md"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn("text-[10px] font-semibold uppercase tracking-[0.18em]", active ? "text-[#e7c67f]" : "text-[#8f6c2d]")}>Edição</span>
        <span className={cn("rounded-full px-2 py-1 text-[10px] font-semibold", active ? "bg-white/10 text-white" : "bg-[#f5ead5] text-[#73531e]")}>{edition.summary.present} presentes</span>
      </div>
      <p className="mt-3 line-clamp-1 text-sm font-semibold">{edition.name}</p>
      <p className={cn("mt-1 text-xs capitalize", active ? "text-white/65" : "text-muted-foreground")}>{formatEditionDate(edition.eventDate)}</p>
      <div className={cn("mt-4 flex items-center gap-2 text-xs", active ? "text-white/75" : "text-muted-foreground")}>
        <Users className="size-3.5" />
        <span>{edition.summary.expected} confirmados</span>
        <span aria-hidden>·</span>
        <span>{edition.summary.excused} justificativas</span>
      </div>
    </button>
  );
}

export function CafeAdminClient() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editions, setEditions] = useState<CafeAdminEdition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const requestedEditionId = searchParams.get("edicao");
  const selectedEdition = useMemo(
    () =>
      editions.find((edition) => edition.id === requestedEditionId) ??
      pickDefaultCafeEdition(editions),
    [editions, requestedEditionId]
  );

  const loadEditions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/cafe-cultura/editions", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível carregar as edições.");
      setEditions(body.editions ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as edições.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if ((profile?.role ?? "").toLowerCase() !== "admin") {
      router.replace("/");
      return;
    }
    void loadEditions();
  }, [authLoading, loadEditions, profile?.role, router, user]);

  useEffect(() => {
    if (!selectedEdition || requestedEditionId === selectedEdition.id) return;
    router.replace(`/cafe-cultura?edicao=${selectedEdition.id}`, { scroll: false });
  }, [requestedEditionId, router, selectedEdition]);

  const selectEdition = (id: string) => {
    router.replace(`/cafe-cultura?edicao=${id}`, { scroll: false });
  };

  const handleDataChange = useCallback((data: CafeAdminData) => {
    setEditions((current) =>
      current.map((edition) =>
        edition.id === data.event.id
          ? { ...edition, ...data.event, summary: data.summary }
          : edition
      )
    );
  }, []);

  const copyCheckinLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}${CHECKIN_PATH}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (authLoading || !user || (profile?.role ?? "").toLowerCase() !== "admin") {
    return <div className="flex min-h-[48vh] items-center justify-center"><LoaderCircle className="size-6 animate-spin text-[#347796]" /></div>;
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <section className="relative overflow-hidden rounded-[28px] bg-[#0c2434] px-5 py-6 text-white shadow-[0_24px_70px_rgba(12,36,52,.18)] sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full border border-[#d9b56c]/25" aria-hidden />
        <div className="pointer-events-none absolute -right-6 -top-8 size-44 rounded-full border border-[#d9b56c]/15" aria-hidden />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#d9b56c] text-[#0c2434] shadow-lg shadow-black/15 sm:size-14">
              <Coffee className="size-6" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#e7c67f]">Pessoas e Cultura</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Café com Cultura</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
                Central de edições, confirmações, justificativas e presença do encontro mensal.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
              <Link href={CHECKIN_PATH} target="_blank"><ExternalLink /> Abrir página de check-in</Link>
            </Button>
            <Button onClick={copyCheckinLink} className="bg-[#d9b56c] text-[#0c2434] hover:bg-[#e7c67f]">
              {copied ? <Check /> : <Clipboard />} {copied ? "Link copiado" : "Copiar link da NFC"}
            </Button>
          </div>
        </div>
      </section>

      {error && (
        <div role="alert" className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center">
          <span>{error}</span><Button variant="outline" size="sm" onClick={loadEditions}><RefreshCw /> Tentar novamente</Button>
        </div>
      )}

      <section aria-labelledby="edicoes-title" className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8f6c2d]">Histórico operacional</p>
            <h3 id="edicoes-title" className="mt-1 text-lg font-semibold">Edições do encontro</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={loadEditions} disabled={loading} className="text-muted-foreground">
            <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Atualizar
          </Button>
        </div>
        {loading ? (
          <div className="flex min-h-32 items-center justify-center rounded-2xl border border-dashed"><LoaderCircle className="size-5 animate-spin text-[#347796]" /></div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
            {editions.map((edition) => (
              <EditionCard key={edition.id} edition={edition} active={edition.id === selectedEdition?.id} onSelect={() => selectEdition(edition.id)} />
            ))}
          </div>
        )}
      </section>

      {selectedEdition && (
        <section className="space-y-5">
          <div className="flex flex-col gap-3 border-b border-border/60 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#347796]">Edição selecionada</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight">{selectedEdition.name}</h3>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 capitalize"><CalendarDays className="size-3.5" /> {formatEditionDate(selectedEdition.eventDate)}</span>
                <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" /> {selectedEdition.location || "Local ainda não informado"}</span>
              </div>
            </div>
            <p className="max-w-md text-xs leading-5 text-muted-foreground">As alterações abaixo ficam registradas no histórico e valem imediatamente para esta edição.</p>
          </div>
          <CafeAdminPanel eventId={selectedEdition.id} onDataChange={handleDataChange} />
        </section>
      )}

      {!loading && !error && editions.length === 0 && (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">Nenhuma edição disponível.</div>
      )}
    </div>
  );
}
