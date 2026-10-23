"use client";

import type { CSSProperties, ReactNode } from "react";
import type { ListItem } from "@/lib/estudio/fields";
import styles from "./oab.module.css";
import { ClockIcon, CalendarIcon, FitText, ICON_BY_NAME, PinIcon, flag, items, text, type SlideRenderProps } from "./parts";

/*
 * Modelos do 3º Congresso OAB Campinas. Posições e tamanhos seguem as pranchetas do
 * "OAB ricardo.ai" (feed 1080×1350, story 1080×1920); o fundo de cada um sai de
 * scripts/estudio/extrair-fundo.mjs para public/estudio/oab/.
 */

const BG = "/estudio/oab";

function Board({ bg, height, children }: { bg: string; height: number; children: ReactNode }) {
  return (
    <div className={styles.board} style={{ position: "relative", width: 1080, height, overflow: "hidden", background: "#050e16" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${BG}/${bg}`} alt="" width={1080} height={height} style={{ position: "absolute", inset: 0, width: 1080, height }} draggable={false} />
      {children}
    </div>
  );
}

function Zone({ style, children }: { style: CSSProperties; children: ReactNode }) {
  return <div className={styles.zone} style={style}>{children}</div>;
}

/** Bolinhas do carrossel no topo (posição do slide). */
function CarouselDots({ indice, total }: { indice: number; total: number }) {
  if (total < 2) return null;
  return (
    <div className={styles.dots} aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`${styles.dot} ${i === indice ? styles.dotActive : ""}`} />
      ))}
    </div>
  );
}

function Pill({ icon, children, height = 56, fontSize = 36, iconSize = 38, style, campo }: {
  icon: ReactNode;
  children: string;
  height?: number;
  fontSize?: number;
  iconSize?: number;
  style?: CSSProperties;
  campo?: string;
}) {
  return (
    <span className={styles.pill} data-campo={campo} style={{ height, fontSize, gap: Math.round(iconSize * 0.62), padding: `0 ${Math.round(height * 0.55)}px 0 ${Math.round(height * 0.3)}px`, ...style }}>
      <span className={styles.pillBorder} aria-hidden />
      <span className={styles.pillIcon} style={{ display: "flex", width: iconSize, height: iconSize }}>{icon}</span>
      {children}
    </span>
  );
}

/** Pílulas de data e horário lado a lado e o local embaixo, como na capa. */
function ServiceRows({ data, horario, local }: { data: string; horario: string; local: string }) {
  if (!data && !horario && !local) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 30, alignItems: "flex-start" }}>
      {(data || horario) && (
        <div style={{ display: "flex", gap: 26 }}>
          {data && <Pill icon={<CalendarIcon size={38} />} campo="data">{data}</Pill>}
          {horario && <Pill icon={<ClockIcon size={38} />} campo="horario">{horario}</Pill>}
        </div>
      )}
      {local && <Pill icon={<PinIcon size={38} />} campo="local">{local}</Pill>}
    </div>
  );
}

function Cta({ children }: { children: string }) {
  return (
    <div className={styles.cta} data-campo="cta" style={{ alignSelf: "flex-start", padding: "0 34px 0 108px", marginLeft: 6 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${BG}/sympla.png`} alt="" className={styles.ctaSeal} style={{ left: -6 }} draggable={false} />
      {children}
    </div>
  );
}

/** "16h30 às 17h00 | coffee-break": horário, barra e texto alinhados como nas pranchetas. */
function SplitLine({ children, fontSize = 36, campo }: { children: string; fontSize?: number; campo?: string }) {
  const [left, ...rest] = children.split("|");
  const right = rest.join("|").trim();
  return (
    <div className={styles.kanit} data-campo={campo} style={{ fontSize, lineHeight: 1.2, display: "flex", alignItems: "baseline", gap: 36 }}>
      <span style={{ minWidth: right ? 240 : undefined }}>{left.trim()}</span>
      {right && (
        <>
          <span>|</span>
          <span>{right}</span>
        </>
      )}
    </div>
  );
}

function Stack({ children, gap }: { children: ReactNode[]; gap: number }) {
  const visible = children.filter(Boolean);
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {visible.map((child, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap }}>
          {i > 0 && <div className={styles.ruleWide} />}
          {child}
        </div>
      ))}
    </div>
  );
}

/** Espaço livre para o sticker/enquete do Instagram nos stories. */
function postingReserve(valores: SlideRenderProps["valores"]): number {
  if (text(valores, "enquete")) return 300;
  if (text(valores, "sticker")) return 150;
  return 0;
}

// ---------- capa ----------

