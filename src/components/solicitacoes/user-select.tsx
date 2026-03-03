"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User } from "@/lib/users";

interface UserSelectProps {
  users: User[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserSelect({
  users,
  value,
  onValueChange,
  placeholder = "Selecione o solicitante",
}: UserSelectProps) {
  const selected = users.find((u) => u.id === value);

  return (
    <Select value={value || undefined} onValueChange={onValueChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder}>
          {selected && (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={selected.avatar_url || undefined} alt={selected.name} />
                <AvatarFallback className="text-xs">{getInitials(selected.name)}</AvatarFallback>
              </Avatar>
              <span>{selected.name}</span>
              <span className="text-muted-foreground text-sm">({selected.department})</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {users.map((user) => (
          <SelectItem key={user.id} value={user.id}>
            <span className="flex items-center gap-2">
              <Avatar className="h-5 w-5 shrink-0">
                <AvatarImage src={user.avatar_url || undefined} alt={user.name} />
                <AvatarFallback className="text-[10px]">{getInitials(user.name)}</AvatarFallback>
              </Avatar>
              {user.name} — {user.department}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
