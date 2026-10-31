# Allyfe

**Skilled People • Real Work • Brighter Lives**

Allyfe is a marketplace that connects clients with verified artisans. Clients post jobs and pay into Allyfe. Artisans apply or send proposals. The client confirms one artisan, the work gets done, Allyfe releases the money, and the client rates the artisan.

This repository is the first working build: a mobile-first web app (installable PWA) with all three roles, built with React, TypeScript and Vite.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # business-rule tests
npm run build      # type-check and production build into dist/
```

On the sign-in screen, pick a demo account, or type its phone number and any 6-digit code. Use **Account → Sign out / switch account** to play the other side of a job.

| Account | Role | Good for trying |
| --- | --- | --- |
| Kenneth Obi | Client | Posting a job, confirming, paying, rating |
| Ada Nwachukwu | Client | Already has 3 open jobs for artisans to apply to |
| Emeka Uche | Artisan (★ 4.9) | Proposals, active jobs, renting tools, posting work |
| Grace Nwosu | Artisan | Unfinished photo verification |
| ToolHub PH | Tool company | Company verification, adding tools |
| BuildRight Tools | Tool company (verified) | Approving rental requests |

## What's in it

- **Jobs:** post a job → artisans *apply* at the client's price or *propose* their own → the client confirms → the artisan checks the job on arrival → work in progress → done → the client taps **Work completed** → the client rates the artisan.
- **Calendar:** This week, Next week, or Flexible, where the client marks up to 5 days and the artisan picks one.
- **Payments:** every amount moves through in-app wallets. The deposit is held when the job is posted and adjusted to the agreed price on confirm. On **Work completed**, the money is split between the artisan and any tool company whose tools were rented for the job. Clients and tool companies can top up; everyone can withdraw to a bank.
- **50% rule:** if the artisan marks a job *Not as described*, half the deposit pays for their visit and half goes back to the client.
- **Tiers:** Basic (any verified artisan), Pro (rated 4.7★ and above), Premium (Pro plus an Allyfe supervisor who inspects the work before payment).
- **Ratings and ranking:** each review updates the artisan's average. Ranking uses a Bayesian average plus a small loyalty bonus for jobs completed on Allyfe, so one lucky 5★ review can't beat a long track record.
- **Verification:** artisans upload an ID, a selfie and 3 work photos; tool companies upload CAC, shop, owner ID and tool photos. Unverified artisans can't apply for jobs, and tools from unverified companies stay hidden.
- **Tool Store:** artisans rent tools from verified companies, paid from their wallet or from the job's escrow.
- **Community feed:** artisans post finished work, and anyone can like and comment.
- **Alerts** for every step, and an **offline state** (a banner, plus an offline screen for actions that need a connection). Toggle it under Account → Simulate offline.

Screens: sign in, home, discover, artisan profile, post a job (4 steps), job posted, artisan home, jobs board, proposal, applied, client confirm, job detail, completed, review form, alerts, offline, feed, composer, comments, wallet, verification, Tool Store, rent, rental requests, add tool, account.

## Code layout

```
src/domain/     Business rules with no UI. Start here.
  types.ts        Data model
  rules.ts        Pricing, tiers, money splits, 50% rule, ratings, ranking, PLATFORM_FEE_RATE
  actions.ts      Every state change (post job, propose, confirm, complete, rent, …) as a pure reducer
  seed.ts         Demo data
  actions.test.ts Tests for the full job lifecycle and money movements
src/store/      React context: state, navigation, toasts, online/offline
src/components/ Brand art (logo, avatars, illustrations) and shared UI
src/screens/    client.tsx, artisan.tsx, company.tsx, shared.tsx
public/         Logo, PWA manifest, service worker
```

## What is simulated (next steps for production)

This build runs entirely in the browser and saves to `localStorage`, so nobody else can see your data and no real money moves. To go live:

1. **Backend and database:** move `src/domain/actions.ts` to a server (the reducer is already pure, so it ports cleanly) and store data in Postgres or similar.
2. **Auth:** real phone OTP (for example via Termii or Twilio) instead of the demo code.
3. **Payments:** hold escrow with a licensed provider such as Paystack or Flutterwave, and send withdrawals through their transfer API.
4. **Verification:** upload photos to object storage and give admins a review queue. NIN lookup could be automated.
5. **Admin tools:** supervisor assignment for Premium jobs, dispute review and payouts. The app currently has dashed **Simulate** buttons where these would go.
6. **Still to agree:** final prices, Allyfe's fee (`PLATFORM_FEE_RATE`, currently 0), and how long money stays held.
