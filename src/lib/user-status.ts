import type { User } from "./users";

export function isUserActive(user: { is_active?: boolean | null }): boolean {
  return user.is_active ?? true;
}

export function sortUsersActiveFirst(users: User[]): User[] {
  return [...users].sort((a, b) => {
    const aActive = isUserActive(a);
    const bActive = isUserActive(b);
    if (aActive !== bActive) return aActive ? -1 : 1;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

export function getUserStatusLabel(user: { is_active?: boolean | null }): string | null {
  return isUserActive(user) ? null : "Ex-funcionário";
}