export function OabCapa({ valores, indice, total, tipo }: SlideRenderProps) {
  const arraste = flag(valores, "arraste");
  return (
    <Board bg={arraste ? "capa.jpg" : "feed.jpg"} height={1350}>
      {tipo === "carrossel" && <CarouselDots indice={indice} total={total} />}
      <Zone style={{ left: 140, right: 120, top: 330, bottom: arraste ? 380 : 140 }}>
        {text(valores, "titulo") && (
          <FitText as="h2" className={styles.title} size={46} min={34} maxLines={2} campo="titulo">
            {text(valores, "titulo")}
          </FitText>
        )}
        <div className={styles.rule} style={{ marginTop: 26 }} />
        {text(valores, "apoio") && (
          <FitText className={styles.body} size={26} min={22} maxLines={3} style={{ marginTop: 48, maxWidth: 800 }} campo="apoio">
            {text(valores, "apoio")}
          </FitText>
        )}
        <div style={{ marginTop: 64 }}>
          <ServiceRows data={text(valores, "data")} horario={text(valores, "horario")} local={text(valores, "local")} />
        </div>
      </Zone>
    </Board>
  );
}

// ---------- programação (horário + palcos) ----------

export function OabProgramacao({ valores, indice, total, tipo }: SlideRenderProps) {
  const arraste = flag(valores, "arraste");
  // índice original de cada item, para o data-campo bater com o formulário
  const agenda = items(valores, "agenda")
    .map((a, index): ListItem => ({ ...a, index: String(index) }))
    .filter((a) => a.horario?.trim() || a.atividade?.trim());
  const palcos = items(valores, "palcos")
    .map((p, index): ListItem => ({ ...p, index: String(index) }))
    .filter((p) => p.rotulo?.trim() || p.titulo?.trim());
  const blocks: ReactNode[] = [];

  if (text(valores, "destaqueAntes")) blocks.push(<SplitLine key="antes" campo="destaqueAntes">{text(valores, "destaqueAntes")}</SplitLine>);
  if (text(valores, "horario")) {
    blocks.push(
      <Pill key="horario" icon={<ClockIcon size={30} />} height={50} fontSize={27.4} iconSize={30} style={{ alignSelf: "flex-start" }} campo="horario">
        {text(valores, "horario")}
      </Pill>
    );
  }
  if (agenda.length) {
    blocks.push(
      <Stack key="agenda" gap={22}>
        {agenda.map((a) => (
          <SplitLine key={a.index} campo={`agenda.${a.index}.atividade`}>
            {[a.horario?.trim(), a.atividade?.trim()].filter(Boolean).join(" | ")}
          </SplitLine>
        ))}
      </Stack>
    );
  }
  if (palcos.length) {
    blocks.push(
      <Stack key="palcos" gap={24}>
        {palcos.map((p, i) => (
          <div key={p.index} style={{ display: "grid", gridTemplateColumns: "182px 1fr", columnGap: 24, alignItems: "center" }}>
            <Pill
              icon={<PinIcon size={30} />}
              height={48}
              fontSize={27.4}
              iconSize={30}
              style={{ width: 182, padding: "0 0 0 12px", gap: 14 }}
              campo={`palcos.${p.index}.rotulo`}
            >
              {p.rotulo?.trim() || `Palco ${i + 1}`}
            </Pill>
            <FitText className={styles.body} size={26} min={20} maxLines={3} lineHeight={1.23} campo={`palcos.${p.index}.titulo`}>
              {p.titulo?.trim() ?? ""}
            </FitText>
          </div>
        ))}
      </Stack>
    );
  }
  if (text(valores, "destaqueDepois")) blocks.push(<SplitLine key="depois" campo="destaqueDepois">{text(valores, "destaqueDepois")}</SplitLine>);
  if (text(valores, "cta")) blocks.push(<Cta key="cta">{text(valores, "cta")}</Cta>);

  return (
    <Board bg={arraste ? "slide.jpg" : "slide-final.jpg"} height={1350}>
      {tipo === "carrossel" && <CarouselDots indice={indice} total={total} />}
      <Zone style={{ left: 110, right: 70, top: 300, bottom: 300, gap: 70 }}>{blocks}</Zone>
    </Board>
  );
}

// ---------- aviso (É AMANHÃ.) ----------

