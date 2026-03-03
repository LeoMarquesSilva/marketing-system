"use client";

import { useState } from "react";
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
import { Plus, Loader2, Pencil, Trash2, UserX, UserCheck } from "lucide-react";
import type { User } from "@/lib/users";
import { createUser, updateUser, deleteUser, toggleUserActive } from "@/lib/users";
import type { Area } from "@/lib/areas";
import { UserFormDialog, type UserFormValues } from "./user-form-dialog";

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
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteUserTarget, setDeleteUserTarget] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      <div className="flex justify-end">
        <Button onClick={() => { setError(null); setCreateOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Novo usuário
        </Button>
      </div>

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
              <TableHead>Status</TableHead>
              <TableHead className="w-[160px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
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
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
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
