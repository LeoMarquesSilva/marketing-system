"use client";

import { useMemo, useState } from "react";
import {
  AlarmClock,
  ArrowRight,
  History,
  Minus,
  Plus,
  ShieldAlert,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Segmented } from "@/components/facilities/form-parts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { nomeCurto } from "@/lib/vistagem/como-fica-no-vios";
import {
  diferencasDaAlteracao,
  porArea,
  type Diferenca,
} from "@/lib/vistagem/historico-configuracoes";
import {
  agruparPorDia,
  dataHoraDoMomento,
  horaDoMomento,
  tituloDoDia,
} from "@/lib/vistagem/datas-do-historico";
import type { PainelDeRegras } from "@/lib/vistagem/regras-server";
import {
  TODAS_AS_AREAS_VISTAGEM,
  type TipoDeDemanda,
} from "@/lib/vistagem/vistadores";
import { AvatarPessoa } from "./combobox-busca";
import { IconeArea } from "./marcas";
import { Painel } from "./ui";

/**
 * Histórico das Configurações da Vistagem: cada alteração mostra só o que mudou (quem entrou, saiu ou trocou de
 * tipo; etiqueta incluída ou tirada; de → para), com a foto de quem mudou, agrupada por dia. Salvamento sem mudança
 * fica escondido (dá para mostrar).
 */

type Grupo = "vistadores" | "etiquetasDeRisco" | "horaArquivoEsperado" | "ia";

const DA_REGRA: Record<Grupo, { rotulo: string; icone: LucideIcon }> = {
  vistadores: { rotulo: "Vistadores", icone: UsersRound },
  etiquetasDeRisco: { rotulo: "Etiquetas de risco", icone: ShieldAlert },
  horaArquivoEsperado: { rotulo: "Alerta do arquivo", icone: AlarmClock },
  ia: { rotulo: "IA", icone: Sparkles },
};

const ROTULO_COMPLETO: Record<string, string> = {
  vistadores: "Vistadores por área",
  etiquetasDeRisco: "Etiquetas de demanda de risco",
  horaArquivoEsperado: "Hora do alerta do arquivo",
  iaSugestaoTarefa: "IA: sugestão de tarefas",
  iaSugestaoTriagem: "IA: sugestão de pasta",
};

const grupoDa = (chave: string): Grupo =>
  chave === "vistadores" ||
  chave === "etiquetasDeRisco" ||
  chave === "horaArquivoEsperado"
    ? chave
    : "ia";

const TIPO_CURTO: Record<TipoDeDemanda, string> = {
  normal: "normais",
  risco: "risco",
};

function IconeDaArea({ area }: { area: string }) {
  if (area === TODAS_AS_AREAS_VISTAGEM) {
    return (
      <span
        className="grid size-6 shrink-0 place-items-center rounded bg-[#04202f] text-[#47cdd0]"
        aria-hidden
      >
        <UsersRound className="size-3.5" />
      </span>
    );
  }
  return <IconeArea area={area} tamanho="sm" />;
}

/** Etiqueta de uma pessoa que entrou (verde), saiu (vermelho, riscada) ou trocou de tipo (neutra, de → para). */
function PessoaQueMudou({
  diferenca,
  foto,
}: {
  diferenca: Extract<Diferenca, { tipo: "pessoa" | "moveu" }>;
  foto: string | null;
}) {
  const entrou = diferenca.tipo === "pessoa" && diferenca.acao === "entrou";
  const saiu = diferenca.tipo === "pessoa" && diferenca.acao === "saiu";
  return (
    <li
      title={diferenca.nome}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5 text-xs ring-1 ring-inset",
        entrou && "bg-emerald-50 text-emerald-900 ring-emerald-200",
        saiu && "bg-red-50 text-red-900 ring-red-200",
        diferenca.tipo === "moveu" &&
          "bg-[#f2f6f7] text-foreground ring-[#dce9eb]",
      )}
    >
      <AvatarPessoa
        nome={diferenca.nome}
        foto={foto}
        className={cn("size-5", saiu && "opacity-60 grayscale")}
      />
      {entrou ? (
        <Plus className="size-3 shrink-0" aria-label="entrou" />
      ) : saiu ? (
        <Minus className="size-3 shrink-0" aria-label="saiu" />
      ) : null}
      <span
        className={cn(
          "truncate font-medium",
          saiu && "line-through decoration-red-400",
        )}
      >
        {nomeCurto(diferenca.nome)}
      </span>
      {diferenca.tipo === "moveu" ? (
        <span className="inline-flex shrink-0 items-center gap-1 text-muted-foreground">
          {TIPO_CURTO[diferenca.de]}
          <ArrowRight className="size-3" aria-label="para" />
          <span
            className={cn(
              "font-medium",
              diferenca.para === "risco" ? "text-[#8f1d26]" : "text-foreground",
            )}
          >
            {TIPO_CURTO[diferenca.para]}
          </span>
        </span>
      ) : (
        <span
          className={cn(
            "shrink-0",
            diferenca.demanda === "risco" ? "text-[#8f1d26]" : "opacity-70",
          )}
        >
          {TIPO_CURTO[diferenca.demanda]}
        </span>
      )}
    </li>
  );
}

