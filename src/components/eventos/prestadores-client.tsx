"use client";

import { useMemo, useState } from "react";
import {
  FileText,
  Globe,
  Instagram,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EventosSubNav } from "@/components/eventos/eventos-sub-nav";
import { EventoSupplierDialog } from "@/components/eventos/evento-supplier-dialog";
import { SupplierRatingStars } from "@/components/eventos/supplier-rating-stars";
import {
  deleteSupplier,
  fetchSuppliersCatalogWithStats,
  formatBrl,
  SUPPLIER_CATEGORIES,
  SUPPLIER_CATEGORY_LABEL,
  type EventSupplier,
  type EventSupplierWithStats,
} from "@/lib/eventos";
import { cn } from "@/lib/utils";

interface PrestadoresClientProps {
  initialSuppliers: EventSupplierWithStats[];
}

export function PrestadoresClient({ initialSuppliers }: PrestadoresClientProps) {
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("__all__");
  const [onlyActive, setOnlyActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<EventSupplier | null>(null);

  const filtered = useMemo(() => {
    return suppliers.filter((s) => {
      if (onlyActive && !s.active) return false;
      if (categoryFilter !== "__all__" && s.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          (s.contactName ?? "").toLowerCase().includes(q) ||
          (s.email ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [suppliers, search, categoryFilter, onlyActive]);

  async function reload() {
    setLoading(true);
    try {
      setSuppliers(await fetchSuppliersCatalogWithStats());
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(supplier: EventSupplierWithStats) {
    if (supplier.eventsCount > 0) return;
    setLoading(true);
    const ok = await deleteSupplier(supplier.id);
    if (ok) await reload();
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Organização de Eventos</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Catálogo central de prestadores e fornecedores utilizados nos eventos.
        </p>
      </div>

      <EventosSubNav />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar prestador..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as categorias</SelectItem>
              {SUPPLIER_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{SUPPLIER_CATEGORY_LABEL[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={onlyActive ? "default" : "outline"}
            size="sm"
            onClick={() => setOnlyActive((v) => !v)}
          >
            {onlyActive ? "Somente ativos" : "Todos"}
          </Button>
        </div>
        <Button
          onClick={() => {
            setEditingSupplier(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" />
          Novo prestador
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 rounded-xl border border-border/60 bg-muted/20 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center">
          <Truck className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum prestador encontrado.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((supplier) => (
            <PrestadorCard
              key={supplier.id}
              supplier={supplier}
              onEdit={() => {
                setEditingSupplier(supplier);
                setDialogOpen(true);
              }}
              onDelete={() => handleDelete(supplier)}
            />
          ))}
        </div>
      )}

      <EventoSupplierDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        supplier={editingSupplier}
        onSuccess={() => reload()}
      />
    </div>
  );
}

function PrestadorCard({
  supplier,
  onEdit,
  onDelete,
}: {
  supplier: EventSupplierWithStats;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const links = [
    { href: supplier.websiteLink, label: "Site", icon: Globe },
    { href: supplier.instagramLink, label: "Instagram", icon: Instagram },
    { href: supplier.portfolioLink, label: "Portfólio", icon: FileText },
    { href: supplier.whatsappLink, label: "WhatsApp", icon: MessageCircle },
  ].filter((l) => !!l.href);

  return (
    <Card className={cn("shadow-sm", !supplier.active && "opacity-60")}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-200/50 bg-violet-500/10">
            <Truck className="h-5 w-5 text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <CardTitle className="text-base">{supplier.name}</CardTitle>
              {!supplier.active && (
                <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-600">
                  Inativo
                </Badge>
              )}
            </div>
            <Badge variant="outline" className="mt-1 text-[10px]">
              {SUPPLIER_CATEGORY_LABEL[supplier.category as keyof typeof SUPPLIER_CATEGORY_LABEL] ?? supplier.category}
            </Badge>
            <div className="mt-1.5">
              <SupplierRatingStars rating={supplier.rating} />
            </div>
          </div>
        </div>
      </CardHeader>

      <div className="px-6 space-y-2 text-xs text-muted-foreground">
        {supplier.contactName && <p className="text-foreground font-medium">{supplier.contactName}</p>}
        {supplier.phone && (
          <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{supplier.phone}</p>
        )}
        {supplier.email && (
          <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{supplier.email}</p>
        )}
        {links.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href!}
                target="_blank"
                rel="noreferrer"
                title={l.label}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 text-muted-foreground hover:text-violet-600 hover:border-violet-300 transition-colors"
              >
                <l.icon className="h-3.5 w-3.5" />
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="px-6 pt-3 mt-1 border-t border-border/50 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          <p>{supplier.eventsCount} evento{supplier.eventsCount !== 1 ? "s" : ""}</p>
          {supplier.totalApprovedValue > 0 && (
            <p className="text-emerald-700">{formatBrl(supplier.totalApprovedValue)} aprovado</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} title="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            disabled={supplier.eventsCount > 0}
            title={supplier.eventsCount > 0 ? "Prestador vinculado a eventos" : "Excluir"}
          >
            <Trash2 className={cn("h-4 w-4", supplier.eventsCount > 0 ? "text-muted-foreground/40" : "text-red-500")} />
          </Button>
        </div>
      </div>
    </Card>
  );
}
