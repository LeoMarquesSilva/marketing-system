import { Badge } from "@/components/ui/badge";
import { REGISTRATION_STATUS_LABEL, type RegistrationStatus } from "@/lib/rh/registration/types";
import { cn } from "@/lib/utils";

const STYLE: Record<RegistrationStatus, string> = {
  pendente: "border-amber-200 bg-amber-50 text-amber-900",
  recebida: "border-sky-200 bg-sky-50 text-sky-900",
  aprovada: "border-emerald-200 bg-emerald-50 text-emerald-900",
  cancelada: "border-border bg-muted text-muted-foreground",
};

export function RegistrationStatusBadge({
  status,
  expired,
  className,
}: {
  status: RegistrationStatus;
  expired?: boolean;
  className?: string;
}) {
  if (status === "pendente" && expired) {
    return (
      <Badge variant="outline" className={cn("border-rose-200 bg-rose-50 text-rose-900", className)}>
        Link expirado
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn(STYLE[status], className)}>
      {REGISTRATION_STATUS_LABEL[status]}
    </Badge>
  );
}
