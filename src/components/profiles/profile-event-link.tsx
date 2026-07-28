"use client";

import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import {
  beaconProfileEvent,
  clickEventTypeForAction,
} from "@/lib/profiles/metrics";
import type { ProfileEventSource, ProfileLocale } from "@/lib/profiles/types";
import { isAllowedProfileSource } from "@/components/profiles/profile-public-utils";

type ClickAction = "whatsapp" | "email" | "linkedin" | "website";

export type ProfileEventLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "onClick"
> & {
  slug: string;
  action: ClickAction;
  locale: ProfileLocale;
  source?: string | null;
  children: ReactNode;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

function resolveSource(source: string | null | undefined): ProfileEventSource {
  return isAllowedProfileSource(source) ? source : "direct";
}

/**
 * Link externo que registra o clique correspondente via beacon,
 * sem atrasar a navegação.
 */
export function ProfileEventLink({
  slug,
  action,
  locale,
  source = null,
  children,
  onClick,
  ...rest
}: ProfileEventLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    beaconProfileEvent(slug, {
      eventType: clickEventTypeForAction(action),
      source: resolveSource(source),
      locale,
    });
    onClick?.(event);
  }

  return (
    <a {...rest} onClick={handleClick}>
      {children}
    </a>
  );
}