function AvisoContent({ valores, titleSize }: { valores: SlideRenderProps["valores"]; titleSize: number }) {
  const linhas = items(valores, "itens")
    .map((linha, index): ListItem => ({ ...linha, index: String(index) }))
    .filter((linha) => linha.texto?.trim());
  return (
    <>
      {text(valores, "titulo") && (
        <FitText as="h2" className={styles.title} size={titleSize} min={56} maxLines={2} lineHeight={1.05} campo="titulo">
          {text(valores, "titulo")}
        </FitText>
      )}
      <div className={styles.rule} style={{ marginTop: 34 }} />
      {linhas.length > 0 && (
        <div style={{ marginTop: 34 }}>
          <Stack gap={28}>
            {linhas.map((linha) => {
              const Icon = ICON_BY_NAME[linha.icone] ?? ICON_BY_NAME.informacao;
              return (
                <div key={linha.index} style={{ display: "grid", gridTemplateColumns: "44px 1fr", columnGap: 26, alignItems: "start", paddingBottom: 2 }}>
                  <span style={{ display: "flex", paddingTop: 2, color: "#edebe3" }} data-campo={`itens.${linha.index}.icone`}>
                    <Icon size={42} />
                  </span>
                  <FitText className={styles.kanit} size={36} min={28} maxLines={2} campo={`itens.${linha.index}.texto`}>
                    {linha.texto.trim()}
                  </FitText>
                </div>
              );
            })}
          </Stack>
        </div>
      )}
      {text(valores, "cta") && <div style={{ marginTop: 56, display: "flex" }}><Cta>{text(valores, "cta")}</Cta></div>}
    </>
  );
}

export function OabAvisoFeed({ valores, indice, total, tipo }: SlideRenderProps) {
  return (
    <Board bg="feed.jpg" height={1350}>
      {tipo === "carrossel" && <CarouselDots indice={indice} total={total} />}
      <Zone style={{ left: 137, right: 110, top: 330, bottom: 110 }}>
        <AvisoContent valores={valores} titleSize={84} />
      </Zone>
    </Board>
  );
}

export function OabAvisoStory({ valores }: SlideRenderProps) {
  return (
    <Board bg="story.jpg" height={1920}>
      <Zone style={{ left: 150, right: 110, top: 600, bottom: 180 + postingReserve(valores) }}>
        <AvisoContent valores={valores} titleSize={84} />
      </Zone>
    </Board>
  );
}

// ---------- lista (comissões) ----------

function ListaContent({ valores, story }: { valores: SlideRenderProps["valores"]; story: boolean }) {
  const lista = items(valores, "itens")
    .map((item, index): ListItem => ({ ...item, index: String(index) }))
    .filter((item) => item.texto?.trim());
  return (
    <>
      {text(valores, "titulo") && (
        <FitText as="h2" className={styles.title} size={46} min={34} maxLines={3} campo="titulo">
          {text(valores, "titulo")}
        </FitText>
      )}
      {story && <div className={styles.rule} style={{ marginTop: 30 }} />}
      {text(valores, "subtitulo") && (
        <p className={styles.title} style={{ fontSize: 36, marginTop: 44, textTransform: "none" }} data-campo="subtitulo">
          {text(valores, "subtitulo")}
        </p>
      )}
      {lista.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, marginTop: text(valores, "subtitulo") ? 14 : story ? 44 : 40, display: "flex", flexDirection: "column", gap: story ? 40 : 12 }}>
          {lista.map((item) => (
            <li key={item.index} style={{ display: "flex", alignItems: "baseline", gap: story ? 22 : 16 }}>
              <span className={styles.bullet} style={{ transform: `translateY(${story ? -4 : -2}px)` }} />
              {story ? (
                <FitText className={styles.kanit} size={36} min={28} maxLines={2} campo={`itens.${item.index}.texto`}>
                  {item.texto.trim()}
                </FitText>
              ) : (
                <FitText className={styles.body} size={26} min={21} maxLines={2} campo={`itens.${item.index}.texto`}>
                  {item.texto.trim()}
                </FitText>
              )}
            </li>
          ))}
        </ul>
      )}
      <div style={{ marginTop: story ? 80 : 60 }}>
        <ServiceRows data={text(valores, "data")} horario={text(valores, "horario")} local={text(valores, "local")} />
      </div>
    </>
  );
}

export function OabListaFeed({ valores, indice, total, tipo }: SlideRenderProps) {
  return (
    <Board bg="feed.jpg" height={1350}>
      {tipo === "carrossel" && <CarouselDots indice={indice} total={total} />}
      <Zone style={{ left: 136, right: 110, top: 330, bottom: 110 }}>
        <ListaContent valores={valores} story={false} />
      </Zone>
    </Board>
  );
}

export function OabListaStory({ valores }: SlideRenderProps) {
  return (
    <Board bg="story.jpg" height={1920}>
      <Zone style={{ left: 135, right: 110, top: 600, bottom: 180 + postingReserve(valores) }}>
        <ListaContent valores={valores} story />
      </Zone>
    </Board>
  );
}
