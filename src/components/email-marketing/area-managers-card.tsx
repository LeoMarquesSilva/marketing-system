"use client";

import { useEffect, useMemo, useState } from "react";
import { Link2, RefreshCw, X } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchActiveUsers, type User } from "@/lib/users";

interface AreaManager {
  area: string;
  userId: string;
  userName: string | null;
}

export function AreaManagersCard() {
  const [loading, setLoading] = useState(true);
  const [areas, setAreas] = useState<string[]>([]);
  const [managers, setManagers] = useState<AreaManager[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [newArea, setNewArea] = useState("");
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, activeUsers] = await Promise.all([
        fetch("/api/email-marketing/area-managers").then((r) => r.json()),
        fetchActiveUsers(),
      ]);
      if (res.error) throw new Error(res.error);
      setAreas(res.areas ?? []);
      setManagers(res.managers ?? []);
      setUsers(activeUsers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar gestores de área.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const managersByArea = useMemo(() => {
    const map = new Map<string, AreaManager[]>();
    for (const m of managers) {
      const list = map.get(m.area) ?? [];
      list.push(m);
      map.set(m.area, list);
    }
    return map;
  }, [managers]);

  const allAreas = useMemo(() => {
    const set = new Set(areas);
    for (const m of managers) set.add(m.area);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [areas, managers]);

  const areaToUse = selectedArea === "__nova__" ? newArea.trim() : selectedArea;

  const handleAdd = async () => {
    if (!areaToUse || !selectedUser) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/email-marketing/area-managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area: areaToUse, userId: selectedUser }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSelectedUser("");
      setNewArea("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao vincular gestor.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (area: string, userId: string) => {
    const key = `${area}::${userId}`;
    setRemoving(key);
    setError(null);
    try {
      const res = await fetch("/api/email-marketing/area-managers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area, userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover gestor.");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <Card className="rounded-xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Gestores por área jurídica</CardTitle>
        <Button variant="ghost" size="icon-sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          O sócio/gerente vinculado a uma área enxerga <strong>todos os clientes daquela área</strong> em
          &quot;Meus Clientes&quot; e pode designar quem contata. Para alterar o vínculo de uma
          pessoa, use{" "}
          <Link href="/usuarios" className="underline underline-offset-2">
            Usuários → Acesso
          </Link>{" "}
          (ícone de chave). Este card continua útil para ver a lista por área.
        </p>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
          <Select value={selectedArea} onValueChange={setSelectedArea}>
            <SelectTrigger size="sm" className="w-56">
              <SelectValue placeholder="Selecionar área..." />
            </SelectTrigger>
            <SelectContent>
              {allAreas.map((area) => (
                <SelectItem key={area} value={area}>
                  {area}
                </SelectItem>
              ))}
              <SelectItem value="__nova__">+ Nova área...</SelectItem>
            </SelectContent>
          </Select>

          {selectedArea === "__nova__" && (
            <Input
              value={newArea}
              onChange={(e) => setNewArea(e.target.value)}
              placeholder="Nome da área"
              className="h-8 w-44 text-sm"
            />
          )}

          <Select value={selectedUser} onValueChange={setSelectedUser}>
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

          <Button size="sm" className="gap-1.5" disabled={!areaToUse || !selectedUser || saving} onClick={handleAdd}>
            <Link2 className="h-3.5 w-3.5" />
            {saving ? "Salvando..." : "Vincular"}
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : managersByArea.size === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum gestor de área vinculado ainda.</p>
        ) : (
          <div className="space-y-2.5">
            {Array.from(managersByArea.entries())
              .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
              .map(([area, list]) => (
                <div key={area} className="rounded-lg border p-2.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                    {area}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {list.map((m) => (
                      <Badge key={m.userId} variant="outline" className="gap-1 pr-1 text-xs">
                        {m.userName ?? "usuário removido"}
                        <button
                          type="button"
                          onClick={() => handleRemove(area, m.userId)}
                          disabled={removing === `${area}::${m.userId}`}
                          className="ml-1 rounded-full p-0.5 hover:bg-muted"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
