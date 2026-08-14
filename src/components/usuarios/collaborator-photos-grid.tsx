"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Search, X, Images, ImageOff, UserRound } from "lucide-react";
import { ManagerGalleryDialog } from "@/components/collaborator-photos/manager-gallery-dialog";
import { fetchGallerySummary } from "@/lib/collaborator-photos/api";
import {
  computePhotoRosterStats,
  filterPhotoRoster,
  listPhotoRosterAreas,
  type PhotoGalleryFilter,
  type PhotoRosterPerson,
  type PhotoRosterSituation,
} from "@/lib/collaborator-photos/roster";
import { cn } from "@/lib/utils";

interface CollaboratorPhotosGridProps {
  initialPeople: PhotoRosterPerson[];
}

export function CollaboratorPhotosGrid({ initialPeople }: CollaboratorPhotosGridProps) {
  const [people] = useState(initialPeople);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [galleryFilter, setGalleryFilter] = useState<PhotoGalleryFilter>("all");
  const [situationFilter, setSituationFilter] = useState<PhotoRosterSituation>("ativos");
  const [galleryPerson, setGalleryPerson] = useState<PhotoRosterPerson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [officialByUserId, setOfficialByUserId] = useState<Record<string, boolean>>({});
  const [photoCountByUserId, setPhotoCountByUserId] = useState<Record<string, number>>({});

  async function refreshGallerySummary() {
    try {
      const summary = await fetchGallerySummary();
      setOfficialByUserId(summary.officialByUserId);
      setPhotoCountByUserId(summary.photoCountByUserId);
    } catch {
      // resumo opcional
    }
  }

  useEffect(() => {
    void refreshGallerySummary();
  }, []);

  const departments = useMemo(() => listPhotoRosterAreas(people), [people]);

  const situationPool = useMemo(() => {
    if (situationFilter === "ativos") return people.filter((p) => p.isActive);
    if (situationFilter === "inativos") return people.filter((p) => !p.isActive);
    return people;
  }, [people, situationFilter]);

  const stats = useMemo(
    () => computePhotoRosterStats(situationPool, photoCountByUserId),
    [situationPool, photoCountByUserId]
  );

  const filteredPeople = useMemo(
    () =>
      filterPhotoRoster(people, {
        search,
        department: deptFilter,
        situation: situationFilter,
        gallery: galleryFilter,
        photoCountByUserId,
      }),
    [people, search, deptFilter, situationFilter, galleryFilter, photoCountByUserId]
  );

  const hasActiveFilters =
    search.trim() !== "" ||
    deptFilter !== "all" ||
    galleryFilter !== "all" ||
    situationFilter !== "ativos";

  function clearFilters() {
    setSearch("");
    setDeptFilter("all");
    setGalleryFilter("all");
    setSituationFilter("ativos");
  }

  function openGallery(person: PhotoRosterPerson) {
    if (!person.userId) {
      setError(
        `${person.name} ainda não tem usuário no sistema. Cadastre o login em Usuários e vincule em Férias.`
      );
      return;
    }
    setError(null);
    setGalleryPerson(person);
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
          <p className="text-xs text-muted-foreground">Colaboradores (RH)</p>
          <p className="text-2xl font-semibold tabular-nums">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/50 px-4 py-3 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <p className="text-xs text-emerald-700 dark:text-emerald-400">Com fotos na galeria</p>
          <p className="text-2xl font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">
            {stats.withPhotos}
          </p>
        </div>
        <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 px-4 py-3 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-xs text-amber-700 dark:text-amber-400">Sem fotos</p>
          <p className="text-2xl font-semibold tabular-nums text-amber-800 dark:text-amber-300">
            {stats.withoutPhotos}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, área ou cargo…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9 text-sm"
            />
          </div>
          <Select
            value={galleryFilter}
            onValueChange={(v) => setGalleryFilter(v as PhotoGalleryFilter)}
          >
            <SelectTrigger className="h-9 w-[160px] text-xs">
              <SelectValue placeholder="Galeria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Galeria: todas</SelectItem>
              <SelectItem value="com_fotos">Com fotos</SelectItem>
              <SelectItem value="sem_fotos">Sem fotos</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={situationFilter}
            onValueChange={(v) => setSituationFilter(v as PhotoRosterSituation)}
          >
            <SelectTrigger className="h-9 w-[160px] text-xs">
              <SelectValue placeholder="Situação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ativos">Ativos</SelectItem>
              <SelectItem value="inativos">Ex-colaboradores</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-xs" onClick={clearFilters}>
              <X className="h-3.5 w-3.5" />
              Limpar
            </Button>
          )}
          {stats.withoutPhotos > 0 && situationFilter === "ativos" && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 shrink-0"
              onClick={() => setGalleryFilter("sem_fotos")}
            >
              Ver {stats.withoutPhotos} sem fotos
            </Button>
          )}
        </div>

        {departments.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={deptFilter === "all" ? "default" : "outline"}
              className="h-8 rounded-full px-3 text-xs"
              onClick={() => setDeptFilter("all")}
            >
              Todas as áreas
            </Button>
            {departments.map((department) => (
              <Button
                key={department}
                type="button"
                size="sm"
                variant={deptFilter === department ? "default" : "outline"}
                className="h-8 rounded-full px-3 text-xs"
                onClick={() => setDeptFilter(department)}
              >
                {department}
              </Button>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {filteredPeople.length} colaborador{filteredPeople.length !== 1 ? "es" : ""} · mesmas áreas
        de Férias (RH / VIOS)
      </p>

      <ManagerGalleryDialog
        open={!!galleryPerson?.userId}
        person={
          galleryPerson?.userId
            ? {
                id: galleryPerson.userId,
                name: galleryPerson.name,
                department: galleryPerson.department,
                avatar_url: galleryPerson.avatarUrl,
              }
            : null
        }
        onOpenChange={(open) => !open && setGalleryPerson(null)}
        onChanged={() => void refreshGallerySummary()}
      />

      {filteredPeople.length === 0 ? (
        <div className="rounded-xl border bg-card py-16 text-center shadow-sm">
          <UserRound className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum colaborador encontrado.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
          {filteredPeople.map((person) => {
            const photoCount = person.userId ? photoCountByUserId[person.userId] ?? 0 : 0;
            const hasOfficial = person.userId ? officialByUserId[person.userId] === true : false;
            const hasPreview = Boolean(person.avatarUrl?.trim());

            return (
              <article
                key={person.employeeId}
                className={cn(
                  "group overflow-hidden rounded-lg border bg-card shadow-sm transition-shadow hover:shadow-md",
                  photoCount > 0 && "ring-1 ring-emerald-400/40",
                  !person.isActive && "opacity-70"
                )}
              >
                <button
                  type="button"
                  className="relative aspect-[3/4] max-h-44 w-full bg-muted/40 text-left"
                  onClick={() => openGallery(person)}
                  title={person.userId ? "Abrir galeria" : "Sem usuário no sistema"}
                >
                  {hasPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={person.avatarUrl!}
                      alt={`Foto de ${person.name}`}
                      className="h-full w-full object-cover object-top"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
                      <ImageOff className="h-7 w-7 opacity-40" />
                      <span className="px-2 text-center text-[10px] leading-tight">
                        {person.userId ? "Sem foto" : "Sem login"}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent px-2 pb-2 pt-8">
                    <p className="truncate text-xs font-medium text-white">{person.name}</p>
                    <p className="truncate text-[10px] text-white/75">
                      {person.department ?? "—"}
                    </p>
                  </div>
                </button>

                <div className="flex items-start justify-between gap-1.5 border-t px-2 py-1.5">
                  <Badge
                    variant={photoCount > 0 ? "secondary" : "outline"}
                    className={cn(
                      "h-auto min-w-0 flex-1 whitespace-normal px-1.5 py-0.5 text-left text-[10px] font-normal leading-snug",
                      photoCount === 0 && "border-amber-200 text-amber-700"
                    )}
                  >
                    {photoCount > 0
                      ? `${photoCount} foto${photoCount === 1 ? "" : "s"}${hasOfficial ? " · Sistemas do escritório" : ""}`
                      : "Pendente"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    title="Galeria"
                    disabled={!person.userId}
                    onClick={() => openGallery(person)}
                  >
                    <Images className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
