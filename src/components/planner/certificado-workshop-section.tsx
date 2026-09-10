"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Award,
  ChevronDown,
  ChevronUp,
  Clock,
  ClipboardList,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  RefreshCw,
  Ticket as TicketIcon,
  UserCheck,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fetchActiveUsers, type User } from "@/lib/users";
import type { CertificadoWorkshopInfo } from "@/lib/certificado-workshop";

interface CertificadoWorkshopSectionProps {
  requestId: string;
  info: CertificadoWorkshopInfo;
  rawDescription: string;
  onSynced?: () => void;
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Casa cada entrada da presença (nome ou e-mail vindo do SharePoint) com o cadastro do ORQESTRAI. */
function resolveAttendee(raw: string, byEmail: Map<string, User>, byName: Map<string, User>): { user: User | null; label: string } {
  const trimmed = raw.trim();
  const match = trimmed.includes("@")
    ? byEmail.get(trimmed.toLowerCase())
    : byName.get(trimmed.toLowerCase());
  return match ? { user: match, label: match.name } : { user: null, label: trimmed };
}

const sectionClass =
  "space-y-4 rounded-lg border border-amber-300/50 bg-amber-50/40 p-5 shadow-[0_1px_2px_rgba(3,32,47,0.05)] dark:border-amber-500/25 dark:bg-amber-950/10";
const sectionTitleClass =
  "flex items-center gap-2 text-xs font-semibold text-amber-800/90 uppercase tracking-wider dark:text-amber-300/90";
const fieldLabelClass = "text-xs font-medium text-muted-foreground";
const fieldValueClass = "text-sm text-foreground break-words";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className={fieldLabelClass}>{label}</p>
      <div className={fieldValueClass}>{children}</div>
    </div>
  );
}

export function CertificadoWorkshopSection({ requestId, info, rawDescription, onSynced }: CertificadoWorkshopSectionProps) {
  const [showRaw, setShowRaw] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [userDirectory, setUserDirectory] = useState<User[]>([]);

  const attendeeNames = info.presenca?.nomes;
  useEffect(() => {
    if (!attendeeNames || attendeeNames.length === 0) return;
    let cancelled = false;
    fetchActiveUsers().then((users) => {
      if (!cancelled) setUserDirectory(users);
    });
    return () => {
      cancelled = true;
    };
  }, [attendeeNames]);

  const { byEmail, byName } = useMemo(() => {
    const emailMap = new Map<string, User>();
    const nameMap = new Map<string, User>();
    for (const user of userDirectory) {
      if (user.email) emailMap.set(user.email.trim().toLowerCase(), user);
      nameMap.set(user.name.trim().toLowerCase(), user);
    }
    return { byEmail: emailMap, byName: nameMap };
  }, [userDirectory]);

  const handleSyncPresenca = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch(`/api/certificados/${requestId}/presenca`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((body as { error?: string } | null)?.error ?? "Falha ao buscar a presença.");
      }
      onSynced?.();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Falha ao buscar a presença.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <section aria-labelledby="certificado-workshop-heading" className={sectionClass}>
      <div className="flex items-start justify-between gap-3">
        <h4 id="certificado-workshop-heading" className={sectionTitleClass}>
          <Award className="h-4 w-4 shrink-0" aria-hidden />
          {info.tipo ?? "Workshop"} · dados do Responsum
        </h4>
        {info.origem && (
          <span className="shrink-0 text-[11px] text-muted-foreground/80">{info.origem}</span>
        )}
      </div>

      {info.tema && (
        <p className="text-sm font-semibold leading-snug text-foreground">{info.tema}</p>
      )}

      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {(info.responsavelNome || info.responsavelEmail) && (
          <Field label="Responsável (gerente da área)">
            <div className="flex flex-col gap-0.5">
              {info.responsavelNome && <span>{info.responsavelNome}</span>}
              {info.responsavelEmail && (
                <a
                  href={`mailto:${info.responsavelEmail}`}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Mail className="h-3 w-3 shrink-0" aria-hidden />
                  {info.responsavelEmail}
                </a>
              )}
            </div>
          </Field>
        )}

        {info.facilitadores && (
          <Field label="Facilitador(es)">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              {info.facilitadores}
            </span>
          </Field>
        )}

        {(info.dataRealizacao || info.duracao) && (
          <Field label="Data e duração">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              {[info.dataRealizacao, info.duracao].filter(Boolean).join(" · ")}
            </span>
          </Field>
        )}

        {info.area && (
          <Field label="Área">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              {info.area}
            </span>
          </Field>
        )}
      </div>

      <div className="space-y-2 border-t border-amber-300/40 pt-3 dark:border-amber-500/20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h5 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <UserCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Presença
          </h5>
          <button
            type="button"
            onClick={() => void handleSyncPresenca()}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-white/80 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60 dark:bg-background/50"
          >
            {syncing ? (
              <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-3 w-3 shrink-0" aria-hidden />
            )}
            {info.presenca ? "Buscar de novo" : "Buscar presença"}
          </button>
        </div>

        {syncError && (
          <p className="text-xs text-destructive" role="alert">{syncError}</p>
        )}

        {!info.presenca && !syncing && (
          <p className="text-xs text-muted-foreground italic">
            Ainda não consultada no SharePoint.
          </p>
        )}

        {info.presenca?.status === "nao_preenchida" && (
          <p className="text-xs text-muted-foreground">Ninguém preencheu o registro de presença ainda.</p>
        )}

        {info.presenca?.status === "preenchida" && info.presenca.nomes.length > 0 && (
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {info.presenca.nomes.map((raw) => {
              const { user, label } = resolveAttendee(raw, byEmail, byName);
              return (
                <li
                  key={raw}
                  className="flex items-center gap-2 rounded-full border border-emerald-300/60 bg-emerald-50 py-1 pl-1 pr-3 dark:border-emerald-500/30 dark:bg-emerald-950/30"
                >
                  <Avatar className="h-6 w-6 shrink-0 border border-white/70 dark:border-white/10">
                    {user?.avatar_url && <AvatarImage src={user.avatar_url} alt={label} />}
                    <AvatarFallback className="bg-emerald-600/10 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300">
                      {getInitials(label)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 truncate text-xs font-medium text-emerald-900 dark:text-emerald-200" title={label}>
                    {label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-amber-300/40 pt-3 dark:border-amber-500/20">
        {info.ticketUrl && (
          <a
            href={info.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20 dark:bg-primary/20"
            title={info.ticketId}
          >
            <TicketIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Abrir ticket no Responsum
          </a>
        )}
        {info.listaPresencaUrl && (
          <a
            href={info.listaPresencaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-white/80 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted dark:bg-background/50"
          >
            <ClipboardList className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Lista de presença
            <ExternalLink className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
          </a>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowRaw((v) => !v)}
        className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
      >
        {showRaw ? <>Ocultar nota original <ChevronUp className="h-3 w-3" /></> : <>Ver nota original <ChevronDown className="h-3 w-3" /></>}
      </button>
      {showRaw && (
        <p className="whitespace-pre-wrap break-words rounded-md bg-black/[0.03] p-3 text-xs text-muted-foreground dark:bg-white/[0.04]">
          {rawDescription}
        </p>
      )}
    </section>
  );
}
