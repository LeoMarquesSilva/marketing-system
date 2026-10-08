"use client";

import { useMemo, useState } from "react";
import { IdCard, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  alignedTierFor,
  groupTiers,
  listOrgTargets,
  seniorityGrade,
  targetValueOf,
  type OrgMember,
} from "@/lib/rh/org-chart";
import { OrgAvatar } from "@/components/rh/organograma/org-visuals";

export type PlacementRequest =
  | {
      mode: "create";
      employeeId: string;
      fullName: string;
      photoUrl: string | null;
      displayName: string;
      role: string;
      /** Destino já sugerido (ex.: equipe aberta ao clicar em "Adicionar pessoa"). */
      targetValue?: string;
    }
  | { mode: "edit"; member: OrgMember };

export type PlacementPayload = {
  employeeId?: string;
  displayName: string;
  role: string;
  placement: string;
  divisionKey: string | null;
  teamKey: string | null;
  groupLabel: string | null;
  tier: number | null;
};

const NO_GROUP = "__none";
const NEW_TIER = "__new";
const TARGETS = listOrgTargets();
const SECTIONS = [...new Set(TARGETS.map((t) => t.section))];

function tierLabel(index: number, names: string[]) {
  const preview = names.slice(0, 2).join(", ") + (names.length > 2 ? ` +${names.length - 2}` : "");
  return `Nível ${index + 1} · ${preview}`;
}

export function OrgPlacementDialog({
  request,
  members,
  employees,
  onClose,
  onSubmit,
  onDelete,
  onOpenFicha,
}: {
  request: PlacementRequest | null;
  members: OrgMember[];
  /** Colaboradores ativos, para escolher quem adicionar. */
  employees: { employeeId: string; fullName: string; photoUrl: string | null; role: string; displayName: string }[];
  onClose: () => void;
  onSubmit: (payload: PlacementPayload, memberId?: string) => Promise<string | null>;
  onDelete: (memberId: string) => Promise<string | null>;
  onOpenFicha: (employeeId: string) => void;
}) {
  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
      {request && (
        <PlacementForm
          key={request.mode === "edit" ? request.member.id : `${request.employeeId}-${request.targetValue ?? ""}`}
          request={request}
          members={members}
          employees={employees}
          onClose={onClose}
          onSubmit={onSubmit}
          onDelete={onDelete}
          onOpenFicha={onOpenFicha}
        />
      )}
    </Dialog>
  );
}

