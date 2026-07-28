import type { PublicProfessionalProfile } from "@/lib/profiles/types";
import { sectionLabel } from "@/components/profiles/profile-public-utils";

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
          <h2 className="pp-section__title">
            {sectionLabel(section.key, profile.locale)}
          </h2>
          <ul className="pp-section__list">
            {section.entries.map((entry) => (
              <li key={entry.id} className="pp-section__item">
                <div className="pp-section__item-head">
                  {entry.linkUrl ? (
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
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
