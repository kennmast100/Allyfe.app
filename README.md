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
| Kenneth Obi | Client | Posting a job, accepting a bid, confirming delivery, rating |
| Ada Nwachukwu | Client | Already has 3 open jobs for artisans to bid on |
| Emeka Uche | Artisan (★ 4.9) | Carpentry quotations, team profile, apprentices, posting work |
| Grace Nwosu | Artisan | Unfinished photo verification |
| Ibrahim Sani, David Johnson | Artisans (plumbers) | Quotations, start day, no-show replacement |
| Tunde Bakare | Construction team of 4 | Team profile |
| Chinedu Okafor | Artisan, ex-apprentice | Collaborated projects |
| Mile 3 / Oil Mill vendors | Market vendors | Accepting and delivering materials |
| ToolHub PH | Tool company | Company verification, adding tools |
| BuildRight Tools | Tool company (verified) | Approving rental requests |

## What's in it

**The job journey** (both client and artisan see it as a step-by-step tracker):

1. **Client posts a job.** They pick the kind of job first, then write a detailed description (at least 60 characters, with prompts for each trade). They add clear photos (blurry ones are refused automatically and the rest are compressed) and videos of up to 20 seconds. They pick up to 3 days, each at least 24 hours away, so a vendor has time to deliver. Nothing is paid yet.
2. **Artisans in the same trade and city are notified.** They read the job and send a **quotation**: materials picked from a price list (`MATERIALS` in `src/domain/rules.ts`) with quantities, any extra items with their own cost price, a service fee, and one of the client's days.
3. **Client compares bids and accepts one.** They pay the full quotation into Allyfe, which holds it.
4. **Market vendors in the same city get the materials list.** The first verified vendor to accept supplies it, waybills it to the client's home, and is paid when the client taps **I've received the materials**.
5. **On the scheduled day** the app pops up **Work started** for the artisan, and the client is notified. The artisan taps **Work finished**. Premium jobs get a supervisor check.
6. **Client taps Job done.** The service fee goes to the artisan's wallet and a rating page opens. It has two questions (work quality and attitude), each scored 1 to 5; the job's stars are their average.

**When things go wrong:**
- **Not as described:** on arrival the artisan can flag the job. The client forfeits 50% of the service fee; the materials stay with them.
- **No-show:** from the scheduled day the client can report a no-show. The artisan gets 1★ for that job. The client then chooses a **refund** (everything held except delivered materials) or **another artisan**. The new quotation is automatically reduced by the materials already on site, and the money still held counts toward it.
- **Cancel before delivery:** full refund.

**People:** clients, artisans (individuals or construction teams, with apprentices; a former apprentice's profile shows the master's work as collaborated projects), market vendors, and tool companies that rent tools to artisans. Jobs only go to artisans and vendors in the client's city.

**Also:** in-app wallets with top-up and withdrawal, the Tool Store, the community feed (photo or video posts, likes, comments), alerts, an offline state, and Terms & Conditions (including the refund rules).

Screens: see `screenshots/v2/` for every page of the current flow.

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
