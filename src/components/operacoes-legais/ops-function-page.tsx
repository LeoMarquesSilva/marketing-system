import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";

export function OpsFunctionPage({
  title,
  skill,
  icon: Icon,
  children,
}: {
  title: string;
  skill: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Link
        href="/operacoes-legais"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Operações Legais
      </Link>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#48466e]/10 text-[#48466e] dark:text-[#8f8bb8]">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">Skill do agente: {skill}</p>
        </div>
      </div>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}
