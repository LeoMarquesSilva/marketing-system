"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Loader2,
  Palmtree,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useFeriasRealtime } from "@/hooks/use-ferias-realtime";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VacationDebtTags } from "@/components/ferias/vacation-debt-tags";
import { EmployeeAvatar } from "@/components/ferias/employee-avatar";
import {
  ColaboradorFormDialog,
  NO_LINKED_USER,
  type EmployeeFormValues,
} from "@/components/ferias/colaborador-form-dialog";
import { ColaboradorDetailDialog } from "@/components/ferias/colaborador-detail-dialog";
import {
  RecessoFormDialog,
  type RecessFormValues,
} from "@/components/ferias/recesso-form-dialog";
import {
  applyRecessRequest,
  createEmployeeRequest,
  deleteRecessRequest,
  upsertRecessRequest,
} from "@/lib/ferias/client";
import { formatISODateBR } from "@/lib/ferias/balance";
import {
  ACTIVITY_FILTER_LABEL,
  BALANCE_FILTER_LABEL,
  computeFeriasKpis,
  filterEmployeesWithBalance,
  listEmployeeDepartments,
  RECESS_APPLY_STATE_LABEL,
  type ActivityFilter,
  type BalanceFilter,
  type SituationFilter,
  type StatusFilter,
} from "@/lib/ferias/filters";
import type {
  CompanyRecessWithStatus,
  EmployeeWithBalance,
  LinkableUser,
  RecessApplyState,
} from "@/lib/ferias/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type TabKey = "colaboradores" | "recesso";

interface FeriasClientProps {
  employees: EmployeeWithBalance[];
  recess: CompanyRecessWithStatus[];
  users: LinkableUser[];
  canManage: boolean;
  scopeAreas: string[] | null;
}

const RECESS_APPLY_STATE_CLASS: Record<RecessApplyState, string> = {
  pendente: "border-amber-200 bg-amber-50 text-amber-800",
  parcial: "border-sky-200 bg-sky-50 text-sky-800",
  aplicado: "border-emerald-200 bg-emerald-50 text-emerald-800",
  sem_elegiveis: "border-muted bg-muted/60 text-muted-foreground",
};

function RecessApplyBadge({ state }: { state: RecessApplyState }) {
  return (
    <Badge variant="outline" className={cn("font-medium", RECESS_APPLY_STATE_CLASS[state])}>
      {RECESS_APPLY_STATE_LABEL[state]}
    </Badge>
  );
}

