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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Cloud, ExternalLink, ImageOff, Images, Loader2, Pencil } from "lucide-react";
import type { User } from "@/lib/users";
import { updateUser } from "@/lib/users";
import { COLLABORATOR_PHOTOS_BUCKET, isSupabaseStorageUrl } from "@/lib/storage-buckets";
import { CollaboratorPhotoUploadButton } from "@/components/usuarios/collaborator-photo-upload-button";
import { cn } from "@/lib/utils";

interface CollaboratorPhotosChecklistProps {
  users: User[];
  photoCountByUserId?: Record<string, number>;
  officialByUserId?: Record<string, boolean>;
  onUserUpdated: (user: User) => void;
  onEdit: (user: User) => void;
  onOpenGallery: (user: User) => void;
  onError: (message: string) => void;
}

export function CollaboratorPhotosChecklist({
  users,
  photoCountByUserId = {},
  officialByUserId = {},
  onUserUpdated,
  onEdit,
  onOpenGallery,
  onError,
}: CollaboratorPhotosChecklistProps) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [draftOnedrive, setDraftOnedrive] = useState<Record<string, string>>({});

  function getOnedriveDraft(user: User) {
    return draftOnedrive[user.id] ?? user.photo_onedrive_url ?? "";
  }

  async function patchUser(userId: string, patch: Parameters<typeof updateUser>[1]) {
    setSavingId(userId);
    onError("");
    const { data, error } = await updateUser(userId, patch);
    setSavingId(null);
    if (error) {
      onError(error);
      return null;
    }
    if (data) {
      onUserUpdated({ ...data, photo_collected: data.photo_collected ?? false });
    }
    return data;
  }

  async function toggleCollected(user: User, checked: boolean) {
    await patchUser(user.id, {
      photo_collected: checked,
      photo_collected_at: checked ? new Date().toISOString() : null,
    });
  }

  async function saveOnedrive(user: User) {
    const value = getOnedriveDraft(user).trim();
    if (value && !/^https?:\/\/.+/.test(value)) {
      onError("Link do OneDrive inválido. Use http ou https.");
      return;
    }
    if (value === (user.photo_onedrive_url ?? "")) return;
    const data = await patchUser(user.id, { photo_onedrive_url: value || null });
    if (data) {
      setDraftOnedrive((prev) => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });
    }
  }

  async function savePhotoFromUpload(user: User, publicUrl: string) {
    await patchUser(user.id, {
      avatar_url: publicUrl,
      photo_collected: true,
      photo_collected_at: new Date().toISOString(),
    });
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-center">OK</TableHead>
            <TableHead>Colaborador</TableHead>
            <TableHead className="hidden md:table-cell w-[140px]">Área</TableHead>
            <TableHead className="w-[180px]">Foto</TableHead>
            <TableHead>OneDrive (opcional)</TableHead>
            <TableHead className="w-[110px] text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const collected = user.photo_collected === true;
            const hasOnedrive = Boolean(user.photo_onedrive_url?.trim());
            const hasPhotoLink = Boolean(user.avatar_url?.trim());
            const isHostedPhoto =
              hasPhotoLink && isSupabaseStorageUrl(user.avatar_url!, COLLABORATOR_PHOTOS_BUCKET);
            const isSaving = savingId === user.id;
            const isActive = user.is_active !== false;

            return (
              <TableRow
                key={user.id}
                className={cn(
                  collected && "bg-emerald-50/40 dark:bg-emerald-950/10",
                  !isActive && "opacity-60"
                )}
              >
                <TableCell className="text-center align-middle">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void toggleCollected(user, !collected)}
                    className={cn(
                      "mx-auto flex h-6 w-6 items-center justify-center rounded-md border transition-colors",
                      collected
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-muted-foreground/30 hover:border-emerald-400"
                    )}
                    title={collected ? "Marcar como pendente" : "Marcar foto como obtida"}
                  >
                    {isSaving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : collected ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : null}
                  </button>
                </TableCell>
                <TableCell className="align-middle">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-sm">{user.name}</p>
                    {!isActive && (
                      <Badge variant="outline" className="mt-0.5 text-[10px]">
                        Ex-colaborador
                      </Badge>
                    )}
                    <p className="truncate text-xs text-muted-foreground md:hidden">{user.department}</p>
                    {(photoCountByUserId[user.id] ?? 0) > 0 && (
                      <p className="text-[11px] text-[#1a6b72]">
                        {photoCountByUserId[user.id]} na galeria
                        {officialByUserId[user.id] ? " · oficial escolhida" : " · oficial pendente"}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell align-middle text-sm text-muted-foreground">
                  {user.department}
                </TableCell>
                <TableCell className="align-middle">
                  <div className="flex items-center gap-2">
                    {hasPhotoLink ? (
                      <a
                        href={user.avatar_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block h-12 w-10 shrink-0 overflow-hidden rounded border bg-muted"
                        title="Abrir foto"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={user.avatar_url!}
                          alt={`Foto de ${user.name}`}
                          className="h-full w-full object-cover object-top"
                        />
                      </a>
                    ) : (
                      <div className="flex h-12 w-10 shrink-0 items-center justify-center rounded border border-dashed bg-muted/40 text-muted-foreground">
                        <ImageOff className="h-4 w-4" />
                      </div>
                    )}
                    <div className="min-w-0 space-y-1">
                      <CollaboratorPhotoUploadButton
                        userId={user.id}
                        disabled={isSaving}
                        onError={onError}
                        onUploaded={(url) => savePhotoFromUpload(user, url)}
                      />
                      {hasPhotoLink && (
                        <Badge
                          variant={isHostedPhoto ? "secondary" : "outline"}
                          className="text-[10px] font-normal"
                        >
                          {isHostedPhoto ? "Storage" : "Link externo"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="align-middle">
                  <Input
                    value={getOnedriveDraft(user)}
                    onChange={(e) =>
                      setDraftOnedrive((prev) => ({ ...prev, [user.id]: e.target.value }))
                    }
                    onBlur={() => void saveOnedrive(user)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.currentTarget.blur();
                      }
                    }}
                    placeholder="Link externo (opcional)…"
                    className="h-8 text-xs"
                    disabled={isSaving}
                  />
                </TableCell>
                <TableCell className="align-middle text-right">
                  <div className="flex justify-end gap-0.5">
                    {hasOnedrive && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-sky-600" asChild>
                        <a
                          href={user.photo_onedrive_url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir OneDrive"
                        >
                          <Cloud className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {hasPhotoLink && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <a
                          href={user.avatar_url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir foto"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Galeria da sessão"
                      onClick={() => onOpenGallery(user)}
                    >
                      <Images className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Editar links"
                      onClick={() => onEdit(user)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
