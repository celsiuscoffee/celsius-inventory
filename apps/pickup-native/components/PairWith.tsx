import { useEffect, useMemo } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import * as Haptics from "expo-haptics";
import { Plus, Check, Sparkles } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import type { Product } from "../lib/menu";
import { useApp } from "../lib/store";
import { formatPrice } from "../lib/api";
import { cloudinaryThumb, prefetchImages } from "../lib/image";
import { ProductImage } from "./ProductImage";
import { fetchActiveCombos, bestComboForPair } from "../lib/combos";

/**
 * Pair-with cross-sell on the product detail screen. Stage-and-commit
 * pattern — taps select pairings into a "to add" set on the parent
 * screen; the parent's main "Add to cart" button is what actually
 * commits everything (drink + every staged pairing) in one shot.
 *
 * Why staged + tied to the main commit instead of independent adds:
 *   - Direct add felt disjointed: tap + on a pair → silent add →
 *     no feedback → main drink still not in cart yet → if user
 *     backs out of the screen, the pair is orphaned in the cart.
 *   - Stage-and-commit matches the mental model of "build my
 *     order on this page". One decision, one commit.
 *   - If user changes their mind and backs out, nothing gets added.
 *
 * Visual state:
 *   - Default: white card, plus button bottom-right
 *   - Staged: amber border + tint, checkmark replaces the plus,
 *     subtle "Added" pill at the top-left of the card
 *
 * Pairing logic (Phase 1, deliberately simple):
 *   - Each category is tagged drink/food via CATEGORY_KIND below.
 *   - Drink → suggest food. Food → suggest drink.
 *   - Rank by featured first, then featured_position, then name.
 *   - De-dupe against cart so we don't suggest already-in-basket items.
 *   - Show 6 items max in a horizontal scroll.
 */

const CATEGORY_KIND: Record<string, "drink" | "food"> = {
  // Drinks
  "artisan-choc":   "drink",
  "artisan-matcha": "drink",
  "classic":        "drink",
  "flavoured":      "drink",
  "fruit-tea":      "drink",
  "gourmet-tea":    "drink",
  "mocha":          "drink",
  "mocktails":      "drink",
  "bottles":        "drink",
  // Food
  "cakes":          "food",
  "cookies":        "food",
  "croissant":      "food",
  "fries":          "food",
  "nasi-lemak":     "food",
  "noodle":         "food",
  "pasta":          "food",
  "roti-bakar":     "food",
  "sandwiches":     "food",
};

const MAX_PAIRS = 6;

export type PairWithProps = {
  /** The product currently being viewed. */
  current: Product;
  /** All products from the menu fetch. */
  allProducts: Product[];
  /** Set of product IDs the customer has staged for "add together"
   *  with the main product. The parent owns this state — we just
   *  reflect it visually and emit toggles. */
  stagedIds: Set<string>;
  /** Toggle a product into / out of the staged set. */
  onToggle: (p: Product) => void;
};

/** Compute the price of a pair-with line at default selections. The
 *  parent uses this to roll up the bottom CTA total without having
 *  to peek into modifier shape. Exported so the product page can
 *  share the exact same math. */
export function defaultPairLinePrice(p: Product): number {
  const defaultModTotal = (p.modifiers ?? [])
    .filter((g) => !g.multiSelect)
    .reduce((s, g) => {
      const def = g.options.find((o) => o.isDefault) ?? g.options[0];
      return s + (def?.priceDelta ?? 0);
    }, 0);
  return p.price + defaultModTotal;
}

/** Build the pair-with suggestion list. Exported so the product page
 *  can prefetch the exact same images this component will render —
 *  the loader holds until those are cached, eliminating the
 *  "image-arrives-after-page" flash that reads as broken. */
export function buildPairSuggestions(args: {
  current: Product;
  allProducts: Product[];
  cartProductIds: Set<string>;
}): Product[] {
  const { current, allProducts, cartProductIds } = args;
  const currentKind = CATEGORY_KIND[current.category] ?? "drink";
  const targetKind: "drink" | "food" = currentKind === "drink" ? "food" : "drink";
  return allProducts
    .filter((p) =>
      p.id !== current.id &&
      p.is_available &&
      (CATEGORY_KIND[p.category] ?? "drink") === targetKind &&
      !cartProductIds.has(p.id),
    )
    .sort((a, b) => {
      if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
      const ap = a.featured_position ?? 9999;
      const bp = b.featured_position ?? 9999;
      if (ap !== bp) return ap - bp;
      return a.name.localeCompare(b.name);
    })
    .slice(0, MAX_PAIRS);
}

