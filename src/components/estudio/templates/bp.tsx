"use client";

import type { ComponentType, CSSProperties, ReactNode } from "react";
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  ChartColumnIncreasing,
  CircleDollarSign,
  Cog,
  CreditCard,
  FileSignature,
  FileText,
  Gavel,
  Handshake,
  Lightbulb,
  PhoneCall,
  Scale,
  ShieldCheck,
  Store,
  Target,
  TrendingDown,
  UsersRound,
  type LucideProps,
} from "lucide-react";
import { studioImageUrl } from "@/lib/estudio/images";
import { IconifyIcon } from "../iconify-icon";
import styles from "./bp.module.css";
import { FitColumn, FitText, RichText, adjust, items, text, type SlideRenderProps } from "./parts";

/*
 * Modelos dos posts do escritório (posts.ai). Fundos, fênix, "arraste", @ e ícones do
 * rodapé saem de scripts/estudio/extrair-fundo.mjs para public/estudio/bp/; o resto é
 * desenhado aqui, com as medidas das pranchetas.
 */

const BG = "/estudio/bp";

/** Balões cheios das peças (? e !), em dourado com o sinal claro. */
function Bubble({ size, sign }: { size: number; sign: "?" | "!" }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <path d="M12 4h40a8 8 0 0 1 8 8v30a8 8 0 0 1-8 8H37l-5 9-5-9H12a8 8 0 0 1-8-8V12a8 8 0 0 1 8-8Z" fill="#d5b071" />
      {sign === "?" ? (
        <>
          <path d="M24.5 21.5a7.5 7.5 0 1 1 11.2 6.5c-2.4 1.4-3.7 2.8-3.7 5.6v1.4" fill="none" stroke="#fcf8f4" strokeWidth={5} strokeLinecap="round" />
          <circle cx="32" cy="42" r="3.2" fill="#fcf8f4" />
        </>
      ) : (
        <>
          <path d="M32 14v19" stroke="#fcf8f4" strokeWidth={6} strokeLinecap="round" />
          <circle cx="32" cy="42" r="3.6" fill="#fcf8f4" />
        </>
      )}
    </svg>
  );
}

const LINE_ICONS: Record<string, ComponentType<LucideProps>> = {
  check: BadgeCheck,
  escudo: ShieldCheck,
  calendario: CalendarDays,
  grafico: ChartColumnIncreasing,
  queda: TrendingDown,
  dinheiro: CircleDollarSign,
  cartao: CreditCard,
  loja: Store,
  predio: Building2,
  documento: FileText,
  contrato: FileSignature,
  balanca: Scale,
  martelo: Gavel,
  telefone: PhoneCall,
  pessoas: UsersRound,
  acordo: Handshake,
  engrenagem: Cog,
  alvo: Target,
  lampada: Lightbulb,
};

export function BpIcon({ name, size }: { name: string; size: number }) {
  if (name === "pergunta") return <Bubble size={size} sign="?" />;
  if (name === "alerta") return <Bubble size={size} sign="!" />;
  if (name.startsWith("iconify:")) return <IconifyIcon value={name} size={size} stroke={1.5} />;
  const Icon = LINE_ICONS[name];
  return Icon ? <Icon size={size} strokeWidth={1.5} absoluteStrokeWidth={false} /> : null;
}

// referência para o teste de que todo ícone da lista tem desenho
export const BP_ICON_NAMES = ["pergunta", "alerta", ...Object.keys(LINE_ICONS)];

function Img({ src, className, style, campo }: { src: string; className?: string; style?: CSSProperties; campo?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className={className} style={style} draggable={false} data-campo={campo} />;
}

function Board({ bg, dark, backdrop, children }: { bg: string; dark: boolean; backdrop?: ReactNode; children: ReactNode }) {
  return (
    <div className={`${styles.board} ${dark ? styles.escuro : ""}`} style={{ position: "relative", width: 1080, height: 1350, overflow: "hidden", background: dark ? "#101c2c" : "#fcf8f4" }}>
      {backdrop ?? <Img src={`${BG}/${bg}`} className={styles.layer} />}
      {children}
    </div>
  );
}

function Dots({ indice, total }: { indice: number; total: number }) {
  if (total < 2) return null;
  return (
    <div className={styles.dots} aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`${styles.dot} ${i === indice ? styles.dotActive : ""}`} />
      ))}
    </div>
  );
}

