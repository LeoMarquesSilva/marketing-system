"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadEventFile } from "@/lib/storage-buckets";

interface EventStorageUrlFieldProps {
  eventId: string;
  folder: string;
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  accept?: string;
  disabled?: boolean;
}

export function EventStorageUrlField({
  eventId,
  folder,
  value,
  onChange,
  placeholder = "URL ou envie um arquivo",
  accept,
  disabled = false,
}: EventStorageUrlFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFileSelected(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const { publicUrl } = await uploadEventFile(eventId, folder, file);
      onChange(publicUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Erro ao enviar arquivo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled || uploading}
          className="min-w-0"
        />
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept={accept}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFileSelected(file);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          disabled={disabled || uploading}
          title="Enviar arquivo para o storage"
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
        </Button>
      </div>
      {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
    </div>
  );
}
