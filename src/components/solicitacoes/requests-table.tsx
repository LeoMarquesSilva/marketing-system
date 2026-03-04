"use client";

import { useState, useMemo, useEffect } from "react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { DatePickerField } from "@/components/ui/date-picker-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Search, Pencil, Trash2, Clock, LayoutGrid, List } from "lucide-react";
import {
  type MarketingRequest,
  type MarketingRequestStatus,
  deleteMarketingRequest,
} from "@/lib/marketing-requests";
import { AREAS, REQUEST_TYPES, STATUS_OPTIONS } from "@/lib/constants";
import { getAreaIcon } from "@/lib/area-icons";
import { getTypeColor } from "@/lib/type-icons";
import { AreaWithIcon } from "./area-with-icon";
import { RequestEditDialog } from "./request-edit-dialog";
import { CompletedByArea } from "./completed-by-area";
import { KanbanCardDetail } from "@/components/planner/kanban-card-detail";
import { useAuth } from "@/contexts/auth-context";
import type { User } from "@/lib/users";

const STATUS_LABELS: Record<MarketingRequestStatus, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  completed: "Concluído",
};

const STATUS_VARIANTS: Record<MarketingRequestStatus, "secondary" | "default" | "outline"> = {
  pending: "secondary",
  in_progress: "default",
  completed: "outline",
};

