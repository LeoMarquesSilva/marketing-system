import type {
  CompanyRecess,
  EmployeeDetail,
  HrEmployee,
  VacationLeave,
  VacationLeaveKind,
  VacationPeriod,
} from "@/lib/ferias/types";

async function request<T>(url: string, init?: RequestInit): Promise<{ data: T | null; error: string | null }> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    if (response.status === 204) return { data: null, error: null };
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return { data: null, error: payload?.error ?? "Não foi possível concluir a operação." };
    }
    return { data: payload as T, error: null };
  } catch {
    return { data: null, error: "Falha de conexão. Tente novamente." };
  }
}

export interface EmployeePayload {
  fullName: string;
  cpf: string | null;
  email: string | null;
  department: string | null;
  position: string | null;
  admissionDate: string;
  terminationDate: string | null;
  userId: string | null;
  isActive: boolean;
}

export function createEmployeeRequest(payload: EmployeePayload) {
  return request<{ employee: HrEmployee }>("/api/ferias/employees", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateEmployeeRequest(id: string, payload: Partial<EmployeePayload>) {
  return request<{ employee: HrEmployee }>(`/api/ferias/employees/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function fetchEmployeeDetailRequest(id: string) {
  return request<EmployeeDetail>(`/api/ferias/employees/${id}`);
}

export interface LeavePayload {
  employeeId: string;
  startDate: string;
  endDate: string;
  days: number;
  kind: VacationLeaveKind;
  notes: string | null;
}

export function createLeaveRequest(payload: LeavePayload) {
  return request<{ leave: VacationLeave }>("/api/ferias/leaves", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateLeaveRequest(id: string, payload: Partial<Omit<LeavePayload, "employeeId">>) {
  return request<{ leave: VacationLeave }>(`/api/ferias/leaves/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteLeaveRequest(id: string) {
  return request<null>(`/api/ferias/leaves/${id}`, { method: "DELETE" });
}

export interface RecessPayload {
  year: number;
  startDate: string;
  endDate: string;
  days: number;
  notes: string | null;
}

export function upsertRecessRequest(payload: RecessPayload) {
  return request<{ recess: CompanyRecess }>("/api/ferias/recess", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteRecessRequest(id: string) {
  return request<null>(`/api/ferias/recess/${id}`, { method: "DELETE" });
}

export interface ApplyRecessResult {
  applied: number;
  skippedExisting: number;
  skippedIneligible: number;
}

export function applyRecessRequest(id: string) {
  return request<ApplyRecessResult>(`/api/ferias/recess/${id}/apply`, {
    method: "POST",
  });
}

export interface PeriodPayload {
  entitledDays?: number;
  notes?: string | null;
}

export function updatePeriodRequest(id: string, payload: PeriodPayload) {
  return request<{ period: VacationPeriod }>(`/api/ferias/periods/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
