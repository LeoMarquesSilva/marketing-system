"use client";

import { createContext, useContext, useMemo, useState, type ComponentProps } from "react";
import { format, isValid, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Clock } from "lucide-react";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { horaValida } from "@/lib/vistagem/agendamento";
import { cn } from "@/lib/utils";

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Moldura dos campos de data e hora: a mesma altura, borda e foco dos outros campos da Vistagem. */
function moldura({ compacto, invalido, destacado }: { compacto: boolean; invalido: boolean; destacado: boolean }) {
  return cn(
    "flex min-w-0 items-center rounded-md border bg-white shadow-xs transition-[color,box-shadow]",
    "hover:border-[#3e84a8]/40 focus-within:border-[#47cdd0] focus-within:ring-[3px] focus-within:ring-[#47cdd0]/18",
    compacto ? "h-7 text-xs" : "h-10 text-sm",
    invalido ? "border-red-400" : destacado ? "border-[#347796] ring-1 ring-[#347796]/30" : "border-input"
  );
}

/** "2026-11-05" → "05/11/2026" (vazio fica vazio). */
function paraTela(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** "05112026" ou "05/11/2026" → "2026-11-05"; incompleta ou inválida: null. */
function paraIso(texto: string): string | null {
  const digitos = texto.replace(/\D/g, "");
  if (digitos.length !== 8) return null;
  const data = parse(digitos, "ddMMyyyy", new Date());
  return isValid(data) && format(data, "ddMMyyyy") === digitos ? format(data, "yyyy-MM-dd") : null;
}

/** Máscara dd/mm/aaaa enquanto digita. */
function mascaraData(texto: string): string {
  const digitos = texto.replace(/\D/g, "").slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

function paraDate(iso: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(ano, mes - 1, dia, 12);
}

/** O que o calendário de um campo sabe de cada dia: o nome (feriado, fim de semana) e se ele está barrado. */
const DiasDoCampo = createContext<{ nome: (iso: string) => string | null; barrado: (iso: string) => boolean }>({
  nome: () => null,
  barrado: () => false,
});

/**
 * Dia do calendário com o informativo ao passar o mouse (o nome do feriado) e, barrado, marcado como indisponível. Fica
 * fora do campo (e lê o contexto) para não ser recriado a cada render, o que tiraria o foco do teclado no calendário.
 */
function DiaComNome(props: ComponentProps<typeof CalendarDayButton>) {
  const { nome, barrado } = useContext(DiasDoCampo);
  const iso = format(props.day.date, "yyyy-MM-dd");
  const qual = nome(iso);
  const naoPode = barrado(iso);
  return (
    <CalendarDayButton
      {...props}
      title={qual ? `${qual}${naoPode ? ": o VIOS não deixa tarefa nesse dia" : ""}` : undefined}
      aria-disabled={naoPode || undefined}
    />
  );
}

/**
 * Data da Vistagem, no lugar do calendário do navegador: digita "05112026" (vira 05/11/2026) ou escolhe no
 * calendário do sistema, que mostra os dias não úteis (feriados, recesso) em cinza quando recebe `ehDiaUtil`.
 * Ao lado da data, o dia da semana. `compacto` é a versão baixa, para listas (datas do fluxo do VIOS).
 *
 * `bloquearNaoUtil` (datas de tarefa que vão ao VIOS): o dia que não é útil fica riscado e não se escolhe, nem
 * clicando nem digitando. Digitado, o calendário abre nele com o motivo. O VIOS passaria a tarefa para o dia útil
 * seguinte (0056354-65, 25/11/2026: 3. PROTOCOLAR em 08/02/2027, segunda de Carnaval, virou 10/02).
 * `nomeDoDia` dá o informativo ao passar o mouse num dia do calendário (o nome do feriado), na dica do próprio dia.
 * O rodapé não muda com o mouse: trocar o texto mudava o tamanho do calendário e, aberto para cima, os dias saíam de
 * baixo do mouse e o texto voltava, num vai e volta sem fim (25/11/2026).
 */
export function CampoData({
  valor,
  onChange,
  rotulo,
  min,
  ehDiaUtil,
  bloquearNaoUtil = false,
  nomeDoDia,
  compacto = false,
  destacado = false,
  invalido = false,
  permitirVazio = false,
  placeholder = "dd/mm/aaaa",
  dica,
  className,
}: {
  valor: string;
  onChange: (valor: string) => void;
  /** Nome acessível ("Data fatal da tarefa 1"). */
  rotulo: string;
  /** AAAA-MM-DD: dias antes ficam bloqueados no calendário. */
  min?: string;
  ehDiaUtil?: (iso: string) => boolean;
  /** Dia que não é útil (por `ehDiaUtil`) não se escolhe nem se digita. */
  bloquearNaoUtil?: boolean;
  /** Nome do dia para o informativo do calendário ("Carnaval", "Domingo"); dia comum: null. */
  nomeDoDia?: (iso: string) => string | null;
  compacto?: boolean;
  /** Borda da marca (ex.: data alterada pelo jurídico). */
  destacado?: boolean;
  invalido?: boolean;
  /** Mostra "Limpar" no calendário (data opcional). */
  permitirVazio?: boolean;
  placeholder?: string;
  /** Dica ao passar o mouse. */
  dica?: string;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState(() => paraTela(valor));
  // Data digitada ou clicada que não se pode escolher: o calendário abre nela, com o motivo no rodapé.
  const [recusada, setRecusada] = useState<string | null>(null);
  // A data muda de fora (dias do prazo, sugestão da IA): o texto acompanha.
  const [anterior, setAnterior] = useState(valor);
  if (valor !== anterior) {
    setAnterior(valor);
    setTexto(paraTela(valor));
  }
  const selecionada = useMemo(() => paraDate(valor), [valor]);
  const minimo = useMemo(() => (min ? paraDate(min) : undefined), [min]);
  const semana = selecionada ? DIAS[selecionada.getDay()] : null;
  const naoUtil = valor && ehDiaUtil ? !ehDiaUtil(valor) : false;
  const dias = useMemo(
    () => ({
      nome: (iso: string) => nomeDoDia?.(iso) ?? (ehDiaUtil && !ehDiaUtil(iso) ? "Não é dia útil" : null),
      barrado: (iso: string) => Boolean(bloquearNaoUtil && ehDiaUtil && !ehDiaUtil(iso)),
    }),
    [nomeDoDia, ehDiaUtil, bloquearNaoUtil]
  );

  function recusar(iso: string) {
    setRecusada(iso);
    setAberto(true);
  }

  function confirmar(proximo: string) {
    if (!proximo.trim()) {
      if (permitirVazio || valor) onChange("");
      setTexto("");
      return;
    }
    const iso = paraIso(proximo);
    if (iso && dias.barrado(iso)) {
      recusar(iso);
      setTexto(paraTela(valor));
      return;
    }
    if (iso) onChange(iso);
    else setTexto(paraTela(valor));
  }

  const motivoDaRecusa = recusada
    ? `${paraTela(recusada)} é ${dias.nome(recusada) ?? "dia sem expediente"}: o VIOS não deixa tarefa nesse dia (passaria para o dia útil seguinte). Escolha outro dia.`
    : null;

  return (
    <Popover
      open={aberto}
      onOpenChange={(abrir) => {
        setAberto(abrir);
        if (!abrir) setRecusada(null);
      }}
    >
      <PopoverAnchor asChild>
        <div className={cn(moldura({ compacto, invalido, destacado }), className)} title={dica}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Abrir o calendário: ${rotulo}`}
              className={cn(
                "grid h-full shrink-0 place-items-center rounded-l-md text-[#3e84a8] hover:text-[#285f7a] focus-visible:outline-none",
                compacto ? "pl-1.5 pr-1" : "pl-2.5 pr-1.5"
              )}
            >
              <CalendarDays className={compacto ? "size-3.5" : "size-4"} aria-hidden />
            </button>
          </PopoverTrigger>
          <input
            aria-label={rotulo}
            inputMode="numeric"
            autoComplete="off"
            placeholder={placeholder}
            value={texto}
            onChange={(evento) => {
              const mascarada = mascaraData(evento.target.value);
              setTexto(mascarada);
              const iso = paraIso(mascarada);
              if (!iso) return;
              if (dias.barrado(iso)) {
                recusar(iso);
                return;
              }
              setRecusada(null);
              onChange(iso);
            }}
            onBlur={() => confirmar(texto)}
            onKeyDown={(evento) => {
              if (evento.key === "Enter") {
                evento.preventDefault();
                confirmar(texto);
              } else if (evento.key === "ArrowDown" && evento.altKey) {
                evento.preventDefault();
                setAberto(true);
              }
            }}
            className={cn(
              "h-full min-w-0 flex-1 bg-transparent tabular-nums text-foreground outline-none placeholder:text-muted-foreground/70",
              compacto ? "w-[5.75rem]" : "w-[6.5rem]"
            )}
          />
          {semana ? (
            <span
              className={cn("shrink-0 pr-2.5 text-xs", naoUtil ? "font-medium text-amber-700" : "text-muted-foreground")}
              title={naoUtil ? dias.nome(valor) ?? "Não é dia útil" : undefined}
            >
              {semana}
            </span>
          ) : null}
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-auto overflow-hidden rounded-lg border-[#dce9eb] p-0 shadow-[0_16px_40px_-18px_rgba(3,32,47,0.35)]"
        // Aberto pela data digitada que não pode: o foco fica no campo, para a pessoa corrigir digitando.
        onOpenAutoFocus={(evento) => {
          if (recusada) evento.preventDefault();
        }}
      >
        <DiasDoCampo.Provider value={dias}>
          <Calendar
            // Remonta na data recusada para abrir no mês dela.
            key={recusada ?? "calendario"}
            mode="single"
            locale={ptBR}
            selected={selecionada}
            defaultMonth={(recusada ? paraDate(recusada) : undefined) ?? selecionada ?? minimo}
            disabled={minimo ? { before: minimo } : undefined}
            onSelect={(data) => {
              if (!data) return;
              const iso = format(data, "yyyy-MM-dd");
              if (dias.barrado(iso)) {
                setRecusada(iso);
                return;
              }
              setRecusada(null);
              onChange(iso);
              setAberto(false);
            }}
            modifiers={
              ehDiaUtil
                ? {
                    naoUtil: (data: Date) => !ehDiaUtil(format(data, "yyyy-MM-dd")),
                    barrado: (data: Date) => dias.barrado(format(data, "yyyy-MM-dd")),
                  }
                : undefined
            }
            modifiersClassNames={{
              naoUtil: "[&_button]:text-[#9fb8c2] [&_button]:font-normal",
              barrado: "[&_button]:cursor-not-allowed [&_button]:line-through [&_button]:hover:bg-transparent [&_button]:hover:text-[#9fb8c2]",
            }}
            components={{ DayButton: DiaComNome }}
          />
        </DiasDoCampo.Provider>
        {motivoDaRecusa || (permitirVazio && valor) ? (
          <div className="flex items-center justify-between gap-3 border-t border-[#e6eef0] bg-[#fafcfc] px-3 py-2 text-[11px] text-muted-foreground">
            {motivoDaRecusa ? (
              <span role="alert" className="max-w-[16rem] font-medium text-red-700">
                {motivoDaRecusa}
              </span>
            ) : (
              <span />
            )}
            {permitirVazio && valor ? (
              <button
                type="button"
                className="font-medium text-[#347796] underline-offset-4 hover:underline"
                onClick={() => {
                  onChange("");
                  setAberto(false);
                }}
              >
                Limpar
              </button>
            ) : null}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/** Horários da lista: de 30 em 30 minutos, das 7h às 20h. */
const HORARIOS = Array.from({ length: 27 }, (_, indice) => {
  const minutos = 7 * 60 + indice * 30;
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
});

function mascaraHora(texto: string): string {
  const digitos = texto.replace(/\D/g, "").slice(0, 4);
  return digitos.length <= 2 ? digitos : `${digitos.slice(0, 2)}:${digitos.slice(2)}`;
}

/**
 * Horário da Vistagem, no lugar do relógio do navegador: digita "1027" (vira 10:27) ou escolhe na lista de meia em
 * meia hora. Horário fora da lista (o da publicação) vale normalmente.
 */
export function CampoHora({
  valor,
  onChange,
  rotulo,
  invalido = false,
  autoFocus = false,
  className,
}: {
  valor: string;
  onChange: (valor: string) => void;
  rotulo: string;
  invalido?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState(valor);
  const [anterior, setAnterior] = useState(valor);
  if (valor !== anterior) {
    setAnterior(valor);
    setTexto(valor);
  }

  function confirmar(proximo: string) {
    const hora = mascaraHora(proximo);
    if (horaValida(hora)) onChange(hora);
    else if (!hora) onChange("");
    else setTexto(valor);
  }

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverAnchor asChild>
        <div className={cn(moldura({ compacto: false, invalido, destacado: false }), className)}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Escolher na lista: ${rotulo}`}
              className="grid h-full shrink-0 place-items-center rounded-l-md pl-2.5 pr-1.5 text-[#3e84a8] hover:text-[#285f7a] focus-visible:outline-none"
            >
              <Clock className="size-4" aria-hidden />
            </button>
          </PopoverTrigger>
          <input
            aria-label={rotulo}
            inputMode="numeric"
            autoComplete="off"
            autoFocus={autoFocus}
            placeholder="hh:mm"
            value={texto}
            onChange={(evento) => {
              const mascarada = mascaraHora(evento.target.value);
              setTexto(mascarada);
              if (horaValida(mascarada)) onChange(mascarada);
            }}
            onBlur={() => confirmar(texto)}
            onKeyDown={(evento) => {
              if (evento.key === "Enter") confirmar(texto);
            }}
            className="h-full w-full min-w-0 bg-transparent pr-3 tabular-nums text-foreground outline-none placeholder:text-muted-foreground/70"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-40 overflow-hidden rounded-lg border-[#dce9eb] p-0 shadow-[0_16px_40px_-18px_rgba(3,32,47,0.35)]"
        onOpenAutoFocus={(evento) => evento.preventDefault()}
      >
        <p className="border-b border-[#e6eef0] px-3 py-1.5 text-[11px] font-semibold uppercase text-[#285f7a]">Horário</p>
        <ul role="listbox" aria-label={rotulo} className="max-h-60 overflow-y-auto p-1">
          {HORARIOS.map((hora) => {
            const escolhida = hora === valor;
            return (
              <li key={hora} role="option" aria-selected={escolhida}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(hora);
                    setAberto(false);
                  }}
                  className={cn(
                    "w-full rounded-md px-2.5 py-1.5 text-left text-sm tabular-nums transition-colors hover:bg-[#47cdd0]/12",
                    escolhida && "bg-[#e8f8f8] font-semibold text-[#183f50]"
                  )}
                >
                  {hora}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
