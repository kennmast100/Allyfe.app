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

Create an account with any Nigerian mobile number, or tap **Use a demo account (testing only)**. On staging and locally, the 6-digit code is shown on screen because no SMS provider is connected yet. Use **Account → Sign out / switch account** to play the other side of a job.

## Sign in and sign up

- **Sign in:** phone number, then a 6-digit code. Codes expire after 10 minutes. After 5 wrong tries a new code is needed, and at most 5 codes can be sent per hour.
- **Sign up:** choose *I need work done* (client), *I'm an artisan or a team*, or *I'm a market vendor*. Confirm the phone number with a code, then:
  - **Client:** name, city, area, optional photo.
  - **Artisan:** photo, individual or construction team (team name and members), trade, jobs taken, years of experience, city and area, about. Then bank details. Then photo verification before bidding.
  - **Vendor:** shop name, owner, materials sold, market, city and area. Then bank details and agreement to the vendor contract. Then verification before receiving requests.
- **Bank details:** only the bank name and the last 4 digits are stored.
- **Sessions:** the server issues a session token after the code is checked. Every action is carried out as the session's user; the user id the phone sends is ignored. Accounts can only be created through the sign-up endpoint, after a code check.
- **SMS:** set `TERMII_API_KEY` (and optionally `TERMII_SENDER_ID`, `TERMII_BASE_URL`) on Railway to send real texts through Termii. The integration is written but not yet tested against a live Termii account. Without a key, staging shows the code on screen and **production refuses to send codes**.
- **Demo accounts** (one-tap sign-in) only work when `APP_ENV` is not `production`.


| Account | Role | Good for trying |
| --- | --- | --- |
| Kenneth Obi | Client | Posting a job, accepting a bid, confirming delivery, rating |
| Ada Nwachukwu | Client | Already has 3 open jobs for artisans to bid on |
| Emeka Uche | Artisan (★ 4.9) | Carpentry quotations, team profile, apprentices, posting work |
| Grace Nwosu | Artisan | Unfinished photo verification |
| Ibrahim Sani, David Johnson | Artisans (plumbers) | Quotations, start day, no-show replacement |
| Tunde Bakare | Construction team of 4 | Team profile |
| Chinedu Okafor | Artisan, ex-apprentice | Collaborated projects |
| Mile 3 Building Supplies | Market vendor | Full vendor journey: starts with a new request, an order to send, one awaiting the client, one delivered and paid, and a refused delivery to collect |
| Oil Mill Electricals & Plumbing | Market vendor | Taking new requests |

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

**People:** clients, artisans (individuals or construction teams, with apprentices; a former apprentice's profile shows the master's work as collaborated projects), and market vendors. Jobs only go to artisans and vendors in the client's city.

**Allyfe fee:** when the client taps Job done, Allyfe keeps 5% of the artisan's service fee on Basic and Pro jobs and 10% on Premium (`PLATFORM_FEE_RATES` in `src/domain/rules.ts`). Materials carry no fee, and clients pay the quoted price. The job type is shown next to the service fee everywhere, and fees collect in the `allyfe` wallet.

**Vendors:** once a vendor accepts an order, they see the client's phone number and address (with Call and WhatsApp buttons) to confirm logistics and the exact materials. Other vendors never see them. They can post items they have in stock to the feed. If the client is unhappy with a delivery, they choose a reason (wrong item, substandard, damaged, short, wrong size/colour/texture, used, or other). The vendor is not paid and is told to collect the goods under their vendor contract, and the order reopens for vendors.

**Also:** in-app wallets with top-up and withdrawal, the community feed (photo or video posts, vendor stock listings, likes, comments), alerts, an offline state, and Terms & Conditions (including the refund, fee and refusal rules).

Screens: see `screenshots/v2/` for every page of the current flow.

## Code layout

```
src/domain/     Business rules with no UI. Start here.
  types.ts        Data model
  rules.ts        Material prices, tiers, Allyfe fee rates, money splits, 50% rule, ratings, ranking
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

1. **SMS and private data:** connect Termii (see above). Every phone still downloads the whole data set, including other people's phone numbers; the server must send each user only what they're allowed to see.
2. **Database shape:** split the single state row into proper tables (users, jobs, proposals, wallets, ledger) and serve each user only their own data.
3. **Payments:** hold escrow with a licensed provider such as Paystack or Flutterwave, and send withdrawals through their transfer API.
4. **Verification:** upload photos to object storage and give admins a review queue. NIN lookup could be automated.
5. **Admin tools:** supervisor assignment for Premium jobs, dispute review and payouts. The app currently has dashed **Simulate** buttons where these would go.
6. **Vendor contract:** the legal agreement that obliges vendors to collect refused materials.
7. **Still to agree:** real material prices and how long money stays held.
