"use client";

import { fontStack } from "@/lib/estudio/dynamic";
import { studioImageUrl } from "@/lib/estudio/images";
import { ARTBOARD_SIZE, type ArtboardFormat, type DynamicBox, type DynamicLayout } from "@/lib/estudio/types";
import { FitText, adjust, text, type SlideRenderProps } from "./parts";

/*
 * Desenho dos modelos criados na tela Modelos: o fundo limpo da prancheta e, por cima,
 * uma caixa por campo, na posição, fonte, cor e tamanho medidos no .ai.
 */

function TextBox({ box, value, scale }: { box: DynamicBox; value: string; scale: number }) {
  const size = (box.tamanho ?? 32) * scale;
  const lineHeight = box.entrelinha ?? 1.2;
  return (
    <div
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        display: "flex",
        // texto de uma linha fica na linha de base original; o de várias cresce para baixo
        alignItems: "flex-start",
        justifyContent: box.alinhamento === "center" ? "center" : box.alinhamento === "right" ? "flex-end" : "flex-start",
      }}
    >
      <FitText
        size={size}
        min={Math.min(size, (box.minimo ?? (box.tamanho ?? 32) * 0.7) * scale)}
        maxLines={box.linhas ?? 1}
        lineHeight={lineHeight}
        campo={box.key}
        style={{
          margin: 0,
          width: "100%",
          fontFamily: fontStack(box.fonte),
          fontWeight: box.fonte?.peso ?? 400,
          fontStyle: box.fonte?.estilo ?? "normal",
          color: box.cor ?? "#111111",
          textAlign: box.alinhamento ?? "left",
          textTransform: box.caixaAlta ? "uppercase" : "none",
          lineHeight,
          whiteSpace: "pre-line",
          overflowWrap: "break-word",
        }}
      >
        {value}
      </FitText>
    </div>
  );
}

function ImageBox({ box, value }: { box: DynamicBox; value: string }) {
  if (!value) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={studioImageUrl(value)}
      alt=""
      draggable={false}
      data-campo={box.key}
      style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, objectFit: box.ajuste ?? "contain", objectPosition: "center bottom" }}
    />
  );
}

export function DynamicSlide({
  layout,
  formato,
  valores,
  ajustes,
  fundoUrl,
}: SlideRenderProps & { layout: DynamicLayout; formato: ArtboardFormat; /** prévia na tela Modelos, antes de o fundo subir */ fundoUrl?: string }) {
  const aj = adjust(ajustes);
  const { width, height } = ARTBOARD_SIZE[formato];
  return (
    <div style={{ position: "relative", width, height, overflow: "hidden", background: "#ffffff" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={fundoUrl ?? studioImageUrl(layout.fundo)} alt="" draggable={false} style={{ position: "absolute", inset: 0, width, height, objectFit: "cover" }} />
      <div style={{ position: "absolute", inset: 0, transform: aj.y ? `translateY(${aj.y}px)` : undefined }}>
        {layout.caixas.map((box) =>
          box.tipo === "imagem" ? (
            <ImageBox key={box.key} box={box} value={text(valores, box.key)} />
          ) : text(valores, box.key) ? (
            <TextBox key={box.key} box={box} value={text(valores, box.key)} scale={aj.texto} />
          ) : null
        )}
      </div>
    </div>
  );
}
