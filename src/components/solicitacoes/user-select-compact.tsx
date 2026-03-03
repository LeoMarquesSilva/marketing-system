"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { User } from "@/lib/users";

interface UserSelectCompactProps {
  users: User[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

/**
 * Versão leve do UserSelect - apenas texto no dropdown, sem avatars.
 * Agrupa usuários ativos e ex-colaboradores separadamente.
 */
export function UserSelectCompact({
  users,
  value,
  onValueChange,
  placeholder = "Selecione o usuário",
}: UserSelectCompactProps) {
  const selected = users.find((u) => u.id === value);
  const activeUsers = users.filter((u) => u.is_active !== false);
  const inactiveUsers = users.filter((u) => u.is_active === false);

  return (
    <Select value={value || undefined} onValueChange={onValueChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder}>
          {selected ? `${selected.name} (${selected.department})` : null}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {activeUsers.length > 0 && (
          <SelectGroup>
            <SelectLabel>Ativos</SelectLabel>
            {activeUsers.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name} — {user.department}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {activeUsers.length > 0 && inactiveUsers.length > 0 && <SelectSeparator />}
        {inactiveUsers.length > 0 && (
          <SelectGroup>
            <SelectLabel>Ex-colaboradores</SelectLabel>
            {inactiveUsers.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name} — {user.department}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}
