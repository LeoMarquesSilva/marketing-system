"use client";

import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, Pencil, Trash2, UserX, UserCheck, KeyRound, Search, X } from "lucide-react";
import type { User } from "@/lib/users";
import { createUser, updateUser, deleteUser, toggleUserActive } from "@/lib/users";
import { formatAuthDateTime, formatAuthRelative, formatLastAccess } from "@/lib/users-auth-activity";
import type { Area } from "@/lib/areas";
import { UserFormDialog, type UserFormValues } from "./user-form-dialog";
import { UserAccessDialog } from "./user-access-dialog";
import { cn } from "@/lib/utils";
import { userMatchesSearch } from "@/lib/user-search";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface UsersTableProps {
  initialUsers: User[];
  initialAreas: Area[];
}

export function UsersTable({ initialUsers, initialAreas }: UsersTableProps) {
  const [users, setUsers] = useState(initialUsers);
  const [areas, setAreas] = useState(initialAreas);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [accessFilter, setAccessFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteUserTarget, setDeleteUserTarget] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null);
  const [accessUser, setAccessUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  const departments = useMemo(() => {
    const set = new Set<string>();
    areas.forEach((a) => a.name && set.add(a.name));
    users.forEach((u) => u.department && set.add(u.department));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [areas, users]);

  const filteredUsers = useMemo(() => {
    const q = search.trim();
    return users.filter((u) => {
      if (q) {
        const hay = `${u.name} ${u.email ?? ""} ${u.department ?? ""} ${(u.managedLegalAreas ?? []).join(" ")}`;
        if (!userMatchesSearch(hay, q)) return false;
      }
      if (deptFilter !== "all" && u.department !== deptFilter) return false;
      const isActive = u.is_active !== false;
      if (statusFilter === "ativo" && !isActive) return false;
      if (statusFilter === "inativo" && isActive) return false;
      const hasLogin = Boolean(u.auth_id);
      if (accessFilter === "com" && !hasLogin) return false;
      if (accessFilter === "sem" && hasLogin) return false;
      return true;
    });
  }, [users, search, deptFilter, statusFilter, accessFilter]);

  const hasActiveFilters =
    search.trim() !== "" || deptFilter !== "all" || statusFilter !== "all" || accessFilter !== "all";

  function clearFilters() {
    setSearch("");
    setDeptFilter("all");
    setStatusFilter("all");
    setAccessFilter("all");
  }

  function handleAccessUpdated(id: string, patch: Partial<User>) {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
    setAccessUser((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
  }

  async function handleCreate(values: UserFormValues) {
    setError(null);
    const { data, error: err } = await createUser({
      name: values.name,
      email: values.email || null,
      department: values.department,
      avatar_url: values.avatar_url?.trim() || null,
    });
    if (err) {
      setError(err);
      return;
    }
    if (data) {
      setUsers((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setCreateOpen(false);
    }
  }

  async function handleUpdate(values: UserFormValues) {
    if (!editingUser) return;
    setError(null);
    const { data, error: err } = await updateUser(editingUser.id, {
      name: values.name,
      email: values.email || null,
      department: values.department,
      avatar_url: values.avatar_url?.trim() || null,
    });
    if (err) {
      setError(err);
      return;
    }
    if (data) {
      setUsers((prev) =>
        prev.map((u) => (u.id === data.id ? data : u)).sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditOpen(false);
      setEditingUser(null);
    }
  }

  async function handleDelete() {
    if (!deleteUserTarget) return;
    setDeleteLoading(true);
    const { error: err } = await deleteUser(deleteUserTarget.id);
    setDeleteLoading(false);
    if (!err) {
      setUsers((prev) => prev.filter((u) => u.id !== deleteUserTarget.id));
      setDeleteUserTarget(null);
    } else {
      setError(err);
    }
  }

  function openEdit(user: User) {
    setError(null);
    setEditingUser(user);
    setEditOpen(true);
  }

  async function handleToggleActive(user: User, skipConfirm = false) {
    const isActive = user.is_active !== false;
    if (isActive && !skipConfirm) {
      setDeactivateTarget(user);
      return;
    }
    setError(null);
    setTogglingId(user.id);
    setDeactivateTarget(null);
    const { data, error: err } = await toggleUserActive(user.id);
    setTogglingId(null);
    if (err) {
      setError(err);
      return;
    }
    if (data) {
      setUsers((prev) =>
        prev.map((u) => (u.id === data.id ? data : u)).sort((a, b) => a.name.localeCompare(b.name))
      );
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, e-mail…"
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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[140px] text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Status: todos</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="inativo">Ex-colaboradores</SelectItem>
            </SelectContent>
          </Select>
          <Select value={accessFilter} onValueChange={setAccessFilter}>
            <SelectTrigger className="h-9 w-[150px] text-xs">
              <SelectValue placeholder="Acesso" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Acesso: todos</SelectItem>
              <SelectItem value="com">Com login</SelectItem>
              <SelectItem value="sem">Sem login</SelectItem>
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-xs" onClick={clearFilters}>
              <X className="h-3.5 w-3.5" />
              Limpar
            </Button>
          )}
        </div>
        <Button onClick={() => { setError(null); setCreateOpen(true); }} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          Novo usuário
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {filteredUsers.length} de {users.length} usuário{users.length !== 1 ? "s" : ""}
      </p>

      <UserFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        areas={areas}
        onAreasChange={setAreas}
        editingUser={null}
        onSubmit={handleCreate}
        submitLabel="Adicionar"
        error={error}
      />

      <UserAccessDialog
        open={!!accessUser}
        onOpenChange={(open) => !open && setAccessUser(null)}
        user={accessUser}
        onUpdated={handleAccessUpdated}
      />

      <UserFormDialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditingUser(null);
        }}
        areas={areas}
        onAreasChange={setAreas}
        editingUser={editingUser}
        onSubmit={handleUpdate}
        submitLabel="Salvar"
        error={error}
      />

      <Dialog open={!!deactivateTarget} onOpenChange={(open) => !open && setDeactivateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desativar usuário</DialogTitle>
            <DialogDescription>
              Desativar {deactivateTarget?.name}? O usuário não aparecerá mais nas seleções de
              solicitante, mas os registros históricos serão mantidos. Você pode reativar depois.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateTarget(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => deactivateTarget && handleToggleActive(deactivateTarget, true)}
              disabled={togglingId === deactivateTarget?.id}
            >
              {togglingId === deactivateTarget?.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Desativar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteUserTarget} onOpenChange={(open) => !open && setDeleteUserTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir usuário</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir {deleteUserTarget?.name}? Esta ação não pode ser
              desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUserTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>Gestor de área</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Último acesso</TableHead>
              <TableHead className="w-[160px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum usuário encontrado com esses filtros.
                </TableCell>
              </TableRow>
            )}
            {filteredUsers.map((user) => {
              const isActive = user.is_active !== false;
              return (
                <TableRow
                  key={user.id}
                  className={!isActive ? "opacity-60 bg-muted/30" : undefined}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar_url || undefined} alt={user.name} />
                        <AvatarFallback className="text-xs">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{user.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.email || "—"}
                  </TableCell>
                  <TableCell>{user.department}</TableCell>
                  <TableCell>
                    {(user.managedLegalAreas ?? []).length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {(user.managedLegalAreas ?? []).map((area) => (
                          <Badge key={area} variant="outline" className="font-normal">
                            {area}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {isActive ? (
                      <Badge variant="secondary" className="font-normal">
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="font-normal text-muted-foreground border-amber-200 bg-amber-50">
                        Ex-colaborador
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.auth_id ? (
                      <div className="space-y-0.5">
                        <span
                          className="text-sm text-foreground"
                          title={
                            user.last_seen_at
                              ? `Último acesso: ${formatAuthDateTime(user.last_seen_at)}`
                              : user.auth_activity?.last_sign_in_at
                                ? `Último login: ${formatAuthDateTime(user.auth_activity.last_sign_in_at)}`
                                : "Conta criada, mas ainda sem acesso registrado"
                          }
                        >
                          {formatLastAccess(user.last_seen_at, user.auth_activity, Boolean(user.auth_id))}
                        </span>
                        {user.auth_activity?.last_sign_in_at &&
                          user.last_seen_at &&
                          user.auth_activity.last_sign_in_at !== user.last_seen_at && (
                          <p className="text-[11px] text-muted-foreground">
                            Login com senha {formatAuthRelative(user.auth_activity.last_sign_in_at)}
                          </p>
                        )}
                        {user.auth_activity?.account_created_at && !user.last_seen_at && (
                          <p className="text-[11px] text-muted-foreground">
                            Conta criada {formatAuthRelative(user.auth_activity.account_created_at)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Sem login</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-8 w-8",
                          user.auth_id ? "text-emerald-600" : "text-muted-foreground"
                        )}
                        onClick={() => { setError(null); setAccessUser(user); }}
                        title="Gerenciar acesso, permissões e gestor de área"
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(user)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleToggleActive(user, !isActive)}
                        disabled={togglingId === user.id}
                        title={isActive ? "Desativar" : "Reativar"}
                      >
                        {togglingId === user.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isActive ? (
                          <UserX className="h-4 w-4 text-amber-600" />
                        ) : (
                          <UserCheck className="h-4 w-4 text-green-600" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => { setError(null); setDeleteUserTarget(user); }}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
