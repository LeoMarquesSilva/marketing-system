"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePickerField } from "@/components/ui/date-picker-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmployeeAvatar } from "@/components/ferias/employee-avatar";
import type { HrEmployee, LinkableUser } from "@/lib/ferias/types";

export const NO_LINKED_USER = "none";

export interface EmployeeFormValues {
  fullName: string;
  cpf: string;
  email: string;
  department: string;
  position: string;
  admissionDate: string;
  terminationDate: string;
  userId: string;
  isActive: boolean;
}

function toFormValues(employee: HrEmployee | null): EmployeeFormValues {
  return {
    fullName: employee?.full_name ?? "",
    cpf: employee?.cpf ?? "",
    email: employee?.email ?? "",
    department: employee?.department ?? "",
    position: employee?.position ?? "",
    admissionDate: employee?.admission_date ?? "",
    terminationDate: employee?.termination_date ?? "",
    userId: employee?.user_id ?? NO_LINKED_USER,
    isActive: employee?.is_active ?? true,
  };
}

interface ColaboradorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: HrEmployee | null;
  users: LinkableUser[];
  /** Usuários já cadastrados em férias — sumidos do seletor ao criar. */
  occupiedUserIds?: string[];
  onSubmit: (values: EmployeeFormValues) => Promise<string | null>;
}

export function ColaboradorFormDialog({
  open,
  onOpenChange,
  employee,
  users,
  occupiedUserIds = [],
  onSubmit,
}: ColaboradorFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{employee ? "Editar colaborador" : "Novo colaborador"}</DialogTitle>
          <DialogDescription>
            Escolha o colaborador entre os usuários do sistema. Os períodos aquisitivos são gerados
            a partir da data de admissão.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <ColaboradorForm
            key={employee?.id ?? "novo"}
            employee={employee}
            users={users}
            occupiedUserIds={occupiedUserIds}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
            onSaved={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ColaboradorForm({
  employee,
  users,
  occupiedUserIds,
  onSubmit,
  onCancel,
  onSaved,
}: {
  employee: HrEmployee | null;
  users: LinkableUser[];
  occupiedUserIds: string[];
  onSubmit: (values: EmployeeFormValues) => Promise<string | null>;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const isCreate = !employee;
  const [values, setValues] = useState<EmployeeFormValues>(() => toFormValues(employee));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectableUsers = useMemo(() => {
    const occupied = new Set(occupiedUserIds);
    return users.filter((user) => {
      if (employee?.user_id && user.id === employee.user_id) return true;
      return !occupied.has(user.id);
    });
  }, [users, occupiedUserIds, employee?.user_id]);

  const selectedUser = selectableUsers.find((user) => user.id === values.userId) ?? null;

  function set<K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSelectUser(userId: string) {
    const user = selectableUsers.find((item) => item.id === userId);
    if (!user) return;
    setValues((prev) => ({
      ...prev,
      userId: user.id,
      fullName: user.name,
      email: user.email ?? "",
      department: user.department ?? prev.department,
    }));
  }

  async function handleSubmit() {
    if (isCreate && values.userId === NO_LINKED_USER) {
      setError("Selecione o colaborador no sistema.");
      return;
    }
    if (values.fullName.trim().length < 2) {
      setError("Informe o nome do colaborador.");
      return;
    }
    if (!values.admissionDate) {
      setError("A data de admissão é obrigatória: ela define os períodos aquisitivos.");
      return;
    }
    setSaving(true);
    const result = await onSubmit(values);
    setSaving(false);
    if (result) {
      setError(result);
      return;
    }
    onSaved();
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="ferias-colaborador">Colaborador</Label>
          <Select
            value={values.userId === NO_LINKED_USER ? undefined : values.userId}
            onValueChange={handleSelectUser}
          >
            <SelectTrigger id="ferias-colaborador" className="h-auto min-h-10 w-full py-2">
              <SelectValue placeholder="Selecione o colaborador">
                {selectedUser ? (
                  <span className="flex items-center gap-2 text-left">
                    <EmployeeAvatar
                      name={selectedUser.name}
                      avatarUrl={selectedUser.avatar_url}
                      className="h-7 w-7"
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">{selectedUser.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {selectedUser.department ?? "Sem área"}
                      </span>
                    </span>
                  </span>
                ) : employee && values.userId === NO_LINKED_USER ? (
                  employee.full_name
                ) : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {selectableUsers.length === 0 ? (
                <div className="px-2 py-3 text-sm text-muted-foreground">
                  Nenhum colaborador disponível para cadastrar.
                </div>
              ) : (
                selectableUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <span className="flex items-center gap-2">
                      <EmployeeAvatar
                        name={user.name}
                        avatarUrl={user.avatar_url}
                        className="h-6 w-6"
                      />
                      <span>
                        {user.name}
                        {user.department ? ` — ${user.department}` : ""}
                      </span>
                    </span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {isCreate && (
            <p className="text-xs text-muted-foreground">
              Lista dos usuários do sistema, exceto T.I. e quem já está neste módulo.
            </p>
          )}
        </div>

        {/* Nome só editável quando a ficha não tem usuário vinculado (ex.: legado). */}
        {!isCreate && values.userId === NO_LINKED_USER && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ferias-nome">Nome completo</Label>
            <Input
              id="ferias-nome"
              value={values.fullName}
              onChange={(event) => set("fullName", event.target.value)}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="ferias-cpf">CPF</Label>
          <Input
            id="ferias-cpf"
            value={values.cpf}
            onChange={(event) => set("cpf", event.target.value)}
            placeholder="000.000.000-00"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ferias-email">E-mail</Label>
          <Input
            id="ferias-email"
            type="email"
            value={values.email}
            onChange={(event) => set("email", event.target.value)}
            placeholder="nome@bismarchipires.com.br"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ferias-area">Área</Label>
          <Input
            id="ferias-area"
            value={values.department}
            onChange={(event) => set("department", event.target.value)}
            placeholder="Operações Legais"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ferias-cargo">Cargo</Label>
          <Input
            id="ferias-cargo"
            value={values.position}
            onChange={(event) => set("position", event.target.value)}
            placeholder="Gerente"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ferias-admissao">Data de admissão</Label>
          <DatePickerField
            id="ferias-admissao"
            value={values.admissionDate}
            onChange={(value) => set("admissionDate", value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ferias-desligamento">Data de desligamento</Label>
          <DatePickerField
            id="ferias-desligamento"
            value={values.terminationDate}
            onChange={(value) => set("terminationDate", value)}
            placeholder="Sem desligamento"
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="ferias-situacao">Situação</Label>
          <Select
            value={values.isActive ? "ativo" : "inativo"}
            onValueChange={(value) => set("isActive", value === "ativo")}
          >
            <SelectTrigger id="ferias-situacao" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Ex-colaborador</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={saving || (isCreate && selectableUsers.length === 0)}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : employee ? "Salvar" : "Adicionar"}
        </Button>
      </DialogFooter>
    </>
  );
}
