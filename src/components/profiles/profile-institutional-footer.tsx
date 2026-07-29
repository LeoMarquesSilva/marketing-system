import type { PublicProfessionalProfile } from "@/lib/profiles/types";
import {
  FIRM_LOGO_ALT,
  FIRM_LOGO_SRC,
  FIRM_WEBSITE_URL,
  profileUiCopy,
} from "@/components/profiles/profile-public-utils";

type ProfileInstitutionalFooterProps = {
  profile: PublicProfessionalProfile;
};

export function ProfileInstitutionalFooter({
  profile,
}: ProfileInstitutionalFooterProps) {
  const copy = profileUiCopy(profile.locale);
  const siteUrl = profile.contacts.websiteUrl || FIRM_WEBSITE_URL;
  const siteHost = siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <footer className="pp-footer">
      <div className="pp-footer__rule" aria-hidden="true" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="pp-footer__logo"
        src={FIRM_LOGO_SRC}
        alt={FIRM_LOGO_ALT}
        width={160}
        height={36}
      />
      <p className="pp-footer__notice">{copy.institutionalNotice}</p>
      {siteUrl ? (
        <p className="pp-footer__site">
          <a href={siteUrl} rel="noopener noreferrer">
            {siteHost}
          </a>
        </p>
      ) : null}
    </footer>
  );
}
