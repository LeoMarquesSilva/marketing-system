/** Hierarquia por gestor direto (hr_employees.manager_employee_id) — funções puras. */

export interface EmployeeLink {
  id: string;
  manager_employee_id: string | null;
  department: string | null;
  is_active: boolean;
}

/** Liderados diretos e indiretos de `rootId` pela cadeia de gestor direto. */
export function collectReports(rootId: string, links: Iterable<EmployeeLink>): Set<string> {
  const children = new Map<string, string[]>();
  for (const link of links) {
    if (!link.manager_employee_id) continue;
    const list = children.get(link.manager_employee_id) ?? [];
    list.push(link.id);
    children.set(link.manager_employee_id, list);
  }
  const result = new Set<string>();
  const queue = [...(children.get(rootId) ?? [])];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (id === rootId || result.has(id)) continue;
    result.add(id);
    queue.push(...(children.get(id) ?? []));
  }
  return result;
}

/** Colocar `managerId` como gestor de `employeeId` criaria um ciclo? */
export function createsCycle(employeeId: string, managerId: string, links: Iterable<EmployeeLink>): boolean {
  return managerId === employeeId || collectReports(employeeId, links).has(managerId);
}
