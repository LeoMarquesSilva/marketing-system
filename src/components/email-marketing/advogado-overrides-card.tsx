"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Link2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchActiveUsers, type User } from "@/lib/users";

interface UnmatchedAdvogado {
  advogadoNameNormalized: string;
  advogadoName: string;
  clientCount: number;
  totalProcesses: number;
}

interface AdvogadoOverride {
  advogadoNameNormalized: string;
  userId: string;
  userName: string | null;
  updatedAt: string;
}

export function AdvogadoOverridesCard() {
  const [loading, setLoading] = useState(true);
  const [unmatched, setUnmatched] = useState<UnmatchedAdvogado[]>([]);
  const [overrides, setOverrides] = useState<AdvogadoOverride[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, activeUsers] = await Promise.all([
        fetch("/api/email-marketing/advogado-overrides").then((r) => r.json()),
        fetchActiveUsers(),
      ]);
      if (res.error) throw new Error(res.error);
      setUnmatched(res.unmatched ?? []);
      setOverrides(res.overrides ?? []);
      setUsers(activeUsers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar vínculos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const overriddenSet = useMemo(
    () => new Set(overrides.map((o) => o.advogadoNameNormalized)),
    [overrides]
  );
  const pendingUnmatched = unmatched.filter((u) => !overriddenSet.has(u.advogadoNameNormalized));

  const handleSave = async (advogadoNameNormalized: string) => {
    const userId = selection[advogadoNameNormalized];
    if (!userId) return;
    setSaving(advogadoNameNormalized);
    try {
      const res = await fetch("/api/email-marketing/advogado-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advogadoNameNormalized, userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar vínculo.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card className="rounded-xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Vincular responsáveis (advogados não casados)</CardTitle>
        <Button variant="ghost" size="icon-sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          O nome do <code>advogado_responsavel</code> nos processos do SIOE não bateu automaticamente
          com nenhum usuário do sistema. Selecione o usuário correto para cada nome — o vínculo é
          reaproveitado em todos os próximos syncs.
        </p>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : pendingUnmatched.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            <p>Todos os advogados responsáveis já estão vinculados a um usuário.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingUnmatched.map((item) => (
              <div
                key={item.advogadoNameNormalized}
                className="flex flex-wrap items-center gap-2 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.advogadoName}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.clientCount} cliente{item.clientCount === 1 ? "" : "s"} ·{" "}
                    {item.totalProcesses} processo{item.totalProcesses === 1 ? "" : "s"} em aberto
                  </p>
                </div>
                <Select
                  value={selection[item.advogadoNameNormalized] ?? ""}
                  onValueChange={(value) =>
                    setSelection((prev) => ({ ...prev, [item.advogadoNameNormalized]: value }))
                  }
                >
                  <SelectTrigger size="sm" className="w-56">
                    <SelectValue placeholder="Selecionar usuário..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={!selection[item.advogadoNameNormalized] || saving === item.advogadoNameNormalized}
                  onClick={() => handleSave(item.advogadoNameNormalized)}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  {saving === item.advogadoNameNormalized ? "Salvando..." : "Vincular"}
                </Button>
              </div>
            ))}
          </div>
        )}

        {overrides.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Já vinculados manualmente
            </p>
            <div className="flex flex-wrap gap-1.5">
              {overrides.map((o) => (
                <Badge key={o.advogadoNameNormalized} variant="outline" className="text-xs">
                  {o.advogadoNameNormalized} → {o.userName ?? "usuário removido"}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
