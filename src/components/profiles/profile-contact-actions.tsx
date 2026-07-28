"use client";

import { useMemo, useState, type MouseEvent } from "react";
import type { PublicProfessionalProfile, ProfileEventSource } from "@/lib/profiles/types";
import { beaconProfileEvent } from "@/lib/profiles/metrics";
import { ProfileEventLink } from "@/components/profiles/profile-event-link";
import {
  buildCanonicalProfileUrl,
  buildContactDownloadHref,
  downloadVCardOrFail,
  formatVisibleContacts,
  isAllowedProfileSource,
  profileUiCopy,
  shareOrCopyProfileUrl,
  whatsappHref,
} from "@/components/profiles/profile-public-utils";

type ProfileContactActionsProps = {
  profile: PublicProfessionalProfile;
  source?: string | null;
};

const ACTION_CLASS = "pp-action min-h-11 min-w-11";

function resolveSource(source: string | null | undefined): ProfileEventSource {
  return isAllowedProfileSource(source) ? source : "direct";
}

export function ProfileContactActions({
  profile,
  source = null,
}: ProfileContactActionsProps) {
  const copy = profileUiCopy(profile.locale);
  const { contacts } = profile;
  const [vcardFailed, setVcardFailed] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const eventSource = resolveSource(source);

  const contatoHref = useMemo(
    () => buildContactDownloadHref(profile.slug, profile.locale, source),
    [profile.slug, profile.locale, source]
  );

  const visibleContactText = useMemo(
    () => formatVisibleContacts(profile),
    [profile]
  );

  async function handleSaveContact(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    setStatusMessage(null);
    const result = await downloadVCardOrFail({
      href: contatoHref,
      filenameHint: profile.identity.name,
    });
    if (result === "failed") {
      setVcardFailed(true);
      return;
    }
    setVcardFailed(false);
  }

  async function handleCopyContacts() {
    try {
      await navigator.clipboard.writeText(visibleContactText);
      setStatusMessage(copy.contactsCopied);
    } catch {
      setStatusMessage(copy.shareFailed);
    }
  }

  async function handleShare() {
    setStatusMessage(null);
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const url = buildCanonicalProfileUrl({
      origin,
      slug: profile.slug,
      locale: profile.locale,
      source,
    });
    try {
      const result = await shareOrCopyProfileUrl({
        url,
        title: profile.identity.name,
        text: profile.identity.tagline || profile.identity.role,
        navigatorLike: typeof navigator !== "undefined" ? navigator : undefined,
      });
      if (result === "shared" || result === "copied") {
        beaconProfileEvent(profile.slug, {
          eventType: "share",
          source: "share",
          locale: profile.locale,
        });
      }
      if (result === "copied") {
        setStatusMessage(copy.shareCopied);
      }
    } catch {
      setStatusMessage(copy.shareFailed);
    }
  }

  return (
    <section className="pp-actions" aria-label={copy.saveContact}>
      <div className="pp-actions__row">
        <a
          className={`${ACTION_CLASS} pp-action--primary`}
          href={contatoHref}
          onClick={handleSaveContact}
          data-action="save-contact"
        >
          {copy.saveContact}
        </a>

        {contacts.whatsapp ? (
          <ProfileEventLink
            className={ACTION_CLASS}
            href={whatsappHref(contacts.whatsapp)}
            rel="noopener noreferrer"
            target="_blank"
            data-action="whatsapp"
            slug={profile.slug}
            action="whatsapp"
            locale={profile.locale}
            source={eventSource}
          >
            {copy.whatsapp}
          </ProfileEventLink>
        ) : null}

        {contacts.email ? (
          <ProfileEventLink
            className={ACTION_CLASS}
            href={`mailto:${contacts.email}`}
            data-action="email"
            slug={profile.slug}
            action="email"
            locale={profile.locale}
            source={eventSource}
          >
            {copy.email}
          </ProfileEventLink>
        ) : null}

        {contacts.linkedinUrl ? (
          <ProfileEventLink
            className={ACTION_CLASS}
            href={contacts.linkedinUrl}
            rel="noopener noreferrer"
            target="_blank"
            data-action="linkedin"
            slug={profile.slug}
            action="linkedin"
            locale={profile.locale}
            source={eventSource}
          >
            {copy.linkedin}
          </ProfileEventLink>
        ) : null}

        <button
          type="button"
          className={ACTION_CLASS}
          onClick={handleShare}
          data-action="share"
        >
          {copy.share}
        </button>

        {contacts.websiteUrl ? (
          <ProfileEventLink
            className={ACTION_CLASS}
            href={contacts.websiteUrl}
            rel="noopener noreferrer"
            target="_blank"
            data-action="website"
            slug={profile.slug}
            action="website"
            locale={profile.locale}
            source={eventSource}
          >
            {copy.website}
          </ProfileEventLink>
        ) : null}
      </div>

      {vcardFailed ? (
        <div className="pp-actions__fallback" role="alert">
          <p>
            {profile.locale === "en"
              ? "Could not download the contact file."
              : "Não foi possível baixar o arquivo de contato."}
          </p>
          <button
            type="button"
            className={`${ACTION_CLASS} pp-action--secondary`}
            onClick={handleCopyContacts}
            data-action="copy-contacts"
          >
            {copy.copyContacts}
          </button>
        </div>
      ) : null}

      {statusMessage ? (
        <p className="pp-actions__status" role="status">
          {statusMessage}
        </p>
      ) : null}
    </section>
  );
}
