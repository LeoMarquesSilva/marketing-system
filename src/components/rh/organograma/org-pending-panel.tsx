"use client";

import { forwardRef, useState } from "react";
import { EyeOff, Loader2, UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OrgMember, OrgPendingEmployee } from "@/lib/rh/org-chart";
import { OrgAvatar } from "@/components/rh/organograma/org-visuals";

/**
 * Pendências do organograma: quem entrou (ativo no RH sem posição) e quem
 * saiu (posicionado, mas inativo). É para cá que a notificação do sino leva.
 */
export const OrgPendingPanel = forwardRef<
  HTMLElement,
  {
    pending: OrgPendingEmployee[];
    departed: OrgMember[];
    onPlace: (employee: OrgPendingEmployee) => void;
    onHide: (employee: OrgPendingEmployee) => Promise<void>;
    onRemoveDeparted: (employeeId: string) => Promise<void>;
  }
>(function OrgPendingPanel({ pending, departed, onPlace, onHide, onRemoveDeparted }, ref) {
  const [busy, setBusy] = useState<string | null>(null);
  const total = pending.length + departed.length;
  if (total === 0) return null;

  async function run(id: string, action: () => Promise<void>) {
    setBusy(id);
    try {
      await action();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      ref={ref}
      aria-labelledby="org-pending-title"
      className="overflow-hidden rounded-lg border border-[#47cdd0]/40 bg-[linear-gradient(180deg,#f2fbfb,#ffffff)] shadow-[0_1px_2px_rgba(4,32,47,0.05)]"
    >
      <div className="flex items-start gap-3 px-5 pt-4">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[#47cdd0]/20 text-[#285f7a]">
          <UserPlus className="size-4" aria-hidden />
        </span>
        <div>
          <h3 id="org-pending-title" className="font-semibold text-foreground">
            {total === 1 ? "1 ajuste no organograma" : `${total} ajustes no organograma`}
          </h3>
          <p className="text-sm text-muted-foreground">
            Mudanças vindas do cadastro do RH (VIOS). Posicione quem entrou e tire quem saiu.
          </p>
        </div>
      </div>
      <ul className="mt-3 divide-y divide-[#dce9eb]">
        {pending.map((employee) => (
          <li key={employee.employeeId} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <OrgAvatar name={employee.fullName} photoUrl={employee.photoUrl} size={38} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{employee.fullName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  Entrou · {[employee.department, employee.position].filter(Boolean).join(" · ") || "sem área no cadastro"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="gap-1.5"
                disabled={busy === employee.employeeId}
                onClick={() => void run(employee.employeeId, () => onHide(employee))}
              >
                {busy === employee.employeeId ? <Loader2 className="size-3.5 animate-spin" /> : <EyeOff className="size-3.5" />}
                Não exibir
              </Button>
              <Button type="button" size="sm" className="gap-1.5" onClick={() => onPlace(employee)}>
                <UserPlus className="size-3.5" />
                Posicionar
              </Button>
            </div>
          </li>
        ))}
        {departed.map((member) => (
          <li key={member.employeeId} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <OrgAvatar name={member.name} photoUrl={member.photoUrl} size={38} className="grayscale" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{member.name}</p>
                <p className="truncate text-xs text-muted-foreground">Saiu · está inativo no cadastro do RH</p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0 gap-1.5"
              disabled={busy === member.employeeId}
              onClick={() => void run(member.employeeId, () => onRemoveDeparted(member.employeeId))}
            >
              {busy === member.employeeId ? <Loader2 className="size-3.5 animate-spin" /> : <UserMinus className="size-3.5" />}
              Tirar do organograma
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
});