const tone = (dark: boolean) => (dark ? "branco" : "navy");

// ---------- conteúdo ----------

export function BpConteudo({ valores, indice, total, ajustes, fundo }: SlideRenderProps) {
  const aj = adjust(ajustes);
  const dark = text(valores, "tema") === "escuro";
  const last = total > 1 && indice === total - 1;
  // guarda a posição original de cada caixa para o data-campo bater com o formulário
  const caixas = items(valores, "caixas")
    .map((caixa, index) => ({ caixa, index }))
    .filter(({ caixa }) => caixa.texto?.trim());
  const titleIcon = text(valores, "icone");
  const bg = `fundo-${dark ? "escuro" : "claro"}-${fundo?.tipo === "variacao" ? fundo.n : (indice % 3) + 1}.jpg`;
  // foto de fundo em cover, com o papel/navy por cima para o texto continuar legível
  const backdrop =
    fundo?.tipo === "imagem" ? (
      <>
        <Img src={studioImageUrl(fundo.path)} className={styles.layer} style={{ objectFit: "cover" }} />
        {/* transparência na cor (rgba): o SVG para o Illustrator lê assim */}
        <div className={styles.layer} style={{ background: dark ? `rgba(16, 28, 44, ${fundo.camada})` : `rgba(252, 248, 244, ${fundo.camada})` }} />
      </>
    ) : undefined;

  return (
    <Board bg={bg} dark={dark} backdrop={backdrop}>
      <Dots indice={indice} total={total} />
      <Img src={`${BG}/fenix.png`} style={{ position: "absolute", left: 100, top: 28, width: 110, height: 112 }} />
      <div className={styles.headerLine} />
      {last ? (
        <Img src={`${BG}/arroba-${tone(dark)}.png`} style={{ position: "absolute", left: 775, top: 72, width: 195, height: 40 }} />
      ) : (
        <Img src={`${BG}/arraste-${tone(dark)}.png`} style={{ position: "absolute", left: 830, top: 55, width: 140, height: 65 }} />
      )}

      <FitColumn base={32 * aj.texto} className={styles.column} style={{ left: 110, right: 110, top: 140 + aj.y, bottom: 185 - aj.y }} deps={[valores, ajustes]}>
        {titleIcon && titleIcon !== "nenhum" && (
          <span className={styles.titleIcon} data-campo="icone">
            <BpIcon name={titleIcon} size={titleIcon === "pergunta" || titleIcon === "alerta" ? 158 : 112} />
          </span>
        )}
        {text(valores, "titulo") && (
          <h2 className={styles.title} style={aj.titulo !== 1 ? { fontSize: `${1.96 * aj.titulo}em` } : undefined} data-campo="titulo">
            {text(valores, "titulo")}
          </h2>
        )}
        {caixas.length > 0 && (
          <div className={styles.boxes} style={text(valores, "titulo") ? undefined : { marginTop: 0 }}>
            {caixas.map(({ caixa, index }) => (
              <Caixa
                key={index}
                campo={`caixas.${index}`}
                estilo={caixa.estilo}
                icone={caixa.icone}
                marcador={caixa.marcador}
                rotulo={caixa.rotulo?.trim() ?? ""}
                texto={caixa.texto.trim()}
              />
            ))}
          </div>
        )}
      </FitColumn>

      {last ? (
        <Img src={`${BG}/acoes-${tone(dark)}.png`} style={{ position: "absolute", left: 460, top: 1210, width: 160, height: 50 }} />
      ) : (
        <>
          <Img src={`${BG}/acoes-${tone(dark)}.png`} style={{ position: "absolute", left: 105, top: 1210, width: 160, height: 50 }} />
          <Img src={`${BG}/arroba-${tone(dark)}.png`} style={{ position: "absolute", left: 775, top: 1225, width: 195, height: 40 }} />
        </>
      )}
    </Board>
  );
}

