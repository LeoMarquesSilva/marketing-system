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
  createdAt: string;
}

export interface EventPhotoAlbumDetail {
  album: EventPhotoAlbum;
  photos: EventPhoto[];
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
