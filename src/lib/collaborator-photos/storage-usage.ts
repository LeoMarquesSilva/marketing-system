export const SUPABASE_PRO_STORAGE_QUOTA_BYTES = 100 * 1024 * 1024 * 1024;
export const PHOTOS_BUCKET_ID = "MARKETING-SYSTEM-FOTOS";

export type StorageBarTone = "ok" | "warn" | "danger";

export interface StorageBucketUsage {
  bucketId: string;
  files: number;
  bytes: number;
}

export interface StorageUsageSummary {
  usedBytes: number;
  photosBytes: number;
  photosFiles: number;
  quotaBytes: number;
  availableBytes: number;
  percent: number;
  buckets: StorageBucketUsage[];
}

export function formatStorageBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) {
    return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(mb)} MB`;
  }
  const gb = bytes / (1024 * 1024 * 1024);
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(gb)} GB`;
}

export function storageUsagePercent(usedBytes: number, quotaBytes: number): number {
  if (quotaBytes <= 0) return 0;
  return Math.min(100, Math.round((usedBytes / quotaBytes) * 100));
}

export function storageBarTone(percent: number): StorageBarTone {
  if (percent >= 90) return "danger";
  if (percent >= 70) return "warn";
  return "ok";
}

export function aggregateStorageUsage(
  buckets: StorageBucketUsage[],
  quotaBytes: number
): StorageUsageSummary {
  const usedBytes = buckets.reduce((sum, bucket) => sum + bucket.bytes, 0);
  const photos = buckets.find((bucket) => bucket.bucketId === PHOTOS_BUCKET_ID);
  return {
    usedBytes,
    photosBytes: photos?.bytes ?? 0,
    photosFiles: photos?.files ?? 0,
    quotaBytes,
    availableBytes: Math.max(0, quotaBytes - usedBytes),
    percent: storageUsagePercent(usedBytes, quotaBytes),
    buckets,
  };
}
