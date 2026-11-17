"use client";

import { useMemo, useState } from "react";
import { Sparkles, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { lerSintese, rotuloDasPaginas, trechosDaSintese, type MarcoDoAndamento, type ParteDaSintese } from "@/lib/processos/sintese-leitura";
import { MARCA } from "../vistagem/leitor-publicacao";
import { Selo } from "../vistagem/ui";

/** Páginas citadas: selo discreto, sem competir com o texto. */
function SeloPaginas({ rotulo }: { rotulo: string }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded bg-[#f0f5f7] px-1.5 align-[1px] text-[11px] font-medium leading-4 tabular-nums text-[#4d6b7a] ring-1 ring-inset ring-[#dce9eb]">
      {rotulo}
    </span>
  );
}

/** Frase com os destaques da Vistagem (valor, data, prazo, ato, pena) e as páginas em selo. Só elementos React: o texto é dado. */
function Frase({ texto }: { texto: string }) {
  return (
    <>
      {trechosDaSintese(texto).map((trecho) => {
        if (!trecho.tipo) return <span key={trecho.inicio}>{trecho.texto}</span>;
        if (trecho.tipo === "pagina") return <SeloPaginas key={trecho.inicio} rotulo={trecho.texto.replace(/^\(\s*|\s*\)$/g, "")} />;
        return (
          <mark key={trecho.inicio} className={cn("bg-transparent text-inherit", MARCA[trecho.tipo], (trecho.tipo === "valor" || trecho.tipo === "data") && "whitespace-nowrap", trecho.tipo === "valor" && "font-semibold")}>
            {trecho.texto}
          </mark>
        );
      })}
    </>
  );
}

function Titulo({ children }: { children: string }) {
  return <h4 className="text-xs font-semibold uppercase tracking-wide text-[#285f7a]">{children}</h4>;
}

function Andamento({ marcos }: { marcos: MarcoDoAndamento[] }) {
  return (
    <ol className="ml-1 space-y-1.5 border-l border-[#dce9eb] pl-3">
      {marcos.map((marco, indice) => (
        <li key={indice} className="relative grid grid-cols-[5.75rem_minmax(0,1fr)] gap-x-2">
          <span className="absolute -left-[16.5px] top-[9px] size-2 rounded-full bg-[#47cdd0] ring-2 ring-white" aria-hidden />
          <span className="font-semibold tabular-nums text-[#183f50]">{marco.data ?? ""}</span>
          <span className={cn("break-words", !marco.data && "col-start-1 col-end-3")}>
            <Frase texto={marco.texto} />
            {marco.paginas.length ? (
              <>
                {" "}
                <SeloPaginas rotulo={rotuloDasPaginas(marco.paginas)} />
              </>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Parte({ parte }: { parte: ParteDaSintese }) {
  if (parte.tipo === "ia") {
    return (
      <div className="flex items-center gap-2 pt-1">
        <Selo tom="ia" icone={Sparkles}>
          IA
        </Selo>
        <span className="text-xs font-medium text-[#48466e]">Leitura dos autos · {parte.data}</span>
        <span className="h-px flex-1 bg-[#48466e]/15" aria-hidden />
      </div>
    );
  }
  if (parte.tipo === "andamento") {
    return (
      <section className="space-y-1.5">
        <Titulo>{parte.rotulo}</Titulo>
        <Andamento marcos={parte.marcos} />
      </section>
    );
  }
  if (parte.tipo === "atencao") {
    return (
      <section className="space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800">
          <TriangleAlert className="size-3.5" aria-hidden />
          {parte.rotulo}
        </h4>
        {parte.itens.length ? (
          <ul className="list-disc space-y-0.5 pl-5 marker:text-amber-500">
            {parte.itens.map((item, indice) => (
              <li key={indice} className="break-words">
                <Frase texto={item} />
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    );
  }
  return (
    <section className="space-y-1.5">
      {parte.rotulo ? <Titulo>{parte.rotulo}</Titulo> : null}
      {parte.paragrafos.map((paragrafo, indice) => (
        <p key={indice} className="whitespace-pre-wrap break-words">
          <Frase texto={paragrafo} />
        </p>
      ))}
    </section>
  );
}

/**
 * A síntese do processo formatada para leitura: blocos com título, Andamento em linha do tempo (data em
 * destaque, páginas em selo), Pontos de atenção em âmbar e o cabeçalho da IA como divisória. Só exibe:
 * o texto gravado (e enviado ao VIOS) continua o mesmo. `recolher` mostra o começo e "Ver tudo".
 */
export function TextoSintese({ texto, recolher = false, className }: { texto: string; recolher?: boolean; className?: string }) {
  const partes = useMemo(() => lerSintese(texto), [texto]);
  const [inteiro, setInteiro] = useState(false);
  const longo = recolher && (texto.length > 320 || texto.split("\n").length > 4);
  const recolhido = longo && !inteiro;
  return (
    <div className={className}>
      <div
        className={cn(
          "space-y-3 text-sm leading-6 text-foreground",
          recolhido && "max-h-36 overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
        )}
      >
        {partes.map((parte, indice) => (
          <Parte key={indice} parte={parte} />
        ))}
      </div>
      {longo ? (
        <button type="button" className="text-xs font-medium text-[#347796] underline-offset-4 hover:underline" onClick={() => setInteiro((atual) => !atual)}>
          {inteiro ? "Mostrar menos" : "Ver tudo"}
        </button>
      ) : null}
    </div>
  );
}
