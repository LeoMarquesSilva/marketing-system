"use client";

import { useState } from "react";
import { Boxes, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { NfcAssetAdminData } from "@/lib/nfc/types";

interface NfcAssetCreateDialogProps {
  tags: NfcAssetAdminData["tags"];
  onCreated: (message: string) => void;
  onError: (message: string) => void;
}

export function NfcAssetCreateDialog({
  tags,
  onCreated,
  onError,
}: NfcAssetCreateDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [tagId, setTagId] = useState(tags[0]?.id ?? "");
  const [label, setLabel] = useState(tags[0]?.assetLabel ?? "Guarda-chuva");
  const [assetNumber, setAssetNumber] = useState("");
  const [prefix, setPrefix] = useState("");
  const [startNumber, setStartNumber] = useState("1");
  const [endNumber, setEndNumber] = useState("10");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);

  const handleTagChange = (value: string) => {
    setTagId(value);
    const tag = tags.find((item) => item.id === value);
    if (tag) setLabel(tag.assetLabel);
  };

  const reset = () => {
    setMode("single");
    setTagId(tags[0]?.id ?? "");
    setLabel(tags[0]?.assetLabel ?? "Guarda-chuva");
    setAssetNumber("");
    setPrefix("");
    setStartNumber("1");
    setEndNumber("10");
    setNotes("");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    let assetNumbers: string[];
    if (mode === "single") {
      assetNumbers = [assetNumber.trim()];
    } else {
      const start = Number(startNumber);
      const end = Number(endNumber);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) {
        onError("Informe um intervalo numérico válido.");
        return;
      }
      if (end - start + 1 > 200) {
        onError("Cadastre no máximo 200 itens por lote.");
        return;
      }
      const width = Math.max(startNumber.length, endNumber.length);
      assetNumbers = Array.from(
        { length: end - start + 1 },
        (_, index) => `${prefix.trim()}${String(start + index).padStart(width, "0")}`
      );
    }

    setPending(true);
    try {
      const response = await fetch("/api/nfc/assets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tagId,
          label,
          assetNumbers,
          notes: notes.trim() || null,
        }),
      });
      const body = (await response.json()) as { error?: string; created?: number };
      if (!response.ok) throw new Error(body.error || "Não foi possível cadastrar.");
      const created = body.created ?? assetNumbers.length;
      onCreated(
        created === 1
          ? `${label} cadastrado com sucesso.`
          : `${created} itens cadastrados com sucesso.`
      );
      setOpen(false);
      reset();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Não foi possível cadastrar.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!tags.length} className="shrink-0">
          <Plus />
          Cadastrar itens
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <span className="mb-1 flex size-11 items-center justify-center rounded-xl bg-[#e8f8f8] text-[#347796]">
            <Boxes className="size-5" />
          </span>
          <DialogTitle>Cadastrar itens</DialogTitle>
          <DialogDescription>
            Adicione um guarda-chuva ou crie uma sequência numerada de uma só vez.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="asset-tag">Etiqueta responsável</Label>
            <Select value={tagId} onValueChange={handleTagChange}>
              <SelectTrigger id="asset-tag" className="w-full">
                <SelectValue placeholder="Selecione a etiqueta" />
              </SelectTrigger>
              <SelectContent>
                {tags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    {tag.name} · {tag.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="asset-label">Nome do item</Label>
            <Input
              id="asset-label"
              required
              maxLength={80}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Guarda-chuva"
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Forma de cadastro</legend>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#f1f7f8] p-1.5">
              <button
                type="button"
                onClick={() => setMode("single")}
                className={`min-h-11 rounded-lg px-3 text-sm font-semibold transition ${
                  mode === "single"
                    ? "bg-white text-[#285f7a] shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                Um item
              </button>
              <button
                type="button"
                onClick={() => setMode("batch")}
                className={`min-h-11 rounded-lg px-3 text-sm font-semibold transition ${
                  mode === "batch"
                    ? "bg-white text-[#285f7a] shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                Cadastrar lote
              </button>
            </div>
          </fieldset>

          {mode === "single" ? (
            <div className="space-y-1.5">
              <Label htmlFor="asset-number">Número ou código</Label>
              <Input
                id="asset-number"
                required
                maxLength={80}
                autoCapitalize="characters"
                value={assetNumber}
                onChange={(event) => setAssetNumber(event.target.value)}
                placeholder="Ex.: 12"
                className="font-mono"
              />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr_1fr]">
              <div className="space-y-1.5">
                <Label htmlFor="asset-prefix">Prefixo opcional</Label>
                <Input
                  id="asset-prefix"
                  maxLength={40}
                  value={prefix}
                  onChange={(event) => setPrefix(event.target.value)}
                  placeholder="GC-"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="asset-start">Número inicial</Label>
                <Input
                  id="asset-start"
                  required
                  inputMode="numeric"
                  value={startNumber}
                  onChange={(event) => setStartNumber(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="asset-end">Número final</Label>
                <Input
                  id="asset-end"
                  required
                  inputMode="numeric"
                  value={endNumber}
                  onChange={(event) => setEndNumber(event.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="asset-notes">Observações</Label>
            <Textarea
              id="asset-notes"
              maxLength={1000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Opcional: cor, tamanho, condição inicial..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !tagId}>
              {pending ? "Cadastrando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