const AREAS_VISIVEIS = 4;

function MudancasDeVistadores({
  diferencas,
  fotos,
}: {
  diferencas: Diferenca[];
  fotos: Record<string, string>;
}) {
  const [tudo, setTudo] = useState(false);
  const grupos = porArea(diferencas);
  const visiveis = tudo ? grupos : grupos.slice(0, AREAS_VISIVEIS);
  const entraram = diferencas.filter(
    (item) => item.tipo === "pessoa" && item.acao === "entrou",
  ).length;
  const sairam = diferencas.filter(
    (item) => item.tipo === "pessoa" && item.acao === "saiu",
  ).length;
  const trocaram = diferencas.filter((item) => item.tipo === "moveu").length;
  const resumo = [
    entraram ? `${entraram} ${entraram === 1 ? "entrou" : "entraram"}` : null,
    sairam ? `${sairam} ${sairam === 1 ? "saiu" : "saíram"}` : null,
    trocaram
      ? `${trocaram} ${trocaram === 1 ? "trocou" : "trocaram"} de tipo`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {resumo} em {grupos.length} {grupos.length === 1 ? "área" : "áreas"}
      </p>
      <ul className="divide-y divide-[#eef3f5]">
        {visiveis.map((grupo) => (
          <li
            key={grupo.area}
            className="grid gap-2 py-2 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-start"
          >
            <span className="flex items-center gap-2 pt-0.5 text-sm font-medium text-foreground">
              <IconeDaArea area={grupo.area} />
              <span className="truncate">{grupo.area}</span>
            </span>
            <ul className="flex flex-wrap gap-1.5">
              {grupo.itens.map((item, indice) =>
                item.tipo === "pessoa" || item.tipo === "moveu" ? (
                  <PessoaQueMudou
                    key={`${item.nome}-${indice}`}
                    diferenca={item}
                    foto={fotos[item.nome] ?? null}
                  />
                ) : null,
              )}
            </ul>
          </li>
        ))}
      </ul>
      {grupos.length > AREAS_VISIVEIS ? (
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="text-[#347796]"
          onClick={() => setTudo((atual) => !atual)}
        >
          {tudo
            ? "Mostrar menos"
            : `Ver mais ${grupos.length - AREAS_VISIVEIS} ${grupos.length - AREAS_VISIVEIS === 1 ? "área" : "áreas"}`}
        </Button>
      ) : null}
    </div>
  );
}

function MudancasSimples({ diferencas }: { diferencas: Diferenca[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-1.5">
      {diferencas.map((item, indice) =>
        item.tipo === "etiqueta" ? (
          <li
            key={`${item.etiqueta}-${indice}`}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
              item.acao === "entrou"
                ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
                : "bg-red-50 text-red-900 ring-red-200",
            )}
          >
            {item.acao === "entrou" ? (
              <Plus className="size-3" aria-label="entrou" />
            ) : (
              <Minus className="size-3" aria-label="saiu" />
            )}
            <span
              className={cn(
                item.acao === "saiu" && "line-through decoration-red-400",
              )}
            >
              {item.etiqueta}
            </span>
          </li>
        ) : item.tipo === "valor" ? (
          <li
            key={`valor-${indice}`}
            className="inline-flex items-center gap-2 text-sm"
          >
            <span className="rounded-md bg-[#f2f6f7] px-2 py-0.5 text-muted-foreground line-through decoration-muted-foreground/50">
              {item.antes}
            </span>
            <ArrowRight
              className="size-3.5 text-muted-foreground"
              aria-label="para"
            />
            <span className="rounded-md bg-[#e8f8f8] px-2 py-0.5 font-medium text-[#285f7a]">
              {item.depois}
            </span>
          </li>
        ) : null,
      )}
    </ul>
  );
}

