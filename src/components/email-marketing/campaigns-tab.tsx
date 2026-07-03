"use client";

import { useState } from "react";
import { Mail, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deleteEmailCampaign,
  EMAIL_CAMPAIGN_STATUS_LABEL,
  type EmailCampaign,
  type EmailCampaignStatus,
  type EmailContact,
  type EmailList,
  type EmailRdEmail,
} from "@/lib/email-marketing";
import { CampaignFormDialog, type CampaignFormStep } from "./campaign-form-dialog";
import { CampaignDetailDialog } from "./campaign-detail-dialog";
import { RdEmailsSection } from "./rd-emails-section";

interface CampaignsTabProps {
  campaigns: EmailCampaign[];
  rdEmails: EmailRdEmail[];
  lists: EmailList[];
  contacts: EmailContact[];
  onChanged: () => void;
}

const STATUS_VARIANT: Record<EmailCampaignStatus, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  scheduled: "outline",
  sending: "default",
  sent: "default",
  paused: "secondary",
  failed: "destructive",
};

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  if (isToday) {
    return `Hoje, ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CampaignsTab({ campaigns, rdEmails, lists, contacts, onChanged }: CampaignsTabProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [formInitialStep, setFormInitialStep] = useState<CampaignFormStep>("setup");
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<EmailCampaign | null>(null);
  const [viewing, setViewing] = useState<EmailCampaign | null>(null);

  const openCampaignForm = (campaign: EmailCampaign | null, step: CampaignFormStep) => {
    setEditing(campaign);
    setFormInitialStep(step);
    setFormOpen(true);
  };

  const handleDelete = async (campaign: EmailCampaign, e: React.MouseEvent) => {
    e.stopPropagation();
    if (campaign.status !== "draft") {
      alert("Só é possível excluir campanhas em rascunho.");
      return;
    }
    if (!confirm(`Excluir a campanha "${campaign.name}"?`)) return;
    await deleteEmailCampaign(campaign.id);
    onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-semibold">Campanhas internas</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Newsletters enviadas por este sistema, com rastreio via Resend.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-2"
          onClick={() => openCampaignForm(null, "setup")}
        >
          <Plus className="h-4 w-4" />
          Nova campanha
        </Button>
      </div>

      <Card className="rounded-xl">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Assunto</TableHead>
                <TableHead>Lista</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Destinatários</TableHead>
                <TableHead>Atualizado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="py-14">
                    <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
                      <Mail className="h-8 w-8 opacity-40" />
                      <p className="text-sm">Nenhuma campanha criada ainda.</p>
                      <p className="text-xs">Clique em &quot;Nova campanha&quot; para montar sua primeira newsletter.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {campaigns.map((campaign) => {
                const isEmptyDraft = campaign.status === "draft" && !campaign.subject.trim();
                return (
                  <TableRow
                    key={campaign.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setViewing(campaign);
                      setDetailOpen(true);
                    }}
                  >
                    <TableCell className="font-medium max-w-56 truncate">{campaign.name}</TableCell>
                    <TableCell className="max-w-64 truncate">
                      {isEmptyDraft ? (
                        <span className="italic text-muted-foreground">Sem assunto definido</span>
                      ) : (
                        campaign.subject
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{campaign.listName ?? "Todos"}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[campaign.status]}>
                        {EMAIL_CAMPAIGN_STATUS_LABEL[campaign.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {campaign.totalRecipients > 0 ? campaign.totalRecipients : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {formatUpdatedAt(campaign.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {campaign.status === "draft" && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Ver detalhes e editar"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewing(campaign);
                              setDetailOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {campaign.status === "draft" && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Excluir rascunho"
                            onClick={(e) => handleDelete(campaign, e)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CampaignFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditing(null);
            setFormInitialStep("setup");
          }
        }}
        campaign={editing}
        lists={lists}
        contacts={contacts}
        initialStep={formInitialStep}
        onSaved={onChanged}
      />
      <CampaignDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        campaign={viewing}
        onChanged={onChanged}
        onEdit={(campaign) => {
          setDetailOpen(false);
          openCampaignForm(campaign, "editor");
        }}
      />

      <div className="border-t pt-8">
        <RdEmailsSection emails={rdEmails} />
      </div>
    </div>
  );
}
