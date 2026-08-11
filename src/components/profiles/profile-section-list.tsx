import type { PublicProfessionalProfile } from "@/lib/profiles/types";
import { sectionLabel } from "@/components/profiles/profile-public-utils";
import { buildInstagramReelEmbedUrl } from "@/components/profiles/profile-instagram-reel";

type ProfileSectionListProps = {
  profile: PublicProfessionalProfile;
};

export function ProfileSectionList({ profile }: ProfileSectionListProps) {
  if (profile.sections.length === 0) return null;

  return (
    <div className="pp-sections">
      {profile.sections.map((section) => (
        <section
          key={section.key}
          className="pp-section"
          data-section={section.key}
        >
          <div className="pp-section__heading">
            <h2 className="pp-section__title">
              {sectionLabel(section.key, profile.locale)}
            </h2>
          </div>
          <ul className="pp-section__list">
            {section.entries.map((entry) => {
              const reelEmbedUrl = buildInstagramReelEmbedUrl(entry.linkUrl);

              return (
                <li key={entry.id} className="pp-section__item">
                  <div className="pp-section__item-head">
                    {entry.linkUrl && !reelEmbedUrl ? (
                      <a
                        className="pp-section__link"
                        href={entry.linkUrl}
                        rel="noopener noreferrer"
                      >
                        {entry.title}
                      </a>
                    ) : (
                      <strong className="pp-section__item-title">{entry.title}</strong>
                    )}
                    {entry.occurredOn ? (
                      <time className="pp-section__date" dateTime={entry.occurredOn}>
                        {entry.occurredOn}
                      </time>
                    ) : null}
                  </div>
                  {entry.subtitle ? (
                    <p className="pp-section__subtitle">{entry.subtitle}</p>
                  ) : null}
                  {entry.description ? (
                    <p className="pp-section__description">{entry.description}</p>
                  ) : null}
                  {reelEmbedUrl && entry.linkUrl ? (
                    <div className="pp-section__reel">
                      <iframe
                        className="pp-section__reel-frame"
                        src={reelEmbedUrl}
                        title={`Reel: ${entry.title}`}
                        loading="lazy"
                        allow="autoplay; encrypted-media; picture-in-picture"
                        allowFullScreen
                      />
                      <a
                        className="pp-section__reel-cta"
                        href={entry.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <span aria-hidden="true">▶</span>
                        Assistir no Instagram
                      </a>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
