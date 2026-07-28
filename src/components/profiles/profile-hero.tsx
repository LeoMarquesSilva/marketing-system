import type { PublicProfessionalProfile } from "@/lib/profiles/types";
import {
  FIRM_LOGO_ALT,
  FIRM_LOGO_SRC,
  getProfileInitials,
} from "@/components/profiles/profile-public-utils";

type ProfileHeroProps = {
  profile: PublicProfessionalProfile;
};

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
          width={180}
          height={40}
        />
      </div>

      <div className="pp-hero__layout">
        <div className="pp-hero__photo-wrap" aria-hidden={identity.photoUrl ? undefined : true}>
          {identity.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="pp-hero__photo"
              src={identity.photoUrl}
              alt=""
              width={160}
              height={160}
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

        <div className="pp-hero__copy">
          <h1 className="pp-hero__name">{identity.name}</h1>
          <p className="pp-hero__role">{identity.role}</p>
          {identity.practiceArea ? (
            <p className="pp-hero__area">{identity.practiceArea}</p>
          ) : null}
          {identity.oab ? <p className="pp-hero__oab">{identity.oab}</p> : null}
          {identity.tenureLabel ? (
            <p className="pp-hero__tenure">{identity.tenureLabel}</p>
          ) : null}
          {identity.tagline ? (
            <p className="pp-hero__tagline">{identity.tagline}</p>
          ) : null}
        </div>
      </div>

      {identity.bio ? <p className="pp-hero__bio">{identity.bio}</p> : null}
    </header>
  );
}
