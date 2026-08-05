"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VacationStatusBadge } from "@/components/ferias/status-badge";
import { VacationDebtTags } from "@/components/ferias/vacation-debt-tags";
import { EmployeeAvatar } from "@/components/ferias/employee-avatar";
import {
  ColaboradorFormDialog,
  NO_LINKED_USER,
  type EmployeeFormValues,
} from "@/components/ferias/colaborador-form-dialog";
import {
  RegistrarFeriasDialog,
  type LeaveFormValues,
} from "@/components/ferias/registrar-ferias-dialog";
import {
  PeriodoFormDialog,
  type PeriodFormValues,
} from "@/components/ferias/periodo-form-dialog";
import { LEAVE_KIND_LABEL, formatISODateBR } from "@/lib/ferias/balance";
import {
  createLeaveRequest,
  deleteLeaveRequest,
  fetchEmployeeDetailRequest,
  updateEmployeeRequest,
  updateLeaveRequest,
  updatePeriodRequest,
} from "@/lib/ferias/client";
import {
  isVacationCreditKind,
  type EmployeeDetail,
  type LinkableUser,
  type VacationLeave,
  type VacationLeaveKind,
  type VacationPeriod,
} from "@/lib/ferias/types";
import { cn } from "@/lib/utils";

interface ColaboradorDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string | null;
  users: LinkableUser[];
  occupiedUserIds?: string[];
}

function SummaryItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "danger" | "warning";
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-xl font-semibold tracking-tight tabular-nums",
          tone === "danger" && "text-red-600",
          tone === "warning" && "text-amber-600"
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function ColaboradorDetailDialog({
  open,
  onOpenChange,
  employeeId,
  users,
  occupiedUserIds = [],
}: ColaboradorDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        {/* Remonta a ficha a cada colaborador para resetar o estado sem setState no effect. */}
        {open && employeeId ? (
          <DetailBody
            key={employeeId}
            employeeId={employeeId}
            users={users}
            occupiedUserIds={occupiedUserIds}
          />
        ) : (
          <>
            <DialogHeader className="px-6 py-5 pr-12 text-left">
              <DialogTitle>Ficha de férias</DialogTitle>
              <DialogDescription>Selecione um colaborador na lista.</DialogDescription>
            </DialogHeader>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailBody({
  employeeId,
  users,
  occupiedUserIds,
}: {
  employeeId: string;
  users: LinkableUser[];
  occupiedUserIds: string[];
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [leaveDefaultKind, setLeaveDefaultKind] = useState<VacationLeaveKind>("ferias");
  const [editingLeave, setEditingLeave] = useState<VacationLeave | null>(null);
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<VacationPeriod | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VacationLeave | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchEmployeeDetailRequest(employeeId).then(({ data, error: err }) => {
      if (cancelled) return;
      if (err || !data) {
        setDetail(null);
        setLoadError(err ?? "Colaborador não encontrado.");
        setLoading(false);
        return;
      }
      setDetail(data);
      setLoadError(null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  const orderedLeaves = useMemo(
    () =>
      detail
        ? [...detail.leaves].sort((a, b) => b.start_date.localeCompare(a.start_date))
        : [],
    [detail]
  );

  async function reloadDetail() {
    const { data, error: err } = await fetchEmployeeDetailRequest(employeeId);
    if (err || !data) {
      setLoadError(err ?? "Não foi possível atualizar a ficha.");
      return;
    }
    setDetail(data);
    router.refresh();
  }

  async function handleEmployeeSubmit(values: EmployeeFormValues): Promise<string | null> {
    if (!detail) return "Colaborador não carregado.";
    const { error: err } = await updateEmployeeRequest(detail.employee.id, {
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
    if (err) return err;
    await reloadDetail();
    return null;
  }

  async function handlePeriodSubmit(values: PeriodFormValues): Promise<string | null> {
    if (!editingPeriod) return "Período não selecionado.";
    const { error: err } = await updatePeriodRequest(editingPeriod.id, {
      entitledDays: values.entitledDays,
      notes: values.notes || null,
    });
    if (err) return err;
    await reloadDetail();
    return null;
  }

  async function handleLeaveSubmit(values: LeaveFormValues): Promise<string | null> {
    if (!detail) return "Colaborador não carregado.";
    const payload = {
      startDate: values.startDate,
      endDate: values.endDate,
      days: values.days,
      kind: values.kind,
      notes: values.notes || null,
    };
    const { error: err } = editingLeave
      ? await updateLeaveRequest(editingLeave.id, payload)
      : await createLeaveRequest({ employeeId: detail.employee.id, ...payload });
    if (err) return err;
    await reloadDetail();
    return null;
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error: err } = await deleteLeaveRequest(deleteTarget.id);
    setDeleting(false);
    if (err) {
      setError(err);
      return;
    }
    setDeleteTarget(null);
    await reloadDetail();
  }

  const employee = detail?.employee;
  const balance = detail?.balance;

  return (
    <>
      <DialogHeader className="shrink-0 space-y-3 border-b px-6 py-5 pr-12 text-left">
        {loading || !employee || !balance ? (
          <>
            <DialogTitle>Ficha de férias</DialogTitle>
            <DialogDescription>
              {loadError ?? "Carregando dados do colaborador…"}
            </DialogDescription>
          </>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <EmployeeAvatar
                name={employee.full_name}
                avatarUrl={employee.avatar_url}
                className="h-12 w-12"
                fallbackClassName="text-sm"
              />
              <div className="min-w-0">
                <DialogTitle className="text-lg">{employee.full_name}</DialogTitle>
                <DialogDescription className="mt-1">
                  {[employee.position, employee.department].filter(Boolean).join(" · ") ||
                    "Sem cargo informado"}{" "}
                  · Admissão em {formatISODateBR(employee.admission_date)}
                </DialogDescription>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <VacationDebtTags balance={balance} />
                  {!employee.is_active && (
                    <span className="text-xs text-muted-foreground">Ex-colaborador</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Editar
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setEditingLeave(null);
                  setLeaveDefaultKind("ferias");
                  setLeaveDialogOpen(true);
                }}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Registrar
              </Button>
            </div>
          </div>
        )}
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {loading && (
          <div className="flex min-h-[200px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && loadError && (
          <p className="py-8 text-center text-sm text-destructive">{loadError}</p>
        )}

        {!loading && employee && balance && (
          <div className="space-y-5">
            <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryItem label="Adquiridos" value={balance.totalEntitledDays} />
              <SummaryItem label="Gozados" value={balance.totalTakenDays} />
              <SummaryItem
                label="Pendentes"
                value={balance.pendingDays}
                tone={
                  balance.overdueDays > 0
                    ? "danger"
                    : balance.dueSoonDays > 0
                      ? "warning"
                      : undefined
                }
              />
              <SummaryItem
                label="Período em curso"
                value={
                  balance.currentPeriod
                    ? `${balance.currentPeriod.accruedDays} dias`
                    : "Sem período"
                }
              />
            </div>

            {balance.unallocatedDays > 0 && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {balance.unallocatedDays} dia(s) gozados além do direito adquirido.
              </p>
            )}

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Períodos aquisitivos — Quadro demonstrativo
              </h3>
              {balance.periods.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum período aquisitivo completo desde a admissão.
                </p>
              )}
              <div className="grid gap-3">
                {balance.periods.map((item) => (
                  <div
                    key={item.period.id}
                    className="space-y-2 rounded-xl border border-[#d7e8ef] bg-gradient-to-br from-[#f7fbfc] to-white px-4 py-3 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {formatISODateBR(item.period.period_start)} a{" "}
                          {formatISODateBR(item.period.period_end)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Concessivo até {formatISODateBR(item.period.concessive_end)}
                          {item.remainingDays > 0 &&
                            (item.daysUntilDeadline >= 0
                              ? ` · faltam ${item.daysUntilDeadline} dia(s)`
                              : ` · vencido há ${Math.abs(item.daysUntilDeadline)} dia(s)`)}
                        </p>
                        {item.period.notes && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{item.period.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-md bg-white/80 px-2 py-0.5 text-xs tabular-nums text-muted-foreground ring-1 ring-[#d7e8ef]">
                          {item.usedDays}/{item.period.entitled_days} · resta {item.remainingDays}
                        </span>
                        <VacationStatusBadge status={item.status} />
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Ajustar direito do período"
                          onClick={() => {
                            setEditingPeriod(item.period);
                            setPeriodDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {item.allocations.length > 0 && (
                      <ul className="space-y-1 border-t border-[#e4eef3] pt-2">
                        {item.allocations.map((allocation, index) => {
                          const credit = allocation.days < 0;
                          return (
                            <li
                              key={`${item.period.id}-${allocation.leave.id}-${index}`}
                              className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground"
                            >
                              <span className="text-foreground">
                                {formatISODateBR(allocation.leave.start_date)}
                                {allocation.leave.end_date !== allocation.leave.start_date
                                  ? ` a ${formatISODateBR(allocation.leave.end_date)}`
                                  : ""}
                              </span>
                              <span
                                className={cn(
                                  credit ? "font-medium text-emerald-700" : undefined
                                )}
                              >
                                {credit ? "+" : ""}
                                {Math.abs(allocation.days)} dia(s) ·{" "}
                                {LEAVE_KIND_LABEL[allocation.leave.kind]}
                              </span>
                              {allocation.leave.notes && <span>· {allocation.leave.notes}</span>}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Lançamentos</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Gozo, recesso e créditos por dias trabalhados.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 border-emerald-200 bg-emerald-50 text-xs text-emerald-800 hover:bg-emerald-100"
                    onClick={() => {
                      setEditingLeave(null);
                      setLeaveDefaultKind("trabalho_recesso");
                      setLeaveDialogOpen(true);
                    }}
                  >
                    <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                    Dia trabalhado no recesso
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 border-sky-200 bg-sky-50 text-xs text-sky-800 hover:bg-sky-100"
                    onClick={() => {
                      setEditingLeave(null);
                      setLeaveDefaultKind("trabalho_ferias");
                      setLeaveDialogOpen(true);
                    }}
                  >
                    <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
                    Dia trabalhado nas férias
                  </Button>
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {orderedLeaves.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum lançamento registrado.</p>
              ) : (
                <div className="grid gap-2">
                  {orderedLeaves.map((leave) => {
                    const credit = isVacationCreditKind(leave.kind);
                    return (
                      <div
                        key={leave.id}
                        className={cn(
                          "flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3",
                          credit
                            ? "border-emerald-200 bg-emerald-50/60"
                            : "border-border bg-card"
                        )}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                                credit
                                  ? "bg-emerald-100 text-emerald-800"
                                  : leave.kind === "recesso"
                                    ? "bg-violet-100 text-violet-800"
                                    : leave.kind === "abono"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-[#e8f8f8] text-[#285f7a]"
                              )}
                            >
                              {LEAVE_KIND_LABEL[leave.kind]}
                            </span>
                            <p className="text-sm font-medium text-foreground">
                              {formatISODateBR(leave.start_date)}
                              {leave.end_date !== leave.start_date
                                ? ` a ${formatISODateBR(leave.end_date)}`
                                : ""}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            <span
                              className={cn(
                                "font-medium tabular-nums",
                                credit ? "text-emerald-700" : "text-foreground"
                              )}
                            >
                              {credit ? "+" : "−"}
                              {leave.days} dia(s)
                            </span>
                            {credit ? " · crédito no saldo" : " · débito no saldo"}
                            {leave.notes ? ` · ${leave.notes}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingLeave(leave);
                              setLeaveDefaultKind(leave.kind);
                              setLeaveDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(leave)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {employee && (
        <>
          <ColaboradorFormDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            employee={employee}
            users={users}
            occupiedUserIds={occupiedUserIds}
            onSubmit={handleEmployeeSubmit}
          />

          <RegistrarFeriasDialog
            open={leaveDialogOpen}
            onOpenChange={(nextOpen) => {
              setLeaveDialogOpen(nextOpen);
              if (!nextOpen) {
                setEditingLeave(null);
                setLeaveDefaultKind("ferias");
              }
            }}
            employeeName={employee.full_name}
            leave={editingLeave}
            defaultKind={leaveDefaultKind}
            onSubmit={handleLeaveSubmit}
          />

          <PeriodoFormDialog
            open={periodDialogOpen}
            onOpenChange={(nextOpen) => {
              setPeriodDialogOpen(nextOpen);
              if (!nextOpen) setEditingPeriod(null);
            }}
            period={editingPeriod}
            onSubmit={handlePeriodSubmit}
          />
        </>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(nextOpen) => !nextOpen && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir lançamento</DialogTitle>
            <DialogDescription>
              Excluir as férias de {deleteTarget && formatISODateBR(deleteTarget.start_date)} a{" "}
              {deleteTarget && formatISODateBR(deleteTarget.end_date)}? O saldo será recalculado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
