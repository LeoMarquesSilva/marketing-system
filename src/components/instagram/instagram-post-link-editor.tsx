"use client";

import { useState } from "react";
import { Loader2, Plus, X, Users, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { AreaSelectWithCreate } from "@/components/usuarios/area-select-with-create";
import { AreaWithIcon } from "@/components/solicitacoes/area-with-icon";
import { UserSelectSearch } from "@/components/solicitacoes/user-select-search";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Area } from "@/lib/areas";
import type { User } from "@/lib/users";
import type { InstagramPost, PostSolicitante } from "@/lib/instagram-posts";
import {
  getPostAreas,
  getPostSolicitantes,
  isInstitutionalArea,
} from "@/lib/instagram-link-rules";
import { isUserActive } from "@/lib/user-status";
import { FormerEmployeeBadge } from "@/components/usuarios/former-employee-badge";
import { cn } from "@/lib/utils";

export interface PostLinkPatch {
  areas: string[];
  solicitantes: PostSolicitante[];
  skip_participants?: boolean;
}

interface InstagramPostLinkEditorProps {
  post: InstagramPost;
  areas: Area[];
  users: User[];
  saving?: boolean;
  compact?: boolean;
  onAreasChange: (areas: Area[]) => void;
  onSave: (patch: PostLinkPatch) => void;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function InstagramPostLinkEditor({
  post,
  areas,
  users,
  saving = false,
  compact = false,
  onAreasChange,
  onSave,
}: InstagramPostLinkEditorProps) {
  const initialAreas = getPostAreas(post);
  const initialSolicitantes = getPostSolicitantes(post);

  const [collabMode, setCollabMode] = useState(
    initialAreas.length > 1 || initialSolicitantes.length > 1
  );
  const [selectedAreas, setSelectedAreas] = useState<string[]>(
    initialAreas.length ? initialAreas : [""]
  );
  const [selectedSolicitantes, setSelectedSolicitantes] = useState<
    (PostSolicitante | null)[]
  >(initialSolicitantes.length ? initialSolicitantes : [null]);

  const activeAreas = selectedAreas.filter(Boolean);
  const activeSolicitantes = selectedSolicitantes.filter(
    (s): s is PostSolicitante => Boolean(s?.id)
  );
  const institutionalOnly =
    activeAreas.length > 0 && activeAreas.every((a) => isInstitutionalArea(a));

  const singleArea = activeAreas.length === 1 ? activeAreas[0] : undefined;
  const departmentFilter =
    !collabMode && singleArea && !isInstitutionalArea(singleArea)
      ? singleArea
      : undefined;

  const persist = (
    nextAreas: string[],
    nextSolicitantes: (PostSolicitante | null)[],
    skipParticipants?: boolean
  ) => {
    const cleanAreas = nextAreas.filter(Boolean);
    const cleanSolicitantes = nextSolicitantes.filter(
      (s): s is PostSolicitante => Boolean(s?.id)
    );

    onSave({
      areas: cleanAreas,
      solicitantes: cleanSolicitantes,
      skip_participants:
        skipParticipants ??
        (cleanSolicitantes.length > 0 ? false : post.skip_participants),
    });
  };

  const handleCollabToggle = (enabled: boolean) => {
    setCollabMode(enabled);
    if (!enabled) {
      const firstArea = activeAreas[0] ?? "";
      const firstSolicitante = activeSolicitantes[0] ?? null;
      setSelectedAreas(firstArea ? [firstArea] : [""]);
      setSelectedSolicitantes([firstSolicitante]);
      persist(
        firstArea ? [firstArea] : [],
        [firstSolicitante],
        firstSolicitante ? false : post.skip_participants
      );
    } else if (selectedAreas.length < 2) {
      setSelectedAreas([...selectedAreas, ""]);
    }
    if (enabled && selectedSolicitantes.length < 2) {
      setSelectedSolicitantes([...selectedSolicitantes, null]);
    }
  };

  const handleAreaChange = (index: number, value: string) => {
    const next = [...selectedAreas];
    next[index] = value;
    setSelectedAreas(next);
    persist(next, selectedSolicitantes);
  };

  const handleAddArea = () => {
    setSelectedAreas([...selectedAreas, ""]);
  };

  const handleRemoveArea = (index: number) => {
    const next = selectedAreas.filter((_, i) => i !== index);
    const safe = next.length ? next : [""];
    setSelectedAreas(safe);
    persist(safe, selectedSolicitantes);
  };

  const handleSolicitanteChange = (index: number, userId: string) => {
    const next = [...selectedSolicitantes];
    if (!userId) {
      next[index] = null;
    } else {
      const user = users.find((u) => u.id === userId);
      if (user) next[index] = { id: user.id, name: user.name };
    }
    setSelectedSolicitantes(next);
    persist(selectedAreas, next, false);
  };

  const handleAddSolicitante = () => {
    setSelectedSolicitantes([...selectedSolicitantes, null]);
  };

  const handleRemoveSolicitante = (index: number) => {
    const next = selectedSolicitantes.filter((_, i) => i !== index);
    const safe = next.length ? next : [null];
    setSelectedSolicitantes(safe);
    persist(selectedAreas, safe);
  };

  const handleSkipParticipants = () => {
    setSelectedSolicitantes([null]);
    persist(selectedAreas, [null], true);
  };

  const usedSolicitanteIds = new Set(
    activeSolicitantes.map((s) => s.id).filter(Boolean)
  );

  return (
    <div className={cn(compact ? "space-y-2" : "space-y-4 pt-1 border-t border-border/40")}>
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3",
          compact ? "py-2" : "py-2.5"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Label className="text-sm font-medium">
            Collab entre áreas
          </Label>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            (2+ áreas e autores)
          </span>
        </div>
        <Button
          type="button"
          variant={collabMode ? "default" : "outline"}
          size="sm"
          className="rounded-lg h-8 shrink-0"
          onClick={() => handleCollabToggle(!collabMode)}
          disabled={saving}
        >
          {collabMode ? "Collab ativo" : "Ativar collab"}
        </Button>
      </div>

      <div className={cn("grid sm:grid-cols-2", compact ? "gap-3" : "gap-4")}>
        <div className={cn("min-w-0", compact ? "space-y-2" : "space-y-3")}>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            {collabMode ? "Áreas" : "Área responsável"}
          </label>

          {selectedAreas.map((areaValue, index) => (
            <div key={`area-${index}`} className="relative flex gap-2">
              {saving && index === 0 && (
                <Loader2 className="absolute right-12 top-2.5 h-4 w-4 animate-spin text-muted-foreground z-10" />
              )}
              <div className="flex-1 min-w-0">
                <AreaSelectWithCreate
                  areas={areas}
                  value={areaValue}
                  onValueChange={(val) => handleAreaChange(index, val)}
                  onAreasChange={onAreasChange}
                  placeholder={index === 0 ? "Selecione a área" : "Adicionar área"}
                  disabled={saving}
                />
              </div>
              {collabMode && selectedAreas.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-9 w-9"
                  onClick={() => handleRemoveArea(index)}
                  disabled={saving}
                  title="Remover área"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          {collabMode && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg h-8"
              onClick={handleAddArea}
              disabled={saving}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Adicionar área
            </Button>
          )}

          {activeAreas.length > 0 && !compact && (
            <div className="flex flex-wrap gap-1.5">
              {activeAreas.map((area) => (
                <AreaWithIcon key={area} area={area} className="text-sm" />
              ))}
              {collabMode && activeAreas.length > 1 && (
                <Badge variant="outline" className="rounded-full text-[10px]">
                  Collab
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className={cn("min-w-0", compact ? "space-y-2" : "space-y-3")}>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {collabMode ? "Autores" : "Solicitante"}
            {institutionalOnly && (
              <span className="normal-case font-normal text-muted-foreground/80 ml-1">
                (opcional)
              </span>
            )}
          </label>

          {(collabMode ? selectedSolicitantes : selectedSolicitantes.slice(0, 1)).map(
            (solicitante, index) => {
              const excludeIds = new Set(usedSolicitanteIds);
              if (solicitante?.id) excludeIds.delete(solicitante.id);

              return (
                <div key={`sol-${index}`} className="flex gap-2">
                  <div className="flex-1 min-w-0">
                    <UserSelectSearch
                      users={users.filter((u) => !excludeIds.has(u.id) || u.id === solicitante?.id)}
                      value={solicitante?.id ?? ""}
                      departmentFilter={departmentFilter}
                      allowClear
                      disabled={saving || activeAreas.length === 0}
                      onValueChange={(userId) => handleSolicitanteChange(index, userId)}
                      placeholder={
                        activeAreas.length === 0
                          ? "Selecione a área primeiro"
                          : institutionalOnly
                            ? "Opcional — pesquisar participante"
                            : collabMode
                              ? `Autor ${index + 1}`
                              : "Pesquisar solicitante"
                      }
                    />
                  </div>
                  {collabMode && selectedSolicitantes.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-9 w-9"
                      onClick={() => handleRemoveSolicitante(index)}
                      disabled={saving}
                      title="Remover autor"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            }
          )}

          {collabMode && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg h-8"
              onClick={handleAddSolicitante}
              disabled={saving || activeAreas.length === 0}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Adicionar autor
            </Button>
          )}

          {activeSolicitantes.length > 0 ? (
            !compact && (
              <div className="space-y-2">
                {activeSolicitantes.map((s) => {
                  const user = users.find((u) => u.id === s.id);
                  const inactive = user ? !isUserActive(user) : false;
                  return (
                    <div
                      key={s.id}
                      className={cn(
                        "flex items-center gap-2 text-sm rounded-lg px-2 py-1.5",
                        inactive && "bg-amber-50/80 border border-amber-200/60"
                      )}
                    >
                      <Avatar className={cn("h-6 w-6", inactive && "opacity-75")}>
                        <AvatarImage src={user?.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px]">
                          {getInitials(user?.name ?? s.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className={cn(inactive && "text-muted-foreground")}>
                        {user?.name ?? s.name}
                      </span>
                      {inactive && <FormerEmployeeBadge />}
                      {user?.department && (
                        <span className="text-xs text-muted-foreground">
                          ({user.department})
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : institutionalOnly ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Posts institucionais podem incluir quem participou (ex.: quem gravou).
              </p>
              {!post.skip_participants && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn("h-8 text-xs text-muted-foreground")}
                  onClick={handleSkipParticipants}
                  disabled={saving}
                >
                  Concluir sem participante
                </Button>
              )}
              {post.skip_participants && (
                <Badge variant="outline" className="rounded-full text-[10px]">
                  Concluído sem participante
                </Badge>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {activeAreas.length === 0
                ? "Selecione a área primeiro"
                : "Nenhum autor atribuído"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
