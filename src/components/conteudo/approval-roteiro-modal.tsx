"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { UserSelectSearch } from "@/components/solicitacoes/user-select-search";
import type { User } from "@/lib/users";
import { Loader2, Check } from "lucide-react";

interface ContentRoteiro {
  id: string;
  title: string;
  post: string;
  area: string;
}

interface ApprovalRoteiroModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roteiro: ContentRoteiro | null;
  users: User[];
  onApprove: (data: {
    approved_by_id: string;
    approved_by_name: string;
    has_alterations: boolean;
    alterations_notes: string | null;
    sent_for_manager_review: boolean;
    post?: string;
  }) => Promise<void>;
}

export function ApprovalRoteiroModal({
  open,
  onOpenChange,
  roteiro,
  users,
  onApprove,
}: ApprovalRoteiroModalProps) {
  const [approvedById, setApprovedById] = useState("");
  const [hasAlterations, setHasAlterations] = useState(false);
  const [alterationsNotes, setAlterationsNotes] = useState("");
  const [sentForManagerReview, setSentForManagerReview] = useState(false);
  const [editedPost, setEditedPost] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (roteiro && open) {
      setEditedPost(roteiro.post);
    }
  }, [roteiro, open]);

  const resetForm = () => {
    setApprovedById("");
    setHasAlterations(false);
    setAlterationsNotes("");
    setSentForManagerReview(false);
    setEditedPost(roteiro?.post ?? "");
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  const handleApprove = async () => {
    if (!roteiro) return;
    const selectedUser = users.find((u) => u.id === approvedById);
    if (!selectedUser) {
      setError("Selecione o advogado que está aprovando.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onApprove({
        approved_by_id: selectedUser.id,
        approved_by_name: selectedUser.name,
        has_alterations: hasAlterations,
        alterations_notes: hasAlterations && alterationsNotes.trim() ? alterationsNotes.trim() : null,
        sent_for_manager_review: sentForManagerReview,
        post: hasAlterations && editedPost.trim() !== roteiro.post ? editedPost : undefined,
      });
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao aprovar.");
    } finally {
      setSaving(false);
    }
  };

  const selectedUser = users.find((u) => u.id === approvedById);
  const canSubmit = !!selectedUser && !saving;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Aprovar conteúdo</DialogTitle>
        </DialogHeader>
        {roteiro && (
          <div className="flex flex-col gap-4 overflow-auto flex-1 min-h-0">
            <p className="text-sm text-muted-foreground">
              Preencha os dados abaixo para registrar a aprovação deste post.
            </p>

            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label>Advogado que aprova (solicitante)</Label>
              <UserSelectSearch
                users={users}
                value={approvedById}
                onValueChange={setApprovedById}
                placeholder="Selecione o advogado"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="has-alterations"
                checked={hasAlterations}
                onChange={(e) => {
                  setHasAlterations(e.target.checked);
                  if (!e.target.checked) {
                    setEditedPost(roteiro.post);
                    setAlterationsNotes("");
                  } else {
                    setEditedPost(roteiro.post);
                  }
                }}
                className="rounded border-input"
              />
              <Label htmlFor="has-alterations" className="cursor-pointer font-normal">
                Vai ter alterações no conteúdo?
              </Label>
            </div>

            {hasAlterations && (
              <div className="space-y-2">
                <Label htmlFor="alterations-notes">Descreva as alterações (opcional)</Label>
                <textarea
                  id="alterations-notes"
                  value={alterationsNotes}
                  onChange={(e) => setAlterationsNotes(e.target.value)}
                  placeholder="Ex: Ajustar slide 2, incluir exemplo..."
                  className="w-full min-h-[60px] rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                />
                <Label htmlFor="edited-post">Conteúdo editado (opcional)</Label>
                <textarea
                  id="edited-post"
                  value={editedPost}
                  onChange={(e) => setEditedPost(e.target.value)}
                  placeholder="Cole ou edite o conteúdo do post aqui..."
                  className="w-full min-h-[180px] rounded-md border border-input bg-muted/30 px-3 py-2 text-sm font-mono whitespace-pre-wrap"
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="sent-for-manager"
                checked={sentForManagerReview}
                onChange={(e) => setSentForManagerReview(e.target.checked)}
                className="rounded border-input"
              />
              <Label htmlFor="sent-for-manager" className="cursor-pointer font-normal">
                Já enviou este conteúdo para revisão do gestor?
              </Label>
            </div>
          </div>
        )}

        <DialogFooter className="shrink-0 border-t pt-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleApprove} disabled={!canSubmit} className="gap-2">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Aprovando…
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Confirmar aprovação
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
