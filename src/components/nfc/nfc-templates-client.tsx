"use client";

import Link from "next/link";
import { ArrowRight, FileText, FormInput, Globe2, MessageCircle, Webhook, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NfcPageHeading } from "@/components/nfc/nfc-page-heading";
import { NfcSubnav } from "@/components/nfc/nfc-subnav";
import type { NfcTemplate } from "@/lib/nfc/types";

const ICONS = {
  url: Globe2,
  custom_page: FileText,
  form: FormInput,
  webhook: Webhook,
  whatsapp: MessageCircle,
  menu: FileText,
  sequence: Workflow,
};

export function NfcTemplatesClient({ templates }: { templates: NfcTemplate[] }) {
  return (
    <div className="space-y-5">
      <NfcPageHeading
        title="Modelos prontos"
        description="Comece com uma configuração segura e ajuste os campos antes de criar a etiqueta."
      />
      <NfcSubnav />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => {
          const Icon = ICONS[template.action_type] ?? Workflow;
          return (
            <Card key={template.id} className="gap-4 py-5 transition-colors hover:border-[#3e84a8]/45">
              <CardHeader className="px-5">
                <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-[#e8f8f8] text-[#347796]">
                  <Icon className="h-5 w-5" />
                </span>
                <CardTitle className="text-base">{template.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col px-5">
                <p className="flex-1 text-sm leading-6 text-muted-foreground">{template.description}</p>
                <div className="mt-4 flex items-center justify-between border-t border-[#e5eef0] pt-4">
                  <span className="text-xs font-medium text-[#347796]">{template.category || "Geral"}</span>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/nfc/tags/nova?modelo=${template.id}`}>
                      Usar modelo <ArrowRight />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