export function HistoricoDasConfiguracoes({
  painel,
}: {
  painel: PainelDeRegras;
}) {
  const [filtro, setFiltro] = useState<Grupo | "todas">("todas");
  const [comSemMudanca, setComSemMudanca] = useState(false);
  const [agora] = useState(() => Date.now());
  const fotos = useMemo(
    () => ({
      ...painel.fotosDosVistadores,
      ...(painel.fotosDoHistorico ?? {}),
    }),
    [painel.fotosDosVistadores, painel.fotosDoHistorico],
  );

  const itens = useMemo(
    () =>
      painel.historico.map((item, indice) => ({
        ...item,
        indice,
        grupo: grupoDa(item.chave),
        diferencas: diferencasDaAlteracao(
          item.chave,
          item.valorAnterior,
          item.valorNovo,
        ),
      })),
    [painel.historico],
  );
  const semMudanca = itens.filter(
    (item) => item.diferencas.length === 0,
  ).length;
  const contagem = (grupo: Grupo) =>
    itens.filter((item) => item.grupo === grupo && item.diferencas.length > 0)
      .length;
  const visiveis = itens.filter(
    (item) =>
      (filtro === "todas" || item.grupo === filtro) &&
      (comSemMudanca || item.diferencas.length > 0),
  );

  const porDia = agruparPorDia(visiveis, (item) => item.alteradoEm);

  if (!itens.length) {
    return (
      <Painel>
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <span className="grid size-10 place-items-center rounded-md bg-[#e8f8f8] text-[#3e84a8]">
            <History className="size-5" aria-hidden />
          </span>
          <p className="text-sm font-medium text-foreground">
            Nenhuma alteração ainda
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            Tudo segue o padrão do sistema. Cada mudança feita aqui fica
            registrada com quem mudou e quando.
          </p>
        </div>
      </Painel>
    );
  }

  const grupos = (Object.keys(DA_REGRA) as Grupo[]).filter(
    (grupo) => contagem(grupo) > 0,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {grupos.length > 1 ? (
          <Segmented<Grupo | "todas">
            label="Filtrar o histórico pela regra"
            value={filtro}
            options={[
              {
                value: "todas",
                label: `Todas ${itens.length - semMudanca}`,
                icon: History,
              },
              ...grupos.map((grupo) => ({
                value: grupo,
                label: `${DA_REGRA[grupo].rotulo} ${contagem(grupo)}`,
                icon: DA_REGRA[grupo].icone,
              })),
            ]}
            onChange={setFiltro}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {itens.length - semMudanca}{" "}
            {itens.length - semMudanca === 1 ? "alteração" : "alterações"} nas
            regras
          </p>
        )}
        {semMudanca ? (
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="size-3.5 accent-[#347796]"
              checked={comSemMudanca}
              onChange={(evento) => setComSemMudanca(evento.target.checked)}
            />
            Mostrar {semMudanca}{" "}
            {semMudanca === 1 ? "salvamento" : "salvamentos"} sem mudança
          </label>
        ) : null}
      </div>

      {porDia.length === 0 ? (
        <Painel>
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhuma alteração com esse filtro.
          </p>
        </Painel>
      ) : (
        porDia.map(([dia, doDia]) => (
          <section
            key={dia}
            aria-label={tituloDoDia(dia, agora)}
            className="space-y-2"
          >
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#285f7a]">
              {tituloDoDia(dia, agora)}
            </h3>
            <ol className="space-y-2">
              {doDia.map((item) => {
                const { icone: Icone } = DA_REGRA[item.grupo];
                const quem = item.alteradoPor ?? "Admin";
                return (
                  <li key={`${item.chave}-${item.alteradoEm}-${item.indice}`}>
                    <Painel>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#eef3f5] px-4 py-2.5">
                        <AvatarPessoa
                          nome={quem}
                          foto={fotos[quem] ?? null}
                          className="size-8"
                        />
                        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {nomeCurto(quem)}
                          </span>{" "}
                          alterou{" "}
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#e8f8f8] px-1.5 py-0.5 align-middle text-xs font-medium text-[#285f7a]">
                            <Icone className="size-3.5" aria-hidden />
                            {ROTULO_COMPLETO[item.chave] ?? item.chave}
                          </span>
                        </p>
                        <time
                          dateTime={item.alteradoEm}
                          title={dataHoraDoMomento(item.alteradoEm)}
                          className="shrink-0 text-xs tabular-nums text-muted-foreground"
                        >
                          {horaDoMomento(item.alteradoEm)}
                        </time>
                      </div>
                      <div className="px-4 py-3">
                        {item.diferencas.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Salvou sem mudar nada.
                          </p>
                        ) : item.chave === "vistadores" ? (
                          <MudancasDeVistadores
                            diferencas={item.diferencas}
                            fotos={fotos}
                          />
                        ) : (
                          <MudancasSimples diferencas={item.diferencas} />
                        )}
                      </div>
                    </Painel>
                  </li>
                );
              })}
            </ol>
          </section>
        ))
      )}
      <p className="text-xs text-muted-foreground">
        Mostra as últimas {painel.historico.length} alterações.
      </p>
    </div>
  );
}
