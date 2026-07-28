import type { PublicProfessionalProfile } from "@/lib/profiles/types";
import { ProfileContactActions } from "@/components/profiles/profile-contact-actions";
import { ProfileHero } from "@/components/profiles/profile-hero";
import { ProfileInstitutionalFooter } from "@/components/profiles/profile-institutional-footer";
import { ProfileRecentContent } from "@/components/profiles/profile-recent-content";
import { ProfileSectionList } from "@/components/profiles/profile-section-list";
import {
  buildLanguageSwitchHref,
  profileUiCopy,
} from "@/components/profiles/profile-public-utils";
import styles from "@/components/profiles/professional-profile-page.module.css";

export type ProfessionalProfilePageProps = {
  profile: PublicProfessionalProfile;
  source?: string | null;
};

function LanguageSwitch({
  profile,
  source,
}: {
  profile: PublicProfessionalProfile;
  source?: string | null;
}) {
  const copy = profileUiCopy(profile.locale);
  const ptHref = buildLanguageSwitchHref(profile.slug, "pt-BR", source);
  const enHref = buildLanguageSwitchHref(profile.slug, "en", source);

  return (
    <nav className="pp-lang" aria-label="Language">
      <a
        href={ptHref}
        className={
          profile.locale === "pt-BR" ? "pp-lang__link is-active" : "pp-lang__link"
        }
        hrefLang="pt-BR"
        lang="pt-BR"
        data-lang="pt"
      >
        {copy.langPt}
      </a>
      <span className="pp-lang__sep" aria-hidden="true">
        /
      </span>
      <a
        href={enHref}
        className={
          profile.locale === "en" ? "pp-lang__link is-active" : "pp-lang__link"
        }
        hrefLang="en"
        lang="en"
        data-lang="en"
      >
        {copy.langEn}
      </a>
    </nav>
  );
}

export function ProfessionalProfilePage({
  profile,
  source = null,
}: ProfessionalProfilePageProps) {
  const copy = profileUiCopy(profile.locale);

  return (
    <div className={`${styles.root} pp-root`} data-profile-slug={profile.slug}>
      <div className="pp-shell">
        <div className="pp-topbar">
          <LanguageSwitch profile={profile} source={source} />
        </div>

        {profile.campaignMessage ? (
          <aside className="pp-campaign" role="status" data-campaign="true">
            <p className="pp-campaign__label">{copy.campaign}</p>
            <p className="pp-campaign__message">{profile.campaignMessage}</p>
          </aside>
        ) : null}

        <ProfileHero profile={profile} />
        <ProfileContactActions profile={profile} source={source} />
        <ProfileSectionList profile={profile} />
        <ProfileRecentContent profile={profile} />
        <ProfileInstitutionalFooter profile={profile} />
      </div>
    </div>
  );
}