function Caixa({ campo, estilo, icone, marcador, rotulo, texto }: { campo: string; estilo: string; icone: string; marcador: string; rotulo: string; texto: string }) {
  const lines = texto.split("\n").map((l) => l.trim()).filter(Boolean);
  const list = marcador && marcador !== "nenhum";
  const styleClass = estilo === "contorno" ? styles.contorno : estilo === "destaque" ? styles.destaque : "";
  return (
    <div className={styles.boxWrap}>
      {rotulo && (
        <span className={styles.label} data-campo={`${campo}.rotulo`}>
          {rotulo}
        </span>
      )}
      <div className={`${styles.box} ${styleClass} ${rotulo ? styles.withLabel : ""}`} data-campo={`${campo}.texto`}>
        {icone && icone !== "nenhum" && (
          <span className={styles.boxIcon} data-campo={`${campo}.icone`}>
            <BpIcon name={icone} size={icone === "pergunta" || icone === "alerta" ? 118 : 84} />
          </span>
        )}
        {list ? (
          <ul className={styles.list}>
            {lines.map((line, i) => (
              <li key={i}>
                <span className={`${styles.marker} ${styles[marcador] ?? ""}`} />
                <p className={styles.text}>
                  <RichText text={line} />
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.text}>
            <RichText text={texto} />
          </p>
        )}
      </div>
    </div>
  );
}

// ---------- capa com equipe ----------

const TEAM = { left: 85, right: 85, gap: 24, maxWidth: 300, ratio: 1.38, bottom: 1185 };

/**
 * Capa com duas a quatro pessoas: texto centralizado em cima e cartões arredondados
 * com a foto (com fundo) e o nome numa pílula de contorno dourado.
 */
export function BpCapaEquipe({ valores, indice, total, ajustes }: SlideRenderProps) {
  const aj = adjust(ajustes);
  const dark = text(valores, "tema") === "escuro";
  const carrossel = total > 1;
  const last = carrossel && indice === total - 1;
  // guarda o número de cada pessoa para o data-campo bater com o formulário
  const pessoas = [1, 2, 3, 4]
    .map((n) => ({ n, foto: text(valores, `foto${n}`), nome: text(valores, `nome${n}`) }))
    .filter((p) => p.foto || p.nome);
  const count = Math.max(pessoas.length, 1);
  const width = Math.floor(Math.min(TEAM.maxWidth, (1080 - TEAM.left - TEAM.right - TEAM.gap * (count - 1)) / count));
  const height = Math.round(width * TEAM.ratio);
  const cardsTop = TEAM.bottom - height;

  return (
    <Board bg={`fundo-${dark ? "escuro" : "claro"}-1.jpg`} dark={dark}>
      <Dots indice={indice} total={total} />
      <Img src={`${BG}/fenix.png`} style={{ position: "absolute", left: 100, top: 28, width: 110, height: 112 }} />
      <div className={styles.headerLine} />
      {carrossel && !last ? (
        <Img src={`${BG}/arraste-${tone(dark)}.png`} style={{ position: "absolute", left: 830, top: 55, width: 140, height: 65 }} />
      ) : (
        <Img src={`${BG}/arroba-${tone(dark)}.png`} style={{ position: "absolute", left: 775, top: 72, width: 195, height: 40 }} />
      )}

      <FitColumn
        base={32 * aj.texto}
        className={styles.column}
        style={{ left: 110, right: 110, top: 150 + aj.y, bottom: 1350 - cardsTop + 45 - aj.y, alignItems: "center", textAlign: "center" }}
        deps={[valores, ajustes]}
      >
        {text(valores, "area") && (
          <span className={styles.pillArea} data-campo="area">
            {text(valores, "area")}
          </span>
        )}
        {text(valores, "chamada") && (
          <span className={styles.pillKicker} style={{ marginTop: "0.7em" }} data-campo="chamada">
            {text(valores, "chamada")}
          </span>
        )}
        {text(valores, "titulo") && (
          <h2
            className={styles.coverTitle}
            data-campo="titulo"
            style={{ marginTop: text(valores, "chamada") ? "0.35em" : "0.6em", ...(aj.titulo !== 1 ? { fontSize: `${2.094 * aj.titulo}em` } : {}) }}
          >
            {text(valores, "titulo")}
          </h2>
        )}
        <span className={styles.coverRule} style={{ marginTop: "0.9em" }} />
        {text(valores, "subtitulo") && (
          <p className={styles.subtitle} style={{ marginTop: "0.75em", maxWidth: "24em" }} data-campo="subtitulo">
            {text(valores, "subtitulo")}
          </p>
        )}
      </FitColumn>

      <div className={styles.teamRow} style={{ top: cardsTop, height, gap: TEAM.gap }}>
        {pessoas.map((p) => (
          <div key={p.n} className={styles.teamCard} style={{ width, height }}>
            {p.foto ? (
              <Img src={studioImageUrl(p.foto)} className={styles.teamPhoto} campo={`foto${p.n}`} />
            ) : (
              <span className={styles.teamPlaceholder} data-campo={`foto${p.n}`}>
                <BpIcon name="pessoas" size={Math.round(width * 0.3)} />
              </span>
            )}
            <span className={styles.teamShade} />
            {p.nome && (
              // a pílula fica por fora: o FitText mede só o texto, sem borda nem respiro
              <div className={styles.teamNameRow}>
                <span className={styles.teamPill}>
                  <FitText as="span" className={styles.teamName} size={21} min={15} maxLines={1} campo={`nome${p.n}`}>
                    {p.nome}
                  </FitText>
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {carrossel && !last ? (
        <>
          <Img src={`${BG}/acoes-${tone(dark)}.png`} style={{ position: "absolute", left: 105, top: 1210, width: 160, height: 50 }} />
          <Img src={`${BG}/arroba-${tone(dark)}.png`} style={{ position: "absolute", left: 775, top: 1225, width: 195, height: 40 }} />
        </>
      ) : (
        <Img src={`${BG}/acoes-${tone(dark)}.png`} style={{ position: "absolute", left: 460, top: 1210, width: 160, height: 50 }} />
      )}
    </Board>
  );
}

// ---------- pessoa ----------

/** Caixa da foto e coluna de texto; a moldura de contorno fica deslocada para fora, como nas capas. */
const PESSOA_BOX = { width: 450, height: 680, top: 320, frame: 22 };
const PESSOA = {
  direita: { box: 540, frame: 1, column: { left: 110, right: 590 } },
  esquerda: { box: 90, frame: -1, column: { left: 600, right: 100 } },
};
/** A coluna de texto fica centrada na altura da caixa da foto. */
const PESSOA_COLUMN = { top: 220, bottom: 1350 - (PESSOA_BOX.top + PESSOA_BOX.height) - 100 };

/**
 * Slide interno com uma pessoa: o cabeçalho dos slides de conteúdo (fênix, linha,
 * "arraste") — sem o logo de 10 anos, que é só da capa —, a foto (com fundo) numa
 * caixa arredondada de um lado e papel, chamada, nome e texto de apoio do outro,
 * sempre alinhados à esquerda.
 */
export function BpPessoa({ valores, indice, total, ajustes, fundo }: SlideRenderProps) {
  const aj = adjust(ajustes);
  const dark = text(valores, "tema") === "escuro";
  const last = total > 1 && indice === total - 1;
  const lado = PESSOA[text(valores, "lado") === "esquerda" ? "esquerda" : "direita"];
  const foto = text(valores, "foto");
  const bg = `fundo-${dark ? "escuro" : "claro"}-${fundo?.tipo === "variacao" ? fundo.n : (indice % 3) + 1}.jpg`;
  const backdrop =
    fundo?.tipo === "imagem" ? (
      <>
        <Img src={studioImageUrl(fundo.path)} className={styles.layer} style={{ objectFit: "cover" }} />
        <div className={styles.layer} style={{ background: dark ? `rgba(16, 28, 44, ${fundo.camada})` : `rgba(252, 248, 244, ${fundo.camada})` }} />
      </>
    ) : undefined;

  return (
    <Board bg={bg} dark={dark} backdrop={backdrop}>
      <Dots indice={indice} total={total} />
      <Img src={`${BG}/fenix.png`} style={{ position: "absolute", left: 100, top: 28, width: 110, height: 112 }} />
      <div className={styles.headerLine} />
      {last ? (
        <Img src={`${BG}/arroba-${tone(dark)}.png`} style={{ position: "absolute", left: 775, top: 72, width: 195, height: 40 }} />
      ) : (
        <Img src={`${BG}/arraste-${tone(dark)}.png`} style={{ position: "absolute", left: 830, top: 55, width: 140, height: 65 }} />
      )}

      <span
        className={styles.personFrame}
        style={{
          left: lado.box + PESSOA_BOX.frame * lado.frame,
          top: PESSOA_BOX.top + PESSOA_BOX.frame,
          width: PESSOA_BOX.width,
          height: PESSOA_BOX.height,
        }}
      />
      <div className={styles.personBox} style={{ left: lado.box, top: PESSOA_BOX.top, width: PESSOA_BOX.width, height: PESSOA_BOX.height }}>
        {foto ? (
          <Img
            src={studioImageUrl(foto)}
            className={styles.teamPhoto}
            campo="foto"
            style={{ transform: `translate(${aj.fotoX}px, ${aj.fotoY}px) scale(${aj.fotoZoom})`, transformOrigin: "center top" }}
          />
        ) : (
          <span className={styles.teamPlaceholder} data-campo="foto">
            <BpIcon name="pessoas" size={130} />
          </span>
        )}
      </div>

      <FitColumn
        base={32 * aj.texto}
        className={styles.column}
        style={{ ...lado.column, top: PESSOA_COLUMN.top + aj.y, bottom: PESSOA_COLUMN.bottom - aj.y, alignItems: "flex-start", textAlign: "left" }}
        deps={[valores, ajustes]}
      >
        {text(valores, "area") && (
          <span className={styles.pillArea} data-campo="area">
            {text(valores, "area")}
          </span>
        )}
        {text(valores, "chamada") && (
          <span className={styles.pillKicker} style={{ marginTop: "0.7em" }} data-campo="chamada">
            {text(valores, "chamada")}
          </span>
        )}
        {text(valores, "titulo") && (
          <h2
            className={styles.coverTitle}
            data-campo="titulo"
            style={{ marginTop: text(valores, "chamada") ? "0.35em" : "0.6em", ...(aj.titulo !== 1 ? { fontSize: `${2.094 * aj.titulo}em` } : {}) }}
          >
            {text(valores, "titulo")}
          </h2>
        )}
        <span className={styles.coverRule} style={{ marginTop: "1.1em" }} />
        {text(valores, "rotulo") && (
          <span className={styles.personLabel} style={{ marginTop: "0.9em" }} data-campo="rotulo">
            {text(valores, "rotulo")}
          </span>
        )}
        {text(valores, "painel") && (
          <p className={styles.personPanel} style={{ marginTop: text(valores, "rotulo") ? "0.3em" : "0.9em" }} data-campo="painel">
            {text(valores, "painel")}
          </p>
        )}
        {text(valores, "subtitulo") && (
          <p className={styles.subtitle} style={{ marginTop: "0.75em" }} data-campo="subtitulo">
            {text(valores, "subtitulo")}
          </p>
        )}
      </FitColumn>

      <Img src={`${BG}/acoes-${tone(dark)}.png`} style={{ position: "absolute", left: lado.column.left - 5, top: 1210, width: 160, height: 50 }} />
    </Board>
  );
}

// ---------- capa ----------

/**
 * Três capas do posts.ai: clara com foto à esquerda (texto à direita), clara com foto
 * à direita (texto à esquerda) e escura com foto à esquerda.
 */
const COVER = {
  "claro-esquerda": {
    bg: "capa-clara-esq.jpg",
    // o título passa por cima da moldura e da foto, como no Illustrator
    zone: { left: 285, right: 85, top: 428, bottom: 290 },
    align: "right" as const,
    photo: { left: 0, top: 520, width: 470 },
    // nameMax: o nome não invade a foto nem cruza a linha que desce do ponto dourado
    author: { axis: 625, top: 1127, nameMax: 330 },
  },
  "claro-direita": {
    bg: "capa-clara-dir.jpg",
    zone: { left: 108, right: 430, top: 420, bottom: 410 },
    align: "left" as const,
    photo: { left: 615, top: 620, width: 465 },
    author: { axis: 430, top: 1092, nameMax: 420 },
  },
  "escuro-esquerda": {
    bg: "capa-escura-esq.jpg",
    zone: { left: 285, right: 85, top: 428, bottom: 290 },
    align: "right" as const,
    photo: { left: 0, top: 540, width: 470 },
    author: { axis: 680, top: 1120, nameMax: 380 },
  },
};

export function BpCapa({ valores, indice, total, ajustes }: SlideRenderProps) {
  const aj = adjust(ajustes);
  const dark = text(valores, "tema") === "escuro";
  // não há capa escura com foto à direita no posts.ai
  const cover = dark ? COVER["escuro-esquerda"] : text(valores, "lado") === "direita" ? COVER["claro-direita"] : COVER["claro-esquerda"];
  const right = cover.align === "right";
  const foto = text(valores, "foto");
  const logo = text(valores, "logo");
  const autor = text(valores, "autor");
  const cargo = text(valores, "cargo");

  return (
    <Board bg={cover.bg} dark={dark}>
      <Dots indice={indice} total={total} />
      {foto && (
        <Img
          src={studioImageUrl(foto)}
          className={styles.photo}
          campo="foto"
          style={{
            left: cover.photo.left,
            top: cover.photo.top,
            width: cover.photo.width,
            height: 1350 - cover.photo.top,
            transform: `translate(${aj.fotoX}px, ${aj.fotoY}px) scale(${aj.fotoZoom})`,
            transformOrigin: "center bottom",
          }}
        />
      )}

      <FitColumn
        base={32 * aj.texto}
        className={styles.column}
        style={{ ...cover.zone, top: cover.zone.top + aj.y, bottom: cover.zone.bottom - aj.y, justifyContent: "flex-start", alignItems: right ? "flex-end" : "flex-start", textAlign: cover.align }}
        deps={[valores, ajustes]}
      >
        {text(valores, "area") && (
          <span className={styles.pillArea} data-campo="area">
            {text(valores, "area")}
          </span>
        )}
        {text(valores, "chamada") && (
          <span className={styles.pillKicker} style={{ marginTop: "0.7em" }} data-campo="chamada">
            {text(valores, "chamada")}
          </span>
        )}
        {logo && right && <Img src={studioImageUrl(logo)} className={styles.clientLogo} style={{ marginTop: "0.9em", objectPosition: "right center" }} campo="logo" />}
        {text(valores, "titulo") && (
          <h2
            className={styles.coverTitle}
            data-campo="titulo"
            style={{ marginTop: text(valores, "chamada") ? "0.35em" : logo && right ? "0.5em" : "1.9em", ...(aj.titulo !== 1 ? { fontSize: `${2.094 * aj.titulo}em` } : {}) }}
          >
            {text(valores, "titulo")}
          </h2>
        )}
        {logo && !right && <Img src={studioImageUrl(logo)} className={styles.clientLogo} style={{ marginTop: "0.6em" }} campo="logo" />}
        <span className={styles.coverRule} style={{ marginTop: "1.1em" }} />
        {text(valores, "subtitulo") && (
          <p className={styles.subtitle} style={{ marginTop: "0.75em", maxWidth: right ? "17.8em" : "12.35em" }} data-campo="subtitulo">
            {text(valores, "subtitulo")}
          </p>
        )}
      </FitColumn>

      {(autor || cargo) && (
        <div className={styles.author} style={{ left: cover.author.axis, top: cover.author.top }}>
          {autor && (
            <FitText className={styles.authorName} size={23} min={18} maxLines={1} style={{ maxWidth: cover.author.nameMax, textAlign: "center" }} campo="autor">
              {`Por: ${autor}`}
            </FitText>
          )}
          {cargo && (
            <span className={styles.authorRole} data-campo="cargo">
              {cargo}
            </span>
          )}
        </div>
      )}
    </Board>
  );
}
