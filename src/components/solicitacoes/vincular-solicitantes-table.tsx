"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserSelectSearch } from "@/components/solicitacoes/user-select-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { AreaWithIcon } from "./area-with-icon";
import type { MarketingRequest } from "@/lib/marketing-requests";
import type { User } from "@/lib/users";
import { linkSolicitante, linkSolicitantesBatch } from "@/lib/marketing-requests";
import { cn } from "@/lib/utils";

interface VincularSolicitantesTableProps {
  requests: MarketingRequest[];
  users: User[];
}

export function VincularSolicitantesTable({
  requests: initialRequests,
  users,
}: VincularSolicitantesTableProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchUserId, setBatchUserId] = useState("");
  const [batchLoading, setBatchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allSelected = requests.length > 0 && selectedIds.size === requests.length;
  const someSelected = selectedIds.size > 0;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(requests.map((r) => r.id)));
    }
  }

  async function handleLink(requestId: string) {
    const userId = selectedUser[requestId];
    if (!userId) return;
    setError(null);
    setLinkingId(requestId);
    const { error: err } = await linkSolicitante(requestId, userId);
    setLinkingId(null);
    if (!err) {
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      setSelectedUser((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    } else {
      setError(err);
    }
  }

  async function handleBatchLink() {
    if (selectedIds.size === 0 || !batchUserId) return;
    setError(null);
    setBatchLoading(true);
    const ids = Array.from(selectedIds);
    const { error: err } = await linkSolicitantesBatch(ids, batchUserId);
    setBatchLoading(false);
    if (!err) {
      setRequests((prev) => prev.filter((r) => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
      setSelectedUser((prev) => {
        const next = { ...prev };
        ids.forEach((id) => delete next[id]);
        return next;
      });
    } else {
      setError(err);
    }
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center shadow-sm">
        <Check className="mx-auto mb-4 h-12 w-12 text-green-500" />
        <h3 className="text-lg font-semibold text-slate-900">
          Tudo vinculado!
        </h3>
        <p className="mt-2 text-muted-foreground">
          Não há solicitações pendentes de vinculação.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {someSelected && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-primary/5 px-4 py-3">
          <span className="text-sm font-medium">
            {selectedIds.size} selecionado(s)
          </span>
          <div className="min-w-[200px] flex-1">
            <UserSelectSearch
              users={users}
              value={batchUserId}
              onValueChange={setBatchUserId}
              placeholder="Pesquisar ou selecionar usuário para vincular em lote"
            />
          </div>
          <Button
            size="sm"
            onClick={handleBatchLink}
            disabled={!batchUserId || batchLoading}
          >
            {batchLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              `Vincular ${selectedIds.size} em lote`
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
          >
            Limpar seleção
          </Button>
        </div>
      )}

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="border-b bg-slate-50 px-4 py-2">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-slate-700">{requests.length}</span>{" "}
            solicitação(ões) pendente(s)
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-slate-300"
                  title="Selecionar todos"
                />
              </TableHead>
              <TableHead>Solicitante (texto)</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Detalhe</TableHead>
              <TableHead>Solicitado em</TableHead>
              <TableHead className="w-[320px]">Vincular a usuário</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(() => {
              const byArea = requests.reduce<Record<string, MarketingRequest[]>>(
                (acc, req) => {
                  const area = req.requesting_area || "Outros";
                  if (!acc[area]) acc[area] = [];
                  acc[area].push(req);
                  return acc;
                },
                {}
              );
              const areas = Object.keys(byArea).sort();

              return areas.map((area) => (
                <React.Fragment key={area}>
                  <TableRow className="bg-slate-100/80 hover:bg-slate-100/80">
                    <TableCell colSpan={7} className="font-semibold text-slate-700 py-2">
                      {area}
                    </TableCell>
                  </TableRow>
                  {byArea[area].map((req) => (
                    <TableRow
                      key={req.id}
                      className={cn(selectedIds.has(req.id) && "bg-primary/5")}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(req.id)}
                          onChange={() => toggleSelect(req.id)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {req.solicitante}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{req.request_type || req.title}</Badge>
                      </TableCell>
                      <TableCell>
                        <AreaWithIcon area={req.requesting_area || ""} />
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={req.description || ""}>
                        {req.description || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(req.requested_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserSelectSearch
                            users={users}
                            value={selectedUser[req.id] || ""}
                            onValueChange={(userId) =>
                              setSelectedUser((prev) => ({ ...prev, [req.id]: userId }))
                            }
                            placeholder="Pesquisar ou selecionar usuário..."
                          />
                          <Button
                            size="sm"
                            onClick={() => handleLink(req.id)}
                            disabled={!selectedUser[req.id] || linkingId === req.id}
                          >
                            {linkingId === req.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Vincular"
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
              ));
            })()}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
