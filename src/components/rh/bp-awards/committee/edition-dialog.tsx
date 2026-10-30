"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fromBrasiliaInput, toBrasiliaInput } from "@/lib/rh/bp-awards/format";
import type { AwardEdition } from "@/lib/rh/bp-awards/types";
import { requestJson } from "./request";

/** Datas da votação e se sócios concorrem. */
export function EditionDialog({
  edition,
  open,
  onOpenChange,
  onSaved,
}: {
  edition: AwardEdition;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (edition: AwardEdition) => void;
}) {
  const [opensAt, setOpensAt] = useState(() => toBrasiliaInput(edition.voting_opens_at));
  const [closesAt, setClosesAt] = useState(() => toBrasiliaInput(edition.voting_closes_at));
  const [partners, setPartners] = useState(edition.partners_eligible);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (Boolean(opensAt) !== Boolean(closesAt)) {
      setError("Preencha a abertura e o encerramento, ou deixe os dois em branco.");
      return;
    }
    if (opensAt && closesAt && closesAt <= opensAt) {
      setError("O encerramento precisa ser depois da abertura.");
      return;
    }
    setSaving(true);
    try {
      const data = await requestJson<{ edition: AwardEdition }>("/api/rh/bp-awards", {
        method: "PATCH",
        body: JSON.stringify({
          voting_opens_at: opensAt ? fromBrasiliaInput(opensAt) : null,
          voting_closes_at: closesAt ? fromBrasiliaInput(closesAt) : null,
          partners_eligible: partners,
        }),
      });
      onSaved(data.edition);
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-[#dce9eb] px-6 py-4">
          <DialogTitle>Configurar a votação</DialogTitle>
          <DialogDescription>Horário de Brasília. O convite aparece no sistema enquanto a votação estiver aberta.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bp-abertura">Abertura</Label>
              <Input id="bp-abertura" type="datetime-local" value={opensAt} onChange={(event) => setOpensAt(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bp-encerramento">Encerramento</Label>
              <Input
                id="bp-encerramento"
                type="datetime-local"
                value={closesAt}
                onChange={(event) => setClosesAt(event.target.value)}
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            O roteiro da pesquisa prevê de 10 a 15 dias de votação. Deixe tempo para o comitê antes da festa (17/12).
          </p>
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-[#dce9eb] p-3">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[#347796]"
              checked={partners}
              onChange={(event) => setPartners(event.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium">Sócios podem ser indicados</span>
              <span className="block text-sm text-muted-foreground">
                Desmarcado, sócios patrimoniais e sócios de área votam, mas não aparecem na lista de indicação.
              </span>
            </span>
          </label>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="gap-2 border-t border-[#dce9eb] px-6 py-4 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
