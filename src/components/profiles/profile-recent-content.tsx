import type { PublicProfessionalProfile } from "@/lib/profiles/types";
import { profileUiCopy } from "@/components/profiles/profile-public-utils";

const MAX_RECENT = 3;

type ProfileRecentContentProps = {
  profile: PublicProfessionalProfile;
};

export function ProfileRecentContent({ profile }: ProfileRecentContentProps) {
  const items = profile.recentContent.slice(0, MAX_RECENT);
  if (items.length === 0) return null;

  const copy = profileUiCopy(profile.locale);

  return (
    <section className="pp-recent" aria-labelledby="pp-recent-heading">
      <h2 id="pp-recent-heading" className="pp-section__title">
        {copy.recentContent}
      </h2>
      <ul className="pp-recent__list">
        {items.map((item) => (
          <li key={item.key} className="pp-recent__item" data-content-key={item.key}>
            {item.url ? (
              <a
                className="pp-recent__link"
                href={item.url}
                rel="noopener noreferrer"
              >
                {item.title}
              </a>
            ) : (
              <span className="pp-recent__title">{item.title}</span>
            )}
            {item.publishedAt ? (
              <time className="pp-recent__date" dateTime={item.publishedAt}>
                {item.publishedAt.slice(0, 10)}
              </time>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
