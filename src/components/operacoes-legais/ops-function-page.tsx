import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OpsPageHeading } from "@/components/operacoes-legais/ops-page-heading";

export function OpsFunctionPage({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  skill?: string;
  description?: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <OpsPageHeading
        title={title}
        description={description}
        icon={icon}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/operacoes-legais">
              <ArrowLeft />
              Voltar
            </Link>
          </Button>
        }
      />
      <div className="space-y-3 rounded-lg border border-border/80 bg-card p-5 text-sm leading-relaxed text-muted-foreground shadow-sm">
        {children}
      </div>
    </div>
  );
}
