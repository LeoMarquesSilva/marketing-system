import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/ferias/filters";
import { cn } from "@/lib/utils";

interface EmployeeAvatarProps {
  name: string;
  avatarUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
}

export function EmployeeAvatar({
  name,
  avatarUrl,
  className,
  fallbackClassName,
}: EmployeeAvatarProps) {
  return (
    <Avatar
      className={cn("h-9 w-9 shrink-0", className)}
      data-has-photo={avatarUrl ? "true" : "false"}
      title={name}
    >
      <AvatarImage src={avatarUrl || undefined} alt={name} />
      <AvatarFallback className={cn("text-xs font-medium", fallbackClassName)}>
        {getInitials(name || "?")}
      </AvatarFallback>
    </Avatar>
  );
}
