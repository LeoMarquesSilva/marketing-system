export interface ReadingRecommendation {
  id: string;
  userId: string;
  publicName: string;
  practiceArea: string;
  role: string;
  roleOverride: string | null;
  profilePhotoUrl: string | null;
  photoOverrideUrl: string | null;
  photoUrl: string | null;
  bookTitle: string | null;
  bookAuthor: string | null;
  bookCoverUrl: string | null;
  recommendationText: string | null;
  trajectoryNote: string | null;
  bookLink: string | null;
  displayOrder: number;
  isVisible: boolean;
  isComplete: boolean;
  updatedAt: string;
}

export interface ReadingRecommendationsResult {
  items: ReadingRecommendation[];
  summary: {
    total: number;
    visible: number;
    complete: number;
    pending: number;
  };
}
