import type { PublicProfessionalProfile } from "@/lib/profiles/types";
import {
  FIRM_LOGO_ALT,
  FIRM_LOGO_SRC,
  getProfileInitials,
} from "@/components/profiles/profile-public-utils";

type ProfileHeroProps = {
  profile: PublicProfessionalProfile;
};

function BioParagraphs({ bio }: { bio: string }) {
  const parts = bio
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return <p className="pp-hero__bio">{bio}</p>;
  }

  return (
    <div className="pp-hero__bio-stack">
      {parts.map((part, index) => (
        <p key={index} className="pp-hero__bio">
          {part}
        </p>
      ))}
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
          width={200}
          height={44}
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
                width={176}
                height={176}
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
          <p className="pp-hero__eyebrow">{identity.role}</p>
          <h1 className="pp-hero__name">{identity.name}</h1>
          <div className="pp-hero__rule" aria-hidden="true" />

          <div className="pp-hero__meta">
            {identity.practiceArea ? (
              <span className="pp-hero__chip">{identity.practiceArea}</span>
            ) : null}
            {identity.oab ? (
              <span className="pp-hero__chip">{identity.oab}</span>
            ) : null}
            {identity.tenureLabel ? (
              <span className="pp-hero__chip">{identity.tenureLabel}</span>
            ) : null}
          </div>

          {identity.tagline ? (
            <p className="pp-hero__tagline">{identity.tagline}</p>
          ) : null}
        </div>
      </div>

      {identity.bio ? <BioParagraphs bio={identity.bio} /> : null}
    </header>
  );
}
