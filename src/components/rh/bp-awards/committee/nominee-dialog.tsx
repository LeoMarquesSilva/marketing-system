"use client";

import { useState } from "react";
import { Eye, EyeOff, LoaderCircle, Star, UserMinus, UserPlus } from "lucide-react";
import { AwardAvatar } from "@/components/rh/bp-awards/award-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatAwardDate } from "@/lib/rh/bp-awards/format";
import { MAX_FINALISTS, type AwardCategory, type AwardFinalist, type NomineeTally } from "@/lib/rh/bp-awards/types";

/**
 * Relatos de quem indicou a pessoa neste valor. O nome de quem indicou fica
 * escondido por padrão: o comitê julga a história, não o autor.
 */
export function NomineeDialog({
  tally,
  category,
  finalist,
  finalistCount,
  busy,
  onOpenChange,
  onAddFinalist,
  onRemoveFinalist,
  onMakeWinner,
}: {
  tally: NomineeTally | null;
  category: AwardCategory;
  finalist: AwardFinalist | null;
  finalistCount: number;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onAddFinalist: () => void;
  onRemoveFinalist: () => void;
  onMakeWinner: () => void;
}) {
  const [showAuthors, setShowAuthors] = useState(false);
  if (!tally) return null;
  const full = !finalist && finalistCount >= MAX_FINALISTS;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-[#dce9eb] px-6 py-4">
          <div className="flex items-center gap-4">
            <AwardAvatar person={tally.person} size="lg" tone="system" />
            <div className="min-w-0 text-left">
              <DialogTitle className="truncate text-lg">{tally.person.short_name}</DialogTitle>
              <DialogDescription className="mt-1">
                {[tally.person.department, tally.person.position].filter(Boolean).join(" · ")}
              </DialogDescription>
              <p className="mt-1 text-sm font-medium text-[#285f7a]">
                {tally.count} {tally.count === 1 ? "indicação" : "indicações"} em {category.name}
                {finalist?.is_winner ? " · vencedor" : finalist ? " · finalista" : ""}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Situações descritas</h3>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAuthors((value) => !value)}>
              {showAuthors ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              {showAuthors ? "Esconder quem indicou" : "Mostrar quem indicou"}
            </Button>
          </div>
          <ol className="space-y-3">
            {tally.testimonies.map((testimony, index) => (
              <li key={testimony.id} className="rounded-md border border-[#dce9eb] bg-[#fbfdfd] p-4">
                <p className="whitespace-pre-wrap text-[0.95rem] leading-7 text-foreground">{testimony.justification}</p>
                <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  {showAuthors && testimony.voter ? (
                    <>
                      <AwardAvatar person={testimony.voter} size="sm" tone="system" className="size-6" />
                      <span className="font-medium text-foreground">{testimony.voter.short_name}</span>
                      {testimony.voter.department && <span>· {testimony.voter.department}</span>}
                    </>
                  ) : (
                    <span>Relato {index + 1}</span>
                  )}
                  <span>· {formatAwardDate(testimony.updated_at)}</span>
                </p>
              </li>
            ))}
          </ol>
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-[#dce9eb] px-6 py-4 sm:flex-row sm:justify-between sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            {finalist ? (
              <>
                <Button type="button" variant="outline" disabled={busy} onClick={onRemoveFinalist}>
                  <UserMinus className="size-4" aria-hidden />
                  Tirar dos finalistas
                </Button>
                {!finalist.is_winner && (
                  <Button type="button" disabled={busy} onClick={onMakeWinner}>
                    {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Star className="size-4" aria-hidden />}
                    Definir como vencedor
                  </Button>
                )}
              </>
            ) : (
              <Button type="button" disabled={busy || full} onClick={onAddFinalist} title={full ? `Já há ${MAX_FINALISTS} finalistas` : undefined}>
                {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}
                {full ? `${MAX_FINALISTS} finalistas escolhidos` : "Marcar como finalista"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
