import type { ReactNode } from "react";
import { awardsFontVariables } from "@/components/rh/bp-awards/awards-fonts";

export default function BpAwardsRevealLayout({ children }: { children: ReactNode }) {
  return <div className={awardsFontVariables}>{children}</div>;
}
