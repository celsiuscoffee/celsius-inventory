# Pickup-Native Design Review — 2026-05-08

Snapshot before the night's work. Revert any/all of it via:

```bash
git fetch --tags
git reset --hard pre-design-overhaul-2026-05-08
git push origin main --force-with-lease
```

Or branch off the tag:

```bash
git checkout -b restore-design-pre-overhaul pre-design-overhaul-2026-05-08
```

---

## What ended up shipping (final state)

12 OTA waves total to both `preview` and `production` channels.

| Wave | Update group (production) | Highlights |
|---|---|---|
|  1 | `decb9472-...`* | First overhaul attempt — For You tabbed strip, order stepper, outlet gate, cart hero, reward urgency |
|  2 | `84b7ed9e-...` | Reverted home back to separate sections (For You strip didn't land) — kept the other 4 changes |
|  3 | `ebefa576-...` | Sign-in polish (resend countdown, change-number link, phone preview, SMS auto-fill), global Toast util, outlet-closed banner, menu guest banner, accessibility labels |
|  4 | `6b2e41d8-...` | Promo error toast, reward revalidation at checkout press, `/settings` sub-screen, OTP copy ("Text me the code", "Let me in") |
|  5 | `f894f400-...` | Color contrast bumps, corner radius unification, hitSlop ≥12 sweep |
|  6 | `f64d52de-...` | `maxFontSizeMultiplier=1.3`, product detail (modifier auto-default + gated CTA + back-button always + a11y), reorder confirmation |
|  7 | `9506c9d0-...` | Active-order banner colour: emerald → terracotta. Pluralisation bug fix. Support a11y |
|  8 | `a27ab749-...` | Cart line `−` disabled at qty 1, accessibility on +/−/trash, PrimaryButton role + state |
|  9 | `69e8ef1d-...` | "How was it?" 24h reorder affordance (client-side detection), first-launch poster hero |
| 10 | `ab248141-...` | Hidden dine-in categories (`nasi-lemak`, `noodle`, `pasta`, `roti-bakar`), points-earned preview on cart, removed redundant "tap to track" hint |

\* Wave 1 was partially reverted by Wave 2 — the For You strip on home is gone, but order stepper, outlet gate, cart hero, and reward expiry stayed.

---

## Backlog status (from the original review's 28 items)

| # | Item | Status |
|---|---|---|
|  1 | For You tabbed strip on home | shipped → reverted (separate sections preferred) |
|  2 | Animated order progress stepper | ✅ live |
|  3 | Outlet gate before menu | ✅ live |
|  4 | Cart empty-state hero + thumbnails | ✅ live |
|  5 | Reward expiry urgency on rewards screen | ✅ live |
|  6 | Active-order banner brand colour | ✅ live |
|  7 | Corner radius unification | ✅ live |
|  8 | Peachii sweep across 84 sites | ⏭ skipped (regression risk too high) |
|  9 | Force outlet pick (same as #3) | ✅ live |
| 10 | Sign-in OTP escape (resend + change number) | ✅ live |
| 11 | Reorder toast (replaces silent yank to /cart) | ✅ live |
| 12 | Reorder confirm before wiping cart | ✅ live |
| 13 | Reward expiry on rewards screen (same as #5) | ✅ live |
| 14 | First-launch poster hero | ✅ live |
| 15 | Menu guest banner | ✅ live |
| 16 | Account slim down + /settings sub-screen | ✅ live |
| 17 | OTP copy sweep | ✅ live |
| 18 | Pluralisation bug fix | ✅ live |
| 19 | Phone format preview | ✅ live |
| 20 | Button verb consistency | ⏭ partial (sweep too noisy) |
| 21 | Color contrast | ✅ live |
| 22 | Accessibility labels (broad sweep) | ✅ live |
| 23 | Tap target audit (hitSlop ≥12) | ✅ live |
| 24 | Global text-scale multiplier cap | ✅ live |
| 25 | Outlet-closed banner on cart | ✅ live |
| 26 | Reward revalidate at checkout press | ✅ live |
| 27 | Promo network error toast | ✅ live |
| 28 | 24h reorder affordance | ✅ live |

---

## Bonus changes (not in the original 28)

- `/settings` sub-screen extracted from `/account` (Privacy, Delete, Support row)
- New `/stripe-redirect` route to handle Stripe FPX/3DS return that was hitting `[+not-found]`
- Eager OTA fetch + reload on cold launch — replaces the "open twice" flow
- Stripe Apple Pay entitlement explicit in `app.json` (kicked off iOS rebuild)
- Hide dine-in food categories from pickup menu (food doesn't travel well)
- Cart total breakdown "You'll earn +X pts" preview for signed-in members

---

## Still needs external input

| Blocker | What I need from you |
|---|---|
| Apple Pay live in app | (a) Install latest preview/prod IPA. (b) Register merchant ID `merchant.com.celsiuscoffee.pickup` in Stripe Dashboard → Settings → Payments → Apple Pay. Once done, Stripe auto-mints the payment processing certificate. |
| WhatsApp number on support page | Real number — drop-in replacement for the `mailto:` block |
| Push backend for "How was it?" beyond 24h client window | Server-side cron + push payload — bigger task, separate session |

---

## Key file locations

```
apps/pickup-native/
├── app/_layout.tsx                  ← global font + text-scale multiplier
├── app/index.tsx                    ← home (tier hero, sign-in CTA, active order, recently-collected, promo, rewards, usual, best sellers, first-launch hero)
├── app/menu.tsx                     ← outlet gate + side category rail + guest banner + Usual tab
├── app/product/[id].tsx             ← gated CTA, modifier auto-defaults, back button always
├── app/cart.tsx                     ← outlet-closed banner, points preview, qty −1 disabled
├── app/checkout.tsx                 ← reward revalidation, promo error toast
├── app/orders.tsx                   ← reorder confirmation
├── app/order/[id].tsx               ← horizontal stepper, terracotta "collected" pill
├── app/account.tsx                  ← slim profile, sign-in polish, settings link
├── app/settings.tsx                 ← extracted Privacy / Support / Delete
├── app/store.tsx                    ← friendly first-time picker
├── app/stripe-redirect.tsx          ← FPX return handler
├── components/Toast.tsx             ← global toast layer
├── components/OrderStepper.tsx      ← horizontal pulsing pipeline
├── components/PrimaryButton.tsx     ← a11y role + state
├── lib/toast.ts                     ← zustand store + showToast()
└── lib/rewards.ts                   ← rewardUrgencyLabel + EvaluateResult discriminator
```
