# Plot Line (working name)

UK generative site-planning & feasibility. See `CLAUDE.md` for mission, stage, stack and operating rules.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

Apply `supabase/migrations/` against the existing Supabase project (anonymous sign-in must be enabled under Authentication → Settings for the app to get a session).
