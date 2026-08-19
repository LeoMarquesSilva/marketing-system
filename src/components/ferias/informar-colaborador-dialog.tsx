"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  buildVacationBalanceMessage,
  listVacationMessageYears,
  type VacationMessageChannel,
  type VacationMessageScope,
} from "@/lib/ferias/message-template";
import type { EmployeeDetail } from "@/lib/ferias/types";

interface InformarColaboradorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: EmployeeDetail | null;
}

export function InformarColaboradorDialog({
  open,
  onOpenChange,
  detail,
}: InformarColaboradorDialogProps) {
  const [channel, setChannel] = useState<VacationMessageChannel | null>(null);
  const [scopeType, setScopeType] = useState<"all" | "year">("all");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [copied, setCopied] = useState<"body" | "subject" | null>(null);

  const years = useMemo(
    () => (detail ? listVacationMessageYears(detail) : [new Date().getFullYear()]),
    [detail]
  );

  useEffect(() => {
    if (!open) {
      setChannel(null);
      setScopeType("all");
      setSubject("");
      setBody("");
      setCopied(null);
      return;
    }
    if (detail) {
      const available = listVacationMessageYears(detail);
      const current = new Date().getFullYear();
      setYear(available.includes(current) ? current : available[0] ?? current);
    }
  }, [open, detail]);

  const scope: VacationMessageScope =
    scopeType === "year" ? { type: "year", year } : { type: "all" };

  useEffect(() => {
    if (!open || !detail || !channel) return;
    const msg = buildVacationBalanceMessage(detail, channel, scope);
    setSubject(msg.subject ?? "");
    setBody(msg.body);
    setCopied(null);
    // scope is derived from scopeType/year; include those deps instead of the object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, detail, channel, scopeType, year]);

  async function copyText(kind: "body" | "subject", text: string) {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="space-y-1 border-b px-6 py-5 text-left">
          <DialogTitle>Informar colaborador</DialogTitle>
          <DialogDescription>
            {channel
              ? "Escolha o recorte, revise o texto e copie para enviar."
              : "Escolha o canal da mensagem."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          {!channel && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="h-auto justify-start gap-3 px-4 py-3"
                onClick={() => setChannel("whatsapp")}
              >
                <MessageCircle className="h-4 w-4 shrink-0" />
                <span className="text-left">
                  <span className="block text-sm font-medium">WhatsApp</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    Tom conversacional
                  </span>
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-auto justify-start gap-3 px-4 py-3"
                onClick={() => setChannel("email")}
              >
                <Mail className="h-4 w-4 shrink-0" />
                <span className="text-left">
                  <span className="block text-sm font-medium">E-mail</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    Tom formal
                  </span>
                </span>
              </Button>
            </div>
          )}

          {channel && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={channel === "whatsapp" ? "default" : "outline"}
                  onClick={() => setChannel("whatsapp")}
                >
                  WhatsApp
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={channel === "email" ? "default" : "outline"}
                  onClick={() => setChannel("email")}
                >
                  E-mail
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Recorte</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={scopeType === "all" ? "default" : "outline"}
                    onClick={() => setScopeType("all")}
                  >
                    Todo o período
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={scopeType === "year" ? "default" : "outline"}
                    onClick={() => setScopeType("year")}
                  >
                    Por ano
                  </Button>
                </div>
                {scopeType === "year" && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {years.map((y) => (
                      <Button
                        key={y}
                        type="button"
                        size="sm"
                        variant={year === y ? "default" : "outline"}
                        className="h-7 px-2.5 tabular-nums"
                        onClick={() => setYear(y)}
                      >
                        {y}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {channel === "email" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="ferias-msg-subject">Assunto</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => copyText("subject", subject)}
                    >
                      {copied === "subject" ? (
                        <Check className="mr-1 h-3.5 w-3.5" />
                      ) : (
                        <Copy className="mr-1 h-3.5 w-3.5" />
                      )}
                      {copied === "subject" ? "Copiado" : "Copiar assunto"}
                    </Button>
                  </div>
                  <Input
                    id="ferias-msg-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="ferias-msg-body">Mensagem</Label>
                <Textarea
                  id="ferias-msg-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={16}
                  className="min-h-[260px] resize-y font-mono text-sm"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          {!channel ? (
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setChannel(null)}>
                Voltar
              </Button>
              <Button type="button" onClick={() => copyText("body", body)}>
                {copied === "body" ? (
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                ) : (
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                )}
                {copied === "body" ? "Mensagem copiada" : "Copiar mensagem"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
