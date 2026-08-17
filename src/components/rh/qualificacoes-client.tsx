"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Download,
  History,
  Loader2,
  Search,
  Settings2,
  ShieldOff,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCEP, formatCPF } from "@/lib/masks-br";
import { buildQualificationText } from "@/lib/rh/qualifications/text";
import type { QualificationListItem } from "@/lib/rh/qualifications/types";
import { isQualificationPending } from "@/lib/qualification-requirement";
import {
  listQualificationAreas,
  qualificationAreaLabel,
  qualificationMatchesArea,
} from "@/lib/rh/qualifications/areas";
import {
  listQualificationPositionsForArea,
  matchesQualificationRequirementTarget,
  type QualificationRequirementHistoryItem,
} from "@/lib/rh/qualifications/requirements";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function itemIsComplete(item: QualificationListItem): boolean {
  return (
    item.qualification?.status === "completo" &&
    !isQualificationPending(item)
  );
}

function toCsv(items: QualificationListItem[]): string {
  const header = [
    "Nome",
    "E-mail",
    "Departamento",
    "Status",
    "CPF",
    "RG",
    "OAB",
    "Cidade",
    "UF",
    "Atualizado em",
    "Qualificação",
  ];
  const rows = items.map((item) => {
    const q = item.qualification;
    const oab =
      q?.oab_number && q?.oab_uf
        ? `${q.oab_uf} ${q.oab_number}`
        : q?.oab_number ?? "";
    const text = q ? buildQualificationText(q) : "";
    return [
      item.user_name,
      item.user_email ?? "",
      qualificationAreaLabel(item.department),
      itemIsComplete(item) ? "completo" : "pendente",
      formatCPF(q?.cpf),
      q?.rg ?? "",
      oab,
      q?.city ?? "",
      q?.state ?? "",
      q?.updated_at ? new Date(q.updated_at).toLocaleString("pt-BR") : "",
      text,
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(",");
  });
  return [header.join(","), ...rows].join("\n");
}

interface QualificacoesClientProps {
  items: QualificationListItem[];
  history: QualificationRequirementHistoryItem[];
}

export function QualificacoesClient({
  items,
  history,
}: QualificacoesClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completo" | "pendente">("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [selected, setSelected] = useState<QualificationListItem | null>(null);
  const [copied, setCopied] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [requirementOpen, setRequirementOpen] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState<Set<string>>(() => new Set());
  const [selectedPositionsByArea, setSelectedPositionsByArea] = useState<
    Record<string, string[]>
  >({});
  const [savingRequirement, setSavingRequirement] = useState(false);
  const [clearingRequirement, setClearingRequirement] = useState(false);
  const [requirementError, setRequirementError] = useState<string | null>(null);
  const [requirementSuccess, setRequirementSuccess] = useState<string | null>(null);

  const departments = useMemo(() => {
    return listQualificationAreas(items);
  }, [items]);
  const positionsByArea = useMemo(
    () =>
      Object.fromEntries(
        departments.map((area) => [
          area,
          listQualificationPositionsForArea(items, area),
        ])
      ) as Record<string, string[]>,
    [departments, items]
  );
  const requirementScopes = useMemo(
    () =>
      [...selectedAreas].map((area) => ({
        area,
        positions: selectedPositionsByArea[area] ?? [],
      })),
    [selectedAreas, selectedPositionsByArea]
  );
  const hasAreaWithoutPosition = requirementScopes.some(
    (scope) => scope.positions.length === 0
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const complete = itemIsComplete(item);
      const status = complete ? "completo" : "pendente";
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (
        deptFilter !== "all" &&
        !qualificationMatchesArea(item, deptFilter)
      ) {
        return false;
      }
      if (!q) return true;
      const hay = [
        item.user_name,
        item.user_email ?? "",
        qualificationAreaLabel(item.department),
        formatCPF(item.qualification?.cpf),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, search, statusFilter, deptFilter]);

  const filled = items.filter(itemIsComplete).length;
  const pending = items.length - filled;
  const requiredCount = items.filter((item) => isQualificationPending(item)).length;

  const selectedTargetCount = useMemo(
    () =>
      items.filter((item) =>
        matchesQualificationRequirementTarget(item, {
          scopes: requirementScopes,
        })
      ).length,
    [items, requirementScopes]
  );
  const selectedPendingCount = useMemo(
    () =>
      items.filter(
        (item) =>
          item.qualification?.status !== "completo" &&
          matchesQualificationRequirementTarget(item, {
            scopes: requirementScopes,
          })
      ).length,
    [items, requirementScopes]
  );

  const exportCsv = () => {
    const blob = new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qualificacoes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const activateRequirement = async () => {
    setSavingRequirement(true);
    setRequirementError(null);
    setRequirementSuccess(null);
    try {
      const response = await fetch("/api/rh/qualificacoes/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scopes: requirementScopes,
        }),
      });
      const data = (await response.json()) as {
        requestedCount?: number;
        alreadyCompleteCount?: number;
        error?: string;
      };
      if (!response.ok || data.requestedCount === undefined) {
        throw new Error(data.error ?? "Não foi possível ativar a obrigatoriedade.");
      }
      setRequirementSuccess(
        data.requestedCount > 0
          ? `Obrigatoriedade ativada para ${data.requestedCount} colaborador(es).`
          : "Todos os colaboradores selecionados já preencheram a qualificação."
      );
      setRequirementOpen(false);
      router.refresh();
    } catch (error) {
      setRequirementError(
        error instanceof Error
          ? error.message
          : "Não foi possível ativar a obrigatoriedade."
      );
    } finally {
      setSavingRequirement(false);
    }
  };

  const clearRequirement = async () => {
    setClearingRequirement(true);
    setRequirementError(null);
    setRequirementSuccess(null);
    try {
      const response = await fetch("/api/rh/qualificacoes/request", {
        method: "DELETE",
      });
      const data = (await response.json()) as {
        clearedCount?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Não foi possível desativar a obrigatoriedade.");
      }
      setRequirementSuccess("Obrigatoriedade desativada.");
      setRequirementOpen(false);
      router.refresh();
    } catch (error) {
      setRequirementError(
        error instanceof Error
          ? error.message
          : "Não foi possível desativar a obrigatoriedade."
      );
    } finally {
      setClearingRequirement(false);
    }
  };

  const toggleArea = (area: string) => {
    const removing = selectedAreas.has(area);
    setSelectedAreas((current) => {
      const next = new Set(current);
      if (removing) next.delete(area);
      else next.add(area);
      return next;
    });
    setSelectedPositionsByArea((current) => {
      const next = { ...current };
      if (removing) delete next[area];
      else next[area] = [];
      return next;
    });
  };

  const togglePosition = (area: string, position: string) => {
    setSelectedPositionsByArea((current) => {
      const selected = current[area] ?? [];
      return {
        ...current,
        [area]: selected.includes(position)
          ? selected.filter((item) => item !== position)
          : [...selected, position],
      };
    });
  };

  const toggleAllPositions = (area: string) => {
    const available = positionsByArea[area] ?? [];
    const selected = selectedPositionsByArea[area] ?? [];
    setSelectedPositionsByArea((current) => ({
      ...current,
      [area]: selected.length === available.length ? [] : [...available],
    }));
  };

  const detailText = selected?.qualification
    ? buildQualificationText(selected.qualification)
    : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Qualificações</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Painel do RH — dados preenchidos pelos colaboradores no perfil
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" className="gap-2" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => setHistoryOpen(true)}
          >
            <History className="h-4 w-4" />
            Histórico
          </Button>
          <Button
            type="button"
            className="gap-2"
            onClick={() => {
              setRequirementError(null);
              setRequirementOpen(true);
            }}
          >
            <Settings2 className="h-4 w-4" />
            Definir obrigatoriedade
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-[#dce9eb] bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Colaboradores</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{items.length}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
          <p className="text-xs font-medium text-emerald-800">Preenchidas</p>
          <p className="mt-1 text-2xl font-bold text-emerald-900">{filled}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
          <p className="text-xs font-medium text-amber-900">Pendentes</p>
          <p className="mt-1 text-2xl font-bold text-amber-950">{pending}</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 shadow-sm">
          <p className="text-xs font-medium text-sky-800">Obrigatórios agora</p>
          <p className="mt-1 text-2xl font-bold text-sky-950">{requiredCount}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, e-mail, CPF..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="completo">Preenchido</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
          </SelectContent>
        </Select>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Departamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os departamentos</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {requirementError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {requirementError}
        </p>
      )}
      {requirementSuccess && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {requirementSuccess}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-[#dce9eb] bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-[#dce9eb] bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Colaborador</th>
                <th className="px-4 py-3 font-medium">Equipe</th>
                <th className="px-4 py-3 font-medium">Cargo</th>
                <th className="px-4 py-3 font-medium">CPF</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Preenchimento</th>
                <th className="px-4 py-3 font-medium">Atualizado em</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Nenhum colaborador encontrado.
                  </td>
                </tr>
              )}
              {filtered.map((item) => {
                const complete = itemIsComplete(item);
                const required = isQualificationPending(item);
                return (
                  <tr
                    key={item.user_id}
                    className="cursor-pointer border-b border-[#eef4f5] transition-colors hover:bg-[#f7fbfc]"
                    onClick={() => setSelected(item)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={item.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px]">
                            {initials(item.user_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{item.user_name}</p>
                          {item.user_email && (
                            <p className="truncate text-xs text-muted-foreground">
                              {item.user_email}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {qualificationAreaLabel(item.department)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.position || "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {formatCPF(item.qualification?.cpf) || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={cn(
                          complete
                            ? "bg-emerald-100 text-emerald-900 hover:bg-emerald-100"
                            : "bg-amber-100 text-amber-950 hover:bg-amber-100"
                        )}
                      >
                        {complete ? "Preenchido" : "Pendente"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          required
                            ? "border-sky-200 bg-sky-50 text-sky-800"
                            : "border-slate-200 bg-slate-50 text-slate-600"
                        )}
                      >
                        {required ? "Obrigatório" : "Opcional"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.qualification?.updated_at
                        ? new Date(item.qualification.updated_at).toLocaleString("pt-BR")
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de obrigatoriedade</DialogTitle>
            <DialogDescription>
              Registro das ativações e desativações realizadas pelo RH.
            </DialogDescription>
          </DialogHeader>

          {history.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#cddfe2] px-5 py-10 text-center">
              <History className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium text-foreground">
                Nenhuma alteração registrada
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                As próximas ativações e desativações aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((event) => (
                <article
                  key={event.id}
                  className="rounded-xl border border-[#dce9eb] bg-card p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge
                          className={cn(
                            event.action === "activated"
                              ? "bg-sky-100 text-sky-900 hover:bg-sky-100"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-100"
                          )}
                        >
                          {event.action === "activated"
                            ? "Ativada"
                            : "Desativada"}
                        </Badge>
                        <span className="text-sm font-semibold text-foreground">
                          {event.performed_by_name}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {new Date(event.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <div className="text-left text-xs text-muted-foreground sm:text-right">
                      <p>
                        <strong className="text-foreground">
                          {event.affected_count}
                        </strong>{" "}
                        colaborador(es) afetados
                      </p>
                      {event.action === "activated" && (
                        <p className="mt-1">
                          {event.selected_count} selecionados ·{" "}
                          {event.already_complete_count} já preenchidos
                        </p>
                      )}
                    </div>
                  </div>

                  {event.scopes.length > 0 && (
                    <div className="mt-4 space-y-2 border-t border-[#e7eff0] pt-3">
                      {event.scopes.map((scope) => (
                        <div key={scope.area} className="text-xs">
                          <span className="font-semibold text-foreground">
                            {scope.area}:
                          </span>{" "}
                          <span className="text-muted-foreground">
                            {scope.positions.join(", ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={requirementOpen}
        onOpenChange={(open) => {
          if (!savingRequirement && !clearingRequirement) {
            setRequirementOpen(open);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Definir obrigatoriedade</DialogTitle>
            <DialogDescription>
              Selecione as equipes e os cargos que deverão preencher a
              qualificação antes de continuar usando o sistema.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-xs leading-relaxed text-sky-900">
            Selecione uma equipe para abrir os cargos disponíveis nela. Cada
            equipe terá sua própria seleção, sem cruzar cargos com outras
            áreas. Quem já preencheu continuará liberado.
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Equipes e cargos</h3>
              <p className="text-xs text-muted-foreground">
                Áreas agrupadas conforme o padrão do módulo de Férias
              </p>
            </div>
            <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {departments.map((area) => {
                const areaSelected = selectedAreas.has(area);
                const availablePositions = positionsByArea[area] ?? [];
                const selectedPositions = selectedPositionsByArea[area] ?? [];
                return (
                  <section
                    key={area}
                    className={cn(
                      "overflow-hidden rounded-lg border transition-colors",
                      areaSelected
                        ? selectedPositions.length > 0
                          ? "border-[#8ed8db] bg-[#f7fefe]"
                          : "border-amber-300 bg-amber-50/40"
                        : "border-[#dce9eb] bg-card"
                    )}
                  >
                    <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={areaSelected}
                        onChange={() => toggleArea(area)}
                        className="h-4 w-4 rounded border-[#b8cdd1] accent-[#258b91]"
                      />
                      <span className="flex-1 text-sm font-semibold text-foreground">
                        {area}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {areaSelected
                          ? `${selectedPositions.length}/${availablePositions.length} cargos`
                          : `${availablePositions.length} cargos`}
                      </span>
                    </label>

                    {areaSelected && (
                      <div className="border-t border-[#dce9eb] bg-white px-4 py-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="text-xs font-medium text-muted-foreground">
                            Selecione os cargos desta equipe
                          </p>
                          <button
                            type="button"
                            className="text-xs font-medium text-[#258b91] hover:underline"
                            onClick={() => toggleAllPositions(area)}
                          >
                            {selectedPositions.length === availablePositions.length
                              ? "Limpar"
                              : "Selecionar todos"}
                          </button>
                        </div>
                        <div className="grid gap-1 sm:grid-cols-2">
                          {availablePositions.map((position) => (
                            <label
                              key={position}
                              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted"
                            >
                              <input
                                type="checkbox"
                                checked={selectedPositions.includes(position)}
                                onChange={() => togglePosition(area, position)}
                                className="h-4 w-4 rounded border-[#b8cdd1] accent-[#258b91]"
                              />
                              <span>{position}</span>
                            </label>
                          ))}
                        </div>
                        {selectedPositions.length === 0 && (
                          <p className="mt-2 text-xs font-medium text-amber-700">
                            Selecione pelo menos um cargo desta equipe.
                          </p>
                        )}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-[#dce9eb] bg-muted/35 px-4 py-3 text-sm">
            <strong>{selectedTargetCount}</strong> colaborador(es) correspondem
            à seleção. <strong>{selectedPendingCount}</strong> serão bloqueados
            até preencher; os demais já concluíram.
          </div>

          {requirementError && (
            <p className="text-sm text-destructive">{requirementError}</p>
          )}

          <DialogFooter className="border-t border-[#dce9eb] pt-4 sm:justify-between">
            {requiredCount > 0 ? (
              <Button
                type="button"
                variant="outline"
                className="gap-2 text-destructive hover:text-destructive"
                disabled={savingRequirement || clearingRequirement}
                onClick={() => void clearRequirement()}
              >
                {clearingRequirement ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldOff className="h-4 w-4" />
                )}
                Desativar obrigatoriedade atual
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                disabled={savingRequirement || clearingRequirement}
                onClick={() => setRequirementOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="gap-2"
                disabled={
                  savingRequirement ||
                  clearingRequirement ||
                  selectedAreas.size === 0 ||
                  hasAreaWithoutPosition ||
                  selectedTargetCount === 0
                }
                onClick={() => void activateRequirement()}
              >
                {savingRequirement && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Ativar para selecionados
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{selected?.user_name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              {!selected.qualification ? (
                <p className="text-sm text-muted-foreground">
                  Este colaborador ainda não preencheu a qualificação.
                </p>
              ) : (
                <>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-muted-foreground">Nome na qualificação</dt>
                      <dd className="font-medium">{selected.qualification.full_name || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Profissão</dt>
                      <dd className="font-medium">{selected.qualification.profession || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">CPF</dt>
                      <dd className="font-mono">{formatCPF(selected.qualification.cpf) || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">RG</dt>
                      <dd>{selected.qualification.rg || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">OAB</dt>
                      <dd>
                        {selected.qualification.oab_number
                          ? `${selected.qualification.oab_uf ?? ""} ${selected.qualification.oab_number}`.trim()
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">CEP</dt>
                      <dd className="font-mono">{formatCEP(selected.qualification.cep) || "—"}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-muted-foreground">Endereço</dt>
                      <dd>
                        {[
                          selected.qualification.street,
                          selected.qualification.number && `nº ${selected.qualification.number}`,
                          selected.qualification.complement,
                          selected.qualification.district,
                          selected.qualification.city &&
                            `${selected.qualification.city}/${selected.qualification.state ?? ""}`,
                        ]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Telefone</dt>
                      <dd>{selected.qualification.personal_phone || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">E-mail pessoal</dt>
                      <dd>{selected.qualification.personal_email || "—"}</dd>
                    </div>
                  </dl>

                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Texto jurídico
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        disabled={!detailText}
                        onClick={() => copyText(detailText)}
                      >
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? "Copiado" : "Copiar"}
                      </Button>
                    </div>
                    <p className="text-sm leading-relaxed">{detailText || "—"}</p>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
