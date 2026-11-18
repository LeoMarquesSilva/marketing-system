"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmailCompany, EmailContact } from "@/lib/email-marketing";
import { ClientLogo } from "./email-marketing-visuals";

export function contactInitials(contact: EmailContact): string {
  const source = contact.name?.trim() || contact.email;
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  if (contact.name?.trim() && parts.length > 1) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

/** Iniciais do contato do cliente (não temos foto de quem é de fora), no tom neutro da marca. */
export function ContactAvatar({ contact, className }: { contact: EmailContact; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8f1f5] text-[11px] font-semibold text-[#315f73] ring-1 ring-black/5",
        contact.status !== "subscribed" && "bg-[#f1f3f5] text-[#7a8b94]",
        className
      )}
    >
      {contactInitials(contact)}
    </span>
  );
}

interface StatCardProps {
  label: string;
  value: number | string;
  hint?: string;
}

export function EmailStatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-lg border border-[#dce9eb] bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium text-[#3b5560]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[#0d2a38]">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface CompanyLinkProps {
  company: EmailCompany | null | undefined;
  fallbackName?: string | null;
  onClick?: () => void;
}

/** Empresa com o logo do cliente; clicável quando há cadastro da empresa. */
export function CompanyLinkButton({ company, fallbackName, onClick }: CompanyLinkProps) {
  const name = company?.name ?? fallbackName;
  if (!name) return <span className="text-sm text-muted-foreground">—</span>;

  const content = (
    <>
      <ClientLogo group={company?.clientGroupName} company={name} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-[#0d2a38] group-hover:text-[#285f7a]">{name}</span>
        {(company?.city || company?.state) && (
          <span className="block truncate text-xs text-muted-foreground">{[company?.city, company?.state].filter(Boolean).join(" · ")}</span>
        )}
      </span>
    </>
  );

  if (!onClick || !company) return <span className="flex min-w-0 max-w-[240px] items-center gap-2">{content}</span>;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "group -mx-1.5 inline-flex max-w-[260px] items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors",
        "hover:bg-[#eaf2f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
      )}
    >
      {content}
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

interface TagListProps {
  tags: string[];
  max?: number;
}

export function TagList({ tags, max = 2 }: TagListProps) {
  if (!tags.length) return <span className="text-sm text-muted-foreground">—</span>;
  const visible = tags.slice(0, max);
  const rest = tags.length - visible.length;

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((tag) => (
        <span key={tag} className="inline-flex h-6 max-w-[160px] items-center truncate rounded-full bg-[#f1f5f7] px-2 text-xs text-[#3b5560]">
          {tag}
        </span>
      ))}
      {rest > 0 && (
        <span className="inline-flex h-6 items-center rounded-full bg-[#eaf2f5] px-2 text-xs font-medium tabular-nums text-[#285f7a]" title={tags.slice(max).join(", ")}>
          +{rest}
        </span>
      )}
    </div>
  );
}