function recessApplicationHint(item: CompanyRecessWithStatus): string {
  const { application } = item;
  if (application.state === "sem_elegiveis") {
    return application.ineligible > 0
      ? `${application.ineligible} ativo(s), nenhum elegível neste período`
      : "Nenhum colaborador ativo elegível";
  }
  if (application.state === "aplicado") {
    return `Lançamento em ${application.applied} de ${application.eligible} elegível(is)`;
  }
  if (application.state === "parcial") {
    return `${application.applied} já tem · ${application.pending} ainda sem lançamento`;
  }
  return `${application.pending} elegível(is) ainda sem lançamento`;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "neutral",
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  hint: string;
  tone?: "neutral" | "warning" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "text-red-600"
      : tone === "warning"
        ? "text-amber-600"
        : "text-[#285f7a]";
  return (
    <Card className="gap-0 py-4">
      <CardContent className="flex items-start gap-3 px-4">
        <span className={cn("mt-0.5 rounded-lg bg-[#e8f8f8] p-2.5", toneClass)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className={cn("mt-0.5 text-2xl font-semibold tracking-tight", toneClass)}>{value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function FeriasClient({
  employees,
  recess,
  users,
  canManage,
  scopeAreas,
}: FeriasClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("colaboradores");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [situationFilter, setSituationFilter] = useState<SituationFilter>("ativos");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>("all");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [recessDialogOpen, setRecessDialogOpen] = useState(false);
  const [editingRecess, setEditingRecess] = useState<CompanyRecessWithStatus | null>(null);
  const [deleteRecessTarget, setDeleteRecessTarget] = useState<CompanyRecessWithStatus | null>(
    null
  );
  const [applyRecessTarget, setApplyRecessTarget] = useState<CompanyRecessWithStatus | null>(
    null
  );
  const [deletingRecess, setDeletingRecess] = useState(false);
  const [applyingRecess, setApplyingRecess] = useState(false);
  const [recessError, setRecessError] = useState<string | null>(null);
  const [recessSuccess, setRecessSuccess] = useState<string | null>(null);

  const realtimePaused =
    createOpen ||
    selectedEmployeeId !== null ||
    recessDialogOpen ||
    deleteRecessTarget !== null ||
    applyRecessTarget !== null;

  const handleRealtimeRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const { status: realtimeStatus, lastSyncAt } = useFeriasRealtime({
    enabled: canManage,
    paused: realtimePaused,
    onRefresh: handleRealtimeRefresh,
  });

  const kpis = useMemo(() => computeFeriasKpis(employees), [employees]);

  const occupiedUserIds = useMemo(
    () =>
      employees
        .map((item) => item.employee.user_id)
        .filter((id): id is string => Boolean(id)),
    [employees]
  );

  const departments = useMemo(() => listEmployeeDepartments(employees), [employees]);

  const filtered = useMemo(
    () =>
      filterEmployeesWithBalance(employees, {
        search,
        status: statusFilter,
        situation: situationFilter,
        department: departmentFilter,
        balance: balanceFilter,
        activity: activityFilter,
      }),
    [
      employees,
      search,
      statusFilter,
      situationFilter,
      departmentFilter,
      balanceFilter,
      activityFilter,
    ]
  );

  const hasFilters =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    situationFilter !== "ativos" ||
    departmentFilter !== "all" ||
    balanceFilter !== "all" ||
    activityFilter !== "all";

  async function handleCreate(values: EmployeeFormValues): Promise<string | null> {
    const { error } = await createEmployeeRequest({
      fullName: values.fullName.trim(),
      cpf: values.cpf.trim() || null,
      email: values.email.trim() || null,
      department: values.department.trim() || null,
      position: values.position.trim() || null,
      admissionDate: values.admissionDate,
      terminationDate: values.terminationDate || null,
      userId: values.userId === NO_LINKED_USER ? null : values.userId,
      isActive: values.isActive,
    });
    if (error) return error;
    router.refresh();
    return null;
  }

  async function handleRecessSubmit(values: RecessFormValues): Promise<string | null> {
    const { error } = await upsertRecessRequest({
      year: values.year,
      startDate: values.startDate,
      endDate: values.endDate,
      days: values.days,
      notes: values.notes || null,
    });
    if (error) return error;
    router.refresh();
    return null;
  }

  async function handleDeleteRecess() {
    if (!deleteRecessTarget) return;
    setDeletingRecess(true);
    setRecessError(null);
    setRecessSuccess(null);
    const { error } = await deleteRecessRequest(deleteRecessTarget.id);
    setDeletingRecess(false);
    if (error) {
      setRecessError(error);
      return;
    }
    setDeleteRecessTarget(null);
    router.refresh();
  }

  async function handleApplyRecess() {
    if (!applyRecessTarget) return;
    setApplyingRecess(true);
    setRecessError(null);
    setRecessSuccess(null);
    const { data, error } = await applyRecessRequest(applyRecessTarget.id);
    setApplyingRecess(false);
    if (error || !data) {
      setRecessError(error ?? "Não foi possível aplicar o recesso.");
      return;
    }
    const year = applyRecessTarget.year;
    setApplyRecessTarget(null);

    if (data.applied === 0 && data.skippedExisting > 0 && data.skippedIneligible >= 0) {
      const parts = [
        `Recesso ${year}: já estava aplicado`,
        data.skippedExisting === 1
          ? "1 colaborador já tinha este lançamento"
          : `${data.skippedExisting} colaboradores já tinham este lançamento`,
      ];
      if (data.skippedIneligible > 0) {
        parts.push(
          data.skippedIneligible === 1
            ? "1 fora do período de vínculo"
            : `${data.skippedIneligible} fora do período de vínculo`
        );
      }
      setRecessSuccess(parts.join(" · "));
      router.refresh();
      return;
    }

    if (data.applied === 0 && data.skippedExisting === 0) {
      setRecessSuccess(
        `Recesso ${year}: nenhum colaborador elegível para receber o lançamento.`
      );
      router.refresh();
      return;
    }

    const parts = [
      data.applied === 1
        ? `Recesso ${year}: 1 colaborador recebeu o lançamento`
        : `Recesso ${year}: ${data.applied} colaboradores receberam o lançamento`,
    ];
    if (data.skippedExisting > 0) {
      parts.push(
        data.skippedExisting === 1
          ? "1 já tinha este recesso"
          : `${data.skippedExisting} já tinham este recesso`
      );
    }
    if (data.skippedIneligible > 0) {
      parts.push(
        data.skippedIneligible === 1
          ? "1 fora do período de vínculo"
          : `${data.skippedIneligible} fora do período de vínculo`
      );
    }
    setRecessSuccess(parts.join(" · "));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">Férias</h2>
            {!canManage && (
              <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-800">
                Somente leitura
              </Badge>
            )}
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {canManage
              ? "Controle dos períodos aquisitivos, dos dias já gozados e de quem precisa sair de férias."
              : `Visualização de férias: ${
                  scopeAreas === null ? "todas as áreas" : scopeAreas.join(", ")
                }.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <>
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                  realtimeStatus === "connected"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                )}
                title={
                  lastSyncAt
                    ? `Última atualização em tempo real: ${lastSyncAt.toLocaleTimeString("pt-BR")}`
                    : undefined
                }
              >
                {realtimeStatus === "connected" ? (
                  <Wifi className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <WifiOff className="h-3.5 w-3.5" aria-hidden />
                )}
                {realtimeStatus === "connected" ? "Tempo real ativo" : "Tempo real indisponível"}
              </div>
              {tab === "colaboradores" ? (
                <Button onClick={() => setCreateOpen(true)} className="shrink-0">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo colaborador
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setEditingRecess(null);
                    setRecessDialogOpen(true);
                  }}
                  className="shrink-0"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Novo recesso
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          icon={Palmtree}
          label="Dias pendentes"
          value={kpis.pendingDays}
          hint={`${kpis.activeCount} colaborador${kpis.activeCount === 1 ? "" : "es"} ativo${kpis.activeCount === 1 ? "" : "s"}`}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Com férias vencidas"
          value={kpis.overdue}
          hint="Prazo concessivo já expirado"
          tone="danger"
        />
        <KpiCard
          icon={CalendarClock}
          label="A vencer em 90 dias"
          value={kpis.dueSoon}
          hint="Precisam programar as férias"
          tone="warning"
        />
        <KpiCard
          icon={CalendarDays}
          label="Em férias hoje"
          value={kpis.onLeave}
          hint="Considera recesso e abono"
        />
        <KpiCard
          icon={CalendarPlus}
          label="Férias programadas"
          value={kpis.scheduledDays}
          hint={`${kpis.scheduledCount} colaborador${kpis.scheduledCount === 1 ? "" : "es"} · ainda não descontam o saldo`}
        />
      </div>

      <div className="flex gap-1 border-b">
        {(
          [
            ["colaboradores", "Colaboradores"],
            ["recesso", "Recesso coletivo"],
          ] as Array<[TabKey, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "colaboradores" ? (
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, área ou cargo…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-9 pl-9 text-sm"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as StatusFilter)}
              >
                <SelectTrigger className="h-9 w-[160px] text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Status: todos</SelectItem>
                  <SelectItem value="vencido">Vencidas</SelectItem>
                  <SelectItem value="a_vencer">A vencer</SelectItem>
                  <SelectItem value="em_dia">Em dia</SelectItem>
                  <SelectItem value="quitado">Sem saldo</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={situationFilter}
                onValueChange={(value) => setSituationFilter(value as SituationFilter)}
              >
                <SelectTrigger className="h-9 w-[160px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativos">Ativos</SelectItem>
                  <SelectItem value="inativos">Ex-colaboradores</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 gap-1.5 text-xs"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                    setSituationFilter("ativos");
                    setDepartmentFilter("all");
                    setBalanceFilter("all");
                    setActivityFilter("all");
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                  Limpar
                </Button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  "all",
                  "a_tirar",
                  "a_mais",
                  "zerado",
                ] as BalanceFilter[]
              ).map((key) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={balanceFilter === key ? "default" : "outline"}
                  className={cn(
                    "h-8 rounded-full px-3 text-xs",
                    balanceFilter === key &&
                      key === "a_mais" &&
                      "border-red-600 bg-red-600 text-white hover:bg-red-600/90",
                    balanceFilter !== key &&
                      key === "a_mais" &&
                      "border-red-200 text-red-800 hover:border-red-300 hover:bg-red-50"
                  )}
                  onClick={() => setBalanceFilter(key)}
                >
                  {BALANCE_FILTER_LABEL[key]}
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(["all", "em_ferias", "programada"] as ActivityFilter[]).map((key) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={activityFilter === key ? "default" : "outline"}
                  className="h-8 rounded-full px-3 text-xs"
                  onClick={() => setActivityFilter(key)}
                >
                  {ACTIVITY_FILTER_LABEL[key]}
                </Button>
              ))}
            </div>

            {departments.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={departmentFilter === "all" ? "default" : "outline"}
                  className="h-8 rounded-full px-3 text-xs"
                  onClick={() => setDepartmentFilter("all")}
                >
                  Todas as áreas
                </Button>
                {departments.map((department) => (
                  <Button
                    key={department}
                    type="button"
                    size="sm"
                    variant={departmentFilter === department ? "default" : "outline"}
                    className="h-8 rounded-full px-3 text-xs"
                    onClick={() => setDepartmentFilter(department)}
                  >
                    {department}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Admissão</TableHead>
                  <TableHead className="text-right">Adquiridos</TableHead>
                  <TableHead className="text-right">Gozados</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">Programados</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Prazo mais próximo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-12 text-center text-sm text-muted-foreground"
                    >
                      {employees.length === 0
                        ? "Nenhum colaborador cadastrado ainda. Cadastre o primeiro para começar."
                        : "Nenhum colaborador encontrado com esses filtros."}
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map(({ employee, balance }) => {
                  const nextDeadline = balance.periods.find((item) => item.remainingDays > 0);
                  return (
                    <TableRow
                      key={employee.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedEmployeeId(employee.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedEmployeeId(employee.id);
                        }
                      }}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-muted/40",
                        !employee.is_active && "bg-muted/20 opacity-70"
                      )}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <EmployeeAvatar
                            name={employee.full_name}
                            avatarUrl={employee.avatar_url}
                          />
                          <span className="min-w-0">
                            <span className="block font-medium text-foreground">
                              {employee.full_name}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {[employee.position, employee.department]
                                .filter(Boolean)
                                .join(" · ") || "Sem cargo informado"}
                            </span>
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {formatISODateBR(employee.admission_date)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {balance.totalEntitledDays}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {balance.totalTakenDays}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold tabular-nums">
                        {balance.pendingDays}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                        {balance.scheduledDays > 0 ? balance.scheduledDays : "-"}
                      </TableCell>
                      <TableCell>
                        <VacationDebtTags balance={balance} compact />
                      </TableCell>
                      <TableCell className="text-sm tabular-nums text-muted-foreground">
                        {nextDeadline
                          ? formatISODateBR(nextDeadline.period.concessive_end)
                          : "Sem pendência"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <p className="text-xs text-muted-foreground">
            {filtered.length} de {employees.length} colaborador
            {employees.length === 1 ? "" : "es"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {recessError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              {recessError}
            </div>
          )}
          {recessSuccess && (
            <div
              role="status"
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
            >
              {recessSuccess}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {canManage
              ? "Cadastrar o calendário não altera o saldo. Use “Aplicar aos ativos” para gerar o lançamento de recesso em cada ficha elegível. A coluna Status mostra se o ano já foi aplicado."
              : "Calendário de recessos coletivos e situação dos lançamentos dentro do seu escopo."}
          </p>
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ano</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Retorno</TableHead>
                  <TableHead className="text-right">Dias</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Observação</TableHead>
                  {canManage && <TableHead className="w-[220px] text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {recess.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={canManage ? 7 : 6}
                      className="py-12 text-center text-sm text-muted-foreground"
                    >
                      Nenhum recesso coletivo cadastrado. Adicione o calendário do próximo fim de
                      ano.
                    </TableCell>
                  </TableRow>
                )}
                {recess.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/40">
                    <TableCell className="font-medium tabular-nums">{item.year}</TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {formatISODateBR(item.start_date)}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {formatISODateBR(item.end_date)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{item.days}</TableCell>
                    <TableCell>
                      <div className="flex max-w-[220px] flex-col gap-1">
                        <RecessApplyBadge state={item.application.state} />
                        <span className="text-xs text-muted-foreground">
                          {recessApplicationHint(item)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.notes ?? "-"}
                    </TableCell>
                    {canManage && <TableCell className="text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1">
                        <Button
                          variant={
                            item.application.state === "aplicado" ? "outline" : "default"
                          }
                          size="sm"
                          className="h-8"
                          aria-label={`Aplicar recesso ${item.year} aos ativos`}
                          title={
                            item.application.state === "aplicado"
                              ? "Já aplicado — clique para verificar novamente"
                              : item.application.state === "parcial"
                                ? "Aplicar aos que ainda não têm o lançamento"
                                : "Aplicar aos ativos elegíveis"
                          }
                          onClick={() => {
                            setRecessSuccess(null);
                            setRecessError(null);
                            setApplyRecessTarget(item);
                          }}
                        >
                          <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                          {item.application.state === "aplicado"
                            ? "Já aplicado"
                            : item.application.state === "parcial"
                              ? "Completar"
                              : "Aplicar"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Editar recesso ${item.year}`}
                          onClick={() => {
                            setEditingRecess(item);
                            setRecessDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Excluir recesso ${item.year}`}
                          onClick={() => setDeleteRecessTarget(item)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {canManage && <ColaboradorFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        employee={null}
        users={users}
        occupiedUserIds={occupiedUserIds}
        onSubmit={handleCreate}
      />}

      <ColaboradorDetailDialog
        open={!!selectedEmployeeId}
        onOpenChange={(open) => {
          if (!open) setSelectedEmployeeId(null);
        }}
        employeeId={selectedEmployeeId}
        users={users}
        occupiedUserIds={occupiedUserIds}
        canManage={canManage}
      />

      {canManage && <RecessoFormDialog
        open={recessDialogOpen}
        onOpenChange={(open) => {
          setRecessDialogOpen(open);
          if (!open) setEditingRecess(null);
        }}
        recess={editingRecess}
        onSubmit={handleRecessSubmit}
      />}

      {canManage && <Dialog
        open={!!deleteRecessTarget}
        onOpenChange={(open) => !open && setDeleteRecessTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir recesso coletivo</DialogTitle>
            <DialogDescription>
              Excluir o recesso de {deleteRecessTarget?.year}? Isso não remove os lançamentos de
              férias já registrados nos colaboradores.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRecessTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteRecess} disabled={deletingRecess}>
              {deletingRecess ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>}

      {canManage && <Dialog
        open={!!applyRecessTarget}
        onOpenChange={(open) => !open && setApplyRecessTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aplicar recesso {applyRecessTarget?.year}</DialogTitle>
            <DialogDescription>
              Vai criar um lançamento de recesso (
              {applyRecessTarget
                ? `${formatISODateBR(applyRecessTarget.start_date)} a ${formatISODateBR(applyRecessTarget.end_date)} · ${applyRecessTarget.days} dia(s)`
                : ""}
              ) para cada colaborador ativo elegível. Quem já tiver recesso no mesmo período
              (mesmo que as datas sejam um pouco diferentes) não é duplicado.
            </DialogDescription>
          </DialogHeader>
          {applyRecessTarget && (
            <div className="space-y-3 rounded-lg border bg-muted/30 px-3 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">Situação atual:</span>
                <RecessApplyBadge state={applyRecessTarget.application.state} />
              </div>
              <ul className="space-y-1 text-muted-foreground">
                <li>
                  <span className="font-medium text-foreground">
                    {applyRecessTarget.application.eligible}
                  </span>{" "}
                  elegível(is) entre os ativos
                </li>
                <li>
                  <span className="font-medium text-emerald-700">
                    {applyRecessTarget.application.applied}
                  </span>{" "}
                  já {applyRecessTarget.application.applied === 1 ? "tem" : "têm"} este recesso
                </li>
                <li>
                  <span className="font-medium text-amber-700">
                    {applyRecessTarget.application.pending}
                  </span>{" "}
                  ainda{" "}
                  {applyRecessTarget.application.pending === 1
                    ? "não tem"
                    : "não têm"}{" "}
                  o lançamento
                </li>
                {applyRecessTarget.application.ineligible > 0 && (
                  <li>
                    <span className="font-medium text-foreground">
                      {applyRecessTarget.application.ineligible}
                    </span>{" "}
                    fora do período de vínculo (não recebem)
                  </li>
                )}
              </ul>
              {applyRecessTarget.application.state === "aplicado" && (
                <p className="text-xs text-emerald-800">
                  Este ano já foi aplicado a todos os elegíveis. Rodar de novo só confirma — não
                  cria duplicatas.
                </p>
              )}
              {applyRecessTarget.application.state === "sem_elegiveis" && (
                <p className="text-xs text-amber-800">
                  Não há quem receber o lançamento agora. Confira admissões e desligamentos.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyRecessTarget(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleApplyRecess}
              disabled={
                applyingRecess ||
                applyRecessTarget?.application.state === "sem_elegiveis" ||
                applyRecessTarget?.application.pending === 0
              }
            >
              {applyingRecess ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : applyRecessTarget?.application.state === "aplicado" ? (
                "Já está aplicado"
              ) : applyRecessTarget?.application.state === "parcial" ? (
                `Aplicar aos ${applyRecessTarget.application.pending} pendentes`
              ) : applyRecessTarget?.application.state === "sem_elegiveis" ? (
                "Sem elegíveis"
              ) : (
                "Aplicar aos ativos"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>}
    </div>
  );
}
