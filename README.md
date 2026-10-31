# Allyfe

**Skilled People • Real Work • Brighter Lives**

Allyfe is a marketplace that connects clients with verified artisans. Clients post jobs and pay into Allyfe. Artisans apply or send proposals. The client confirms one artisan, the work gets done, Allyfe releases the money, and the client rates the artisan.

This repository is the first working build: a mobile-first web app (installable PWA) with all three roles, built with React, TypeScript and Vite, plus a small Node server that keeps one shared copy of the data in Postgres.

## Run it

```bash
npm install
npm run dev        # app only, data saved on this device: http://localhost:5173
npm test           # business-rule and server tests
npm run build      # type-check, build the app into dist/ and the server into dist-server/
npm start          # app + shared server: http://localhost:3000 (saves to data/state.json)
```

Run `npm start` in one terminal and `npm run dev` in another to develop against the shared server. With no server running, the app falls back to saving on the device.

## Deploying to Railway (staging, then production)

1. In Railway: **New Project → Deploy from GitHub repo → `kennmast100/Allyfe.app`**, branch `claude/allyfe-app`.
2. In the project: **+ New → Database → PostgreSQL**.
3. On the app service, under **Variables**, add:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (reference the database)
   - `APP_ENV` = `staging`
4. Under **Settings → Networking**, click **Generate Domain**.

`railway.json` already sets the build (`npm run build`), the start command (`npm start`) and a health check at `/api/health`. Railway sets `PORT` itself. Each push to the branch redeploys.

For production, make a second Railway environment with its own Postgres and `APP_ENV=production`. Production hides the STAGING badge and blocks **Reset demo data**.

### How the shared data works

- The phone applies each change immediately so the app feels instant, then sends it to `POST /api/action`. The server runs the same rules from `src/domain/actions.ts` on the shared copy and saves it. Both sides produce the same ids from a per-action nonce.
- Phones check `GET /api/state?since=<rev>` every 3 seconds and when the app regains focus, so the other side of a job shows up within a few seconds.
- If the server refuses a change (a rule was broken, or someone else got there first), the phone shows why and switches to the server's copy.

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

With the server running, all testers share one copy of the data in Postgres. No real money moves. Before production:

1. **Auth:** real phone OTP (for example via Termii or Twilio) instead of the demo code. Until then, the server trusts the user id the phone sends, and every phone downloads the whole data set. That's fine for staging with demo accounts, but not for real users.
2. **Database shape:** split the single state row into proper tables (users, jobs, proposals, wallets, ledger) and serve each user only their own data.
3. **Payments:** hold escrow with a licensed provider such as Paystack or Flutterwave, and send withdrawals through their transfer API.
4. **Verification:** upload photos to object storage and give admins a review queue. NIN lookup could be automated.
5. **Admin tools:** supervisor assignment for Premium jobs, dispute review and payouts. The app currently has dashed **Simulate** buttons where these would go.
6. **Still to agree:** final prices, Allyfe's fee (`PLATFORM_FEE_RATE`, currently 0), and how long money stays held.
