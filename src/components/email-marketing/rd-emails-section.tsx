"use client";

import { useState } from "react";
import { Eye, Mail, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type EmailRdEmail } from "@/lib/email-marketing";
import { EmailStatCard } from "./email-marketing-ui";
import { RdEmailPreviewDialog } from "./rd-email-preview-dialog";

interface RdEmailsSectionProps {
  emails: EmailRdEmail[];
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: string | null): string {
  if (!status) return "—";
  const map: Record<string, string> = {
    finished: "Enviado",
    draft: "Rascunho",
    scheduled: "Agendado",
    sending: "Enviando",
  };
  return map[status] ?? status;
}

function analyticsStat(analytics: Record<string, unknown>, key: string): number | null {
  const value = analytics[key];
  return typeof value === "number" ? value : null;
}

export function RdEmailsSection({ emails }: RdEmailsSectionProps) {
  const [previewEmail, setPreviewEmail] = useState<EmailRdEmail | null>(null);
  const sent = emails.filter((e) => e.status === "finished").length;
  const totalRecipients = emails.reduce((sum, e) => sum + e.leadsCount, 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">E-mails enviados no RD Station</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Histórico importado do RD Station Marketing. Sincronize em Configurações para atualizar.
        </p>
      </div>

      {emails.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <EmailStatCard label="E-mails no RD" value={emails.length} />
          <EmailStatCard label="Finalizados" value={sent} />
          <EmailStatCard label="Destinatários (total)" value={totalRecipients} hint="Soma de leads_count" />
        </div>
      )}

      <Card className="rounded-xl overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead>Campanha / E-mail</TableHead>
                <TableHead>Envio</TableHead>
                <TableHead>Destinatários</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12">
                    <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
                      <Mail className="h-8 w-8 opacity-40" />
                      <p className="text-sm font-medium text-foreground">Nenhum e-mail importado ainda</p>
                      <p className="text-xs max-w-md">
                        Use &quot;Sincronizar agora&quot; em Configurações para importar o histórico de
                        envios do RD Station.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                emails.map((email) => {
                  const opened = analyticsStat(email.analytics, "opened_count");
                  const clicked = analyticsStat(email.analytics, "clicked_count");
                  const hasAnalytics = opened != null || clicked != null;
                  const hasContent = Boolean(email.htmlBody);

                  return (
                    <TableRow key={email.id}>
                      <TableCell>
                        <p className="font-medium text-sm max-w-md">{email.name}</p>
                        <p className="text-xs text-muted-foreground">ID RD {email.rdEmailId}</p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(email.sendAt)}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-sm">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          {email.leadsCount}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={email.status === "finished" ? "default" : "secondary"}>
                          {statusLabel(email.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-2">
                          {hasAnalytics && (
                            <span className="text-xs text-muted-foreground hidden lg:inline">
                              {opened ?? 0} aberturas · {clicked ?? 0} cliques
                            </span>
                          )}
                          {hasContent ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 h-8"
                              onClick={() => setPreviewEmail(email)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Ver
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sem conteúdo</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RdEmailPreviewDialog
        open={Boolean(previewEmail)}
        onOpenChange={(open) => !open && setPreviewEmail(null)}
        email={previewEmail}
      />

      <p className="text-xs text-muted-foreground">
        * Métricas de abertura/clique disponíveis apenas para envios dos últimos 45 dias (limitação da
        API do RD no plano atual).
      </p>
    </div>
  );
}
