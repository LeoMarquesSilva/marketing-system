"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ExternalLink,
  Feather,
  Globe,
  Quote,
} from "lucide-react";
import {
  FIRM_LOGO_ALT,
  FIRM_LOGO_SRC,
  FIRM_WEBSITE_URL,
} from "@/components/profiles/profile-public-utils";
import type { ReadingRecommendation } from "@/lib/reading-trajectories/types";
import styles from "./reading-public-page.module.css";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function Portrait({ item, className }: { item: ReadingRecommendation; className: string }) {
  if (item.photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.photoUrl} alt={`Retrato de ${item.publicName}`} className={className} />;
  }
  return <span className={`${className} ${styles.portraitFallback}`}>{initials(item.publicName)}</span>;
}

function BookCover({ item, className }: { item: ReadingRecommendation; className: string }) {
  if (item.bookCoverUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.bookCoverUrl} alt={`Capa de ${item.bookTitle}`} className={className} />;
  }
  return <span className={`${className} ${styles.coverFallback}`}><BookOpen aria-hidden="true" /><strong>{item.bookTitle}</strong></span>;
}

export function ReadingExperience({ items }: { items: ReadingRecommendation[] }) {
  const ready = useMemo(() => items.filter((item) => item.isComplete), [items]);
  const [selectedId, setSelectedId] = useState(ready[0]?.id ?? "");
  const selected = ready.find((item) => item.id === selectedId) ?? ready[0] ?? null;
  const selectedIndex = selected ? ready.findIndex((item) => item.id === selected.id) : -1;

  function select(item: ReadingRecommendation, scroll = true) {
    if (!item.isComplete) return;
    setSelectedId(item.id);
    if (scroll) {
      window.requestAnimationFrame(() => {
        document.getElementById("historia-selecionada")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  function move(direction: -1 | 1) {
    if (!selected || ready.length < 2) return;
    const next = ready[(selectedIndex + direction + ready.length) % ready.length];
    select(next, false);
  }

  return (
    <main className={styles.root}>
      <div className={styles.paper}>
        <header className={styles.masthead}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={FIRM_LOGO_SRC} alt={FIRM_LOGO_ALT} className={styles.logo} />
          <a href={FIRM_WEBSITE_URL} target="_blank" rel="noopener noreferrer" className={styles.siteLink}><Globe aria-hidden="true" /><span>Site do escritório</span></a>
        </header>

        <section className={styles.hero} aria-labelledby="reading-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Bismarchi | Pires apresenta</p>
            <h1 id="reading-title">Leituras que<br /><em>formam trajetórias.</em></h1>
            <p className={styles.intro}>Livros que marcaram a trajetória dos profissionais do Bismarchi | Pires — e as histórias que explicam por que cada escolha merece acompanhar quem está começando no Direito.</p>
            <a href="#indicacoes" className={styles.discover}>Descobrir as indicações <ArrowDown aria-hidden="true" /></a>
          </div>
          <div className={styles.heroObject} aria-hidden="true">
            <div className={styles.heroBook}><span>LEITURAS</span><strong>QUE FORMAM<br />TRAJETÓRIAS</strong><small>Bismarchi | Pires</small></div>
            <div className={styles.heroPhoenix}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/fenix.png" alt="" />
            </div>
          </div>
        </section>

        <section id="indicacoes" className={styles.collection} aria-labelledby="collection-title">
          <div className={styles.sectionHeading}>
            <div><p className={styles.eyebrow}>A seleção</p><h2 id="collection-title">Oito perspectivas.<br />Uma profissão em construção.</h2></div>
            <p><strong>{ready.length}</strong> histórias disponíveis</p>
          </div>

          <div className={styles.grid}>
            {items.map((item, index) => item.isComplete ? (
              <button key={item.id} type="button" onClick={() => select(item)} aria-pressed={selected?.id === item.id} className={`${styles.card} ${selected?.id === item.id ? styles.cardActive : ""}`}>
                <span className={styles.cardNumber}>{String(index + 1).padStart(2, "0")}</span>
                <Portrait item={item} className={styles.cardPortrait} />
                <span className={styles.cardCopy}><span className={styles.cardArea}>{item.practiceArea}</span><strong>{item.publicName}</strong><span className={styles.cardBook}>{item.bookTitle}</span><span className={styles.cardAction}>Ler a história <ArrowRight aria-hidden="true" /></span></span>
                <BookCover item={item} className={styles.cardCover} />
              </button>
            ) : (
              <article key={item.id} className={`${styles.card} ${styles.cardPending}`}>
                <span className={styles.cardNumber}>{String(index + 1).padStart(2, "0")}</span>
                <Portrait item={item} className={styles.cardPortrait} />
                <span className={styles.cardCopy}><span className={styles.cardArea}>{item.practiceArea}</span><strong>{item.publicName}</strong><span className={styles.pendingLabel}><Feather aria-hidden="true" /> Indicação em preparação</span></span>
              </article>
            ))}
          </div>
        </section>

        {selected && (
          <section id="historia-selecionada" className={styles.story} aria-live="polite">
            <div className={styles.storyRail}>
              <span className={styles.storyIndex}>{String(selectedIndex + 1).padStart(2, "0")} / {String(ready.length).padStart(2, "0")}</span>
              <div className={styles.railLine} />
              <Quote aria-hidden="true" />
            </div>

            <div className={styles.storyIdentity}>
              <div className={styles.portraitFrame}><Portrait item={selected} className={styles.storyPortrait} /><span /></div>
              <p className={styles.eyebrow}>A indicação de</p>
              <h2>{selected.publicName}</h2>
              <p className={styles.role}>{selected.role}<br /><span>{selected.practiceArea}</span></p>
            </div>

            <article className={styles.storyArticle}>
              <div className={styles.bookHeading}>
                <BookCover item={selected} className={styles.storyCover} />
                <div><p className={styles.eyebrow}>O livro escolhido</p><h3>{selected.bookTitle}</h3>{selected.bookAuthor && <p>por {selected.bookAuthor}</p>}</div>
              </div>

              {selected.trajectoryNote && <blockquote className={styles.trajectoryNote}><span>Uma história dentro da história</span><p>“{selected.trajectoryNote}”</p></blockquote>}

              <div className={styles.recommendation}>
                <p className={styles.eyebrow}>Por que esta leitura?</p>
                {selected.recommendationText?.split(/\n\s*\n/).map((paragraph, index) => <p key={`${selected.id}-${index}`}>{paragraph}</p>)}
              </div>

              <div className={styles.storyFooter}>
                {selected.bookLink ? <a href={selected.bookLink} target="_blank" rel="noopener noreferrer">Conhecer o livro <ExternalLink aria-hidden="true" /></a> : <span />}
                <div className={styles.storyNav}><button type="button" onClick={() => move(-1)} aria-label="Indicação anterior"><ArrowLeft /></button><button type="button" onClick={() => move(1)} aria-label="Próxima indicação"><ArrowRight /></button></div>
              </div>
            </article>
          </section>
        )}

        <footer className={styles.footer}>
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/fenix.png" alt="" aria-hidden="true" />
            <div><strong>Bismarchi | Pires</strong><span>Sociedade de Advogados</span></div>
          </div>
          <p>Conhecimento compartilhado também constrói trajetórias.</p>
          <a href={FIRM_WEBSITE_URL} target="_blank" rel="noopener noreferrer">bismarchipires.com.br</a>
        </footer>
      </div>
    </main>
  );
}
