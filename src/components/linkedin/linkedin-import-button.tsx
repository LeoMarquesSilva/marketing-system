"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LinkedinReportType } from "@/lib/linkedin-types";

export interface LinkedinImportFeedback {
  duplicate: boolean;
  reportType: LinkedinReportType;
  dailyRows: number;
  postRows: number;
  demographicRows: number;
  competitorRows: number;
  matchedPosts: number;
  warnings: string[];
}

interface LinkedinImportButtonProps {
  disabled?: boolean;
  onFeedback: (feedback: LinkedinImportFeedback | { error: string }) => void;
}

export function LinkedinImportButton({ disabled, onFeedback }: LinkedinImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/linkedin-insights/import", {
        method: "POST",
        body: formData,
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Não foi possível importar o relatório.");
      onFeedback({
        duplicate: Boolean(json.duplicate),
        reportType: json.reportType === "followers" || json.reportType === "visitors" || json.reportType === "competitors" ? json.reportType : "content",
        dailyRows: Number(json.dailyRows ?? 0),
        postRows: Number(json.postRows ?? 0),
        demographicRows: Number(json.demographicRows ?? 0),
        competitorRows: Number(json.competitorRows ?? 0),
        matchedPosts: Number(json.matchedPosts ?? 0),
        warnings: Array.isArray(json.warnings) ? json.warnings : [],
      });
      router.refresh();
    } catch (error) {
      onFeedback({ error: error instanceof Error ? error.message : "Erro ao importar relatório." });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <Button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
        className="h-10 rounded-xl bg-[#0A66C2] px-4 text-white shadow-[0_10px_28px_rgba(10,102,194,0.22)] hover:bg-[#0959a8]"
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
        {uploading ? "Importando…" : "Importar relatório"}
      </Button>
    </>
  );
}
