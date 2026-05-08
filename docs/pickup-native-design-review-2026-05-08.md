# Pickup-Native Design Review — 2026-05-08

Snapshot before the next design overhaul. Revert path:

```bash
git reset --hard pre-design-overhaul-2026-05-08
```

Currently shipped OTAs at the moment of this snapshot:

- **Preview**: update group `9e976e2e-4ff0-45a5-965d-f5735d640589`
- **Production**: update group `cc681ea8-17b3-4ba6-a425-cb10f49c8391`

Both at runtime version `1.0.0`, message _"fix Boss promo: send Origin header on evaluate call"_.

---

## What's planned to ship next (top 5)

### 1. Collapse home into a "For you" tabbed strip
Replace the Available Rewards + Your Usual sections (currently two separate strips) with a single horizontally-scrolling tabbed area:

- **Vouchers** (default tab — shows issued + claimable rewards w/ expiry urgency)
- **Usual** (recent items pulled from order history)

Saves ~200vpx on the first viewport, removes a redundant section header, and consolidates personalisation into one mental block.

**Files**: `app/index.tsx` (lines ~556–649), new `components/HomePersonalStrip.tsx`.

### 2. Animated order progress stepper
On the order detail page (`app/order/[id].tsx`), replace the static status pill with a 3-step horizontal progress bar:

```
●━━━━━━━━━━●━━━━━━━━━━○
Paid       Brewing     Ready
```

Active node pulses gently (reanimated `withRepeat`). Pair with the existing swipe-to-collect for the Ready state.

**Files**: `app/order/[id].tsx`, new `components/OrderStepper.tsx`.

### 3. Force outlet pick before menu access
Block `/menu` if `outletId` is null and route the user to a friendly outlet picker first. Today, customers can shop the menu, hit checkout, and only then learn they didn't pick an outlet — high abandon point.

**Files**: `app/menu.tsx` (early return + redirect), copy on `app/store.tsx` for first-time pickers.

### 4. Cart empty state with thumbnails
Replace the bland "Your cart is empty" + "Browse menu" button with a richer first-time pickup hero:

- 1-2 thumbnail tiles of best sellers ("Start with these →")
- Brand-aligned espresso panel for visual continuity with active-order banner

**Files**: `app/cart.tsx` (lines ~37–46).

### 5. Expiry urgency on issued rewards
Apply the same `urgencyLabel()` logic used on home rewards (`index.tsx:138`) to the rewards screen claim list — "Ends in 3d", "Last one!", etc. Drives use-it-or-lose-it behaviour on welcome BOGO + birthday rewards.

**Files**: `app/rewards.tsx` (claimable list rendering), pull `urgencyLabel` into a shared util.

---

## Other suggestions (not yet scheduled)

### Brand consistency
6. Promo banner uses amber accent — swap to `text-primary` (terracotta) for brand alignment
7. Pick one corner radius rule: hero panels = 0, content cards = `rounded-2xl`, pills = `rounded-full`. No `rounded-xl` / `rounded-3xl` anywhere.
8. Font discipline: numerals + headlines = Peachi-Bold; everything else = Space Grotesk

### UX friction
9. ~~Force outlet pick~~ (in priority list)
10. Sign-in OTP escape: add "Didn't get it?" hint after 30s + "Use a different number" link
11. ~~Cart empty state~~ (in priority list)
12. Reorder dump to cart silent — add toast "5 items added — review cart →"
13. ~~Reward expiry urgency~~ (in priority list)

### Empty states
14. First-launch hero: full-bleed espresso panel + brand poster art instead of mostly-empty home
15. Menu top-bar banner for guests: "Sign in for free welcome drink"
16. Account screen busy — hide Privacy/Delete/Support behind a Settings sub-screen

### Microcopy
17. Generic copy → brand voice ("Send code" → "Text me the code", "Browse menu" → "See what's brewing")
18. Pluralisation bugs: "1 items" in checkout. Centralise in a `pluralize()` util.
19. Phone format preview live under the input ("Will text +60 12 345 6789")
20. Button verb consistency: View cart vs. Checkout vs. Cart — pick one per context

### Accessibility
21. Color contrast: `rgba(255,255,255,0.55)` on terracotta likely fails WCAG AA — bump to 0.70
22. `accessibilityLabel` on every icon-only button (cart, chevrons, +, etc.)
23. Tap targets: bump `hitSlop={12}` everywhere to hit Apple HIG 44pt minimum
24. Text scaling: `maxFontSizeMultiplier={1.3}` on RootText defaults so Larger Text doesn't break layouts

### Edge cases
25. Outlet flips to closed mid-cart — add banner on cart/checkout
26. Reward expires between adding to cart and checkout — re-validate at checkout press
27. Loyalty network error swallowed — non-blocking "Couldn't check for discounts" toast
28. After collecting an order, push back to home with "How was it? Reorder ↗" affordance for 24h

---

## Tag

Revert any time with:

```bash
git fetch --tags
git reset --hard pre-design-overhaul-2026-05-08
git push origin main --force-with-lease   # only if you've already merged the overhaul
```

Or branch off the tag:

```bash
git checkout -b restore-design-pre-overhaul pre-design-overhaul-2026-05-08
```
