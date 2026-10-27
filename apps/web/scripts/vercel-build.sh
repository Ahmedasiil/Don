#!/bin/sh
# Vercel build: bring the database up to date, optionally load starter data, then build.
# MIGRATE_DATABASE_URL is a session-mode connection for migrations (e.g. Supabase port 5432);
# DATABASE_URL can then be a transaction pooler (port 6543, ?pgbouncer=true) for the live site.
set -e
DB="${MIGRATE_DATABASE_URL:-$DATABASE_URL}"
DATABASE_URL="$DB" prisma migrate deploy
# The seed (super admin, starter billers) is safe to re-run. Set SEED_ON_BUILD=true
# for a demo site; leave it unset in production once real customers are on the platform.
if [ "$SEED_ON_BUILD" = "true" ]; then DATABASE_URL="$DB" tsx prisma/seed.ts; fi
next build
