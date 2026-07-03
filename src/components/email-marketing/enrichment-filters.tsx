"use client";

import { Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ENRICHMENT_FILTER_OPTIONS,
  type EnrichmentFilterId,
  type EnrichmentStats,
} from "@/lib/email-marketing-enrichment";

export interface GroupFilterOption {
  key: string;
  label: string;
}

interface EnrichmentFiltersBarProps {
  groupOptions: GroupFilterOption[];
  groupFilter: string;
  onGroupFilterChange: (value: string) => void;
  enrichmentFilter: EnrichmentFilterId;
  onEnrichmentFilterChange: (value: EnrichmentFilterId) => void;
  onlyPendingGroups: boolean;
  onOnlyPendingGroupsChange: (value: boolean) => void;
  stats: EnrichmentStats;
  resultCount?: number;
  showSemEmail?: boolean;
  showOnlyPendingGroupsToggle?: boolean;
}

export function EnrichmentFiltersBar({
  groupOptions,
  groupFilter,
  onGroupFilterChange,
  enrichmentFilter,
  onEnrichmentFilterChange,
  onlyPendingGroups,
  onOnlyPendingGroupsChange,
  stats,
  resultCount,
  showSemEmail = true,
  showOnlyPendingGroupsToggle = true,
}: EnrichmentFiltersBarProps) {
  const filterOptions = showSemEmail
    ? ENRICHMENT_FILTER_OPTIONS
    : ENRICHMENT_FILTER_OPTIONS.filter((o) => o.id !== "sem_email");

  return (
    <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground mr-1">
          <Filter className="h-3.5 w-3.5" />
          Filtros
        </span>

        <Select value={groupFilter} onValueChange={onGroupFilterChange}>
          <SelectTrigger size="sm" className="w-52 bg-background">
            <SelectValue placeholder="Grupo cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os grupos</SelectItem>
            {groupOptions.map((group) => (
              <SelectItem key={group.key} value={group.key}>
                {group.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={enrichmentFilter}
          onValueChange={(v) => onEnrichmentFilterChange(v as EnrichmentFilterId)}
        >
          <SelectTrigger size="sm" className="w-52 bg-background">
            <SelectValue placeholder="Pendências" />
          </SelectTrigger>
          <SelectContent>
            {filterOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {showOnlyPendingGroupsToggle && (
          <Button
            type="button"
            variant={onlyPendingGroups ? "default" : "outline"}
            size="sm"
            onClick={() => onOnlyPendingGroupsChange(!onlyPendingGroups)}
          >
            Só grupos com pendências
          </Button>
        )}

        {(groupFilter !== "__all__" || enrichmentFilter !== "all" || onlyPendingGroups) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onGroupFilterChange("__all__");
              onEnrichmentFilterChange("all");
              onOnlyPendingGroupsChange(false);
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {showSemEmail && stats.semEmail > 0 && (
          <Badge variant="outline" className="text-[11px] font-normal">
            {stats.semEmail} sem e-mail
          </Badge>
        )}
        {stats.semCargo > 0 && (
          <Badge variant="outline" className="text-[11px] font-normal">
            {stats.semCargo} sem cargo
          </Badge>
        )}
        {stats.semTelefone > 0 && (
          <Badge variant="outline" className="text-[11px] font-normal">
            {stats.semTelefone} sem telefone
          </Badge>
        )}
        {stats.semArea > 0 && (
          <Badge variant="outline" className="text-[11px] font-normal">
            {stats.semArea} sem área
          </Badge>
        )}
        <Badge variant="secondary" className="text-[11px] font-normal">
          {stats.incompleto} incompletos · {stats.completo} completos
        </Badge>
        {resultCount != null && (
          <span className="text-xs text-muted-foreground ml-auto">
            {resultCount} pessoa{resultCount === 1 ? "" : "s"} exibida{resultCount === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </div>
  );
}
