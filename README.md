# CINEVERSE

CINEVERSE is a Next.js App Router application using live TMDB metadata for films, TV series, search, details, trailers, and recommendations.

## Local configuration

Copy `.env.example` to `.env` and configure these server-only variables:

```dotenv
TMDB_API_READ_ACCESS_TOKEN="your_tmdb_v4_read_access_token"
TMDB_LANGUAGE="fr-FR"
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/cineverse?schema=public"
```

`TMDB_API_READ_ACCESS_TOKEN` must never use a `NEXT_PUBLIC_` prefix. TMDB requests are made by Server Components and Route Handlers with Bearer authentication.

## Profile persistence

Profiles work immediately with browser-local persistence. To enable shared PostgreSQL persistence:

1. Set `DATABASE_URL`.
2. Create the database schema:

   ```bash
   npx prisma migrate dev --name profiles
   npx prisma generate
   ```

3. Restart the Next.js server.

The profile API currently requires `x-cineverse-user-id` and rejects anonymous database access. This header is an integration seam, not production authentication: replace it with a server-verified user ID from your identity provider before deployment. Until then, the browser-local fallback remains active.

## Vercel configuration

Add `TMDB_API_READ_ACCESS_TOKEN`, `TMDB_LANGUAGE`, and `DATABASE_URL` under **Project Settings > Environment Variables** for the required environments. Do not commit `.env` or paste secrets into client-side variables.

## Verification

```bash
npm run type-check
npm run lint
npm run build
```

See `TMDB-INTEGRATION-AUDIT.md` for the current verified status and production blockers.