const COMPLETION_TYPE_MAP: Record<string, { label: string; className: string }> = {
  design_concluido:    { label: "Design",    className: "bg-[#101f2e]/8 text-[#101f2e] dark:bg-white/10 dark:text-white/80" },
  postagem_feita:      { label: "Postagem",  className: "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
  conteudo_entregue:   { label: "Conteúdo",  className: "bg-violet-100/80 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400" },
};

const PRIORITY_MAP: Record<string, { label: string; dotClass: string; className: string }> = {
  urgente: { label: "Urgente", dotClass: "bg-red-500",    className: "text-red-700 dark:text-red-400" },
  alta:    { label: "Alta",    dotClass: "bg-orange-500", className: "text-orange-700 dark:text-orange-400" },
  normal:  { label: "Normal",  dotClass: "bg-slate-400",  className: "text-muted-foreground" },
  baixa:   { label: "Baixa",   dotClass: "bg-slate-300",  className: "text-muted-foreground/60" },
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function SolicitanteCell({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl?: string | null;
}) {
  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={avatarUrl || undefined} alt={name} />
        <AvatarFallback className="text-xs">{getInitials(name)}</AvatarFallback>
      </Avatar>
      <span className="truncate">{name}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: MarketingRequestStatus }) {
  const label = STATUS_LABELS[status];
  const dotColor =
    status === "completed"
      ? "bg-green-500"
      : status === "in_progress"
        ? "bg-amber-500"
        : "bg-slate-400";

  return (
    <Badge variant={STATUS_VARIANTS[status]} className="gap-1.5 font-normal">
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      {label}
    </Badge>
  );
}

interface RequestsTableProps {
  requests: MarketingRequest[];
  onEdit?: (req: MarketingRequest) => void;
  onDelete?: (req: MarketingRequest) => void;
  onRowClick?: (req: MarketingRequest) => void;
}

export function RequestsTable({
  requests,
  onEdit,
  onDelete,
  onRowClick,
}: RequestsTableProps) {
  const hasActions = onEdit || onDelete;

  return (
    <div className="rounded-2xl border border-white/50 dark:border-border/50 bg-white/70 dark:bg-card/80 backdrop-blur-sm shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02]">
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tipo</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Solicitante</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Área</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Título</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prioridade</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Conclusão</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Prazo</span>
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Responsável</TableHead>
            {hasActions && <TableHead className="w-[80px]" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.length === 0 && (
            <TableRow>
              <TableCell colSpan={hasActions ? 10 : 9} className="text-center py-12 text-sm text-muted-foreground italic">
                Nenhuma solicitação encontrada.
              </TableCell>
            </TableRow>
          )}
          {requests.map((req) => {
            const isCompleted = req.status === "completed";
            const completionCfg = req.completion_type ? COMPLETION_TYPE_MAP[req.completion_type] : null;
            const priorityCfg = PRIORITY_MAP[req.priority ?? "normal"] ?? PRIORITY_MAP.normal;
            const daysToComplete = req.delivered_at
              ? differenceInDays(new Date(req.delivered_at), new Date(req.requested_at))
              : null;

            return (
              <TableRow
                key={req.id}
                onClick={() => onRowClick?.(req)}
                className={`transition-colors ${onRowClick ? "cursor-pointer hover:bg-[#101f2e]/[0.03] dark:hover:bg-white/[0.03]" : ""} ${isCompleted ? "bg-emerald-50/30 dark:bg-emerald-950/10" : ""}`}
              >
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`text-[11px] font-medium rounded-full px-2.5 border-0 ${getTypeColor(req.request_type || "")}`}
                  >
                    {req.request_type || req.title}
                  </Badge>
                </TableCell>
                <TableCell>
                  <SolicitanteCell
                    name={req.solicitante_user?.name ?? req.solicitante ?? "—"}
                    avatarUrl={req.solicitante_user?.avatar_url}
                  />
                </TableCell>
                <TableCell>
                  <AreaWithIcon area={req.requesting_area} />
                </TableCell>
                <TableCell className="max-w-[180px]">
                  <span className="block truncate text-sm font-medium text-foreground" title={req.title}>
                    {req.title}
                  </span>
                  {req.description && (
                    <span className="block truncate text-xs text-muted-foreground/70 mt-0.5" title={req.description}>
                      {req.description}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <span className={`flex items-center gap-1 text-xs font-medium ${priorityCfg.className}`}>
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${priorityCfg.dotClass}`} />
                    {priorityCfg.label}
                  </span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={req.status} />
                </TableCell>
                <TableCell>
                  {completionCfg ? (
                    <span className={`inline-flex items-center text-[11px] font-medium rounded-full px-2.5 py-0.5 ${completionCfg.className}`}>
                      {completionCfg.label}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/40">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {daysToComplete !== null ? (
                    <span className={`text-xs font-medium tabular-nums ${daysToComplete > 7 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                      {daysToComplete}d
                    </span>
                  ) : req.deadline ? (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(req.deadline), "dd/MM/yyyy", { locale: ptBR })}
                      {req.deadline_time ? ` ${req.deadline_time}` : ""}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/40">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {req.assignee_user && (
                      <Avatar className="h-5 w-5 shrink-0 border border-white/50">
                        <AvatarImage src={req.assignee_user.avatar_url || undefined} />
                        <AvatarFallback className="text-[9px] bg-[#101f2e]/10 text-[#101f2e]">
                          {getInitials(req.assignee_user.name)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <span className="text-sm truncate max-w-[100px]">
                      {req.assignee_user?.name?.split(" ")[0] ?? req.assignee ?? "—"}
                    </span>
                  </div>
                </TableCell>
                {hasActions && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-0.5">
                      {onEdit && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => onEdit(req)} title="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => onDelete(req)} title="Excluir">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

interface RequestsTableWithFiltersProps {
  initialRequests: MarketingRequest[];
  users: User[];
  designers: User[];
}

export function RequestsTableWithFilters({
  initialRequests,
  users,
  designers,
}: RequestsTableWithFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    setSearchQuery(searchParams.get("q") ?? "");
  }, [searchParams]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "concluded">("table");
  const [editRequest, setEditRequest] = useState<MarketingRequest | null>(null);
  const [deleteRequest, setDeleteRequest] = useState<MarketingRequest | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [detailRequest, setDetailRequest] = useState<MarketingRequest | null>(null);

  const requests = useMemo(() => {
    const r = (profile?.role ?? "").toLowerCase();
    const isDesigner = r === "designer" || profile?.department === "Marketing";
    if (isDesigner && profile?.id) {
      return initialRequests.filter((req) => req.assignee_id === profile.id);
    }
    return initialRequests;
  }, [initialRequests, profile]);

  const completedCount = useMemo(
    () => requests.filter((r) => r.status === "completed").length,
    [requests]
  );

  const areaOptions = useMemo(() => {
    const fromData = [...new Set(requests.map((r) => r.requesting_area).filter(Boolean))];
    const combined = [...new Set([...AREAS, ...fromData])].sort();
    return combined;
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const matchStatus =
        statusFilter === "all" || req.status === statusFilter;
      const matchArea =
        areaFilter === "all" || req.requesting_area === areaFilter;
      const matchType =
        typeFilter === "all" || (req.request_type || req.title) === typeFilter;
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !searchQuery ||
        (req.title || "").toLowerCase().includes(q) ||
        (req.description || "").toLowerCase().includes(q) ||
        (req.solicitante || "").toLowerCase().includes(q) ||
        (req.solicitante_user?.name || "").toLowerCase().includes(q);
      const reqDate = new Date(req.requested_at);
      const matchDateFrom = !dateFrom || reqDate >= new Date(dateFrom);
      const matchDateTo = !dateTo || reqDate <= new Date(dateTo + "T23:59:59");
      return matchStatus && matchArea && matchType && matchSearch && matchDateFrom && matchDateTo;
    });
  }, [requests, statusFilter, areaFilter, typeFilter, searchQuery, dateFrom, dateTo]);

  function handleRefresh() {
    router.refresh();
  }

  async function handleConfirmDelete() {
    if (!deleteRequest) return;
    setIsDeleting(true);
    const { error } = await deleteMarketingRequest(deleteRequest.id);
    setIsDeleting(false);
    setDeleteRequest(null);
    if (!error) handleRefresh();
  }

  return (
    <div className="space-y-4">
      {/* View mode tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] w-fit">
        <button
          onClick={() => setViewMode("table")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
            viewMode === "table"
              ? "bg-white dark:bg-white/10 text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <List className="h-3.5 w-3.5" />
          Lista
        </button>
        <button
          onClick={() => setViewMode("concluded")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
            viewMode === "concluded"
              ? "bg-white dark:bg-white/10 text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Concluídos por Área
          {completedCount > 0 && (
            <span className="ml-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-1">
              {completedCount}
            </span>
          )}
        </button>
      </div>

      {/* Concluded cards view */}
      {viewMode === "concluded" && (
        <div className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" aria-hidden />
            <Input
              placeholder="Buscar título, solicitante, designer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 rounded-xl border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-sm"
            />
          </div>
          <CompletedByArea requests={requests} searchQuery={searchQuery} />
        </div>
      )}

      {/* Table view */}
      {viewMode === "table" && (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" aria-hidden />
            <Input
              placeholder="Buscar título, solicitante..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 rounded-xl border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] h-9 rounded-xl border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={areaFilter} onValueChange={setAreaFilter}>
            <SelectTrigger className="w-[150px] h-9 rounded-xl border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-sm">
              <SelectValue placeholder="Área" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as áreas</SelectItem>
              {areaOptions.map((area) => {
                const Icon = getAreaIcon(area);
                return (
                  <SelectItem key={area} value={area}>
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0" />
                      {area}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px] h-9 rounded-xl border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-sm">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {REQUEST_TYPES.map((type) => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DatePickerField
            value={dateFrom}
            onChange={setDateFrom}
            placeholder="DD/MM/AAAA"
            className="w-[130px] h-9 rounded-xl border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-sm"
          />
          <DatePickerField
            value={dateTo}
            onChange={setDateTo}
            placeholder="DD/MM/AAAA"
            className="w-[130px] h-9 rounded-xl border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-sm"
          />
        </div>

        <RequestsTable
          requests={filteredRequests}
          onEdit={(req) => setEditRequest(req)}
          onDelete={(req) => setDeleteRequest(req)}
          onRowClick={(req) => setDetailRequest(req)}
        />
      </div>
      )}

      {detailRequest && (
        <KanbanCardDetail
          request={detailRequest}
          open={!!detailRequest}
          onOpenChange={(open) => !open && setDetailRequest(null)}
          designers={designers}
          onRefresh={handleRefresh}
        />
      )}

      <RequestEditDialog
        request={editRequest}
        users={users}
        designers={designers}
        open={!!editRequest}
        onOpenChange={(open) => !open && setEditRequest(null)}
        onSuccess={handleRefresh}
      />

      <Dialog open={!!deleteRequest} onOpenChange={(open) => !open && setDeleteRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir solicitação</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir esta solicitação? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRequest(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
