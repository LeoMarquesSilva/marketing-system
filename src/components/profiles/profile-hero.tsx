import type { ProfileLocale, PublicProfessionalProfile } from "@/lib/profiles/types";
import {
  FIRM_LOGO_ALT,
  FIRM_LOGO_SRC,
  getProfileInitials,
  profileUiCopy,
} from "@/components/profiles/profile-public-utils";

type ProfileHeroProps = {
  profile: PublicProfessionalProfile;
};

function splitBioParts(bio: string): string[] {
  return bio
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function BioParagraphs({
  bio,
  locale,
}: {
  bio: string;
  locale: ProfileLocale;
}) {
  const parts = splitBioParts(bio);
  const copy = profileUiCopy(locale);

  if (parts.length <= 1) {
    return <p className="pp-hero__bio">{bio}</p>;
  }

  const [summary, ...rest] = parts;

  return (
    <div className="pp-hero__bio-stack">
      <p className="pp-hero__bio">{summary}</p>
      <details className="pp-hero__bio-more">
        <summary className="pp-hero__bio-more-summary">
          {copy.readFullBio}
        </summary>
        <div className="pp-hero__bio-more-body">
          {rest.map((part, index) => (
            <p key={index} className="pp-hero__bio">
              {part}
            </p>
          ))}
        </div>
      </details>
    </div>
  );
}

export function ProfileHero({ profile }: ProfileHeroProps) {
  const { identity } = profile;
  const initials = getProfileInitials(identity.name);

  return (
    <header className="pp-hero">
      <div className="pp-hero__brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="pp-hero__logo"
          src={FIRM_LOGO_SRC}
          alt={FIRM_LOGO_ALT}
          width={160}
          height={35}
        />
      </div>

      <div className="pp-hero__layout">
        <div className="pp-hero__portrait">
          <div className="pp-hero__photo-halo" aria-hidden="true" />
          <div className="pp-hero__photo-ring">
            {identity.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="pp-hero__photo"
                src={identity.photoUrl}
                alt=""
                width={200}
                height={200}
              />
            ) : (
              <div
                className="pp-hero__avatar"
                role="img"
                aria-label={identity.name}
                data-testid="profile-initials-avatar"
              >
                <span aria-hidden="true">{initials}</span>
              </div>
            )}
          </div>
        </div>

        <div className="pp-hero__identity">
          <h1 className="pp-hero__name">{identity.name}</h1>

          {identity.role ? (
            <p className="pp-hero__role">{identity.role}</p>
          ) : null}

          {identity.practiceArea ? (
            <p className="pp-hero__practice">{identity.practiceArea}</p>
          ) : null}

          <div className="pp-hero__rule" aria-hidden="true" />

          {identity.oab || identity.tenureLabel ? (
            <div className="pp-hero__meta">
              {identity.oab ? (
                <span className="pp-hero__chip">{identity.oab}</span>
              ) : null}
              {identity.tenureLabel ? (
                <span className="pp-hero__chip">{identity.tenureLabel}</span>
              ) : null}
            </div>
          ) : null}

          {identity.tagline ? (
            <p className="pp-hero__tagline">{identity.tagline}</p>
          ) : null}
        </div>
      </div>

      {identity.bio ? (
        <BioParagraphs bio={identity.bio} locale={profile.locale} />
      ) : null}
    </header>
  );
}
