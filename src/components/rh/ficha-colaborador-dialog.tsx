"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ColaboradorFormDialog, type EmployeeFormValues, NO_LINKED_USER } from "@/components/ferias/colaborador-form-dialog";
import { fetchEmployeeDetailRequest, fetchLinkableUsersRequest, updateEmployeeRequest } from "@/lib/ferias/client";
import type { HrEmployee, LinkableUser } from "@/lib/ferias/types";

/**
 * Edição pontual da ficha de um colaborador fora de Usuários/RH-Férias — usada
 * pelo sino/popup de notificações do VIOS, que pode apontar para um colaborador
 * ainda sem login (ficha criada automaticamente pelo sync, sem linha em Usuários).
 * Busca o que precisa sob demanda, ao contrário de Usuários (que já tem tudo
 * carregado) e de RH/Férias (que não edita mais esses dados).
 */
export function FichaColaboradorDialog({
  employeeId,
  onOpenChange,
  onSaved,
}: {
  employeeId: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: (employee: HrEmployee) => void;
}) {
  const [employee, setEmployee] = useState<HrEmployee | null>(null);
  const [users, setUsers] = useState<LinkableUser[]>([]);
  const [occupiedUserIds, setOccupiedUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reseta loading/erro assim que abre pra outro colaborador.
    setLoading(true);
    setLoadError(null);

    Promise.all([fetchEmployeeDetailRequest(employeeId), fetchLinkableUsersRequest()]).then(
      ([detailResult, linkableResult]) => {
        if (cancelled) return;
        if (detailResult.error || !detailResult.data) {
          setLoadError(detailResult.error ?? "Colaborador não encontrado.");
          setLoading(false);
          return;
        }
        setEmployee(detailResult.data.employee);
        setUsers(linkableResult.data?.users ?? []);
        setOccupiedUserIds(linkableResult.data?.occupiedUserIds ?? []);
        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  async function handleSubmit(values: EmployeeFormValues): Promise<string | null> {
    if (!employee) return "Colaborador não carregado.";
    const { data, error: err } = await updateEmployeeRequest(employee.id, {
      fullName: values.fullName.trim(),
      cpf: values.cpf.trim() || null,
      email: values.email.trim() || null,
      department: values.department.trim() || null,
      position: values.position.trim() || null,
      admissionDate: values.admissionDate,
      terminationDate: values.terminationDate || null,
      userId: values.userId === NO_LINKED_USER ? null : values.userId,
      isActive: values.isActive,
      employmentType: values.employmentType.trim() || null,
      registrationNumber: values.registrationNumber.trim() || null,
      birthDate: values.birthDate || null,
      gender: values.gender.trim() || null,
      rg: values.rg.trim() || null,
      oabNumber: values.oabNumber.trim() || null,
      oabUf: values.oabUf.trim() || null,
    });
    if (err) return err;
    if (data?.employee) onSaved?.(data.employee);
    return null;
  }

  if (loading || loadError) {
    return (
      <Dialog open={!!employeeId} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ficha do colaborador</DialogTitle>
          </DialogHeader>
          <div className="flex min-h-[120px] items-center justify-center">
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <p className="text-sm text-destructive">{loadError}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <ColaboradorFormDialog
      open={!!employeeId && !!employee}
      onOpenChange={onOpenChange}
      employee={employee}
      users={users}
      occupiedUserIds={occupiedUserIds}
      title="Ficha do colaborador"
      description="Dados cadastrais e de RH: cargo, área, vínculo, admissão e documentos."
      onSubmit={handleSubmit}
    />
  );
}
