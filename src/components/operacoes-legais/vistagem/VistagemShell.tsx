import type { ReactNode } from "react";
import { CalendarClock } from "lucide-react";
import { OpsPageHeading } from "@/components/operacoes-legais/ops-page-heading";
import { VistagemSubnav } from "@/components/operacoes-legais/vistagem/VistagemSubnav";

export function VistagemShell({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <OpsPageHeading
        title={title}
        description={description}
        icon={CalendarClock}
        action={action}
      />
      <VistagemSubnav />
      {children}
    </div>
  );
}
