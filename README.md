# PadelTrack

Rankings for you and the people you play padel with. Next.js 14, Prisma, Postgres, NextAuth.

- **Rankings**: one rating per user. You see yourself plus everyone you've played a confirmed ranked match with.
- **New Match**: ranked doubles. If a registered player is on the other team, one of them has to confirm before ratings move. If nobody confirms within 48 hours, the match confirms automatically. Players who aren't on the app can be added as guests and invited to claim their profile later.
- **Events**: Americano, Round Robin, Snake and Ladders, One Point. These are separate from rankings and never change ratings. The organiser and any registered player in the event can enter scores, and every open event page syncs live.

## Local development

```bash
npm install
npx prisma db push      # create tables in the DB from .env
npm run db:seed         # demo accounts (refuses to run on a non-localhost DB)
npm run dev
```

`.env` needs `POSTGRES_PRISMA_URL`, `DATABASE_URL_UNPOOLED`, `NEXTAUTH_URL` and `NEXTAUTH_SECRET` (see `.env.example`).

## ⚠️ Before going live (database not set up yet)

Everything that's shared between users depends on a real hosted Postgres database: accounts, circles, match confirmations, and events that several people see and score live. Until it's connected, the deployed site loads but every data page will error.

1. **Create a Postgres database** for PadelTrack only, for example Neon via Vercel → Storage. Don't reuse the padeltourspain2026 database.
2. **Check the Vercel environment variables**: `POSTGRES_PRISMA_URL`, `DATABASE_URL_UNPOOLED`, `NEXTAUTH_SECRET` (generate with `openssl rand -base64 32`) and `NEXTAUTH_URL` (your site's URL).
3. **Create the tables once** by running `npx prisma db push` against the new database. The build doesn't do this. Re-run it whenever `prisma/schema.prisma` changes.
4. **Don't run `npm run db:seed` in production.** It's demo data only and refuses non-localhost databases anyway.
5. **Auto-confirm** needs no cron job. Expired pending matches are settled at the start of any signed-in request, oldest first, so it works on any host.
6. **Live updates** work by polling, with no extra services. Every signed-in page checks `/api/sync` every 20 seconds and only re-renders when the database fingerprint has changed. Open event pages re-fetch every 5 seconds while the event is in progress. If it ever feels slow or heavy with lots of users, look at switching to push updates, for example Pusher or Supabase Realtime.

Not built yet: email verification and password reset (both need an email provider).
