"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { UserSelectSearch } from "@/components/solicitacoes/user-select-search";
import {
  createReelRequest,
  REEL_CHECKLIST_ITEMS,
} from "@/lib/request-checklist";
import { uploadReelVideo } from "@/lib/storage-buckets";
import { useAuth } from "@/contexts/auth-context";
import type { User } from "@/lib/users";
import { Video, ListChecks } from "lucide-react";

const REEL_VIDEO_ACCEPT = "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm";

const formSchema = z.object({
  title: z.string().min(1, "Título do reel é obrigatório"),
  solicitante_id: z.string().optional(),
  requesting_area: z.string().min(1, "Informe a área"),
  deadline: z.string().optional(),
  deadline_time: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ReelRequestFormProps {
  users: User[];
  onSuccess?: (requestId?: string) => void;
  onCancel?: () => void;
  embedded?: boolean;
}

export function ReelRequestForm({
  users,
  onSuccess,
  onCancel,
  embedded,
}: ReelRequestFormProps) {
  const { profile } = useAuth();
  const [reelVideo, setReelVideo] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      solicitante_id: "",
      requesting_area: "",
      deadline: "",
      deadline_time: "",
      notes: "",
    },
  });

  async function onSubmit(values: FormValues) {
    if (!reelVideo) {
      form.setError("root", { message: "Selecione o arquivo de vídeo do reel." });
      return;
    }

    setSubmitting(true);
    setUploadProgress(null);
    try {
      const solicitante = users.find((u) => u.id === values.solicitante_id);
      const area = solicitante?.department ?? values.requesting_area.trim();
      if (!area) {
        form.setError("requesting_area", { message: "Informe a área" });
        setSubmitting(false);
        return;
      }

      const { publicUrl } = await uploadReelVideo(reelVideo, {
        onProgress: (percent) => setUploadProgress(percent),
      });
      const { error, requestId } = await createReelRequest({
        title: values.title.trim(),
        videoUrl: publicUrl,
        requestingArea: area,
        deadline: values.deadline || null,
        deadlineTime: values.deadline_time || null,
        notes: values.notes || null,
        solicitanteId: values.solicitante_id || null,
        solicitante: solicitante?.name ?? null,
        nomeAdvogado: solicitante?.name ?? null,
        createdById: profile?.id ?? null,
        createdByName: profile?.name ?? null,
      });

      if (error) {
        form.setError("root", { message: error });
        return;
      }

      form.reset();
      setReelVideo(null);
      onSuccess?.(requestId);
    } catch (err) {
      form.setError("root", {
        message: err instanceof Error ? err.message : "Erro ao criar solicitação de reel.",
      });
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  }

  return (
    <div className={embedded ? "space-y-5" : "space-y-5 p-6"}>
      <div className="rounded-xl border border-border/40 bg-muted/30 p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
          <ListChecks className="h-3.5 w-3.5" aria-hidden />
          Checklist incluído
        </p>
        <ul className="space-y-1">
          {REEL_CHECKLIST_ITEMS.map((item) => (
            <li key={item} className="text-sm text-muted-foreground flex items-start gap-2">
              <span className="text-primary/70 mt-0.5">•</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Título do reel</FormLabel>
                <FormControl>
                  <Input placeholder="Ex.: Dica trabalhista — férias" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {users.length > 0 ? (
            <FormField
              control={form.control}
              name="solicitante_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Solicitante (opcional)</FormLabel>
                  <FormControl>
                    <UserSelectSearch
                      users={users}
                      value={field.value ?? ""}
                      onValueChange={(v) => {
                        field.onChange(v);
                        const u = users.find((x) => x.id === v);
                        if (u) form.setValue("requesting_area", u.department);
                      }}
                      onSelect={(u) => form.setValue("requesting_area", u.department)}
                      placeholder="Pesquisar solicitante"
                      allowClear
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}

          <FormField
            control={form.control}
            name="requesting_area"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Área</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    readOnly={users.length > 0}
                    className={users.length > 0 ? "bg-muted" : undefined}
                    placeholder="Ex.: Trabalhista, Cível"
                  />
                </FormControl>
                {users.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Preenchida ao selecionar o solicitante
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-2">
            <FormLabel htmlFor="reel-video" className="flex items-center gap-1.5">
              <Video className="h-4 w-4 shrink-0" aria-hidden />
              Vídeo do reel
            </FormLabel>
            <Input
              id="reel-video"
              type="file"
              accept={REEL_VIDEO_ACCEPT}
              disabled={submitting}
              onChange={(e) => setReelVideo(e.target.files?.[0] ?? null)}
            />
            {reelVideo && (
              <p className="text-xs text-muted-foreground">
                {reelVideo.name} ({(reelVideo.size / (1024 * 1024)).toFixed(1)} MB)
              </p>
            )}
            {uploadProgress != null && (
              <p className="text-xs text-muted-foreground" role="status">
                Enviando vídeo… {uploadProgress}%
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <FormField
              control={form.control}
              name="deadline"
              render={({ field }) => (
                <FormItem className="min-w-[140px] flex-1">
                  <FormLabel>Prazo (opcional)</FormLabel>
                  <FormControl>
                    <DatePickerField
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      placeholder="DD/MM/AAAA"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="deadline_time"
              render={({ field }) => (
                <FormItem className="min-w-[100px]">
                  <FormLabel>Horário</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Observações (opcional)</FormLabel>
                <FormControl>
                  <textarea
                    {...field}
                    rows={2}
                    placeholder="Roteiro ou contexto do reel..."
                    className="flex min-h-[60px] w-full resize-none rounded-xl border border-input bg-white/80 dark:bg-background/50 px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <p className="text-sm text-muted-foreground">
            A solicitação vai para{" "}
            <span className="font-medium text-foreground">Tarefas Leonardo</span> com o checklist
            Quando o checklist estiver completo, use o botão{" "}
            <span className="font-medium text-foreground">Enviar para banco de conteúdo</span> no
            card do kanban.
          </p>

          {form.formState.errors.root && (
            <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
            )}
            <Button type="submit" disabled={submitting}>
              {submitting
                ? uploadProgress != null
                  ? `Enviando vídeo (${uploadProgress}%)…`
                  : "Criando..."
                : "Criar solicitação de reel"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
