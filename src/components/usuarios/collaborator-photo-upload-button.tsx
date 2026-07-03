"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadCollaboratorPhoto } from "@/lib/storage-buckets";
import { cn } from "@/lib/utils";

interface CollaboratorPhotoUploadButtonProps {
  userId: string;
  disabled?: boolean;
  onUploaded: (publicUrl: string) => void | Promise<void>;
  onError?: (message: string) => void;
  size?: "sm" | "default";
  className?: string;
  label?: string;
}

export function CollaboratorPhotoUploadButton({
  userId,
  disabled = false,
  onUploaded,
  onError,
  size = "sm",
  className,
  label,
}: CollaboratorPhotoUploadButtonProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileSelected(file: File) {
    setUploading(true);
    try {
      const { publicUrl } = await uploadCollaboratorPhoto(userId, file);
      await onUploaded(publicUrl);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Erro ao enviar foto.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFileSelected(file);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        size={size === "sm" ? "sm" : "default"}
        className={cn("gap-1.5", className)}
        disabled={disabled || uploading}
        title="Enviar foto para o storage"
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
        {label ?? (uploading ? "Enviando…" : size === "sm" ? null : "Enviar foto")}
      </Button>
    </>
  );
}
