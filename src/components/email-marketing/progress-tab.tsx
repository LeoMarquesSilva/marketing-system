"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchEmailGroupResponsibles,
  type EmailContact,
  type EmailGroupResponsible,
  type EmailPerson,
} from "@/lib/email-marketing";
import { fetchActiveUsers } from "@/lib/users";
import { buildResponsibleProgress, type ResponsibleProgressRow } from "@/lib/email-marketing-progress";
import { EmailStatCard } from "./email-marketing-ui";

interface ProgressTabProps {
  contacts: EmailContact[];
  people: EmailPerson[];
}

function ProgressBar({ percent }: { percent: number }) {
  const color = percent >= 80 ? "bg-emerald-500" : percent >= 40 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
      <div className={`h-full ${color} transition-all`} style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  );
}

export function ProgressTab({ contacts, people }: ProgressTabProps) {
  const [responsibles, setResponsibles] = useState<EmailGroupResponsible[]>([]);
  const [userNameById, setUserNameById] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchEmailGroupResponsibles(), fetchActiveUsers()])
      .then(([resp, users]) => {
        setResponsibles(resp);
        setUserNameById(new Map(users.map((u) => [u.id, u.name])));
      })
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(
    () => buildResponsibleProgress(responsibles, contacts, people, userNameById),
    [responsibles, contacts, people, userNameById]
  );

  const totals = useMemo(() => {
    const totalProfiles = rows.reduce((sum, r) => sum + r.stats.total, 0);
    const totalCompleto = rows.reduce((sum, r) => sum + r.stats.completo, 0);
    const unmatchedRows = rows.filter((r) => !r.matched);
    return {
      totalProfiles,
      totalCompleto,
      percent: totalProfiles > 0 ? Math.round((totalCompleto / totalProfiles) * 100) : 0,
      unmatchedCount: unmatchedRows.length,
    };
  }, [rows]);

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <EmailStatCard label="Áreas/advogados" value={rows.length} />
        <EmailStatCard label="Cadastros no escopo" value={totals.totalProfiles} />
        <EmailStatCard
          label="Progresso geral"
          value={`${totals.percent}%`}
          hint={`${totals.totalCompleto} de ${totals.totalProfiles} completos`}
        />
        <EmailStatCard
          label="Sem advogado vinculado"
          value={totals.unmatchedCount}
          hint="Vincule em Configurações"
        />
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed py-16 text-center text-muted-foreground">
          <TrendingUp className="h-9 w-9 opacity-40" />
          <p className="text-sm font-medium text-foreground">Nenhum dado de responsabilidade ainda</p>
          <p className="text-xs max-w-sm">
            Rode a sincronização do SIOE em Configurações para detectar áreas e advogados
            responsáveis por cliente.
          </p>
        </div>
      ) : (
        <Card className="rounded-2xl border-border/70 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>Responsável</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead className="text-right">Sem e-mail</TableHead>
                  <TableHead className="text-right">Sem cargo</TableHead>
                  <TableHead className="text-right">Sem telefone</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row: ResponsibleProgressRow) => {
                  const percent =
                    row.stats.total > 0 ? Math.round((row.stats.completo / row.stats.total) * 100) : 0;
                  return (
                    <TableRow key={row.key}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{row.userName}</span>
                          {!row.matched && (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-amber-700 border-amber-200 bg-amber-50 gap-1"
                            >
                              <AlertTriangle className="h-3 w-3" />
                              não vinculado
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.area ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ProgressBar percent={percent} />
                          <span className="text-xs text-muted-foreground tabular-nums">{percent}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{row.stats.semEmail}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{row.stats.semCargo}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{row.stats.semTelefone}</TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums">
                        {row.stats.total}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
