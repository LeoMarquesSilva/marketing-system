"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchCombobox } from "@/components/rh/registration/search-combobox";
import { BRAZIL_UF_OPTIONS, NATIONALITY_OPTIONS } from "@/lib/rh/qualifications/types";
import { bankOption, loadBancos, matchBank, POPULAR_BANKS, type Bank } from "@/lib/rh/registration/bancos";
import { searchKey, type ComboOption } from "@/lib/rh/registration/combo-search";
import { loadMunicipios, matchCity } from "@/lib/rh/registration/municipios";

/** Lista carregada por chave (UF), sem setState síncrono no efeito. */
function useLoadedList<T>(key: string, load: (key: string) => Promise<T[]>) {
  const [loaded, setLoaded] = useState<{ key: string; status: "ready" | "error"; items: T[] } | null>(null);
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    load(key).then(
      (items) => {
        if (!cancelled) setLoaded({ key, status: "ready", items });
      },
      () => {
        if (!cancelled) setLoaded({ key, status: "error", items: [] });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [key, load]);
  if (!key) return { status: "idle" as const, items: [] as T[] };
  if (!loaded || loaded.key !== key) return { status: "loading" as const, items: [] as T[] };
  return { status: loaded.status, items: loaded.items };
}

// ─── Cidade (IBGE) ───────────────────────────────────────────────────────────

/** Cidade escolhida na lista do IBGE da UF; se a lista não carregar, vira campo livre. */
export function CityCombobox({
  id,
  uf,
  value,
  invalid,
  disabled,
  onChange,
}: {
  id: string;
  uf: string;
  value: string;
  invalid?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const { status, items: cities } = useLoadedList(uf, loadMunicipios);
  const options = useMemo<ComboOption[]>(() => cities.map((city) => ({ value: city })), [cities]);
  const match = useCallback((current: string) => matchCity(current, cities), [cities]);

  if (status === "error") {
    return (
      <Input
        id={id}
        value={value}
        disabled={disabled}
        placeholder="Cidade"
        autoComplete="off"
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <SearchCombobox
      id={id}
      value={value}
      options={options}
      status={status}
      placeholder="Selecione a cidade"
      idlePlaceholder="Escolha a UF primeiro"
      loadingPlaceholder="Carregando cidades…"
      searchPlaceholder={`Buscar cidade em ${uf}`}
      emptyText={`Nenhuma cidade encontrada em ${uf}.`}
      match={match}
      unknownMessage={(current) => `“${current}” não está na lista de ${uf}. Escolha a cidade na lista.`}
      invalid={invalid}
      disabled={disabled}
      onChange={onChange}
    />
  );
}

/** UF primeiro, depois a cidade daquela UF. Trocar a UF limpa a cidade. */
export function CityUfPicker({
  id,
  ufId,
  uf,
  city,
  invalid,
  disabled,
  onChange,
}: {
  /** id do seletor de cidade (alvo do foco ao rolar até o erro). */
  id: string;
  ufId: string;
  uf: string;
  city: string;
  invalid?: boolean;
  disabled?: boolean;
  onChange: (next: { uf: string; city: string }) => void;
}) {
  return (
    <div className="flex gap-2">
      <Select
        value={uf || undefined}
        onValueChange={(next) => onChange({ uf: next, city: next === uf ? city : "" })}
        disabled={disabled}
      >
        <SelectTrigger id={ufId} className="w-[5.5rem] shrink-0" aria-label="UF" aria-invalid={invalid || undefined}>
          <SelectValue placeholder="UF" />
        </SelectTrigger>
        <SelectContent>
          {BRAZIL_UF_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <CityCombobox
        id={id}
        uf={uf}
        value={city}
        invalid={invalid}
        disabled={disabled}
        onChange={(next) => onChange({ uf, city: next })}
      />
    </div>
  );
}

// ─── Banco (BrasilAPI) ───────────────────────────────────────────────────────

const loadAllBanks = () => loadBancos();
const POPULAR_OPTIONS = POPULAR_BANKS.map(bankOption);

/**
 * Banco: os mais usados aparecem primeiro; digitando, busca entre todos pelo
 * nome ou código. Sem a lista completa, fica com os mais usados e aceita texto.
 */
export function BankCombobox({
  id,
  value,
  invalid,
  disabled,
  onChange,
}: {
  id: string;
  value: string;
  invalid?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const { status, items } = useLoadedList("todos", loadAllBanks);
  const failed = status === "error";
  const banks: readonly Bank[] = failed ? POPULAR_BANKS : items;
  const options = useMemo(() => (failed ? POPULAR_OPTIONS : items.map(bankOption)), [failed, items]);
  const match = useCallback((current: string) => matchBank(current, banks), [banks]);

  return (
    <SearchCombobox
      id={id}
      value={value}
      options={options}
      initialOptions={POPULAR_OPTIONS}
      status={failed ? "ready" : status}
      placeholder="Selecione o banco"
      loadingPlaceholder="Carregando bancos…"
      searchPlaceholder="Buscar por nome ou código"
      emptyText="Nenhum banco encontrado."
      moreText={failed ? undefined : "Não achou? Digite o nome ou o código do banco."}
      allowCustom={failed}
      match={match}
      unknownMessage={(current) => `“${current}” não está na lista. Escolha o banco na lista.`}
      invalid={invalid}
      disabled={disabled}
      onChange={onChange}
    />
  );
}

// ─── Nacionalidade ───────────────────────────────────────────────────────────

const NATIONALITY_COMBO: ComboOption[] = NATIONALITY_OPTIONS.map((option) => ({
  value: option.feminine.charAt(0).toUpperCase() + option.feminine.slice(1),
  keywords: `${option.label} ${option.masculine}`,
}));

function matchNationality(value: string): string | null {
  const key = searchKey(value);
  const option = NATIONALITY_OPTIONS.find((item) =>
    [item.value, item.label, item.feminine, item.masculine].some((candidate) => searchKey(candidate) === key)
  );
  return option ? option.feminine.charAt(0).toUpperCase() + option.feminine.slice(1) : null;
}

/** Nacionalidade: lista das mais comuns, aceitando outra digitada. */
export function NationalityCombobox({
  id,
  value,
  invalid,
  disabled,
  onChange,
}: {
  id: string;
  value: string;
  invalid?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <SearchCombobox
      id={id}
      value={value}
      options={NATIONALITY_COMBO}
      placeholder="Selecione"
      searchPlaceholder="Buscar nacionalidade ou país"
      emptyText="Digite a nacionalidade."
      allowCustom
      match={matchNationality}
      invalid={invalid}
      disabled={disabled}
      onChange={onChange}
    />
  );
}
