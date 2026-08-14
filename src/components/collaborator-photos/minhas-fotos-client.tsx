"use client";

import { useCallback, useEffect, useState } from "react";
import { Camera, CircleCheck, CircleDashed, HelpCircle, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { PhotoGalleryGrid } from "@/components/collaborator-photos/photo-gallery-grid";
import {
  MinhasFotosTour,
  startMinhasFotosTour,
} from "@/components/collaborator-photos/minhas-fotos-tour";
import {
  deleteGalleryPhoto,
  fetchGallery,
  fetchUsageTypes,
  setGalleryUsage,
} from "@/lib/collaborator-photos/api";
import type { CollaboratorPhoto, PhotoUsageType } from "@/lib/collaborator-photos/types";

function GallerySkeleton() {
  return (
    <div
      className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
      aria-label="Carregando suas fotos"
    >
      {Array.from({ length: 10 }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-lg border border-[#dce9eb] bg-white">
          <div className="aspect-[3/4] animate-pulse bg-[#eaf1f2]" />
          <div className="space-y-2 border-t border-[#edf3f4] p-2">
            <div className="h-8 animate-pulse rounded-md bg-[#edf3f4]" />
            <div className="h-8 animate-pulse rounded-md bg-[#edf3f4]" />
          </div>
          <div className="h-10 animate-pulse border-t border-[#edf3f4] bg-[#f8fbfb]" />
        </div>
      ))}
    </div>
  );
}

export function MinhasFotosClient() {
  const { profile, refreshProfile } = useAuth();
  const [photos, setPhotos] = useState<CollaboratorPhoto[]>([]);
  const [usageTypes, setUsageTypes] = useState<PhotoUsageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyPhotoId, setBusyPhotoId] = useState<string | null>(null);
  const [tourKey, setTourKey] = useState(0);

  const loadGallery = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextPhotos, nextTypes] = await Promise.all([fetchGallery(), fetchUsageTypes()]);
      setPhotos(nextPhotos);
      setUsageTypes(nextTypes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar fotos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGallery();
  }, [loadGallery]);

  async function handleToggle(photo: CollaboratorPhoto, usage: PhotoUsageType) {
    setBusyPhotoId(photo.id);
    setError(null);
    const assigned = !photo.usageSlugs.includes(usage.slug);
    try {
      const next = await setGalleryUsage({
        photoId: photo.id,
        usageTypeId: usage.id,
        assigned,
      });
      setPhotos(next);
      if (usage.isOfficial) await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar uso.");
      throw err;
    } finally {
      setBusyPhotoId(null);
    }
  }

  async function handleDelete(photo: CollaboratorPhoto) {
    if (!confirm("Excluir esta foto da sua galeria?")) return false;
    setBusyPhotoId(photo.id);
    setError(null);
    try {
      await deleteGalleryPhoto(photo.id);
      setPhotos((prev) => prev.filter((item) => item.id !== photo.id));
      if (photo.usageSlugs.includes("oficial")) await refreshProfile();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir foto.");
      throw err;
    } finally {
      setBusyPhotoId(null);
    }
  }

  function restartTour() {
    startMinhasFotosTour();
    setTourKey((current) => current + 1);
  }

  const persistTourCompleted = useCallback(async () => {
    try {
      await fetch("/api/account/minhas-fotos-tutorial-completed", {
        method: "POST",
        credentials: "include",
      });
      await refreshProfile();
    } catch {
      // O tour já foi fechado localmente; falha ao persistir não bloqueia o módulo.
    }
  }, [refreshProfile]);

  const officialSelected = photos.some((photo) => photo.usageSlugs.includes("oficial"));

  return (
    <div className="space-y-5">
      <div
        className="flex flex-col gap-4 border-b border-[#dce9eb] pb-5 sm:flex-row sm:items-end sm:justify-between"
        data-tour="mf-header"
      >
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold text-[#347796]">
            <Camera className="h-3.5 w-3.5" aria-hidden="true" />
            Sessão corporativa
          </p>
          <h2 className="mt-1.5 text-2xl font-semibold leading-tight text-[#102f3d]">Minhas fotos</h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[#5e7a85]">
            Escolha quais fotos o marketing pode usar. A foto dos sistemas do escritório atualiza
            seu avatar e o perfil NFC na hora.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={restartTour}>
          <HelpCircle className="h-4 w-4" />
          Ver guia
        </Button>
      </div>

      <MinhasFotosTour
        key={tourKey}
        dataReady={!loading}
        photoCount={photos.length}
        onComplete={persistTourCompleted}
        onSkip={persistTourCompleted}
      />

      {!loading && photos.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-[#dce9eb] bg-white px-3.5 py-2.5 text-xs text-[#456370] shadow-[0_1px_2px_rgba(3,32,47,0.04)]">
          <span className="font-mono tabular-nums text-[#153f51]">
            {photos.length} foto{photos.length === 1 ? "" : "s"} disponível{photos.length === 1 ? "" : "is"}
          </span>
          <span className="hidden h-4 w-px bg-[#dce9eb] sm:block" aria-hidden="true" />
          <span className="flex items-center gap-1.5">
            {officialSelected ? (
              <CircleCheck className="h-4 w-4 text-[#347796]" aria-hidden="true" />
            ) : (
              <CircleDashed className="h-4 w-4 text-[#8a6a22]" aria-hidden="true" />
            )}
            {officialSelected
              ? "Foto dos sistemas definida"
              : "Escolha uma foto para os sistemas do escritório"}
          </span>
          <span className="ml-auto hidden text-[#6d858e] md:inline">Clique em uma foto para ampliar</span>
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <GallerySkeleton />
        ) : (
          <>
            {error && (
              <div
                role="alert"
                className="flex flex-col gap-3 rounded-lg border border-destructive/35 bg-destructive/[0.08] px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"
              >
                <span>{error}</span>
                {photos.length === 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => void loadGallery()}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Tentar novamente
                  </Button>
                )}
              </div>
            )}
            <PhotoGalleryGrid
              photos={photos}
              usageTypes={usageTypes}
              busyPhotoId={busyPhotoId}
              emptyTitle="Ainda não há fotos da sessão"
              emptyDescription="O marketing ainda não disponibilizou suas fotos. Quando a galeria estiver pronta, você escolhe aqui qual imagem usar em cada ação."
              canDelete
              onToggleUsage={handleToggle}
              onDelete={handleDelete}
            />
            {photos.length > 0 && (
              <p className="text-xs leading-relaxed text-[#5e7a85]">
                A <span className="font-semibold text-[#456370]">foto dos sistemas do escritório</span> vira seu
                avatar no sistema e a foto do perfil NFC. A mesma foto pode ter mais de um uso.
                {profile?.name ? ` Logado como ${profile.name}.` : ""}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
