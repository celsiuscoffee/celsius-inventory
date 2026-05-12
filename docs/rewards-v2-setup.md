# Rewards v2 — Setup Runbook

End-to-end gamified rewards: **Beans** (purchase-driven) + **Vouchers** (engagement-driven) + **Missions** (weekly challenges) + **Mystery Bean** (per-order reveal) + **Streaks** + **Milestones** + **Birthday treats**.

CC v2026 brand-aligned. Add-ons (not size upgrades). ZUS-grade mechanics with Celsius restraint.

---

## 1. Apply database migrations

```bash
# From repo root
cd apps/backoffice/supabase/migrations

# Apply in order via Supabase CLI (or paste into SQL editor)
supabase db push
```

Migrations to run (in order):

| File | What it does |
|---|---|
| `008_rewards_v2_missions_mystery.sql` | Creates 8 new tables + extends `issued_rewards` |
| `009_rewards_v2_seed_and_helpers.sql` | RPC helpers, display columns, seed starter pools |

Verify after:
```sql
SELECT count(*) FROM voucher_templates  WHERE brand_id = 'brand-celsius';  -- 5
SELECT count(*) FROM reward_missions   WHERE brand_id = 'brand-celsius';  -- 5
SELECT count(*) FROM mystery_pool       WHERE brand_id = 'brand-celsius';  -- 5
SELECT count(*) FROM reward_milestones WHERE brand_id = 'brand-celsius';  -- 4
```

## 2. Wire missions to their voucher rewards

The seed leaves `reward_voucher_template_ids` empty so you pick by name in the UI. Open **Backoffice → Rewards → Engagement → Mission Pool**, edit each mission, and check the voucher templates you want it to grant.

Suggested mapping:

| Mission | Reward voucher(s) |
|---|---|
| Group Order | Free Pastry |
| Early Bird | Free Pastry + 2× Beans Boost |
| Try Something New | Free Add-on |
| Outlet Hopper | 2× Beans Boost |
| Regular | Free Drink |

## 3. Configure birthday treat

**Backoffice → Rewards → Engagement → Birthday Treats** → pick `Free Drink` as the auto-issue template → Save.

## 4. Schedule the cron jobs

Add to `apps/order/vercel.json` (or your scheduler):

```json
{
  "crons": [
    { "path": "/api/cron/streak-update",    "schedule": "0 18 * * *" },
    { "path": "/api/cron/birthday-treats",  "schedule": "0 18 * * *" },
    { "path": "/api/cron/milestone-scan",   "schedule": "0 */6 * * *" },
    { "path": "/api/cron/voucher-expiring", "schedule": "0 10 * * *" }
  ]
}
```

(All in UTC. 18:00 UTC = 02:00 MYT, runs in customer overnight.)

## 5. Deploy + verify

```bash
# Order app
cd apps/order && pnpm typecheck && pnpm build

# Backoffice
cd ../backoffice && pnpm typecheck && pnpm build

# Native
cd ../pickup-native && pnpm typecheck
```

Smoke test (after deploy):
1. Open `pickup-native` → Rewards tab → see Beans hero + tabs
2. Tap Challenges → tap "Pick this week's challenge" → pick one → see it on Rewards screen
3. Place a paid order → wait ~5 sec on order screen → Mystery Bean scratch card appears
4. Tap reveal → outcome shown (multiplier / voucher / no bonus)
5. Tap any wallet voucher → "Use" → menu shows the locked-in banner
6. Place an order with the voucher → reservation auto-clears on checkout

---

## Architecture

### Two-currency model
- **Beans** — earned per RM spent + multiplied by Mystery Bean. Used for tier progression + Points Catalog redemption. Never expires.
- **Vouchers** — earned through engagement (missions, mystery, birthday, milestones, referrals). Concrete free-item / upgrade / discount / multiplier rewards. Always expires.

