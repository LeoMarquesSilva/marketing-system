"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Upload, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NfcPageHeading } from "@/components/nfc/nfc-page-heading";
import { ProfileCompletenessBar, ProfileStatusBadge } from "./profile-status-badge";
import { ProfileImportDialog } from "./profile-import-dialog";
import { ProfileCampaignSettings } from "./profile-campaign-settings";
import { matchesProfileListFilters } from "@/lib/profiles/admin";
import type {
  ProfessionalProfileListItem,
  ProfessionalProfileListResult,
  ProfessionalProfileStatus,
} from "@/lib/profiles/types";

type StatusFilter = ProfessionalProfileStatus | "all";
type CompletenessFilter = "all" | "complete" | "incomplete";

export interface ProfilesDashboardClientProps {
  initialData: ProfessionalProfileListResult;
}

/** Resumo do topo. Números vêm do servidor; nada é recalculado no cliente. */
function SummaryCards({ summary }: { summary: ProfessionalProfileListResult["summary"] }) {
  const cards = [
    { label: "Perfis", value: summary.total },
    { label: "Publicados", value: summary.published },
    { label: "Rascunhos", value: summary.draft },
    { label: "Incompletos", value: summary.incomplete },
    { label: "Cartões ativos", value: summary.cardsActive },
    { label: "Cartões pendentes", value: summary.cardsPending },
    {
      label: "Etiquetas gravadas",
      value: `${summary.cardsPhysicallyDone}/${summary.cardsTotal}`,
    },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border border-[#dce9eb] bg-white px-3 py-2.5"
        >
          <dt className="text-xs text-muted-foreground">{card.label}</dt>
          <dd className="mt-0.5 text-xl font-semibold tabular-nums text-[#285f7a]">
            {card.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ProfileAvatar({ item }: { item: ProfessionalProfileListItem }) {
  const initials = (item.displayName ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  if (item.photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.photoUrl}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8f8f8] text-sm font-semibold text-[#285f7a]"
    >
      {initials || <UserRound className="h-4 w-4" />}
    </span>
  );
}

export function ProfilesDashboardClient({ initialData }: ProfilesDashboardClientProps) {
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [completeness, setCompleteness] = useState<CompletenessFilter>("all");
  const [importOpen, setImportOpen] = useState(false);

  // Mesma função pura usada no servidor, para o filtro não divergir.
  const visible = useMemo(
    () =>
      data.items.filter((item) =>
        matchesProfileListFilters(item, { status, search, completeness })
      ),
    [data.items, status, search, completeness]
  );

  async function reload() {
    const response = await fetch("/api/nfc/profiles", { credentials: "include" });
    if (response.ok) setData((await response.json()) as ProfessionalProfileListResult);
  }

  return (
    <div className="space-y-5">
      <NfcPageHeading
        title="Perfis profissionais"
        description="Cartões de apresentação digitais dos colaboradores. Perfis importados começam como rascunho e só vão ao ar quando você publica."
        action={
          <Button className="shrink-0" onClick={() => setImportOpen(true)}>
            <Upload />
            Importar planilha
          </Button>
        }
      />

      <SummaryCards summary={data.summary} />

      <ProfileCampaignSettings />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="pl-8"
            placeholder="Buscar por nome, cargo ou área…"
            aria-label="Buscar perfis"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
          <SelectTrigger size="sm" className="w-full sm:w-44" aria-label="Filtrar por situação">
            <SelectValue placeholder="Situação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as situações</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="published">Publicado</SelectItem>
            <SelectItem value="archived">Arquivado</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={completeness}
          onValueChange={(value) => setCompleteness(value as CompletenessFilter)}
        >
          <SelectTrigger size="sm" className="w-full sm:w-44" aria-label="Filtrar por preenchimento">
            <SelectValue placeholder="Preenchimento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Qualquer preenchimento</SelectItem>
            <SelectItem value="complete">Pronto para publicar</SelectItem>
            <SelectItem value="incomplete">Incompleto</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#dce9eb] px-6 py-12 text-center">
          <p className="text-sm font-medium text-foreground">Nenhum perfil encontrado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.items.length === 0
              ? "Importe a planilha de colaboradores para criar os primeiros rascunhos."
              : "Ajuste a busca ou os filtros para ver outros perfis."}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop: tabela compacta */}
          <div className="hidden overflow-x-auto rounded-lg border border-[#dce9eb] md:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Perfis profissionais cadastrados</caption>
              <thead className="bg-[#f4fafb] text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Colaborador</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Área</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Situação</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Preenchimento</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Cartões</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef5f6]">
                {visible.map((item) => (
                  <tr key={item.id} className="hover:bg-[#fafdfd]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ProfileAvatar item={item} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">
                            {item.displayName ?? "Sem nome"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.role ?? "Cargo não informado"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.practiceArea ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <ProfileStatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3">
                      <ProfileCompletenessBar value={item.completeness} />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {item.activeCardCount}/{item.cardCount}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/nfc/perfis/${item.id}`}>Editar</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards empilhados, sem rolagem horizontal */}
          <ul className="space-y-2 md:hidden">
            {visible.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-[#dce9eb] bg-white p-3"
              >
                <div className="flex items-start gap-3">
                  <ProfileAvatar item={item} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {item.displayName ?? "Sem nome"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[item.role, item.practiceArea].filter(Boolean).join(" · ") || "Sem cargo"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <ProfileStatusBadge status={item.status} />
                      <ProfileCompletenessBar value={item.completeness} />
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[#eef5f6] pt-2">
                  <span className="text-xs text-muted-foreground">
                    {item.activeCardCount}/{item.cardCount} cartões ativos
                  </span>
                  <Button asChild variant="ghost" size="sm" className="min-h-11">
                    <Link href={`/nfc/perfis/${item.id}`}>Editar</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <ProfileImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={reload}
      />
    </div>
  );
}
