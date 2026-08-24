"use client";

import { useState, type ReactNode } from "react";
import { Building2, CircleHelp, FileText, Hash, MessageSquarePlus, PanelRightClose, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsappTagList } from "@/components/trafego-pago/whatsapp-conversation-tags";
import { cn } from "@/lib/utils";
import type { WhatsappConversation } from "./whatsapp-crm-types";
import { PipelineProgress } from "./pipeline-progress";
import {
  isMetaLead,
  isPaidTrafficLead,
  isSiteLead,
  leadCampaign,
  leadLocation,
  leadPhone,
  leadResponsible,
  pipelineStepIndex,
} from "./whatsapp-crm-utils";

interface LeadDetailsPanelProps {
  conversation: WhatsappConversation | null;
  onCollapse?: () => void;
  onUpdateCrm?: (patch: Record<string, unknown>) => void;
}

type Tab = "details" | "history";

export function LeadDetailsPanel({
  conversation,
  onCollapse,
  onUpdateCrm,
}: LeadDetailsPanelProps) {
  const [tab, setTab] = useState<Tab>("details");

  if (!conversation) {
    return (
      <aside className="hidden min-h-0 border-l bg-white dark:bg-card xl:flex xl:flex-col">
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Selecione um lead para ver detalhes do CRM.
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden min-h-0 flex-col border-l bg-white dark:bg-card xl:flex">
      <div className="flex items-center border-b">
        <div className="flex min-w-0 flex-1">
          <TabButton active={tab === "details"} onClick={() => setTab("details")}>
            Detalhes
          </TabButton>
          <TabButton active={tab === "history"} onClick={() => setTab("history")}>
            Histórico
          </TabButton>
        </div>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Recolher painel de detalhes"
            title="Recolher detalhes"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {tab === "details" ? (
          <div className="space-y-6">
            <PanelSection
              title="Sobre o lead"
              action="Editar"
              actionDisabled
              rows={[
                ["Telefone", leadPhone(conversation)],
                ["Localização", leadLocation(conversation)],
                [
                  "Origem",
                  isMetaLead(conversation)
                    ? "Meta Ads"
                    : isSiteLead(conversation)
                      ? "Botão do site"
                      : isPaidTrafficLead(conversation)
                        ? "Tráfego Pago"
                        : "WhatsApp",
                ],
                ...(isSiteLead(conversation) && conversation.site_lead_page_url
                  ? ([
                      [
                        "Página de origem",
                        <a
                          key="site-lead-page"
                          href={conversation.site_lead_page_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#47cdd0] underline underline-offset-2"
                        >
                          {conversation.site_lead_page_title || conversation.site_lead_page_url}
                        </a>,
                      ],
                    ] as Array<[string, ReactNode]>)
                  : []),
                ["Campanha", leadCampaign(conversation)],
                ["Entrou em", new Date(conversation.last_message_at).toLocaleDateString("pt-BR")],
                ["Responsável", leadResponsible(conversation)],
              ]}
            />

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Qualificação</h3>
                <button
                  type="button"
                  disabled
                  title="Em breve: editar qualificação"
                  className="text-xs font-medium text-muted-foreground opacity-60"
                >
                  Editar
                </button>
              </div>
              <div className="space-y-3 text-xs">
                <QualificationRow
                  icon={<CircleHelp />}
                  label="Empresa possui CIPA?"
                  value={conversation.qualification?.cipa ?? "Não informado"}
                />
                <QualificationRow
                  icon={<XCircle />}
                  label="Canal de denúncia?"
                  value={conversation.qualification?.canal_denuncia ?? "Não informado"}
                  negative={conversation.qualification?.canal_denuncia?.toLowerCase() === "não"}
                />
                <QualificationRow
                  icon={<Hash />}
                  label="Nº de funcionários"
                  value={conversation.qualification?.colaboradores ?? "Não informado"}
                />
                <QualificationRow
                  icon={<Building2 />}
                  label="Interesse principal"
                  value={
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">
                      {conversation.qualification?.interesse ?? "Não informado"}
                    </span>
                  }
                />
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Pipeline</h3>
                <button
                  type="button"
                  disabled
                  title="Em breve: abrir funil"
                  className="text-xs font-medium text-muted-foreground opacity-60"
                >
                  Ver funil
                </button>
              </div>
              <PipelineProgress
                currentStep={pipelineStepIndex(conversation.pipeline_stage)}
                onStageChange={(pipeline_stage) => onUpdateCrm?.({ pipeline_stage })}
              />
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Tags</h3>
                <button
                  type="button"
                  disabled
                  title="Use as tags do cabeçalho por enquanto"
                  className="text-xs font-medium text-muted-foreground opacity-60"
                >
                  Gerenciar
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {isMetaLead(conversation) && <TagPill label="Meta Ads" />}
                {isSiteLead(conversation) && <TagPill label="Site" />}
                <WhatsappTagList tags={conversation.tags ?? []} />
                <button
                  type="button"
                  disabled
                  title="Use as tags do cabeçalho por enquanto"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border text-muted-foreground opacity-60"
                >
                  +
                </button>
              </div>
            </section>

            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl"
              onClick={() => onUpdateCrm?.({ notes: "Observação adicionada manualmente." })}
              title="Adiciona observação rápida no CRM"
            >
              <MessageSquarePlus className="h-4 w-4" />
              Adicionar observação
            </Button>
          </div>
        ) : (
          <div className="space-y-4 text-sm text-muted-foreground">
            <div className="rounded-xl border border-dashed p-4">
              <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                <FileText className="h-4 w-4" />
                Histórico do lead
              </div>
              <p>
                Etapa atual: {conversation.pipeline_stage ?? "lead_recebido"}.
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex-1 px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
        active && "text-emerald-700"
      )}
    >
      {children}
      {active && <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-emerald-500" />}
    </button>
  );
}

function PanelSection({
  title,
  action,
  actionDisabled = false,
  rows,
}: {
  title: string;
  action?: string;
  actionDisabled?: boolean;
  rows: Array<[string, React.ReactNode]>;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action && (
          <button
            type="button"
            disabled={actionDisabled}
            title={actionDisabled ? "Em breve: edição de dados do lead" : undefined}
            className={cn(
              "text-xs font-medium",
              actionDisabled
                ? "text-muted-foreground opacity-60"
                : "text-emerald-600 hover:underline"
            )}
          >
            {action}
          </button>
        )}
      </div>
      <div className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[88px_1fr] gap-2 text-xs">
            <span className="text-muted-foreground">{label}</span>
            <span className="min-w-0 font-medium text-foreground">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function QualificationRow({
  icon,
  label,
  value,
  negative = false,
}: {
  icon: React.ReactElement;
  label: string;
  value: React.ReactNode;
  negative?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3">
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        <span className="[&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
        {label}
      </span>
      <span className={cn("font-medium", negative && "text-rose-600")}>{value}</span>
    </div>
  );
}

function TagPill({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-violet-50 px-2 py-1 text-[11px] font-medium text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
      {label}
    </span>
  );
}
