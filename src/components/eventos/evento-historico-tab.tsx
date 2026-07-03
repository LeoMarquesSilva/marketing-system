"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EventHistoryItem } from "@/lib/eventos";

export function EventoHistoricoTab({ items }: { items: EventHistoryItem[] }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Ação</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Usuário</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                Sem histórico registrado.
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{new Date(item.createdAt).toLocaleString("pt-BR")}</TableCell>
                <TableCell>{item.actionLabel}</TableCell>
                <TableCell>{item.actionType}</TableCell>
                <TableCell>{item.actorUserName || "Sistema"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
