"use client";

import { AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileStatusBadge } from "./profile-status-badge";
import { PUBLISH_REQUIREMENT_LABELS, type PublishRequirement } from "@/lib/profiles/admin";
import { buildPublicProfileUrl } from "@/lib/profiles/editor";
import type { ProfessionalProfileStatus } from "@/lib/profiles/types";

export function ProfilePublicationPanel({
  status,
  slug,
  missing,
  busy,
  dirty,
  onPublish,
  onUnpublish,
  onArchive,
}: {
  status: ProfessionalProfileStatus;
  slug: string;
  missing: PublishRequirement[];
  busy: boolean;
  dirty: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
  onArchive: () => void;
}) {
  const canPublish = missing.length === 0 && !dirty;

  return (
    <section className="space-y-3 rounded-lg border border-[#dce9eb] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Publicação</h3>
        <ProfileStatusBadge status={status} />
      </div>

      {status === "published" && (
        <a
          href={buildPublicProfileUrl(slug)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 break-all text-xs text-[#285f7a] underline underline-offset-2"
        >
          {buildPublicProfileUrl(slug)}
          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
        </a>
      )}

      {missing.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          Todos os campos obrigatórios estão preenchidos.
        </p>
      ) : (
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            Falta preencher para publicar:
          </p>
          <ul className="mt-1.5 space-y-1">
            {missing.map((requirement) => (
              <li key={requirement} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                {PUBLISH_REQUIREMENT_LABELS[requirement]}
              </li>
            ))}
          </ul>
        </div>
      )}

      {dirty && (
        <p className="text-xs text-amber-800">
          Salve as alterações antes de publicar.
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {status !== "published" ? (
          <Button className="flex-1" disabled={!canPublish || busy} onClick={onPublish}>
            Publicar perfil
          </Button>
        ) : (
          <Button variant="secondary" className="flex-1" disabled={busy} onClick={onUnpublish}>
            Despublicar
          </Button>
        )}
        {status !== "archived" && (
          <Button variant="ghost" disabled={busy} onClick={onArchive}>
            Arquivar
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Despublicar volta o perfil para rascunho sem apagar cartões, endereços
        antigos nem métricas.
      </p>
    </section>
  );
}
