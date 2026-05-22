# AI Flashcard Generator

Upload a PDF and get a deck of spaced-repetition flashcards, generated and quality-judged by Claude, ready to study in-app or export to Anki.

## Features

- **PDF ingestion** — upload any PDF; text is extracted and stored in Supabase Storage
- **Multi-stage AI pipeline** — structure → enrich → generate → judge → regenerate, powered by Claude Sonnet (generation) and Claude Opus (quality judging)
- **Three card types** — Q&A, cloze deletion, and multiple-choice
- **SM-2 spaced repetition** — study mode uses the SM-2 algorithm with keyboard shortcuts for fast review
- **Anki export** — download a `.apkg` file importable directly into Anki (requires Python + genanki)
- **Analytics dashboard** — review stats, retention curves, and card-level performance
- **Magic link auth** — passwordless sign-in via Resend email; single whitelisted user
- **Background worker** — long-running pipeline runs on Railway, separate from the web app

## Architecture

```
┌─────────────────────────────┐      ┌──────────────────────────┐
│        Vercel (web)         │      │    Railway (worker)       │
│                             │      │                           │
│  Next.js 16 App Router      │      │  Polls /api/worker every  │
│  Auth.js v5 (magic link)    │◄────►│  N seconds using a shared │
│  Drizzle ORM                │      │  WORKER_SECRET header     │
│  Supabase Storage (PDFs)    │      │                           │
│  Anthropic SDK              │      │  Runs the full AI         │
└─────────────────────────────┘      │  pipeline for queued jobs │
                                     └──────────────────────────┘
                  │
                  ▼
         Supabase Postgres
         (shared by both)
```

The web app handles uploads, auth, study sessions, and analytics. The Railway worker polls for pending jobs and runs the multi-step Anthropic pipeline (structure → enrich → generate → judge → regenerate), then persists the resulting cards.

## Local Development Setup

### Prerequisites

- **Node.js 18+**
- **Python 3.9+** with genanki (for Anki export): `pip install genanki`
- A **Supabase** account (free tier works)
- An **Anthropic** API key
- A **Resend** account (for magic link emails)

### 1. Clone and install

```bash
git clone <your-repo-url>
cd flashcards-ks
npm install
```

### 2. Supabase setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Storage** and create a new bucket named `source-pdfs` — set it to **private**
3. Go to **Project Settings → Database** and copy the **Transaction mode pooler** connection string (port 6543) — this is your `DATABASE_URL`
4. Go to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon / public key** → `SUPABASE_ANON_KEY`
   - **service_role / secret key** → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in each value. See the [Environment Variables Reference](#environment-variables-reference) section below for descriptions of every variable.

### 4. Database setup

Apply migrations to create the schema:

```bash
npx drizzle-kit migrate
```

Seed the database with the dev user (the whitelisted email):

```bash
npm run seed
```

### 5. Run locally

```bash
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000). Sign in with the email set in `WHITELISTED_EMAIL` — a magic link will be sent via Resend.

### 6. Worker (optional for local)

The background worker normally runs on Railway. For local development you can trigger it manually after uploading a PDF:

```bash
curl -H "x-worker-secret: your_worker_secret" http://localhost:3000/api/worker
```

Replace `your_worker_secret` with the value you set in `WORKER_SECRET`.

## Environment Variables Reference

| Variable | Description | Required |
|---|---|---|
| `AUTH_SECRET` | Random secret for Auth.js session signing. Generate with: `openssl rand -hex 32` | Yes |
| `AUTH_URL` | Base URL of the app (e.g. `http://localhost:3000` locally, your Vercel URL in production) | Yes |
| `SUPABASE_URL` | Your Supabase project URL (found in Project Settings → API) | Yes |
| `SUPABASE_ANON_KEY` | Supabase anon/public key — safe to expose to the browser | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key — server-only, never expose to the client | Yes |
| `SUPABASE_STORAGE_BUCKET` | Name of the storage bucket for uploaded PDFs (default: `source-pdfs`) | Yes |
| `DATABASE_URL` | Postgres connection string — use the **Transaction mode pooler** URL from Supabase (port 6543) | Yes |
| `ANTHROPIC_API_KEY` | Your Anthropic API key (from [console.anthropic.com](https://console.anthropic.com)) | Yes |
| `ANTHROPIC_SONNET_MODEL` | Model ID for card generation and enrichment (default: `claude-sonnet-4-6`) | No |
| `ANTHROPIC_OPUS_MODEL` | Model ID for quality judging (default: `claude-opus-4-7`) | No |
| `RESEND_API_KEY` | Resend API key for sending magic link emails | Yes |
| `RESEND_FROM_EMAIL` | From address for emails — must be on a domain verified in Resend (e.g. `noreply@yourdomain.com`) | Yes |
| `WHITELISTED_EMAIL` | The only email address allowed to sign in | Yes |
| `WORKER_SECRET` | Shared secret for `/api/worker` authentication. Generate with: `openssl rand -hex 32` | Yes |
| `ENCRYPTION_KEY` | 32-byte hex key for AES-256 encryption of sensitive data. Generate with: `openssl rand -hex 32` | Yes |
| `WORKER_POLL_INTERVAL_MS` | How often the Railway worker polls for jobs in milliseconds (default: `3000`) | No |

## Deployment

### Vercel (web app)

1. Push your repository to GitHub
2. Import the repo at [vercel.com/new](https://vercel.com/new)
3. Set all environment variables in **Project Settings → Environment Variables** (use production values)
4. Deploy — Vercel builds automatically on each push to `main`

### Railway (background worker)

1. Create a new project at [railway.app](https://railway.app)
2. Connect your GitHub repository
3. Set the start command to: `node -r tsx/esm worker/index.ts`
4. Set all environment variables in the Railway project settings (same values as Vercel, plus `WORKER_SECRET`)
5. Deploy

The worker polls `/api/worker` on the Vercel URL, so make sure `AUTH_URL` points to your production Vercel domain in Railway's env vars.

### Production Supabase

- Create a **separate** Supabase project for production (do not reuse the dev project)
- Run migrations against the production database:
  ```bash
  DATABASE_URL=<production-url> npx drizzle-kit migrate
  ```
- Create the `source-pdfs` storage bucket (private) in the production project

## Running Tests

```bash
npx vitest run
```

## Anki Export

Exporting to Anki requires Python 3 and the genanki library:

```bash
pip install genanki
```

Once installed, the export button in the app generates a `.apkg` file you can import directly into Anki.

## Development Notes

- **Tailwind v4** — uses CSS-first configuration (no `tailwind.config.js`); v3 utilities and config format will not work
- **Auth.js v5** — imported from `next-auth` beta; the API differs from Auth.js v4
- **Drizzle ORM** — schema lives in `drizzle/`; generate migrations with `npx drizzle-kit generate`, apply with `npx drizzle-kit migrate`
- **All Claude API calls are server-side only** — the Anthropic SDK is never imported in client components; keys are never exposed to the browser
- **Next.js 16 App Router** — file conventions and APIs may differ from earlier versions; consult `node_modules/next/dist/docs/` for the authoritative reference
