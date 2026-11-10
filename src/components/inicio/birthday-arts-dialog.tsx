"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmployeeAvatar } from "@/components/ferias/employee-avatar";
import {
  BIRTHDAY_ART_KINDS,
  BIRTHDAY_ART_KIND_LABEL,
  BIRTHDAY_ART_TYPES,
  monthLabel,
  shiftMonth,
  type BirthdayArtRow,
} from "@/lib/inicio/birthday-arts";
import { fetchMonthArts, removeBirthdayArt, uploadBirthdayArt } from "@/lib/inicio/birthday-arts-client";
import { cn } from "@/lib/utils";

const rowKey = (row: BirthdayArtRow) => `${row.employeeId}:${row.kind}:${row.year}`;

/** Arte em tamanho grande, em modal centralizado. */
export function BirthdayArtViewer({
  art,
  onClose,
}: {
  art: { url: string; name: string; caption: string } | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={art !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-[#e6eff1] px-6 py-4">
          <DialogTitle>{art?.name}</DialogTitle>
          <DialogDescription>{art?.caption}</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto bg-[#f6fafb] p-4">
          {art && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={art.url} alt={`Arte de ${art.caption.toLowerCase()} de ${art.name}`} className="max-h-[70dvh] w-auto max-w-full rounded-md object-contain" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Marketing sobe, troca e remove a arte de cada aniversariante do mês. */
export function BirthdayArtsDialog({
  open,
  initialMonth,
  onClose,
  onChanged,
}: {
  open: boolean;
  /** "YYYY-MM" em que a tela abre. */
  initialMonth: string;
  onClose: () => void;
  /** Alguma arte mudou: a tela inicial busca os dados de novo. */
  onChanged: () => void;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [rows, setRows] = useState<BirthdayArtRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; name: string; caption: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const target = useRef<BirthdayArtRow | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchMonthArts(month)
      .then((data) => {
        if (cancelled) return;
        setRows(data.rows);
        setError(null);
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setRows([]);
        setError(failure instanceof Error ? failure.message : "Não foi possível carregar os aniversariantes.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, month]);

  const changeMonth = (delta: number) => {
    setRows(null);
    setError(null);
    setConfirmRemove(null);
    setMonth((current) => shiftMonth(current, delta));
  };

  const setArt = (row: BirthdayArtRow, artUrl: string | null) =>
    setRows((current) => current?.map((item) => (rowKey(item) === rowKey(row) ? { ...item, artUrl } : item)) ?? current);

  const pickFile = (row: BirthdayArtRow) => {
    target.current = row;
    fileInput.current?.click();
  };

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const row = target.current;
    event.target.value = "";
    if (!file || !row) return;
    setBusy(rowKey(row));
    setError(null);
    try {
      setArt(row, await uploadBirthdayArt(row, file));
      onChanged();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível enviar a arte.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (row: BirthdayArtRow) => {
    setBusy(rowKey(row));
    setError(null);
    try {
      await removeBirthdayArt(row);
      setArt(row, null);
      setConfirmRemove(null);
      onChanged();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível remover a arte.");
    } finally {
      setBusy(null);
    }
  };

  const missing = rows?.filter((row) => !row.artUrl).length ?? 0;

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-[#e6eff1] px-6 py-4">
            <DialogTitle>Artes de aniversário</DialogTitle>
            <DialogDescription>
              Envie a arte de cada pessoa (PNG, JPG ou WebP, até 10 MB). Ela aparece na tela inicial de todo mundo, junto do nome.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-3 border-b border-[#e6eff1] px-6 py-3">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" aria-label="Mês anterior" onClick={() => changeMonth(-1)}>
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
              <p className="min-w-[168px] text-center text-sm font-semibold text-[#0d2a38] first-letter:uppercase" aria-live="polite">
                {monthLabel(month)}
              </p>
              <Button variant="outline" size="icon" aria-label="Próximo mês" onClick={() => changeMonth(1)}>
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
            {rows && rows.length > 0 && (
              <p className={cn("text-xs font-semibold", missing > 0 ? "text-amber-700" : "text-emerald-700")}>
                {missing > 0 ? `${missing} sem arte` : "Todas as artes enviadas"}
              </p>
            )}
          </div>

          <div className="min-h-[240px] overflow-y-auto px-6 py-4">
            {error && (
              <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </p>
            )}
            {rows === null ? (
              <div className="flex min-h-[200px] items-center justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Carregando" />
              </div>
            ) : rows.length === 0 && !error ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Ninguém faz aniversário neste mês.</p>
            ) : (
              BIRTHDAY_ART_KINDS.map((kind) => {
                const items = rows.filter((row) => row.kind === kind);
                if (items.length === 0) return null;
                return (
                  <section key={kind} className="mb-5 last:mb-0">
                    <h3 className="mb-1 text-xs font-semibold uppercase text-[#48466e]">
                      {BIRTHDAY_ART_KIND_LABEL[kind]} ({items.length})
                    </h3>
                    <ul className="divide-y divide-[#e6eff1]">
                      {items.map((row) => {
                        const key = rowKey(row);
                        const working = busy === key;
                        const caption = `${BIRTHDAY_ART_KIND_LABEL[kind]}${row.years ? ` · ${row.years} ${row.years === 1 ? "ano" : "anos"}` : ""}`;
                        return (
                          <li key={key} className="flex flex-wrap items-center gap-3 py-2.5">
                            <EmployeeAvatar name={row.name} avatarUrl={row.avatarUrl} className="h-10 w-10" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-[#0d2a38]">{row.name}</p>
                              <p className="truncate text-xs text-[#5a717b]">
                                Dia {row.day}
                                {row.years ? ` · ${row.years} ${row.years === 1 ? "ano" : "anos"} de casa` : ""}
                                {row.department ? ` · ${row.department}` : ""}
                              </p>
                            </div>
                            {row.artUrl ? (
                              <button
                                type="button"
                                onClick={() => setPreview({ url: row.artUrl!, name: row.name, caption })}
                                className="size-12 shrink-0 overflow-hidden rounded-md border border-[#dce9eb] outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
                                aria-label={`Ver a arte de ${row.name}`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={row.artUrl} alt="" className="size-full object-cover" />
                              </button>
                            ) : (
                              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Sem arte</span>
                            )}
                            {confirmRemove === key ? (
                              <div className="flex items-center gap-1.5">
                                <Button variant="destructive" size="sm" disabled={working} onClick={() => remove(row)}>
                                  {working ? "Removendo..." : "Remover"}
                                </Button>
                                <Button variant="outline" size="sm" disabled={working} onClick={() => setConfirmRemove(null)}>
                                  Manter
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <Button variant={row.artUrl ? "outline" : "default"} size="sm" disabled={busy !== null} onClick={() => pickFile(row)}>
                                  {working ? (
                                    <Loader2 className="size-4 animate-spin" aria-hidden />
                                  ) : row.artUrl ? (
                                    <RefreshCw className="size-4" aria-hidden />
                                  ) : (
                                    <ImagePlus className="size-4" aria-hidden />
                                  )}
                                  {working ? "Enviando..." : row.artUrl ? "Trocar" : "Enviar arte"}
                                </Button>
                                {row.artUrl && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={busy !== null}
                                    aria-label={`Remover a arte de ${row.name}`}
                                    onClick={() => setConfirmRemove(key)}
                                  >
                                    <Trash2 className="size-4" aria-hidden />
                                  </Button>
                                )}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })
            )}
          </div>
          <input ref={fileInput} type="file" accept={BIRTHDAY_ART_TYPES.join(",")} className="hidden" onChange={onFile} />
        </DialogContent>
      </Dialog>
      <BirthdayArtViewer art={preview} onClose={() => setPreview(null)} />
    </>
  );
}
