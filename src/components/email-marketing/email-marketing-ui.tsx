"use client";

import { Building2, ChevronRight, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EmailCompany, EmailContact } from "@/lib/email-marketing";

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700 ring-blue-200/60",
  "bg-emerald-100 text-emerald-700 ring-emerald-200/60",
  "bg-amber-100 text-amber-700 ring-amber-200/60",
  "bg-violet-100 text-violet-700 ring-violet-200/60",
  "bg-rose-100 text-rose-700 ring-rose-200/60",
  "bg-cyan-100 text-cyan-700 ring-cyan-200/60",
];

export function hashColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function contactInitials(contact: EmailContact): string {
  const source = contact.name?.trim() || contact.email;
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

export function ContactAvatar({ contact, className }: { contact: EmailContact; className?: string }) {
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ring-2",
        hashColor(contact.id),
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
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface CompanyLinkProps {
  company: EmailCompany | null | undefined;
  fallbackName?: string | null;
  onClick?: () => void;
}

export function CompanyLinkButton({ company, fallbackName, onClick }: CompanyLinkProps) {
  const name = company?.name ?? fallbackName;
  if (!name) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  if (!onClick || !company) {
    return <span className="text-sm text-muted-foreground">{name}</span>;
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "group inline-flex max-w-[220px] items-center gap-2 rounded-lg border border-transparent",
        "bg-muted/40 px-2.5 py-1.5 text-left transition-all",
        "hover:border-primary/20 hover:bg-primary/5 hover:shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      )}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Building2 className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">
          {name}
        </span>
        {(company.city || company.state) && (
          <span className="block truncate text-[11px] text-muted-foreground">
            {[company.city, company.state].filter(Boolean).join(" · ")}
          </span>
        )}
      </span>
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
        <Badge key={tag} variant="outline" className="text-[11px] font-normal">
          {tag}
        </Badge>
      ))}
      {rest > 0 && (
        <Badge variant="secondary" className="text-[11px] font-normal">
          +{rest}
        </Badge>
      )}
    </div>
  );
}

interface CompanyCardProps {
  company: EmailCompany;
  onClick: () => void;
}

export function CompanyCard({ company, onClick }: CompanyCardProps) {
  const location = [company.city, company.state].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex w-full flex-col rounded-2xl border border-border/70 bg-card p-4 text-left shadow-sm",
        "transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      )}
    >
      <ChevronRight
        className={cn(
          "absolute right-4 top-4 h-4 w-4 text-muted-foreground/60 transition-all",
          "group-hover:translate-x-0.5 group-hover:text-primary"
        )}
      />

      <div className="flex items-start gap-3 pr-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Building2 className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
            {company.name}
          </h3>
          {company.cnpj && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{company.cnpj}</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {location ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {location}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Local não informado</span>
        )}
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          <Users className="h-3 w-3" />
          {company.contactCount ?? 0} contato{(company.contactCount ?? 0) === 1 ? "" : "s"}
        </span>
      </div>
    </button>
  );
}
