# PadelTrack

Rankings for you and the people you play padel with. Next.js 14, Prisma, Postgres, NextAuth.

- **Rankings**: one rating per user. You see yourself plus everyone you've played a ranked match with. A match becomes ranked once it's confirmed.
- **New Match**: ranked (default) or friendly. Friendlies are saved straight away and never affect ratings, circles or stats.
  - A ranked match becomes ranked once **an opponent confirms the score** and **every guest in it has joined PadelTrack** through their invite link. Both can happen in either order within 48 hours.
  - After 48 hours: if a guest still hasn't joined, the match **becomes a friendly permanently**. If everyone's on PadelTrack but nobody confirmed, it **confirms itself** as ranked.
  - Match Centre shows both checks on each pending match, with an **Invite** button that shares the guest's join link.
- **Events**: Americano, Round Robin, Snake and Ladders. These are separate from rankings and never change ratings. The organiser and any registered player in the event can enter scores, and every open event page syncs live.

## Local development

```bash
npm install
npx prisma migrate deploy   # create tables in the DB from .env
npm run db:seed             # demo accounts (refuses to run on a non-localhost DB)
npm run dev
```

`.env` needs `storage_POSTGRES_PRISMA_URL`, `storage_DATABASE_URL_UNPOOLED`, `NEXTAUTH_URL` and `NEXTAUTH_SECRET` (see `.env.example`).

## Going live

Everything that's shared between users depends on a real hosted Postgres database: accounts, circles, match confirmations, and events that several people see and score live. Until it's connected, the deployed site loads but every data page will error.

1. **Database:** a separate Neon Postgres project connected through Vercel → Storage. Don't reuse the padeltourspain2026 database. Neon provides `storage_POSTGRES_PRISMA_URL` (pooled, used by the app) and `storage_DATABASE_URL_UNPOOLED` (direct, used for migrations).
2. **Sign-in secret:** set `NEXTAUTH_SECRET` for Production with `openssl rand -base64 32 | tr -d '\n' | npx vercel env add NEXTAUTH_SECRET production`. Leave `NEXTAUTH_URL` unset: on Vercel the site address comes from each request, so preview deployments sign in on their own URL.
3. **Tables are created on deploy.** Production builds run `prisma migrate deploy`, which applies any new files in `prisma/migrations/`. It never drops data by itself; a destructive change makes the deploy fail instead. Preview builds skip migrations because they currently share the production database.
4. **Don't run `npm run db:seed` in production.** It's demo data only and refuses non-localhost databases anyway.
5. **Auto-confirm** needs no cron job. Expired pending matches are settled at the start of any signed-in request, oldest first, so it works on any host.
6. **Live updates** work by polling, with no extra services. Every signed-in page checks `/api/sync` every 20 seconds and only re-renders when the database fingerprint has changed. Open event pages re-fetch every 5 seconds while the event is in progress. If it ever feels slow or heavy with lots of users, look at switching to push updates, for example Pusher or Supabase Realtime.

Not built yet: email verification and password reset (both need an email provider).

## Changing the database schema

1. Edit `prisma/schema.prisma`.
2. With the local test database running, run `npm run db:migrate -- --name short_description`. This creates a new folder in `prisma/migrations/` and applies it locally.
3. Commit the migration with the code. The next production deploy applies it to the live database.

## Native app notes (for when PadelTrack is wrapped as an iOS/Android app)

- **Auto-focus on the score boxes.** On New Match, once the fourth player is chosen, the first score box is focused so the number keyboard opens straight away. iOS only shows the keyboard for focus that happens during a user tap. The app calls `focus()` directly inside the tap handler for that reason (`goToScoresIfReady` in `src/components/matches/MatchEntryForm.tsx`), so it never focuses after a delay.
  - **Test this on a real iPhone once wrapped.** In a WKWebView (which Capacitor uses), focus inside a tap normally opens the keyboard. If it doesn't, the web view has to be allowed to show the keyboard without a direct tap on the field. That's the `KeyboardDisplayRequiresUserAction = false` behaviour. Cordova exposes it as a config preference. Capacitor has no built-in switch for it, so it needs a small native tweak or a keyboard plugin.
  - Score boxes use `inputMode="numeric"` and `pattern="[0-9]*"` so both iOS and Android show the number pad.
- **Safe areas.** The header and the New Match save bar already pad for the notch and home bar (`env(safe-area-inset-*)`, with `viewport-fit=cover` set in `src/app/layout.tsx`).
- **Live updates** use polling (`/api/sync` every 20s, events every 5s) and pause while the app is in the background. When the app comes back to the foreground, the page checks immediately.

