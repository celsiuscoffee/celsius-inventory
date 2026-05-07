import type { MemberTier } from "./rewards";

export type TierStyle = {
  /** 2-stop background gradient — top to bottom. */
  gradient: [string, string];
  /** Optional radial accent overlay (top-right glow). null = no glow. */
  glow: string | null;
  /** Color for the greeting/name text. */
  nameColor: string;
  /** Color of the small caps eyebrow line above the name. */
  eyebrowColor: string;

  /** ── Tier card (the prominent strip under the greeting) ── */
  /** Solid background for the tier card so it stands out from the
   *  gradient regardless of how dark the gradient gets. */
  cardBg: string;
  /** Card border / hairline color. */
  cardBorder: string;
  /** Tier name color inside the card. */
  cardName: string;
  /** Status / progress sub-line color. */
  cardSub: string;
  /** Solid pill containing "2× pts" — bg + fg. */
  multiplierPillBg: string;
  multiplierPillFg: string;
  /** Filled progress bar color. */
  progressFg: string;
  /** Empty progress track color. */
  progressBg: string;

  /** Fill for the points pill on the right of the header. */
  pointsPillBg: string;
  /** Color of the points number inside the pill. */
  pointsTextColor: string;
  /** Tagline shown when there's no next tier (top-tier members). */
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
  eyebrowColor: "rgba(255,255,255,0.45)",
  cardBg: "rgba(255,255,255,0.08)",
  cardBorder: "rgba(255,255,255,0.14)",
  cardName: "#FFFFFF",
  cardSub: "rgba(255,255,255,0.65)",
  multiplierPillBg: "rgba(255,255,255,0.16)",
  multiplierPillFg: "#FFFFFF",
  progressFg: "#FBBF24",
  progressBg: "rgba(255,255,255,0.10)",
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
    eyebrowColor: "#F4C996",
    cardBg: "#3a1f0c",
    cardBorder: "rgba(244, 201, 150, 0.35)",
    cardName: "#FFFFFF",
    cardSub: "rgba(244, 201, 150, 0.85)",
    multiplierPillBg: "#F4C996",
    multiplierPillFg: "#3a1f0c",
    progressFg: "#F4C996",
    progressBg: "rgba(244, 201, 150, 0.18)",
    pointsPillBg: "rgba(244, 201, 150, 0.20)",
    pointsTextColor: "#FFFFFF",
    tagline: "Welcome to the club",
    ornamentColor: "#F4C996",
    sparkles: false,
  },
  silver: {
    gradient: ["#1f242c", "#0e1218"],
    glow: "rgba(200, 210, 224, 0.30)",
    nameColor: "#F1F5F9",
    eyebrowColor: "#CBD5E1",
    cardBg: "#252b35",
    cardBorder: "rgba(226, 232, 240, 0.40)",
    cardName: "#F8FAFC",
    cardSub: "rgba(226, 232, 240, 0.80)",
    multiplierPillBg: "#E2E8F0",
    multiplierPillFg: "#1f242c",
    progressFg: "#E2E8F0",
    progressBg: "rgba(226, 232, 240, 0.18)",
    pointsPillBg: "rgba(226, 232, 240, 0.18)",
    pointsTextColor: "#F1F5F9",
    tagline: "Earning more",
    ornamentColor: "#E2E8F0",
    sparkles: true,
  },
  gold: {
    gradient: ["#3a2208", "#1a0c02"],
    glow: "rgba(251, 191, 36, 0.45)",
    nameColor: "#FFFFFF",
    eyebrowColor: "#FBBF24",
    cardBg: "#3f2706",
    cardBorder: "rgba(251, 191, 36, 0.50)",
    cardName: "#FFFFFF",
    cardSub: "rgba(251, 191, 36, 0.90)",
    multiplierPillBg: "#FBBF24",
    multiplierPillFg: "#3a2208",
    progressFg: "#FBBF24",
    progressBg: "rgba(251, 191, 36, 0.18)",
    pointsPillBg: "rgba(251, 191, 36, 0.22)",
    pointsTextColor: "#FBBF24",
    tagline: "On the rise",
    ornamentColor: "#FBBF24",
    sparkles: true,
  },
  elite: {
    // Deep, near-black gradient — Elite reads as obsidian.
    gradient: ["#0a0a14", "#000000"],
    // Subtle indigo glow so the corner has a hint of royalty against
    // the otherwise-black canvas.
    glow: "rgba(99, 102, 241, 0.35)",
    nameColor: "#FFFFFF",
    eyebrowColor: "#FBBF24",
    // Slightly lifted near-black with a gold hairline border so the
    // card visibly sits ON the gradient instead of dissolving into it.
    cardBg: "#13131f",
    cardBorder: "rgba(251, 191, 36, 0.55)",
    cardName: "#FBBF24",
    cardSub: "rgba(255, 255, 255, 0.75)",
    multiplierPillBg: "#FBBF24",
    multiplierPillFg: "#0a0a14",
    progressFg: "#FBBF24",
    progressBg: "rgba(251, 191, 36, 0.18)",
    pointsPillBg: "rgba(251, 191, 36, 0.18)",
    pointsTextColor: "#FBBF24",
    tagline: "Top tier",
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
