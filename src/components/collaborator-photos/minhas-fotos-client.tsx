"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { PhotoGalleryGrid } from "@/components/collaborator-photos/photo-gallery-grid";
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

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#dce9eb] bg-white px-6 py-16 text-center text-sm text-muted-foreground">
        Carregando suas fotos…
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
          A foto <span className="font-semibold">Oficial</span> vira seu avatar no sistema e a foto do
          perfil NFC. A mesma foto pode ter mais de um uso.
          {profile?.name ? ` Logado como ${profile.name}.` : ""}
        </p>
      )}
    </div>
  );
}
