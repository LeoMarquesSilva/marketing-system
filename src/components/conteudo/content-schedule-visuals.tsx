import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AreaIcon, getAreaIconStyle } from "@/lib/area-icons";
import { cn } from "@/lib/utils";
import type { ScheduleCollaborator } from "./content-schedule-ui-types";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? "?"}${parts.length > 1 ? parts.at(-1)?.[0] ?? "" : ""}`.toLocaleUpperCase("pt-BR");
}

export function CollaboratorAvatar({
  person,
  className = "size-7",
}: {
  person: Pick<ScheduleCollaborator, "name" | "avatarUrl">;
  className?: string;
}) {
  return (
    <Avatar className={cn("border border-[#dce9eb] bg-[#e8f8f8]", className)}>
      <AvatarImage src={person.avatarUrl || undefined} alt={person.name} />
      <AvatarFallback className="bg-[#e8f8f8] text-[9px] font-semibold text-[#285f7a]">
        {initials(person.name)}
      </AvatarFallback>
    </Avatar>
  );
}

export function AreaMark({ area, compact = false }: { area: string; compact?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className={cn("flex shrink-0 items-center justify-center rounded-md ring-1", compact ? "size-6" : "size-8", getAreaIconStyle(area))}>
        <AreaIcon area={area} className={compact ? "size-3.5" : "size-4"} aria-hidden />
      </span>
      <span className="truncate">{area}</span>
    </span>
  );
}

export function CollaboratorMark({ person, showArea = false }: { person: ScheduleCollaborator; showArea?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <CollaboratorAvatar person={person} />
      <span className="min-w-0 text-left">
        <span className="block truncate font-medium">{person.name}</span>
        {showArea && person.area ? <span className="block truncate text-[11px] text-muted-foreground">{person.area}</span> : null}
      </span>
    </span>
  );
}
