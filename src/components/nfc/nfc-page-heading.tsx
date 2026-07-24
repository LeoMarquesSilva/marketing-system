import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Plus, RadioTower } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NfcPageHeading({
  title,
  description,
  backHref,
  primaryAction = true,
  action,
}: {
  title: string;
  description: string;
  backHref?: string;
  primaryAction?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {backHref ? (
          <Button asChild variant="ghost" size="icon" className="mt-0.5 shrink-0">
            <Link href={backHref} aria-label="Voltar">
              <ArrowLeft />
            </Link>
          </Button>
        ) : (
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#47cdd0]/30 bg-[#e8f8f8] text-[#285f7a]">
            <RadioTower className="h-5 w-5" aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {action ?? (primaryAction && (
        <Button asChild className="shrink-0">
          <Link href="/nfc/tags/nova">
            <Plus />
            Nova etiqueta
          </Link>
        </Button>
      ))}
    </div>
  );
}
