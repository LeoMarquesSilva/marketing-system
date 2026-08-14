export interface PhotoUsageAssignment {
  userId: string;
  usageTypeSlug: string;
  photoId: string;
}

export interface PhotoUsageType {
  id: string;
  slug: string;
  label: string;
  isOfficial: boolean;
  isSystem: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface CollaboratorPhoto {
  id: string;
  userId: string;
  storagePath: string;
  publicUrl: string;
  originalFilename: string | null;
  uploadedBy: string | null;
  createdAt: string;
  usageSlugs: string[];
}
