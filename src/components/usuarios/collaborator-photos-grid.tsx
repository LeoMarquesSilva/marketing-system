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
  ExternalLink,
  ImageOff,
  Check,
  UserRound,
  Cloud,
} from "lucide-react";
import type { User } from "@/lib/users";
import { updateUser } from "@/lib/users";
import { CollaboratorPhotoEditDialog, type CollaboratorPhotoFormValues } from "./collaborator-photo-edit-dialog";
import { cn } from "@/lib/utils";

interface CollaboratorPhotosGridProps {
  initialUsers: User[];
}

export function CollaboratorPhotosGrid({ initialUsers }: CollaboratorPhotosGridProps) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [photoFilter, setPhotoFilter] = useState<"all" | "com" | "sem">("all");
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
    const withPhoto = pool.filter(
      (u) => Boolean(u.avatar_url?.trim()) || Boolean(u.photo_onedrive_url?.trim())
    ).length;
    return {
      total: pool.length,
      withPhoto,
      withoutPhoto: pool.length - withPhoto,
    };
  }, [users, activeUsers, statusFilter]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users
      .filter((u) => {
        if (statusFilter === "ativos" && u.is_active === false) return false;
        if (q && !u.name.toLowerCase().includes(q)) return false;
        if (deptFilter !== "all" && u.department !== deptFilter) return false;
        const hasPhoto = Boolean(u.avatar_url?.trim()) || Boolean(u.photo_onedrive_url?.trim());
        if (photoFilter === "com" && !hasPhoto) return false;
        if (photoFilter === "sem" && hasPhoto) return false;
        return true;
      })
      .sort((a, b) => {
        const aPhoto = Boolean(a.avatar_url?.trim()) || Boolean(a.photo_onedrive_url?.trim());
        const bPhoto = Boolean(b.avatar_url?.trim()) || Boolean(b.photo_onedrive_url?.trim());
        if (aPhoto !== bPhoto) return aPhoto ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [users, search, deptFilter, photoFilter, statusFilter]);

  const hasActiveFilters =
    search.trim() !== "" ||
    deptFilter !== "all" ||
    photoFilter !== "all" ||
    statusFilter !== "ativos";

  function clearFilters() {
    setSearch("");
    setDeptFilter("all");
    setPhotoFilter("all");
    setStatusFilter("ativos");
  }

  async function handleSavePhoto(userId: string, values: CollaboratorPhotoFormValues) {
    setError(null);
    const { data, error: err } = await updateUser(userId, {
      avatar_url: values.avatar_url?.trim() || null,
      photo_onedrive_url: values.photo_onedrive_url?.trim() || null,
    });
    if (err) {
      setError(err);
      return;
    }
    if (data) {
      setUsers((prev) => prev.map((u) => (u.id === data.id ? { ...u, ...data } : u)));
      setEditingUser(null);
    }
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

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
          <p className="text-xs text-muted-foreground">Colaboradores</p>
          <p className="text-2xl font-semibold tabular-nums">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/50 px-4 py-3 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <p className="text-xs text-emerald-700 dark:text-emerald-400">Com foto cadastrada</p>
          <p className="text-2xl font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">
            {stats.withPhoto}
          </p>
        </div>
        <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 px-4 py-3 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-xs text-amber-700 dark:text-amber-400">Sem foto</p>
          <p className="text-2xl font-semibold tabular-nums text-amber-800 dark:text-amber-300">
            {stats.withoutPhoto}
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
          <Select value={photoFilter} onValueChange={(v) => setPhotoFilter(v as typeof photoFilter)}>
            <SelectTrigger className="h-9 w-[150px] text-xs">
              <SelectValue placeholder="Foto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Foto: todas</SelectItem>
              <SelectItem value="com">Com foto</SelectItem>
              <SelectItem value="sem">Sem foto</SelectItem>
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
        {stats.withoutPhoto > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 shrink-0"
            onClick={() => setPhotoFilter("sem")}
          >
            Ver {stats.withoutPhoto} sem foto
          </Button>
        )}
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
      ) : (
        <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
          {filteredUsers.map((user) => {
            const hasPhotoLink = Boolean(user.avatar_url?.trim());
            const hasOnedrive = Boolean(user.photo_onedrive_url?.trim());
            const hasPhoto = hasPhotoLink || hasOnedrive;
            const isActive = user.is_active !== false;

            return (
              <article
                key={user.id}
                className={cn(
                  "group overflow-hidden rounded-lg border bg-card shadow-sm transition-shadow hover:shadow-md",
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
                      <span className="text-[10px] px-2 text-center leading-tight">Só OneDrive</span>
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
                      <ImageOff className="h-7 w-7 opacity-40" />
                      <span className="text-[10px] px-2 text-center leading-tight">Sem foto</span>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent px-2 pb-2 pt-8">
                    <p className="truncate text-xs font-medium text-white">{user.name}</p>
                    <p className="truncate text-[10px] text-white/75">{user.department}</p>
                  </div>
                  {!isActive && (
                    <Badge
                      variant="outline"
                      className="absolute left-1.5 top-1.5 border-amber-200 bg-amber-50/90 px-1.5 py-0 text-[10px] text-amber-800"
                    >
                      Ex
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between gap-1 border-t px-2 py-1.5">
                  <Badge
                    variant={hasPhoto ? "secondary" : "outline"}
                    className={cn(
                      "px-1.5 py-0 text-[10px] font-normal",
                      !hasPhoto && "border-amber-200 text-amber-700"
                    )}
                  >
                    {hasPhoto ? "OK" : "Pendente"}
                  </Badge>
                  <div className="flex gap-0.5">
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
                      <>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Abrir foto"
                          asChild
                        >
                          <a href={user.avatar_url!} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title={hasPhoto ? "Editar foto" : "Cadastrar foto"}
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
