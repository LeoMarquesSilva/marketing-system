export interface EventPhotoAlbum {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  eventDate: string | null;
  eventId: string | null;
  coverPhotoId: string | null;
  coverUrl: string | null;
  isPublished: boolean;
  photoCount: number;
  createdAt: string;
}

export interface EventPhoto {
  id: string;
  albumId: string;
  storagePath: string;
  publicUrl: string;
  previewUrl: string | null;
  originalFilename: string | null;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  /** Fora do link de convidado (ex.: retrato individual de colaborador). */
  guestHidden: boolean;
  createdAt: string;
}

export interface EventPhotoAlbumDetail {
  album: EventPhotoAlbum;
  photos: EventPhoto[];
}

/** Link de convidado (sem login) de um álbum, visto pelo marketing. */
export interface EventPhotoShare {
  id: string;
  albumId: string;
  token: string;
  url: string;
  label: string;
  logoUrl: string | null;
  allowDownload: boolean;
  expiresAt: string | null;
  revokedAt: string | null;
  openCount: number;
  lastOpenedAt: string | null;
  createdAt: string;
  createdByName: string | null;
}

/** Foto como o convidado recebe: só endereços e medidas, nada de reconhecimento facial. */
export interface PublicGalleryPhoto {
  id: string;
  previewUrl: string;
  originalUrl: string;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  /** Nome no download: <album>-<nnn>.<ext>. */
  downloadName: string;
}

export interface PublicGallery {
  token: string;
  label: string;
  logoUrl: string | null;
  allowDownload: boolean;
  expiresAt: string | null;
  album: {
    slug: string;
    title: string;
    description: string | null;
    eventDate: string | null;
    location: string | null;
  };
  cover: { url: string; shareImageUrl: string } | null;
  photos: PublicGalleryPhoto[];
}

export interface FaceStatus {
  consented: boolean;
  consentedAt: string | null;
  consentVersion: string;
  referenceCount: number;
  matchCount: number;
  /** Marcações em "Talvez seja você" esperando a pessoa confirmar. */
  maybeCount: number;
  pendingScanAlbums: number;
}

export interface MyAlbumMatches {
  /** Aparece direto em "Em que eu apareço". */
  sure: string[];
  /** "Talvez seja você": a pessoa confirma ou recusa. */
  maybe: string[];
}

export interface ScanQueueAlbum {
  albumId: string;
  title: string;
  photos: Array<{ id: string; url: string }>;
}
