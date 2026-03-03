"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import type { Area } from "@/lib/areas";
import { createArea } from "@/lib/areas";

interface AreaSelectWithCreateProps {
  areas: Area[];
  value: string;
  onValueChange: (value: string) => void;
  onAreasChange: (areas: Area[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

const NEW_AREA_VALUE = "__new_area__";

export function AreaSelectWithCreate({
  areas,
  value,
  onValueChange,
  onAreasChange,
  placeholder = "Selecione a área",
  disabled,
}: AreaSelectWithCreateProps) {
  const [showNewInput, setShowNewInput] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateArea() {
    const trimmed = newAreaName.trim();
    if (!trimmed) return;
    setError(null);
    setLoading(true);
    const { data, error: err } = await createArea(trimmed);
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    if (data) {
      onAreasChange([...areas, data].sort((a, b) => a.name.localeCompare(b.name)));
      onValueChange(data.name);
      setNewAreaName("");
      setShowNewInput(false);
    }
  }

  function handleSelectChange(val: string) {
    if (val === NEW_AREA_VALUE) {
      setShowNewInput(true);
      onValueChange("");
    } else {
      onValueChange(val);
    }
  }

  const displayValue = value && value !== NEW_AREA_VALUE ? value : undefined;

  return (
    <div className="space-y-2">
      <Select
        value={displayValue || (showNewInput ? NEW_AREA_VALUE : undefined)}
        onValueChange={handleSelectChange}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {areas.map((area) => (
            <SelectItem key={area.id} value={area.name}>
              {area.name}
            </SelectItem>
          ))}
          <SelectItem value={NEW_AREA_VALUE}>
            <span className="flex items-center gap-2 text-primary">
              <Plus className="h-4 w-4" />
              Nova área
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      {showNewInput && (
        <div className="flex gap-2">
          <Input
            placeholder="Nome da nova área"
            value={newAreaName}
            onChange={(e) => setNewAreaName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateArea()}
            disabled={loading}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleCreateArea}
            disabled={!newAreaName.trim() || loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowNewInput(false);
              setNewAreaName("");
              setError(null);
            }}
          >
            Cancelar
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
