# Meeting-to-Action — Backend (Day 1)

Day 1 scope: Postgres schema + Express API skeleton (CRUD only — no LLM yet, that's Day 2).

## What's here
- `src/db/migrations/001_init.sql` — schema: `meetings` and `action_items` tables
- `src/db/pool.js` — Postgres connection pool (works with Neon, Supabase, or local Postgres)
- `src/db/migrate.js` — tiny migration runner
- `src/routes/meetings.js` — create/list/get meetings
- `src/routes/actionItems.js` — edit/delete individual generated items (the "user control" piece)
- `src/server.js` — Express app entrypoint

## Setup (do this now, locally)

1. **Install Node.js** if you don't have it (v18+): https://nodejs.org

2. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

3. **Get a free Postgres database** — sign up at https://neon.tech (no credit card).
   Create a project, copy the connection string it gives you.

4. **Set up your env file:**
   ```bash
   cp .env.example .env
   ```
   Paste your Neon connection string into `DATABASE_URL` in `.env`.

5. **Run the migration** (creates the tables):
   ```bash
   npm run migrate
   ```
   You should see `[migrate] All migrations applied successfully.`

6. **Start the server:**
   ```bash
   npm run dev
   ```
   Visit http://localhost:4000/health — you should see `{"status":"ok"}`.

## Test it works end to end

```bash
# Create a meeting
curl -X POST http://localhost:4000/api/meetings \
  -H "Content-Type: application/json" \
  -d '{"title": "Sprint planning", "raw_notes": "We decided to ship v2 by Friday. Alex will own the API changes."}'

# List meetings
curl http://localhost:4000/api/meetings
```

If both of those return JSON (not errors), Day 1 is done and working.

## What's NOT built yet (coming next days)
- Turning `raw_notes` into structured `action_items` via an LLM (Day 2)
- Frontend UI (Day 3–4)
- Notion sync (Day 5)
- Auth (Day 6)
- Deployment to Render/Vercel (Day 7)
