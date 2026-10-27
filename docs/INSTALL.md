# Install oenodpay

## You need

- Node 22 and pnpm 10
- PostgreSQL 15 or newer

## Steps

```sh
pnpm install
cp apps/web/.env.example apps/web/.env      # then fill it in
pnpm db:migrate                            # creates the tables
pnpm db:seed                               # creates the super admin and starter billers
pnpm dev                                   # http://localhost:3000
```

`pnpm db:seed` uses `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD`. If you leave the password empty it makes one and prints it once. Set `SEED_DEMO=true` to also add a demo customer with sample history (local use only).

The super admin must turn on two-step sign-in before the admin opens.

## Phone app

```sh
pnpm mobile                                         # Expo dev server
pnpm --filter @oenodpay/mobile export:web           # rebuilds the /mobile web preview
```

See `apps/mobile/README.md` for App Store and Google Play builds.

## Deploy (Vercel)

1. Import the repo in Vercel and set the **Root Directory** to `apps/web`.
2. Add the environment variables from `.env.example` (at least `DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY`, `APP_URL`, `CRON_SECRET`).
3. Deploy. The build runs the database migrations itself. Set `SEED_ON_BUILD=true` for the first deploy to create the super admin, then remove it.
4. Add provider keys in **Admin, Plugin centre**.

A scheduler should call `GET /api/cron/tick` every few minutes with `Authorization: Bearer $CRON_SECRET`. It settles trades, pays due bills, takes loan payments and clears rewards.
