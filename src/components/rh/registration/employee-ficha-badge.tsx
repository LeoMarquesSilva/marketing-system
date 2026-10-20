import { Badge } from "@/components/ui/badge";
import { EMPLOYEE_FICHA_STATUS_LABEL, type EmployeeFichaStatus } from "@/lib/rh/registration/types";
import { cn } from "@/lib/utils";

const STYLE: Record<EmployeeFichaStatus, string> = {
  sem_envio: "border-border bg-muted/60 text-muted-foreground",
  aguardando: "border-amber-200 bg-amber-50 text-amber-900",
  devolvida: "border-amber-200 bg-amber-50 text-amber-900",
  para_revisar: "border-sky-200 bg-sky-50 text-sky-900",
  aprovada: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

export function EmployeeFichaBadge({ status, className }: { status: EmployeeFichaStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap font-medium", STYLE[status], className)}>
      {EMPLOYEE_FICHA_STATUS_LABEL[status]}
    </Badge>
  );
}

/** Barra fina de preenchimento + "x de y" (ou "Completa"). */
export function FichaProgress({ filled, required }: { filled: number; required: number }) {
  const complete = required > 0 && filled >= required;
  const percent = required ? Math.round((filled / required) * 100) : 100;
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", complete ? "bg-emerald-500" : "bg-[#47cdd0]")}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className={cn("text-xs tabular-nums", complete ? "font-medium text-emerald-700" : "text-muted-foreground")}>
        {complete ? "Completa" : `${filled} de ${required}`}
      </span>
    </div>
  );
}