export function PairWith({ current, allProducts, stagedIds, onToggle }: PairWithProps) {
  const cart = useApp((s) => s.cart);
  const outletId = useApp((s) => s.outletId);

  // Active combos — cached 5min so the section render is instant on
  // subsequent product pages. Empty list when no combos exist (the
  // common case until admins set some up); component renders normally.
  const { data: combos = [] } = useQuery({
    queryKey: ["active-combos"],
    queryFn: fetchActiveCombos,
    staleTime: 5 * 60_000,
  });

  const suggestions = useMemo(
    () => buildPairSuggestions({
      current,
      allProducts,
      cartProductIds: new Set(cart.map((c) => c.productId)),
    }),
    [current, allProducts, cart],
  );

  // Reorder suggestions: combo-eligible items first (descending by
  // savings) so customers see the best-value pairings up top. Same
  // category logic still picks the candidate set; combo pre-sort
  // just promotes within it.
  const suggestionsSorted = useMemo(() => {
    if (combos.length === 0) return suggestions;
    return [...suggestions].sort((a, b) => {
      const aSaving = bestComboForPair({
        combos, currentProductId: current.id, currentProductPrice: current.price,
        pairProductId: a.id, pairProductPrice: a.price, outletId,
      })?.savings ?? 0;
      const bSaving = bestComboForPair({
        combos, currentProductId: current.id, currentProductPrice: current.price,
        pairProductId: b.id, pairProductPrice: b.price, outletId,
      })?.savings ?? 0;
      return bSaving - aSaving;
    });
  }, [suggestions, combos, current, outletId]);

  // Warm the image cache as soon as we know the suggestion list.
  // The horizontal scroll lazy-renders offscreen items, but
  // Image.prefetch primes the native cache so the first scroll past
  // them is buttery instead of "appearing 1-2s after they slide in".
  useEffect(() => {
    prefetchImages(
      suggestionsSorted.map((p) => cloudinaryThumb(p.image_url, { size: 140 })),
    );
  }, [suggestionsSorted]);

  if (suggestionsSorted.length === 0) return null;

  const heading =
    (CATEGORY_KIND[current.category] ?? "drink") === "drink"
      ? "Pair with a bite"
      : "Pair with a drink";

  // If any staged pair triggers a combo with the current product,
  // surface a section-level "Combo unlocked" hint above the cards
  // so the customer sees confirmation that the savings will apply
  // when they tap Add to cart.
  const stagedComboSavings = combos.length === 0 ? 0 : suggestionsSorted
    .filter((p) => stagedIds.has(p.id))
    .reduce((sum, p) => {
      const c = bestComboForPair({
        combos,
        currentProductId: current.id,
        currentProductPrice: current.price,
        pairProductId: p.id,
        pairProductPrice: p.price,
        outletId,
      });
      return sum + (c?.savings ?? 0);
    }, 0);

  return (
    <View className="mt-8">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-espresso text-xs font-bold uppercase tracking-wider">
          {heading}
        </Text>
        <Text className="text-muted-fg text-[10px] uppercase tracking-wider">
          Tap to add
        </Text>
      </View>
      {stagedComboSavings > 0 ? (
        <View
          className="mb-3 rounded-xl px-3 py-2 flex-row items-center gap-2"
          style={{ backgroundColor: "#DCFCE7", borderWidth: 1, borderColor: "#86EFAC" }}
        >
          <Sparkles size={12} color="#15803D" strokeWidth={2.5} />
          <Text
            className="text-green-800 text-[12px] flex-1"
            style={{ fontFamily: "SpaceGrotesk_700Bold" }}
          >
            Combo unlocked — saves {formatPrice(stagedComboSavings).replace(/^RM ?/, "RM")}
          </Text>
        </View>
      ) : (
        <Text
          className="text-muted-fg text-[11px] mb-3"
          style={{ fontFamily: "SpaceGrotesk_400Regular" }}
        >
          Adds together when you tap Add to cart below.
        </Text>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingRight: 8 }}
      >
        {suggestionsSorted.map((p) => {
          const isStaged = stagedIds.has(p.id);
          // Combo savings preview — null when no combo applies. Drives
          // the "Save RMx" badge that nudges customers toward the
          // value pairing.
          const combo = combos.length > 0
            ? bestComboForPair({
                combos,
                currentProductId: current.id,
                currentProductPrice: current.price,
                pairProductId: p.id,
                pairProductPrice: p.price,
                outletId,
              })
            : null;
          return (
            <Pressable
              key={p.id}
              onPress={() => {
                Haptics.selectionAsync();
                onToggle(p);
              }}
              className="rounded-2xl overflow-hidden active:opacity-90"
              style={{
                width: 140,
                backgroundColor: isStaged ? "#FFF6F1" : "#FFFFFF",
                borderWidth: isStaged ? 2 : 1,
                borderColor: isStaged ? "#C05040" : "rgba(26,8,0,0.10)",
                shadowColor: "#000",
                shadowOpacity: isStaged ? 0.08 : 0.04,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 2 },
              }}
              accessibilityRole="button"
              accessibilityLabel={
                isStaged
                  ? `Remove ${p.name} from order, ${formatPrice(defaultPairLinePrice(p))}`
                  : `Add ${p.name} to order, ${formatPrice(defaultPairLinePrice(p))}`
              }
              accessibilityState={{ selected: isStaged }}
            >
              {/* Image area — ProductImage handles the loading state
                  (cream pulse + delayed spinner + fade-in) so the card
                  never reads as broken or empty. The parent Pressable
                  is 140 wide; we lock height too. */}
              <View style={{ width: 140, height: 140, position: "relative" }}>
                <ProductImage
                  uri={cloudinaryThumb(p.image_url, { size: 140 })}
                  width={140}
                  height={140}
                  fallback={
                    <Text
                      className="text-espresso text-[13px] text-center"
                      style={{ fontFamily: "Peachi-Bold" }}
                      numberOfLines={3}
                    >
                      {p.name}
                    </Text>
                  }
                />
                {/* Combo savings badge — surfaces "Save RMx" when this
                    pair triggers a backoffice combo promo. Sits on top
                    of the image at top-left. Suppressed when "Added"
                    is showing (the staged state takes precedence so
                    the badge area never has two pills fighting). */}
                {!isStaged && combo && (
                  <View
                    style={{
                      position: "absolute",
                      top: 8,
                      left: 8,
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: "#16A34A", // green to read as "deal"
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 10,
                      shadowColor: "#000",
                      shadowOpacity: 0.18,
                      shadowRadius: 3,
                      shadowOffset: { width: 0, height: 1 },
                      elevation: 2,
                    }}
                  >
                    <Sparkles size={10} color="#FFFFFF" strokeWidth={2.5} />
                    <Text
                      className="text-white text-[9px] uppercase ml-0.5"
                      style={{ fontFamily: "SpaceGrotesk_700Bold", letterSpacing: 0.5 }}
                    >
                      Save {formatPrice(combo.savings).replace(/^RM ?/, "RM")}
                    </Text>
                  </View>
                )}
                {/* "Added" badge on staged cards — top-left so it doesn't
                    fight with the toggle button bottom-right. */}
                {isStaged && (
                  <View
                    style={{
                      position: "absolute",
                      top: 8,
                      left: 8,
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: "#C05040",
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 10,
                    }}
                  >
                    <Check size={10} color="#FFFFFF" strokeWidth={3} />
                    <Text
                      className="text-white text-[9px] uppercase ml-0.5"
                      style={{ fontFamily: "SpaceGrotesk_700Bold", letterSpacing: 0.5 }}
                    >
                      Added
                    </Text>
                  </View>
                )}
                {/* Toggle button. + when not staged, ✓ when staged. */}
                <View
                  style={{
                    position: "absolute",
                    bottom: 8,
                    right: 8,
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isStaged ? "#FFFFFF" : "#160800",
                    borderWidth: isStaged ? 1.5 : 0,
                    borderColor: "#C05040",
                    // A small shadow lifts the button off the photo so
                    // it's tappable even on a busy product image.
                    shadowColor: "#000",
                    shadowOpacity: 0.25,
                    shadowRadius: 3,
                    shadowOffset: { width: 0, height: 1 },
                    elevation: 2,
                  }}
                >
                  {isStaged ? (
                    <Check size={18} color="#C05040" strokeWidth={3} />
                  ) : (
                    <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
                  )}
                </View>
              </View>
              <View className="px-2.5 py-2">
                <Text
                  className="text-espresso text-[12px]"
                  style={{ fontFamily: "Peachi-Bold" }}
                  numberOfLines={1}
                >
                  {p.name}
                </Text>
                <View className="flex-row items-baseline gap-1.5 mt-0.5">
                  {/* Strikethrough original price when a combo applies,
                      with the new effective bundle-share price next to
                      it. Conveys "you save by combining" without
                      needing to break out a separate combo line. */}
                  {combo ? (
                    <>
                      <Text
                        className="text-muted-fg text-[11px]"
                        style={{ fontFamily: "SpaceGrotesk_500Medium", textDecorationLine: "line-through" }}
                      >
                        {formatPrice(defaultPairLinePrice(p))}
                      </Text>
                      <Text
                        className="text-green-700 text-[12px]"
                        style={{ fontFamily: "Peachi-Bold" }}
                      >
                        with combo
                      </Text>
                    </>
                  ) : (
                    <Text
                      className="text-primary text-[12px]"
                      style={{ fontFamily: "Peachi-Bold" }}
                    >
                      {formatPrice(defaultPairLinePrice(p))}
                    </Text>
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
