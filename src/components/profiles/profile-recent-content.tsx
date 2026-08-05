"use client";

import { useState } from "react";
import type {
  ProfileContentSourceType,
  PublicProfessionalProfile,
} from "@/lib/profiles/types";
import {
  IconInstagram,
  IconLinkedIn,
  IconPlay,
} from "@/components/profiles/profile-icons";
import {
  formatProfilePublishedAtBr,
  profileUiCopy,
} from "@/components/profiles/profile-public-utils";

const PREVIEW_COUNT = 3;

type ProfileRecentContentProps = {
  profile: PublicProfessionalProfile;
};

function SourceIcon({ type }: { type: ProfileContentSourceType }) {
  if (type === "instagram") return <IconInstagram />;
  if (type === "linkedin") return <IconLinkedIn />;
  return <IconPlay />;
}

function sourceLabel(type: ProfileContentSourceType, locale: "pt-BR" | "en") {
  if (locale === "en") {
    if (type === "instagram") return "Instagram";
    if (type === "linkedin") return "Article";
    return "Video";
  }
  if (type === "instagram") return "Instagram";
  if (type === "linkedin") return "Artigo";
  return "Vídeo";
}

export function ProfileRecentContent({ profile }: ProfileRecentContentProps) {
  const allItems = profile.recentContent;
  const [expanded, setExpanded] = useState(false);

  if (allItems.length === 0) return null;

  const copy = profileUiCopy(profile.locale);
  const hasMore = allItems.length > PREVIEW_COUNT;
  const items = expanded ? allItems : allItems.slice(0, PREVIEW_COUNT);

  return (
    <section className="pp-recent" aria-labelledby="pp-recent-heading">
      <div className="pp-section__heading">
        <h2 id="pp-recent-heading" className="pp-section__title">
          {copy.recentContent}
        </h2>
      </div>
      <ul className="pp-recent__list">
        {items.map((item) => {
          const body = (
            <>
              <span className="pp-recent__media" aria-hidden="true">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt="" width={64} height={64} />
                ) : (
                  <span className="pp-recent__media-fallback">
                    <SourceIcon type={item.sourceType} />
                  </span>
                )}
              </span>
              <span className="pp-recent__body">
                <span className="pp-recent__source">
                  <SourceIcon type={item.sourceType} />
                  {sourceLabel(item.sourceType, profile.locale)}
                </span>
                {item.url ? (
                  <span className="pp-recent__link">{item.title}</span>
                ) : (
                  <span className="pp-recent__title">{item.title}</span>
                )}
                {item.publishedAt ? (
                  <time className="pp-recent__date" dateTime={item.publishedAt}>
                    {formatProfilePublishedAtBr(item.publishedAt)}
                  </time>
                ) : null}
              </span>
              {item.url ? (
                <span className="pp-recent__outbound" aria-hidden="true">
                  ↗
                </span>
              ) : null}
            </>
          );

          return (
            <li
              key={item.key}
              className="pp-recent__item"
              data-content-key={item.key}
            >
              {item.url ? (
                <a
                  className="pp-recent__card"
                  href={item.url}
                  rel="noopener noreferrer"
                >
                  {body}
                </a>
              ) : (
                <div className="pp-recent__card">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      {hasMore && !expanded ? (
        <button
          type="button"
          className="pp-recent__more"
          onClick={() => setExpanded(true)}
          data-action="view-all-publications"
        >
          {copy.viewAllPublications}
        </button>
      ) : null}
    </section>
  );
}
