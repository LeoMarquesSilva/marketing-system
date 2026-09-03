"use client";

import Link from "next/link";
import type { Publication } from "@/lib/operacoes-legais/vistagem/types";
import { formatDateBR } from "@/lib/operacoes-legais/vistagem/dates";
import { StatusBadge } from "@/components/operacoes-legais/vistagem/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function PublicationTable({
  items,
  hrefPrefix,
}: {
  items: Publication[];
  hrefPrefix: string;
}) {
  if (!items.length) {
    return (
      <p className="rounded-lg border border-dashed border-border/80 bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        Nenhum item nesta fila.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Escritório</TableHead>
            <TableHead>Processo</TableHead>
            <TableHead>Pasta / CI</TableHead>
            <TableHead>Grupo</TableHead>
            <TableHead>Risco</TableHead>
            <TableHead>Publicação</TableHead>
            <TableHead className="text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <StatusBadge status={p.status} />
              </TableCell>
              <TableCell>{p.escritorio_responsavel || "—"}</TableCell>
              <TableCell className="font-mono text-xs">{p.numero_processo || "—"}</TableCell>
              <TableCell className="text-xs">{p.pasta || "—"}</TableCell>
              <TableCell>{p.grupo || "—"}</TableCell>
              <TableCell>{p.demanda_risco ? "Sim" : "Não"}</TableCell>
              <TableCell>{formatDateBR(p.data_publicacao)}</TableCell>
              <TableCell className="text-right">
                <Button asChild variant="ghost" size="sm">
                  <Link href={`${hrefPrefix}/${p.id}`}>Abrir</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
