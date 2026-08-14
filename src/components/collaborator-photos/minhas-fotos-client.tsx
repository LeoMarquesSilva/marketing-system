"use client";

import { useCallback, useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
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

export function MinhasFotosClient() {
  const { profile, refreshProfile } = useAuth();
  const [photos, setPhotos] = useState<CollaboratorPhoto[]>([]);
  const [usageTypes, setUsageTypes] = useState<PhotoUsageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyPhotoId, setBusyPhotoId] = useState<string | null>(null);
  const [tourKey, setTourKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [nextPhotos, nextTypes] = await Promise.all([fetchGallery(), fetchUsageTypes()]);
        if (cancelled) return;
        setPhotos(nextPhotos);
        setUsageTypes(nextTypes);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro ao carregar fotos.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    } finally {
      setBusyPhotoId(null);
    }
  }

  async function handleDelete(photo: CollaboratorPhoto) {
    if (!confirm("Excluir esta foto da sua galeria?")) return;
    setBusyPhotoId(photo.id);
    setError(null);
    try {
      await deleteGalleryPhoto(photo.id);
      setPhotos((prev) => prev.filter((item) => item.id !== photo.id));
      if (photo.usageSlugs.includes("oficial")) await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir foto.");
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

  return (
    <div className="space-y-6">
      <div
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        data-tour="mf-header"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1a6b72]">
            Sessão corporativa
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground">Minhas fotos</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Escolha quais fotos o marketing pode usar. A foto dos sistemas do escritório atualiza
            seu avatar e o perfil NFC na hora.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={restartTour}>
          <HelpCircle className="mr-2 h-4 w-4" />
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

      <div className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-[#dce9eb] bg-white px-6 py-16 text-center text-sm text-muted-foreground">
            Carregando suas fotos…
          </div>
        ) : (
          <>
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                {error}
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
              <p className="text-xs text-[#04202f]/55">
                A <span className="font-semibold">foto dos sistemas do escritório</span> vira seu
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