### Server-side files (apps/order/src)
- `lib/loyalty/v2.ts` — `issueVoucher`, `applyOrderToMission`, `generateMysteryDrop`, `revealMysteryDrop`
- `lib/loyalty/v2-auth.ts` — `resolveMember(req)` — session → member_id
- `app/api/loyalty/me/vouchers/route.ts` — wallet list
- `app/api/loyalty/me/vouchers/[id]/route.ts` — single voucher detail
- `app/api/loyalty/me/claimable/route.ts` — claimable list (pending mystery + future)
- `app/api/loyalty/me/claimable/[id]/claim/route.ts` — one-tap claim
- `app/api/loyalty/me/mission/active/route.ts` — current weekly mission
- `app/api/loyalty/me/missions/pool/route.ts` — picker pool (cooldown-filtered)
- `app/api/loyalty/me/mission/pick/route.ts` — lock in pick (Mon–Sun MYT)
- `app/api/loyalty/me/mission/swap/route.ts` — cancel active assignment
- `app/api/loyalty/me/mystery/[orderId]/route.ts` — pending drop lookup
- `app/api/loyalty/me/mystery/[dropId]/reveal/route.ts` — reveal + credit
- `app/api/cron/streak-update/route.ts` — nightly bump/burn
- `app/api/cron/birthday-treats/route.ts` — daily auto-issue
- `app/api/cron/milestone-scan/route.ts` — periodic lifetime trigger scan
- `app/api/orders/[orderId]/confirm-stripe/route.ts` — extended to call `applyOrderToMission` + `generateMysteryDrop` after payment success (inside `after()` so it doesn't block the customer)

### Backoffice admin pages (apps/backoffice/src/app/(admin)/loyalty)
- `missions/` — Mission Pool CRUD (full)
- `mystery/` — Mystery Pool probability config (full)
- `voucher-templates/` — Voucher catalog (full)
- `milestones/` — Milestones CRUD (full)
- `streaks/` — Read-only dashboard
- `birthday/` — Single-template selector
- `vouchers/` — Vouchers Issued (read-only across customers)
- `redemptions/` — Points Redemptions log (existing, clarified)

### Native components (apps/pickup-native)
- `lib/rewards-v2.ts` — typed API client
- `lib/store.ts` — `reservedVoucher` state
- `components/MysteryBean.tsx` — scratch card + reveal animations
- `components/VoucherWallet.tsx` — wallet list with inline Use pill
- `components/MissionCard.tsx` — active mission + pick CTA
- `components/ClaimableSection.tsx` — one-tap claim rows
- `components/ReservedVoucherBanner.tsx` — sticky banner on menu/cart
- `app/rewards.tsx` — tabbed screen (Challenges / Vouchers / Catalog)
- `app/mission-picker.tsx` — weekly picker modal
- `app/voucher/[id].tsx` — voucher detail
- `app/order/[id].tsx` — order confirmation with MysteryBean
- `app/menu.tsx` — banner + linked-scroll sidebar
- `app/cart.tsx` — banner above cart
- `app/checkout.tsx` — clears reservation on order success
- `app/index.tsx` — home claimable peek + mission peek + voucher count

---

## Env vars

Order app needs:
- `CUSTOMER_JWT_SECRET` (or `JWT_SECRET`) — bearer session signing
- `LOYALTY_BASE_URL` (default `https://loyalty.celsiuscoffee.com`)
- `LOYALTY_BRAND_ID` (default `brand-celsius`)
- `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `STRICT_CUSTOMER_AUTH=true` (after rolling out the native build that always sends a Bearer token)
- `CRON_SECRET` (used by `checkCronAuth` — set the same value on Vercel cron headers)

Backoffice needs the existing loyalty + supabase env vars; no new ones added.

---

## Known follow-ups

- **Promo claimables** — `/api/loyalty/me/claimable` currently only surfaces pending mystery drops. Add an `admin_claimables` table later for admin-pushed promos.
- **Bean multiplier crediting** — `revealMysteryDrop` computes the multiplier but doesn't write the bonus Beans to the member ledger yet (TODO marker in `v2.ts`). Hook into `lib/loyalty/points.ts` `earnLoyaltyPoints` once we agree on the audit-trail shape.
- **Tier-gated mystery outcomes** — `generateMysteryDrop` accepts `memberTier` but `confirm-stripe` passes `null`. Thread member tier through when it's stored on the order row.
- **Streak display on Rewards hero** — compact hero currently only shows tier. Add a `🔥 N wks` chip once streak is reliable in production.
- **Annual "Coffee Wrapped"** — single yearly recap component. Build in January 2027.