function PlacementForm({
  request,
  members,
  employees,
  onClose,
  onSubmit,
  onDelete,
  onOpenFicha,
}: {
  request: PlacementRequest;
  members: OrgMember[];
  employees: { employeeId: string; fullName: string; photoUrl: string | null; role: string; displayName: string }[];
  onClose: () => void;
  onSubmit: (payload: PlacementPayload, memberId?: string) => Promise<string | null>;
  onDelete: (memberId: string) => Promise<string | null>;
  onOpenFicha: (employeeId: string) => void;
}) {
  const editing = request.mode === "edit" ? request.member : null;
  const [employeeId, setEmployeeId] = useState(editing?.employeeId ?? (request.mode === "create" ? request.employeeId : ""));
  const employee = employees.find((e) => e.employeeId === employeeId);
  const [displayName, setDisplayName] = useState(
    editing?.name ?? (request.mode === "create" ? request.displayName : "")
  );
  const [role, setRole] = useState(editing?.role ?? (request.mode === "create" ? request.role : ""));
  const [targetValue, setTargetValue] = useState(
    editing ? targetValueOf(editing) : request.mode === "create" ? request.targetValue ?? "" : ""
  );
  const [groupLabel, setGroupLabel] = useState(editing?.groupLabel ?? NO_GROUP);
  const [tierValue, setTierValue] = useState(editing ? String(editing.tier) : NEW_TIER);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = TARGETS.find((t) => t.value === targetValue);
  const usesTiers = target?.placement === "team" || target?.placement === "division_leader";
  const pickEmployee = request.mode === "create" && !request.employeeId;

  const peers = useMemo(() => {
    if (!target || !usesTiers) return [];
    return members.filter(
      (m) =>
        m.isActive &&
        m.id !== editing?.id &&
        m.employeeId !== employeeId &&
        m.placement === target.placement &&
        m.divisionKey === target.divisionKey &&
        m.teamKey === target.teamKey &&
        (m.groupLabel ?? NO_GROUP) === groupLabel
    );
  }, [members, target, usesTiers, groupLabel, editing?.id, employeeId]);

  const tierOptions = useMemo(
    () =>
      groupTiers(peers).map((tier, index) => ({
        value: String(tier[0].tier),
        label: tierLabel(index, tier.map((m) => m.name)),
      })),
    [peers]
  );

  // Mesmo cargo/senioridade fica sempre lado a lado: o nível deixa de ser escolha.
  const sameGradePeers = peers.filter((m) => seniorityGrade(m.role) === seniorityGrade(role));
  const lockedTier = role.trim() ? alignedTierFor(sameGradePeers, role) : null;
  const lockedOption = lockedTier === null ? null : groupTiers(peers).find((tier) =>
    tier.some((m) => sameGradePeers.includes(m))
  );

  const tierIsValid = tierValue === NEW_TIER || tierOptions.some((o) => o.value === tierValue) || (editing && tierValue === String(editing.tier));
  const effectiveTierValue =
    lockedOption ? String(lockedOption[0].tier) : tierIsValid ? tierValue : NEW_TIER;

  async function submit() {
    if (!target) return setError("Escolha onde a pessoa aparece.");
    if (!employeeId) return setError("Escolha o colaborador.");
    if (!displayName.trim()) return setError("Informe o nome que aparece no organograma.");
    setSaving(true);
    setError(null);
    const payload: PlacementPayload = {
      employeeId,
      displayName: displayName.trim(),
      role: role.trim(),
      placement: target.placement,
      divisionKey: target.divisionKey,
      teamKey: target.teamKey,
      groupLabel: target.groups.length && groupLabel !== NO_GROUP ? groupLabel : null,
      tier: usesTiers ? (effectiveTierValue === NEW_TIER ? null : Number(effectiveTierValue)) : 0,
    };
    const result = await onSubmit(payload, editing?.id);
    setSaving(false);
    if (result) setError(result);
  }

  async function remove() {
    if (!editing) return;
    setSaving(true);
    setError(null);
    const result = await onDelete(editing.id);
    setSaving(false);
    if (result) setError(result);
  }

  const headerName = editing?.employeeName ?? employee?.fullName ?? (request.mode === "create" ? request.fullName : "");
  const headerPhoto = editing?.photoUrl ?? employee?.photoUrl ?? (request.mode === "create" ? request.photoUrl : null);

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{editing ? "Ajustar posição" : "Posicionar no organograma"}</DialogTitle>
        <DialogDescription>
          {editing
            ? "Mova a pessoa de equipe ou nível, ajuste nome e cargo, ou tire desta posição."
            : "Escolha a área, a equipe e o nível em que a pessoa aparece."}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {pickEmployee ? (
          <div className="space-y-1.5">
            <Label htmlFor="org-employee">Colaborador</Label>
            <Select
              value={employeeId}
              onValueChange={(value) => {
                setEmployeeId(value);
                const picked = employees.find((e) => e.employeeId === value);
                if (picked) {
                  setDisplayName(picked.displayName);
                  setRole(picked.role);
                }
              }}
            >
              <SelectTrigger id="org-employee" className="w-full">
                <SelectValue placeholder="Escolha quem adicionar" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.employeeId} value={e.employeeId}>
                    {e.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-md bg-[#f3f8f9] px-3 py-2.5">
            <OrgAvatar name={headerName} photoUrl={headerPhoto} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{headerName}</p>
              <p className="text-xs text-muted-foreground">Nome no cadastro do RH</p>
            </div>
            <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={() => onOpenFicha(employeeId)}>
              <IdCard className="size-3.5" />
              Ficha
            </Button>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="org-name">Nome no organograma</Label>
            <Input id="org-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-role">Cargo</Label>
            <Input id="org-role" value={role} onChange={(e) => setRole(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="org-target">Onde aparece</Label>
          <Select
            value={targetValue}
            onValueChange={(value) => {
              setTargetValue(value);
              setGroupLabel(NO_GROUP);
              setTierValue(NEW_TIER);
            }}
          >
            <SelectTrigger id="org-target" className="w-full">
              <SelectValue placeholder="Escolha a área ou equipe" />
            </SelectTrigger>
            <SelectContent>
              {SECTIONS.map((section) => (
                <SelectGroup key={section}>
                  <SelectLabel>{section}</SelectLabel>
                  {TARGETS.filter((t) => t.section === section).map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>

        {target && target.groups.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="org-group">Subequipe</Label>
            <Select
              value={groupLabel}
              onValueChange={(value) => {
                setGroupLabel(value);
                setTierValue(NEW_TIER);
              }}
            >
              <SelectTrigger id="org-group" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_GROUP}>Equipe toda (liderança e coordenação)</SelectItem>
                {target.groups.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {usesTiers && (
          <div className="space-y-1.5">
            <Label htmlFor="org-tier">Nível</Label>
            <Select value={effectiveTierValue} onValueChange={setTierValue} disabled={Boolean(lockedOption)}>
              <SelectTrigger id="org-tier" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tierOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    Junto com {o.label}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_TIER}>Novo nível abaixo de todos</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {lockedOption
                ? `Fica ao lado de ${sameGradePeers.map((m) => m.name).join(", ")}, que ${sameGradePeers.length > 1 ? "têm" : "tem"} o mesmo cargo. Pessoas com a mesma senioridade nunca ficam uma abaixo da outra.`
                : "Os níveis vão de cima (liderança) para baixo."}
            </p>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <DialogFooter className="gap-2 sm:justify-between">
        {editing ? (
          <Button type="button" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" disabled={saving} onClick={() => void remove()}>
            <Trash2 className="size-4" />
            Tirar desta posição
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="size-4 animate-spin" />}
            Salvar
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
}
