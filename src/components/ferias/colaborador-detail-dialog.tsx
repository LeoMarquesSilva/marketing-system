"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquareText, Pencil, Plus } from "lucide-react";
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
import { LeaveLaunchesSection } from "@/components/ferias/leave-launches-section";
import { InformarColaboradorDialog } from "@/components/ferias/informar-colaborador-dialog";
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
  canManage: boolean;
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
  canManage,
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
            canManage={canManage}
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
  canManage,
}: {
  employeeId: string;
  users: LinkableUser[];
  occupiedUserIds: string[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [leaveDefaultKind, setLeaveDefaultKind] = useState<VacationLeaveKind>("ferias");
  const [creditPreset, setCreditPreset] = useState<{
    kind: VacationLeaveKind;
    rangeStart: string;
    rangeEnd: string;
    sourceLabel: string;
  } | null>(null);
  const [editingLeave, setEditingLeave] = useState<VacationLeave | null>(null);
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<VacationPeriod | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VacationLeave | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [informOpen, setInformOpen] = useState(false);

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
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setInformOpen(true)}>
                <MessageSquareText className="mr-1.5 h-3.5 w-3.5" />
                Informar colaborador
              </Button>
              {canManage && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingLeave(null);
                      setCreditPreset(null);
                      setLeaveDefaultKind("ferias");
                      setLeaveDialogOpen(true);
                    }}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Registrar
                  </Button>
                </>
              )}
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
              <h3 className="text-sm font-semibold text-foreground">Quadro demonstrativo</h3>
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
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#285f7a]">
                      Períodos aquisitivos
                    </p>
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
                        {canManage && <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Ajustar direito do período"
                          onClick={() => {
                            setEditingPeriod(item.period);
                            setPeriodDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>}
                      </div>
                    </div>
                    {item.allocations.length > 0 && (
                      <div className="space-y-1.5 border-t border-[#e4eef3] pt-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#285f7a]">
                          Período usufruído
                        </p>
                        <ul className="space-y-1.5">
                          {item.allocations.map((allocation, index) => {
                            const credit = allocation.days < 0;
                            return (
                              <li
                                key={`${item.period.id}-${allocation.leave.id}-${index}`}
                                className="space-y-0.5 text-xs text-muted-foreground"
                              >
                                <p className="text-foreground">
                                  {formatISODateBR(allocation.leave.start_date)}
                                  {allocation.leave.end_date !== allocation.leave.start_date
                                    ? ` a ${formatISODateBR(allocation.leave.end_date)}`
                                    : ""}
                                </p>
                                <p
                                  className={cn(
                                    credit ? "font-medium text-emerald-700" : undefined
                                  )}
                                >
                                  {credit ? "+" : ""}
                                  {Math.abs(allocation.days)} dia(s) ·{" "}
                                  {LEAVE_KIND_LABEL[allocation.leave.kind]}
                                  {allocation.leave.notes
                                    ? ` · ${allocation.leave.notes}`
                                    : ""}
                                </p>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <LeaveLaunchesSection
              leaves={orderedLeaves}
              error={error}
              readOnly={!canManage}
              onRegisterWorkedDay={(leave) => {
                const creditKind: VacationLeaveKind =
                  leave.kind === "recesso" ? "trabalho_recesso" : "trabalho_ferias";
                const periodLabel = `${LEAVE_KIND_LABEL[leave.kind]} ${formatISODateBR(
                  leave.start_date
                )}${
                  leave.end_date !== leave.start_date
                    ? ` a ${formatISODateBR(leave.end_date)}`
                    : ""
                }`;

                setEditingLeave(null);
                setLeaveDefaultKind(creditKind);
                setCreditPreset({
                  kind: creditKind,
                  rangeStart: leave.start_date,
                  rangeEnd: leave.end_date,
                  sourceLabel: periodLabel,
                });
                setLeaveDialogOpen(true);
              }}
              onEdit={(leave) => {
                setEditingLeave(leave);
                setCreditPreset(null);
                setLeaveDefaultKind(leave.kind);
                setLeaveDialogOpen(true);
              }}
              onDelete={setDeleteTarget}
            />
          </div>
        )}
      </div>

      {detail && (
        <InformarColaboradorDialog
          open={informOpen}
          onOpenChange={setInformOpen}
          detail={detail}
        />
      )}

      {employee && canManage && (
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
                setCreditPreset(null);
                setLeaveDefaultKind("ferias");
              }
            }}
            employeeName={employee.full_name}
            leave={editingLeave}
            defaultKind={leaveDefaultKind}
            creditPreset={creditPreset}
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

      {canManage && <Dialog open={!!deleteTarget} onOpenChange={(nextOpen) => !nextOpen && setDeleteTarget(null)}>
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
      </Dialog>}
    </>
  );
}
