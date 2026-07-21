"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  X,
  Pencil,
  Copy,
  ImageOff,
  Check,
  UserRound,
  Cloud,
  LayoutGrid,
  ListChecks,
} from "lucide-react";
import type { User } from "@/lib/users";
import { updateUser } from "@/lib/users";
import { CollaboratorPhotoEditDialog, type CollaboratorPhotoFormValues } from "./collaborator-photo-edit-dialog";
import { CollaboratorPhotoUploadButton } from "./collaborator-photo-upload-button";
import { CollaboratorPhotosChecklist } from "./collaborator-photos-checklist";
import { cn } from "@/lib/utils";

interface CollaboratorPhotosGridProps {
  initialUsers: User[];
}

export function CollaboratorPhotosGrid({ initialUsers }: CollaboratorPhotosGridProps) {
  const [users, setUsers] = useState(initialUsers);
  const [viewMode, setViewMode] = useState<"checklist" | "grid">("checklist");
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [collectFilter, setCollectFilter] = useState<"all" | "obtidas" | "pendentes">("all");
  const [statusFilter, setStatusFilter] = useState<"ativos" | "todos">("ativos");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const departments = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => u.department && set.add(u.department));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [users]);

  const activeUsers = useMemo(
    () => users.filter((u) => u.is_active !== false),
    [users]
  );

  const stats = useMemo(() => {
    const pool = statusFilter === "ativos" ? activeUsers : users;
    const obtained = pool.filter((u) => u.photo_collected === true).length;
    return {
      total: pool.length,
      obtained,
      pending: pool.length - obtained,
    };
  }, [users, activeUsers, statusFilter]);

  const progressPct = stats.total > 0 ? Math.round((stats.obtained / stats.total) * 100) : 0;

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users
      .filter((u) => {
        if (statusFilter === "ativos" && u.is_active === false) return false;
        if (q && !u.name.toLowerCase().includes(q)) return false;
        if (deptFilter !== "all" && u.department !== deptFilter) return false;
        const collected = u.photo_collected === true;
        if (collectFilter === "obtidas" && !collected) return false;
        if (collectFilter === "pendentes" && collected) return false;
        return true;
      })
      .sort((a, b) => {
        const aDone = a.photo_collected === true;
        const bDone = b.photo_collected === true;
        if (aDone !== bDone) return aDone ? 1 : -1;
        return a.name.localeCompare(b.name);
      });
  }, [users, search, deptFilter, collectFilter, statusFilter]);

  const hasActiveFilters =
    search.trim() !== "" ||
    deptFilter !== "all" ||
    collectFilter !== "all" ||
    statusFilter !== "ativos";

  function clearFilters() {
    setSearch("");
    setDeptFilter("all");
    setCollectFilter("all");
    setStatusFilter("ativos");
  }

  function handleUserUpdated(data: User) {
    setUsers((prev) => prev.map((u) => (u.id === data.id ? { ...u, ...data } : u)));
  }

  async function handleSavePhoto(userId: string, values: CollaboratorPhotoFormValues) {
    setError(null);
    const collected = values.photo_collected === true;
    const { data, error: err } = await updateUser(userId, {
      avatar_url: values.avatar_url?.trim() || null,
      photo_onedrive_url: values.photo_onedrive_url?.trim() || null,
      photo_collected: collected,
      photo_collected_at: collected ? new Date().toISOString() : null,
    });
    if (err) {
      setError(err);
      return;
    }
    if (data) {
      handleUserUpdated(data);
      setEditingUser(null);
    }
  }

  async function handleQuickUpload(userId: string, publicUrl: string) {
    setError(null);
    const { data, error: err } = await updateUser(userId, {
      avatar_url: publicUrl,
      photo_collected: true,
      photo_collected_at: new Date().toISOString(),
    });
    if (err) {
      setError(err);
      return;
    }
    if (data) handleUserUpdated(data);
  }

  async function copyUrl(text: string, userId: string) {
    await navigator.clipboard.writeText(text);
    setCopiedId(userId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-xl border bg-gradient-to-r from-emerald-50/80 to-sky-50/50 px-4 py-3 dark:from-emerald-950/20 dark:to-sky-950/20">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Figurinha Copa — coleta de fotos</p>
            <p className="text-xs text-muted-foreground">
              Envie a foto para o storage (botão de upload) ou marque ✓ quando coletada. OneDrive é opcional.
            </p>
          </div>
          <p className="text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            {stats.obtained}/{stats.total}
            <span className="ml-1 text-sm font-normal text-muted-foreground">({progressPct}%)</span>
          </p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
          <p className="text-xs text-muted-foreground">Colaboradores</p>
          <p className="text-2xl font-semibold tabular-nums">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/50 px-4 py-3 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <p className="text-xs text-emerald-700 dark:text-emerald-400">Foto obtida</p>
          <p className="text-2xl font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">
            {stats.obtained}
          </p>
        </div>
        <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 px-4 py-3 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-xs text-amber-700 dark:text-amber-400">Pendentes</p>
          <p className="text-2xl font-semibold tabular-nums text-amber-800 dark:text-amber-300">
            {stats.pending}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar colaborador…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9 text-sm"
            />
          </div>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="h-9 w-[160px] text-xs">
              <SelectValue placeholder="Área" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as áreas</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={collectFilter}
            onValueChange={(v) => setCollectFilter(v as typeof collectFilter)}
          >
            <SelectTrigger className="h-9 w-[150px] text-xs">
              <SelectValue placeholder="Coleta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Coleta: todas</SelectItem>
              <SelectItem value="obtidas">Foto obtida</SelectItem>
              <SelectItem value="pendentes">Pendentes</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="h-9 w-[140px] text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ativos">Ativos</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-xs" onClick={clearFilters}>
              <X className="h-3.5 w-3.5" />
              Limpar
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {stats.pending > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 shrink-0"
              onClick={() => setCollectFilter("pendentes")}
            >
              Ver {stats.pending} pendentes
            </Button>
          )}
          <div className="flex rounded-lg border p-0.5">
            <Button
              variant={viewMode === "checklist" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={() => setViewMode("checklist")}
            >
              <ListChecks className="h-3.5 w-3.5" />
              Checklist
            </Button>
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Galeria
            </Button>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {filteredUsers.length} colaborador{filteredUsers.length !== 1 ? "es" : ""} exibido
        {filteredUsers.length !== 1 ? "s" : ""}
      </p>

      <CollaboratorPhotoEditDialog
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
        user={editingUser}
        onSubmit={handleSavePhoto}
        error={error}
      />

      {filteredUsers.length === 0 ? (
        <div className="rounded-xl border bg-card py-16 text-center shadow-sm">
          <UserRound className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum colaborador encontrado.</p>
        </div>
      ) : viewMode === "checklist" ? (
        <CollaboratorPhotosChecklist
          users={filteredUsers}
          onUserUpdated={handleUserUpdated}
          onEdit={(user) => {
            setError(null);
            setEditingUser(user);
          }}
          onError={setError}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
          {filteredUsers.map((user) => {
            const hasPhotoLink = Boolean(user.avatar_url?.trim());
            const hasOnedrive = Boolean(user.photo_onedrive_url?.trim());
            const collected = user.photo_collected === true;
            const isActive = user.is_active !== false;

            return (
              <article
                key={user.id}
                className={cn(
                  "group overflow-hidden rounded-lg border bg-card shadow-sm transition-shadow hover:shadow-md",
                  collected && "ring-1 ring-emerald-400/50",
                  !isActive && "opacity-70"
                )}
              >
                <div className="relative aspect-[3/4] max-h-44 bg-muted/40">
                  {hasPhotoLink ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.avatar_url!}
                      alt={`Foto de ${user.name}`}
                      className="h-full w-full object-cover object-top"
                    />
                  ) : hasOnedrive ? (
                    <div className="flex h-full flex-col items-center justify-center gap-1.5 bg-sky-50/80 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
                      <Cloud className="h-8 w-8 opacity-60" />
                      <span className="px-2 text-center text-[10px] leading-tight">Só OneDrive</span>
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
                      <ImageOff className="h-7 w-7 opacity-40" />
                      <span className="px-2 text-center text-[10px] leading-tight">Sem foto</span>
                    </div>
                  )}
                  {collected && (
                    <div className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500 text-white shadow">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent px-2 pb-2 pt-8">
                    <p className="truncate text-xs font-medium text-white">{user.name}</p>
                    <p className="truncate text-[10px] text-white/75">{user.department}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-1 border-t px-2 py-1.5">
                  <Badge
                    variant={collected ? "secondary" : "outline"}
                    className={cn(
                      "px-1.5 py-0 text-[10px] font-normal",
                      !collected && "border-amber-200 text-amber-700"
                    )}
                  >
                    {collected ? "Obtida" : "Pendente"}
                  </Badge>
                  <div className="flex gap-0.5">
                    <CollaboratorPhotoUploadButton
                      userId={user.id}
                      onError={setError}
                      onUploaded={(url) => handleQuickUpload(user.id, url)}
                      className="h-7 px-2"
                    />
                    {hasOnedrive && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-sky-600"
                        title="Abrir OneDrive"
                        asChild
                      >
                        <a
                          href={user.photo_onedrive_url!}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Cloud className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    )}
                    {hasPhotoLink && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Copiar link da foto"
                        onClick={() => copyUrl(user.avatar_url!, user.id)}
                      >
                        {copiedId === user.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Editar links"
                      onClick={() => {
                        setError(null);
                        setEditingUser(user);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
