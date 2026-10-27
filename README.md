# LeoBook

Next.js 14 (App Router, TypeScript) + Supabase, ported from the Figma Make export
"LeoBook (Community)". The design's own stylesheet (`src/app/globals.css`) and icon set
(`src/components/Icon.tsx`) are reused as-is, and its markup is ported 1:1 into real routes.

| Route | Design screen |
|---|---|
| `/feed` | Home: composer, emergency blood alert, post + campaign card, matched events, weekly sparks |
| `/explore` | Map, cause filters, event drawer with register |
| `/world` | Minecraft-style world: seed → sprout → farm → farmer & barn → thriving (live via Realtime) |
| `/hubs`, `/hubs/[slug]` | Your pages and groups, ones you follow, nearby ones, create-a-page; each hub has tabs, public view, member workspace |
| `/profile` | Civic profile; "Edit civic profile" opens the 3-step onboarding modal |
| `/rewards` | Level ring, streak, badges, monthly leaderboard (present in the export but not linked in its nav) |
| `/login`, `/onboarding` | Email + password, Google, or one-time code; then a two-step profile |

## Upgrading an existing install
1. Replace your project files with this version, then `npm install`.
2. Supabase SQL editor → run **only** `supabase/migrations/0003_one_account_pages.sql`
   (it also deletes the old Portland demo data).
3. Run `supabase/seed.sql` (Kathmandu Valley demo data).
4. Hard-refresh. If Explore still shows foreign events, step 3 didn't run: check the SQL editor for an error.

## Account model (Facebook-style)
One account type: a person. Log in, finish a two-step profile, and you're in. From **Groups & Hubs** you can
**Create a page or group** (community group, NGO, event organizer, health organization). You manage it from your
own account: post as it, schedule events, verify member activity, run its member chat. No separate organization logins.

## 1. Supabase
1. Create a project; SQL editor → run `supabase/migrations/0001_init.sql`, then `0002_two_roles_follows.sql`, then `0003_one_account_pages.sql`.
2. Authentication → Email: keep "Confirm email" on. Edit the **Magic Link** and **Confirm signup** email
   templates to include `{{ .Token }}` so members can type the 6-digit code (the link also works).
3. Authentication → URL Configuration: Site URL = your Vercel URL; add `<site>/auth/callback` (and the
   `http://localhost:3000` equivalents) to Redirect URLs.
4. Settings → API: copy the Project URL and anon key.

## 2. Run locally
```bash
cp .env.example .env.local     # fill in the Supabase values
npm install && npm run dev
```
Sign in → finish onboarding (**O+**, keep blood alerts on) → run `supabase/seed.sql` in the SQL editor → refresh.

## 3. Deploy to Vercel
Push to GitHub → Import in Vercel → set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(and `ANTHROPIC_API_KEY` for Ask Leo) → Deploy → add the Vercel URL to Supabase Redirect URLs.

## 4. Photos
The design hot-links two Unsplash photos. Save the garden photo (Zoshua Colah) as
`public/images/community-garden.jpg` (the seed references it) and set `organizations.banner_url`
for the hub cover (Rashpal Singh photo).

## Rules the database enforces
- **Points** (`set_deed_points`): 40 per volunteer hour, 200 blood donation, 40 per invite, event points for
  events, 100 other. Clients can't set points; only org admins can record `verified` deeds.
- **Levels / world stages** (`src/lib/level.ts`, `src/lib/world.ts`, `world_stage()`): 0 / 200 / 500 / 1,000 / 1,500.
- **Blood alerts**: only verified health orgs can raise them; trigger `match_emergency_donors` matches opted-in
  donors with the same blood group and no donation in 56 days. Blood group lives in `profile_health` (owner-only).
- `verified`, `ai_verified` and `identity_verified` flags can only be changed by the service role / SQL editor:
  `update organizations set verified = true, ai_verified = true where slug = '...';`
