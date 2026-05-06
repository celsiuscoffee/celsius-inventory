import type { MemberTier } from "./rewards";

export type TierStyle = {
  /** 2-stop background gradient — top to bottom. */
  gradient: [string, string];
  /** Optional radial accent overlay (top-right glow). null = no glow. */
  glow: string | null;
  /** Color for the tier name. */
  nameColor: string;
  /** Color for "X× points" multiplier text. */
  multiplierColor: string;
  /** Color of the small caps eyebrow line above the name. */
  eyebrowColor: string;
  /** Fill for the points pill on the right of the header. */
  pointsPillBg: string;
  /** Color of the points number inside the pill. */
  pointsTextColor: string;
  /** Tagline shown next to the tier badge ("Premium tier", etc). */
  tagline: string;
  /** Accent color used for the small sparkle/crown ornament. */
  ornamentColor: string;
  /** Whether to render the floating sparkle field overlay. */
  sparkles: boolean;
};

const FALLBACK: TierStyle = {
  gradient: ["#160800", "#160800"],
  glow: null,
  nameColor: "#FFFFFF",
  multiplierColor: "rgba(255,255,255,0.7)",
  eyebrowColor: "rgba(255,255,255,0.45)",
  pointsPillBg: "rgba(255,255,255,0.10)",
  pointsTextColor: "#FFFFFF",
  tagline: "Member",
  ornamentColor: "#FBBF24",
  sparkles: false,
};

const STYLES: Record<string, TierStyle> = {
  bronze: {
    gradient: ["#2a1408", "#160800"],
    glow: "rgba(180, 95, 30, 0.35)",
    nameColor: "#FFFFFF",
    multiplierColor: "#F4C996",
    eyebrowColor: "rgba(244, 201, 150, 0.65)",
    pointsPillBg: "rgba(244, 201, 150, 0.18)",
    pointsTextColor: "#FFFFFF",
    tagline: "Welcome to the club",
    ornamentColor: "#F4C996",
    sparkles: false,
  },
  silver: {
    gradient: ["#1f242c", "#0e1218"],
    glow: "rgba(200, 210, 224, 0.30)",
    nameColor: "#F1F5F9",
    multiplierColor: "#CBD5E1",
    eyebrowColor: "rgba(203, 213, 225, 0.65)",
    pointsPillBg: "rgba(203, 213, 225, 0.18)",
    pointsTextColor: "#F1F5F9",
    tagline: "Earning more",
    ornamentColor: "#E2E8F0",
    sparkles: true,
  },
  gold: {
    gradient: ["#3a2208", "#1a0c02"],
    glow: "rgba(251, 191, 36, 0.45)",
    nameColor: "#FFFFFF",
    multiplierColor: "#FBBF24",
    eyebrowColor: "rgba(251, 191, 36, 0.75)",
    pointsPillBg: "rgba(251, 191, 36, 0.22)",
    pointsTextColor: "#FBBF24",
    tagline: "On the rise",
    ornamentColor: "#FBBF24",
    sparkles: true,
  },
  elite: {
    gradient: ["#1a1a2e", "#05060c"],
    glow: "rgba(99, 102, 241, 0.45)",
    nameColor: "#F8FAFC",
    multiplierColor: "#FBBF24",
    eyebrowColor: "rgba(251, 191, 36, 0.85)",
    pointsPillBg: "rgba(251, 191, 36, 0.18)",
    pointsTextColor: "#FBBF24",
    tagline: "Top tier · invitation only feel",
    ornamentColor: "#FBBF24",
    sparkles: true,
  },
};

/**
 * Resolve the visual treatment for the home header. Drops back to the
 * espresso solid baseline when no tier is loaded (signed out, fetch
 * failed, or first launch before the API responds).
 */
export function tierStyle(tier: MemberTier | null | undefined): TierStyle {
  const slug = tier?.tier_slug ?? "";
  return STYLES[slug] ?? FALLBACK;
}

export function tierFallback(): TierStyle {
  return FALLBACK;
}
