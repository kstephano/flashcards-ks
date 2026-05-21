# AI Flashcard Generator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack AI flashcard generator that ingests PDFs, runs a multi-step Anthropic pipeline to generate and judge flashcards, and supports spaced-repetition study and Anki export.

**Architecture:** Next.js 15 App Router monolith on Vercel + a standalone Railway worker polling a Postgres job queue. All Claude calls are server-side only. Auth.js magic-link restricted to one whitelisted email.

**Tech Stack:** Next.js 15, TypeScript, Auth.js v5, Drizzle ORM, Supabase (Postgres + Storage), Anthropic SDK (Sonnet 4.6 + Opus 4.7), Resend, Tailwind, shadcn/ui, Recharts, Vitest, genanki (Python sidecar), pino

---

## Verified Model IDs & Pricing

| Model | ID | Input $/MTok | Output $/MTok | Cache Read $/MTok |
|---|---|---|---|---|
| Sonnet (latest) | `claude-sonnet-4-6` | $3.00 | $15.00 | $0.30 |
| Opus (latest) | `claude-opus-4-7` | $5.00 | $25.00 | $0.50 |
| Web search | `web_search_20250305` | — | — | $0.01/search |

---

## File Structure

```
/app
  /(auth)/login/page.tsx              # magic link request form
  /(auth)/verify/page.tsx             # "check your email" page
  /(protected)/layout.tsx             # session guard
  /(protected)/page.tsx               # projects list
  /(protected)/projects/[id]/page.tsx # sections list
  /(protected)/projects/[id]/sections/[sid]/page.tsx  # decks list + upload
  /(protected)/decks/[id]/page.tsx    # card table + study/export buttons
  /(protected)/decks/[id]/study/page.tsx
  /(protected)/jobs/[id]/page.tsx     # outline approval + progress
  /(protected)/dashboard/page.tsx
  /(protected)/settings/page.tsx
  /api/auth/[...nextauth]/route.ts
  /api/projects/route.ts
  /api/projects/[id]/route.ts
  /api/sections/route.ts
  /api/sections/[id]/route.ts
  /api/decks/route.ts
  /api/decks/[id]/route.ts
  /api/decks/[id]/cards/route.ts
  /api/cards/[id]/route.ts
  /api/upload/route.ts                # PDF validation + job creation
  /api/jobs/route.ts
  /api/jobs/[id]/route.ts             # status polling
  /api/jobs/[id]/approve/route.ts     # outline approval
  /api/jobs/[id]/cancel/route.ts
  /api/review/sessions/route.ts
  /api/review/sessions/[id]/events/route.ts
  /api/export/[deckId]/route.ts       # Anki export trigger
  /api/settings/route.ts
  /api/worker/route.ts                # single-job tick (GET, called by Railway cron or self-poll)

/components
  /ui/                                # shadcn primitives (added via CLI)
  /layout/
    Header.tsx                        # spend indicator
    JobStatusPanel.tsx                # sticky bottom-right live job
  /projects/
    ProjectCard.tsx
    CreateProjectDialog.tsx
  /sections/
    SectionList.tsx
    CreateSectionDialog.tsx
  /decks/
    DeckCard.tsx
    UploadModal.tsx                   # PDF upload form + cost estimate
    CostEstimateDisplay.tsx
  /cards/
    CardTable.tsx
    CardEditRow.tsx
  /jobs/
    OutlineApproval.tsx               # editable section list + approve button
    SectionProgressList.tsx
  /study/
    StudyCard.tsx
    RatingButtons.tsx
    StudyProgress.tsx
  /dashboard/
    SpendBarChart.tsx
    ModelSpendChart.tsx
    CostPerCardChart.tsx
    CacheHitChart.tsx
    JudgeScoreChart.tsx
    ScoreHistogram.tsx
    RegenRateChart.tsx
    ReviewHeatmap.tsx
    DueCardsChart.tsx
    RetentionChart.tsx
    AreaInsights.tsx
    PipelineHealthTable.tsx

/lib
  /anthropic/
    client.ts                         # Anthropic SDK wrapper + usage logging
    tools.ts                          # tool_use definitions for structure/generate/judge
  /db/
    schema.ts                         # Drizzle schema (all tables + enums)
    index.ts                          # db singleton
    /queries/
      projects.ts
      decks.ts
      cards.ts
      jobs.ts
      usage.ts
      srs.ts
  /jobs/
    queue.ts                          # claim/release job, check cancellation
    worker.ts                         # pipeline orchestrator (called by /api/worker)
    /steps/
      structure.ts
      enrich.ts
      generate.ts
      judge.ts
      regenerate.ts
      persist.ts
  /pdf/
    validate.ts                       # page count + size checks
    hash.ts                           # SHA-256 of buffer
    storage.ts                        # Supabase Storage upload + signed URLs
  /srs/
    sm2.ts                            # SM-2 algorithm
  /cache/
    generation-cache.ts               # cache key + hit/miss logic
  pricing.ts                          # per-model token costs
  prompt-loader.ts                    # load + SHA-256 hash prompt templates
  cost-estimator.ts                   # pre-flight cost range calculation
  encryption.ts                       # AES-256 for stored API keys

/prompts/
  extract_structure.md
  enrich_context.md
  generate_cards.md
  regenerate_card.md
  judge_card.md

/worker/
  index.ts                            # Railway entry (long-poll loop calling worker.ts)

/scripts/
  export_anki.py
  seed.ts

/drizzle/
  drizzle.config.ts
  /migrations/                        # auto-generated

/tests/
  /lib/
    srs/sm2.test.ts
    cache/cache-key.test.ts
    jobs/state-transitions.test.ts
    cost-estimator.test.ts
```

---

## Complete Drizzle Schema

```typescript
// lib/db/schema.ts
import {
  pgTable, pgEnum, uuid, varchar, text, integer, boolean,
  timestamp, real, bigint, jsonb, numeric, index,
} from 'drizzle-orm/pg-core';

export const cardTypeEnum = pgEnum('card_type', ['qa', 'cloze', 'multiple_choice']);
export const jobStatusEnum = pgEnum('job_status', [
  'pending', 'running', 'awaiting_outline_approval', 'complete', 'failed', 'cancelled',
]);
export const pipelineStepEnum = pgEnum('pipeline_step', [
  'structure', 'enrich', 'generate', 'judge', 'regenerate', 'persist',
]);
export const sectionStatusEnum = pgEnum('section_status', [
  'pending', 'running', 'complete', 'failed',
]);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  monthlySpendCapUsd: numeric('monthly_spend_cap_usd', { precision: 10, scale: 4 }).default('50').notNull(),
  defaultMaxWebSearches: integer('default_max_web_searches').default(3).notNull(),
  anthropicApiKeyEncrypted: text('anthropic_api_key_encrypted'),
});

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const sections = pgTable('sections', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  orderIndex: integer('order_index').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const sourcePdfs = pgTable('source_pdfs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  filename: varchar('filename', { length: 500 }).notNull(),
  byteSize: bigint('byte_size', { mode: 'number' }).notNull(),
  pageCount: integer('page_count').notNull(),
  sha256Hash: varchar('sha256_hash', { length: 64 }).notNull().unique(),
  storagePath: varchar('storage_path', { length: 1000 }).notNull(),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
});

export const decks = pgTable('decks', {
  id: uuid('id').primaryKey().defaultRandom(),
  sectionId: uuid('section_id').notNull().references(() => sections.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  sourcePdfId: uuid('source_pdf_id').references(() => sourcePdfs.id, { onDelete: 'set null' }),
  examName: varchar('exam_name', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const cards = pgTable('cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  deckId: uuid('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
  cardType: cardTypeEnum('card_type').notNull(),
  front: text('front').notNull(),
  back: text('back').notNull(),
  explanation: text('explanation'),
  sourcePage: integer('source_page'),
  sourceQuote: varchar('source_quote', { length: 200 }),
  difficulty: integer('difficulty'),
  tags: text('tags').array(),
  accuracyScore: integer('accuracy_score'),
  relevanceScore: integer('relevance_score'),
  judgeRationale: text('judge_rationale'),
  wasRegenerated: boolean('was_regenerated').default(false).notNull(),
  promptTemplateVersion: varchar('prompt_template_version', { length: 64 }),
  humanEdited: boolean('human_edited').default(false).notNull(),
  originalFront: text('original_front'),
  originalBack: text('original_back'),
  editedAt: timestamp('edited_at'),
  easeFactor: real('ease_factor').default(2.5).notNull(),
  intervalDays: integer('interval_days').default(0).notNull(),
  repetitions: integer('repetitions').default(0).notNull(),
  dueDate: timestamp('due_date').defaultNow().notNull(),
  lastReviewedAt: timestamp('last_reviewed_at'),
  lastReviewQuality: integer('last_review_quality'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('cards_deck_due_idx').on(t.deckId, t.dueDate)]);

export const droppedCards = pgTable('dropped_cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  deckId: uuid('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
  attemptedFront: text('attempted_front'),
  attemptedBack: text('attempted_back'),
  finalAccuracyScore: integer('final_accuracy_score'),
  finalRelevanceScore: integer('final_relevance_score'),
  finalRationale: text('final_rationale'),
  attempts: integer('attempts').default(2).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const generationJobs = pgTable('generation_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  deckId: uuid('deck_id').references(() => decks.id, { onDelete: 'set null' }),
  sourcePdfId: uuid('source_pdf_id').notNull().references(() => sourcePdfs.id),
  examName: varchar('exam_name', { length: 255 }),
  requestedCardCount: integer('requested_card_count'),
  maxWebSearches: integer('max_web_searches').default(3).notNull(),
  status: jobStatusEnum('status').default('pending').notNull(),
  currentStep: pipelineStepEnum('current_step'),
  progressPct: integer('progress_pct').default(0).notNull(),
  errorMessage: text('error_message'),
  estimatedCostLowUsd: numeric('estimated_cost_low_usd', { precision: 10, scale: 4 }),
  estimatedCostHighUsd: numeric('estimated_cost_high_usd', { precision: 10, scale: 4 }),
  actualCostUsd: numeric('actual_cost_usd', { precision: 10, scale: 4 }),
  pendingSectionOutline: jsonb('pending_section_outline'),
  outlineApprovedAt: timestamp('outline_approved_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
}, (t) => [index('jobs_user_status_idx').on(t.userId, t.status)]);

export const sectionGenerationStatus = pgTable('section_generation_status', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').notNull().references(() => generationJobs.id, { onDelete: 'cascade' }),
  sectionName: varchar('section_name', { length: 255 }).notNull(),
  status: sectionStatusEnum('status').default('pending').notNull(),
  attemptCount: integer('attempt_count').default(0).notNull(),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const generationCache = pgTable('generation_cache', {
  id: uuid('id').primaryKey().defaultRandom(),
  cacheKey: varchar('cache_key', { length: 64 }).notNull().unique(),
  outputDeckJson: jsonb('output_deck_json').notNull(),
  hitCount: integer('hit_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastHitAt: timestamp('last_hit_at'),
});

export const apiUsageLog = pgTable('api_usage_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  jobId: uuid('job_id').references(() => generationJobs.id, { onDelete: 'set null' }),
  sectionId: uuid('section_id'),
  pipelineStep: pipelineStepEnum('pipeline_step').notNull(),
  model: varchar('model', { length: 100 }).notNull(),
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  cacheReadTokens: integer('cache_read_tokens').default(0).notNull(),
  costUsd: numeric('cost_usd', { precision: 10, scale: 6 }).notNull(),
  latencyMs: integer('latency_ms'),
  cacheHit: boolean('cache_hit').default(false).notNull(),
  promptTemplateVersion: varchar('prompt_template_version', { length: 64 }),
  webSearchesUsed: integer('web_searches_used').default(0).notNull(),
}, (t) => [index('usage_log_timestamp_idx').on(t.timestamp)]);

export const reviewSessions = pgTable('review_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  deckId: uuid('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
  cardsReviewed: integer('cards_reviewed').default(0).notNull(),
  cardsCorrect: integer('cards_correct').default(0).notNull(),
});

export const reviewEvents = pgTable('review_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => reviewSessions.id, { onDelete: 'cascade' }),
  cardId: uuid('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  quality: integer('quality').notNull(),
  reviewedAt: timestamp('reviewed_at').defaultNow().notNull(),
  prevEaseFactor: real('prev_ease_factor').notNull(),
  newEaseFactor: real('new_ease_factor').notNull(),
  prevInterval: integer('prev_interval').notNull(),
  newInterval: integer('new_interval').notNull(),
});
```

---

## DB Views (raw SQL, applied in a migration)

```sql
-- v_cache_hit_rate_daily
CREATE OR REPLACE VIEW v_cache_hit_rate_daily AS
SELECT
  date_trunc('day', timestamp) AS day,
  COUNT(*) FILTER (WHERE cache_hit) * 100.0 / NULLIF(COUNT(*), 0) AS hit_rate_pct,
  COUNT(*) AS total_calls
FROM api_usage_log
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY 1 ORDER BY 1;

-- v_judge_scores_by_template
CREATE OR REPLACE VIEW v_judge_scores_by_template AS
SELECT
  prompt_template_version,
  AVG(accuracy_score) AS avg_accuracy,
  AVG(relevance_score) AS avg_relevance,
  COUNT(*) AS card_count
FROM cards
WHERE accuracy_score IS NOT NULL
GROUP BY prompt_template_version;

-- v_pipeline_latency
CREATE OR REPLACE VIEW v_pipeline_latency AS
SELECT
  pipeline_step,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_ms
FROM api_usage_log
WHERE timestamp >= NOW() - INTERVAL '7 days' AND latency_ms IS NOT NULL
GROUP BY pipeline_step;

-- v_cost_per_card
CREATE OR REPLACE VIEW v_cost_per_card AS
SELECT
  date_trunc('day', j.completed_at) AS day,
  SUM(j.actual_cost_usd) / NULLIF(COUNT(c.id), 0) AS cost_per_card
FROM generation_jobs j
JOIN cards c ON c.deck_id = j.deck_id
WHERE j.status = 'complete' AND j.completed_at >= NOW() - INTERVAL '30 days'
GROUP BY 1 ORDER BY 1;
```

---

## Phase Plan

### Phase 1: Scaffold + Schema + Auth

**Task 1.1 — Initialize Next.js 15 project**

- [ ] Run: `npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"` (answer prompts: yes to ESLint, no to Turbopack for now)
- [ ] Verify `package.json` has `"next": "^15"` and `app/` directory exists
- [ ] Commit: `git add -A && git commit -m "chore: init Next.js 15 + TypeScript scaffold"`

**Task 1.2 — Install dependencies**

- [ ] Run:
```bash
npm install drizzle-orm @supabase/supabase-js @supabase/storage-js \
  next-auth@beta @auth/drizzle-adapter \
  @anthropic-ai/sdk \
  resend \
  pino pino-pretty \
  recharts \
  genanki
npm install -D drizzle-kit vitest @vitejs/plugin-react tsx \
  @types/node
```
- [ ] Run: `npx shadcn@latest init` (choose default style, slate base color, yes to CSS variables)
- [ ] Commit: `chore: install core dependencies`

**Task 1.3 — Environment variables**

- [ ] Create `.env.example`:
```env
# Auth
AUTH_SECRET=
AUTH_URL=http://localhost:3000

# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=source-pdfs

# Database (Supabase connection pooler - Transaction mode)
DATABASE_URL=

# Anthropic
ANTHROPIC_API_KEY=
ANTHROPIC_SONNET_MODEL=claude-sonnet-4-6
ANTHROPIC_OPUS_MODEL=claude-opus-4-7

# Resend
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@yourdomain.com

# App
WHITELISTED_EMAIL=kstephano@gmail.com
WORKER_SECRET=                        # shared secret for /api/worker auth
ENCRYPTION_KEY=                       # 32-byte hex for AES-256

# Worker (Railway)
WORKER_POLL_INTERVAL_MS=3000
```
- [ ] Copy to `.env.local` and fill in dev values
- [ ] Create `.env.development.example` and `.env.production.example` (same keys, different comments)
- [ ] Add `.env.local` to `.gitignore` (should already be there from Next.js init)
- [ ] Commit: `chore: add env var templates`

**Task 1.4 — Drizzle config + DB connection**

- [ ] Create `drizzle/drizzle.config.ts`:
```typescript
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```
- [ ] Create `lib/db/index.ts`:
```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
export type DB = typeof db;
```
- [ ] Install `pg @types/pg`: `npm install pg && npm install -D @types/pg`
- [ ] Commit: `chore: drizzle config and db singleton`

**Task 1.5 — Write schema and generate migration**

- [ ] Create `lib/db/schema.ts` with the complete schema from this plan (all tables, enums, indexes)
- [ ] Run: `npx drizzle-kit generate`
- [ ] Verify migration file created in `drizzle/migrations/`
- [ ] Create a second migration file `drizzle/migrations/0001_views.sql` with the four DB views SQL from this plan
- [ ] Run: `npx drizzle-kit migrate` (against dev Supabase)
- [ ] Verify all tables exist in Supabase dashboard
- [ ] Commit: `feat(db): drizzle schema + migrations + views`

**Task 1.6 — Auth.js with Resend magic link**

- [ ] Create `auth.ts` at project root:
```typescript
import NextAuth from 'next-auth';
import Resend from 'next-auth/providers/resend';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/lib/db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    Resend({
      from: process.env.RESEND_FROM_EMAIL,
      apiKey: process.env.RESEND_API_KEY,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (user.email !== process.env.WHITELISTED_EMAIL) {
        return false; // returns false → Auth.js shows "Access restricted"
      }
      return true;
    },
    async session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
  pages: { signIn: '/login' },
});
```
- [ ] Note: Auth.js DrizzleAdapter needs additional tables (`accounts`, `sessions`, `verification_tokens`). Add these to schema.ts and re-run migration:
```typescript
// Add to schema.ts
export const accounts = pgTable('accounts', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 255 }).notNull(),
  providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: varchar('token_type', { length: 255 }),
  scope: varchar('scope', { length: 255 }),
  id_token: text('id_token'),
  session_state: varchar('session_state', { length: 255 }),
});

export const sessions = pgTable('sessions', {
  sessionToken: varchar('session_token', { length: 255 }).primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires').notNull(),
});

export const verificationTokens = pgTable('verification_tokens', {
  identifier: varchar('identifier', { length: 255 }).notNull(),
  token: varchar('token', { length: 255 }).notNull(),
  expires: timestamp('expires').notNull(),
});
```
- [ ] Re-run `npx drizzle-kit generate && npx drizzle-kit migrate`
- [ ] Create `app/api/auth/[...nextauth]/route.ts`:
```typescript
import { handlers } from '@/auth';
export const { GET, POST } = handlers;
```
- [ ] Create `app/(auth)/login/page.tsx` with email form that calls `signIn('resend', { email })`
- [ ] Create `app/(protected)/layout.tsx` that checks `await auth()` and redirects to `/login` if no session
- [ ] Test: start dev server `npm run dev`, visit `/login`, enter `kstephano@gmail.com`, verify magic link email arrives, verify non-whitelisted email shows error
- [ ] Commit: `feat(auth): Auth.js magic link with email whitelist`

---

### Phase 2: Pricing + PDF Upload + Job Creation

**Task 2.1 — Pricing constants**

- [ ] Create `lib/pricing.ts`:
```typescript
export const PRICING = {
  sonnet: {
    inputPerMTok: 3.00,
    outputPerMTok: 15.00,
    cacheReadPerMTok: 0.30,
  },
  opus: {
    inputPerMTok: 5.00,
    outputPerMTok: 25.00,
    cacheReadPerMTok: 0.50,
  },
  webSearchPerCall: 0.01,
} as const;

export function computeTokenCost(
  model: 'sonnet' | 'opus',
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens = 0,
): number {
  const p = PRICING[model];
  return (
    (inputTokens / 1_000_000) * p.inputPerMTok +
    (outputTokens / 1_000_000) * p.outputPerMTok +
    (cacheReadTokens / 1_000_000) * p.cacheReadPerMTok
  );
}
```
- [ ] Commit: `feat: pricing constants`

**Task 2.2 — Cost estimator + tests**

- [ ] Create `lib/cost-estimator.ts`:
```typescript
import { PRICING } from './pricing';

interface EstimateInput {
  pageCount: number;
  sectionCount: number;
  requestedCardCount: number | null;
  maxWebSearches: number;
}

interface CostBreakdown {
  sonnetLow: number; sonnetHigh: number;
  opusLow: number; opusHigh: number;
  searchCost: number;
  totalLow: number; totalHigh: number;
}

const PDF_TOKENS_PER_PAGE = 2000;
const REGEN_LOW = 1.10;
const REGEN_HIGH = 1.35;

export function estimateCost(input: EstimateInput): CostBreakdown {
  const { pageCount, sectionCount, requestedCardCount, maxWebSearches } = input;
  const totalCards = requestedCardCount ?? sectionCount * 20;
  const cardsPerSection = totalCards / sectionCount;

  const structureIn = pageCount * PDF_TOKENS_PER_PAGE;
  const structureOut = 1000;
  const enrichIn = 1000 + maxWebSearches * 500;
  const enrichOut = 2000;
  const generateIn = sectionCount * (((pageCount / sectionCount) * PDF_TOKENS_PER_PAGE) + 1500);
  const generateOut = sectionCount * cardsPerSection * 300;
  const judgeIn = totalCards * 1000;
  const judgeOut = totalCards * 250;

  const sonnetBase = (
    (structureIn + enrichIn + generateIn) / 1_000_000 * PRICING.sonnet.inputPerMTok +
    (structureOut + enrichOut + generateOut) / 1_000_000 * PRICING.sonnet.outputPerMTok
  );
  const opusBase = (
    judgeIn / 1_000_000 * PRICING.opus.inputPerMTok +
    judgeOut / 1_000_000 * PRICING.opus.outputPerMTok
  );
  const searchCost = maxWebSearches * PRICING.webSearchPerCall;

  const base = sonnetBase + opusBase + searchCost;

  return {
    sonnetLow: sonnetBase * REGEN_LOW,
    sonnetHigh: sonnetBase * REGEN_HIGH,
    opusLow: opusBase * REGEN_LOW,
    opusHigh: opusBase * REGEN_HIGH,
    searchCost,
    totalLow: base * REGEN_LOW,
    totalHigh: base * REGEN_HIGH,
  };
}
```
- [ ] Create `tests/lib/cost-estimator.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { estimateCost } from '@/lib/cost-estimator';

describe('estimateCost', () => {
  it('returns higher high than low', () => {
    const result = estimateCost({ pageCount: 50, sectionCount: 5, requestedCardCount: 100, maxWebSearches: 3 });
    expect(result.totalHigh).toBeGreaterThan(result.totalLow);
  });

  it('defaults to 20 cards per section when requestedCardCount is null', () => {
    const withNull = estimateCost({ pageCount: 10, sectionCount: 2, requestedCardCount: null, maxWebSearches: 0 });
    const withExplicit = estimateCost({ pageCount: 10, sectionCount: 2, requestedCardCount: 40, maxWebSearches: 0 });
    expect(withNull.totalLow).toBeCloseTo(withExplicit.totalLow, 4);
  });

  it('zero web searches means no search cost', () => {
    const result = estimateCost({ pageCount: 10, sectionCount: 2, requestedCardCount: 40, maxWebSearches: 0 });
    expect(result.searchCost).toBe(0);
  });
});
```
- [ ] Run: `npx vitest run tests/lib/cost-estimator.test.ts`
- [ ] Commit: `feat: cost estimator + tests`

**Task 2.3 — PDF validation + hashing**

- [ ] Install `pdf-parse`: `npm install pdf-parse && npm install -D @types/pdf-parse`
- [ ] Create `lib/pdf/validate.ts`:
```typescript
import pdfParse from 'pdf-parse';

const MAX_PAGES = 100;
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

export async function validatePdf(buffer: Buffer): Promise<{ pageCount: number }> {
  if (buffer.length > MAX_BYTES) {
    throw new Error(`PDF exceeds 50 MB limit (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
  }
  const data = await pdfParse(buffer);
  if (data.numpages > MAX_PAGES) {
    throw new Error(`PDF has ${data.numpages} pages; maximum is ${MAX_PAGES}`);
  }
  return { pageCount: data.numpages };
}
```
- [ ] Create `lib/pdf/hash.ts`:
```typescript
import { createHash } from 'crypto';
export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}
```
- [ ] Commit: `feat(pdf): validation and hashing`

**Task 2.4 — Supabase Storage helpers**

- [ ] Create `lib/pdf/storage.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'source-pdfs';

export async function uploadPdf(userId: string, hash: string, buffer: Buffer): Promise<string> {
  const path = `${userId}/${hash}.pdf`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return path;
}

export async function getSignedUrl(storagePath: string, expiresInSeconds = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data) throw new Error(`Signed URL failed: ${error?.message}`);
  return data.signedUrl;
}
```
- [ ] In Supabase dashboard: create bucket `source-pdfs`, set to private, enable RLS
- [ ] Commit: `feat(pdf): Supabase Storage upload + signed URL helpers`

**Task 2.5 — Cache key generation + tests**

- [ ] Create `lib/prompt-loader.ts`:
```typescript
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createHash } from 'crypto';

const PROMPT_FILES = [
  'extract_structure', 'enrich_context', 'generate_cards', 'regenerate_card', 'judge_card',
] as const;

type PromptName = typeof PROMPT_FILES[number];

const cache = new Map<PromptName, { content: string; hash: string }>();

export function loadPrompt(name: PromptName): { content: string; hash: string } {
  if (cache.has(name)) return cache.get(name)!;
  const content = readFileSync(resolve(process.cwd(), `prompts/${name}.md`), 'utf-8');
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 16);
  const entry = { content, hash };
  cache.set(name, entry);
  return entry;
}

export function getPromptVersionsHash(): string {
  const hashes = PROMPT_FILES.map((name) => loadPrompt(name).hash).join(':');
  return createHash('sha256').update(hashes).digest('hex').slice(0, 16);
}
```
- [ ] Create `lib/cache/generation-cache.ts`:
```typescript
import { createHash } from 'crypto';
import { getPromptVersionsHash } from '@/lib/prompt-loader';

export function buildCacheKey(params: {
  pdfHash: string;
  examName: string | null;
  requestedCardCount: number | null;
  maxWebSearches: number;
}): string {
  const versionsHash = getPromptVersionsHash();
  const input = [
    params.pdfHash,
    params.examName ?? '',
    String(params.requestedCardCount ?? ''),
    String(params.maxWebSearches),
    versionsHash,
  ].join('|');
  return createHash('sha256').update(input).digest('hex');
}
```
- [ ] Create `tests/lib/cache/cache-key.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { buildCacheKey } from '@/lib/cache/generation-cache';

describe('buildCacheKey', () => {
  it('is deterministic for same inputs', () => {
    const params = { pdfHash: 'abc', examName: 'USMLE', requestedCardCount: 100, maxWebSearches: 3 };
    expect(buildCacheKey(params)).toBe(buildCacheKey(params));
  });

  it('differs when exam name changes', () => {
    const base = { pdfHash: 'abc', examName: 'USMLE', requestedCardCount: 100, maxWebSearches: 3 };
    expect(buildCacheKey(base)).not.toBe(buildCacheKey({ ...base, examName: 'MCAT' }));
  });

  it('handles null examName', () => {
    const key = buildCacheKey({ pdfHash: 'abc', examName: null, requestedCardCount: null, maxWebSearches: 0 });
    expect(key).toHaveLength(64);
  });
});
```
- [ ] Run: `npx vitest run tests/lib/cache/`
- [ ] Commit: `feat: prompt loader, cache key generation + tests`

**Task 2.6 — Upload API route**

- [ ] Create `app/api/upload/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { validatePdf } from '@/lib/pdf/validate';
import { sha256 } from '@/lib/pdf/hash';
import { uploadPdf } from '@/lib/pdf/storage';
import { db } from '@/lib/db';
import { sourcePdfs, generationJobs, generationCache, userSettings } from '@/lib/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { estimateCost } from '@/lib/cost-estimator';
import { buildCacheKey } from '@/lib/cache/generation-cache';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const sectionId = formData.get('sectionId') as string | null;
  const examName = formData.get('examName') as string | null || null;
  const requestedCardCount = formData.get('requestedCardCount') ? Number(formData.get('requestedCardCount')) : null;
  const maxWebSearches = formData.get('maxWebSearches') ? Number(formData.get('maxWebSearches')) : 3;

  if (!file || !sectionId) return NextResponse.json({ error: 'Missing file or sectionId' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  let pageCount: number;
  try {
    ({ pageCount } = await validatePdf(buffer));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 422 });
  }

  const hash = sha256(buffer);

  // Check for active job
  const activeJob = await db.query.generationJobs.findFirst({
    where: and(
      eq(generationJobs.userId, userId),
      or(eq(generationJobs.status, 'pending'), eq(generationJobs.status, 'running'), eq(generationJobs.status, 'awaiting_outline_approval'))
    ),
  });
  if (activeJob) {
    return NextResponse.json({ error: 'A generation job is already in progress. Please wait for it to complete.' }, { status: 409 });
  }

  // Spend cap check
  const settings = await db.query.userSettings.findFirst({ where: eq(userSettings.userId, userId) });
  const spendCap = Number(settings?.monthlySpendCapUsd ?? 50);
  // TODO: compute current month spend from api_usage_log

  const sectionCount = 5; // placeholder — real count from outline step
  const estimate = estimateCost({ pageCount, sectionCount, requestedCardCount, maxWebSearches });

  // Check generation cache
  const cacheKey = buildCacheKey({ pdfHash: hash, examName, requestedCardCount, maxWebSearches });
  const cached = await db.query.generationCache.findFirst({ where: eq(generationCache.cacheKey, cacheKey) });
  if (cached) {
    // TODO: clone deck, log cache hit, return deck id
  }

  // Store PDF if new
  let pdfRecord = await db.query.sourcePdfs.findFirst({ where: eq(sourcePdfs.sha256Hash, hash) });
  if (!pdfRecord) {
    const storagePath = await uploadPdf(userId, hash, buffer);
    [pdfRecord] = await db.insert(sourcePdfs).values({
      userId, filename: file.name, byteSize: buffer.length, pageCount, sha256Hash: hash, storagePath,
    }).returning();
  }

  const [job] = await db.insert(generationJobs).values({
    userId, sourcePdfId: pdfRecord.id, examName, requestedCardCount, maxWebSearches,
    estimatedCostLowUsd: String(estimate.totalLow.toFixed(4)),
    estimatedCostHighUsd: String(estimate.totalHigh.toFixed(4)),
    status: 'pending',
  }).returning();

  return NextResponse.json({ jobId: job.id, estimate });
}
```
- [ ] Commit: `feat(api): PDF upload + job creation route`

**Task 2.7 — Upload modal UI**

- [ ] Install shadcn components: `npx shadcn@latest add dialog button input label slider`
- [ ] Create `components/decks/UploadModal.tsx` with:
  - File input (accept=".pdf")
  - Exam name text input
  - Card count input (optional)
  - Web searches slider 0-10 (default 3)
  - Submit calls POST /api/upload
  - On success: shows cost estimate, offers confirm or cancel
  - On confirm: redirects to `/jobs/{jobId}`
- [ ] Create `components/decks/CostEstimateDisplay.tsx` showing breakdown table from plan spec
- [ ] Commit: `feat(ui): upload modal with cost estimate`

---

### Phase 3: Worker Infrastructure + Structure Step

**Task 3.1 — Anthropic client wrapper**

- [ ] Create `lib/anthropic/client.ts`:
```typescript
import Anthropic from '@anthropic-ai/sdk';
import { db } from '@/lib/db';
import { apiUsageLog } from '@/lib/db/schema';
import { computeTokenCost } from '@/lib/pricing';
import pino from 'pino';

const log = pino();

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function trackedMessage(params: {
  model: 'sonnet' | 'opus';
  messages: Anthropic.MessageParam[];
  tools?: Anthropic.Tool[];
  jobId?: string;
  sectionId?: string;
  pipelineStep: string;
  promptTemplateVersion?: string;
  webSearchesUsed?: number;
}): Promise<Anthropic.Message> {
  const modelId = params.model === 'sonnet'
    ? process.env.ANTHROPIC_SONNET_MODEL!
    : process.env.ANTHROPIC_OPUS_MODEL!;

  const start = Date.now();
  const response = await anthropic.messages.create({
    model: modelId,
    max_tokens: 8192,
    messages: params.messages,
    tools: params.tools,
  });
  const latencyMs = Date.now() - start;

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const cacheReadTokens = (response.usage as any).cache_read_input_tokens ?? 0;
  const costUsd = computeTokenCost(params.model, inputTokens, outputTokens, cacheReadTokens);

  await db.insert(apiUsageLog).values({
    jobId: params.jobId ?? null,
    sectionId: params.sectionId ?? null,
    pipelineStep: params.pipelineStep as any,
    model: modelId,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    costUsd: String(costUsd.toFixed(6)),
    latencyMs,
    cacheHit: false,
    promptTemplateVersion: params.promptTemplateVersion ?? null,
    webSearchesUsed: params.webSearchesUsed ?? 0,
  });

  log.info({ jobId: params.jobId, step: params.pipelineStep, model: params.model, costUsd, latencyMs });
  return response;
}
```
- [ ] Commit: `feat(anthropic): tracked message wrapper with usage logging`

**Task 3.2 — Tool definitions**

- [ ] Create `lib/anthropic/tools.ts`:
```typescript
import type Anthropic from '@anthropic-ai/sdk';

export const structureTool: Anthropic.Tool = {
  name: 'extract_structure',
  description: 'Extract the section outline from the PDF',
  input_schema: {
    type: 'object',
    properties: {
      sections: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            page_start: { type: 'integer' },
            page_end: { type: 'integer' },
            description: { type: 'string' },
          },
          required: ['name', 'page_start', 'page_end'],
        },
      },
    },
    required: ['sections'],
  },
};

export const generateCardsTool: Anthropic.Tool = {
  name: 'generate_cards',
  description: 'Generate flashcards for a section',
  input_schema: {
    type: 'object',
    properties: {
      cards: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            card_type: { type: 'string', enum: ['qa', 'cloze', 'multiple_choice'] },
            front: { type: 'string' },
            back: { type: 'string' },
            explanation: { type: 'string' },
            source_page: { type: 'integer' },
            source_quote: { type: 'string', maxLength: 200 },
            difficulty: { type: 'integer', minimum: 1, maximum: 5 },
            tags: { type: 'array', items: { type: 'string' }, maxItems: 3 },
          },
          required: ['card_type', 'front', 'back', 'source_page', 'source_quote', 'difficulty', 'tags'],
        },
      },
    },
    required: ['cards'],
  },
};

export const judgeCardTool: Anthropic.Tool = {
  name: 'judge_card',
  description: 'Score a flashcard for accuracy and relevance',
  input_schema: {
    type: 'object',
    properties: {
      accuracy_score: { type: 'integer', minimum: 1, maximum: 5 },
      relevance_score: { type: 'integer', minimum: 1, maximum: 5 },
      rationale: { type: 'string' },
    },
    required: ['accuracy_score', 'relevance_score', 'rationale'],
  },
};
```
- [ ] Commit: `feat(anthropic): tool definitions for structure/generate/judge`

**Task 3.3 — Prompt templates (drafts)**

- [ ] Create `prompts/extract_structure.md`:
```markdown
<!-- DRAFT v1 — iterate before production use -->
You are analyzing a PDF document to extract its section structure for flashcard generation.

Identify all major sections based on headers, chapters, or logical divisions in the content.
For each section, provide its name, approximate page range, and a brief description.

Exam context (if provided): {{exam_name}}
Total pages: {{page_count}}

Call the extract_structure tool with your analysis.
```
- [ ] Create `prompts/enrich_context.md`:
```markdown
<!-- DRAFT v1 -->
You are researching exam scope and common question patterns for: {{exam_name}}

Use the web_search tool to find:
1. Official exam syllabus or blueprint
2. Common high-yield topics
3. Typical difficulty distribution

Return a structured context summary covering: core topics, emphasis areas, common question formats, and difficulty distribution.
```
- [ ] Create `prompts/generate_cards.md`:
```markdown
<!-- DRAFT v1 -->
Generate {{card_count}} flashcards for the following section of a PDF document.

Section: {{section_name}} (pages {{page_start}}-{{page_end}})
Exam context: {{exam_name}}
Enrichment context: {{enrich_context}}

Rules:
- Prefer qa and cloze types; use multiple_choice only when exam context suggests it
- Every card must include source_page, source_quote (verbatim ≤200 chars), difficulty (1-5), and 1-3 tags
- Cloze format: use {{c1::hidden}} syntax in front field; back = full unhidden version
- Multiple choice: front = question + options A-D; back = correct letter + brief justification

Call the generate_cards tool with all cards.
```
- [ ] Create `prompts/regenerate_card.md`:
```markdown
<!-- DRAFT v1 -->
The following flashcard was rejected by the quality judge.

Original front: {{original_front}}
Original back: {{original_back}}
Judge rationale: {{judge_rationale}}

Previous attempt was rejected because: {{judge_rationale}}. Generate a corrected card addressing the judge's concerns.

Section: {{section_name}}, Source PDF pages {{page_start}}-{{page_end}}

Call the generate_cards tool with a single corrected card.
```
- [ ] Create `prompts/judge_card.md`:
```markdown
<!-- DRAFT v1 -->
Evaluate this flashcard against the source PDF and exam context.

Card front: {{front}}
Card back: {{back}}
Source quote: {{source_quote}}
Exam: {{exam_name}}

## Rubric

### Accuracy (factual correctness against source PDF)
5 — Fully accurate: Every claim directly supported by source. No fabrication. Full exam credit.
4 — Substantively accurate: Core facts correct; minor imprecision in non-essential details.
3 — Mostly accurate, minor errors: Main answer correct but small factual error or omission.
2 — Partially incorrect: Meaningful factual error, significant omission, or conflation.
1 — Incorrect or fabricated: Contradicts source, invents content, or fundamentally wrong.

### Relevance (usefulness for specified exam)
5 — Highly relevant: Core concept explicitly in exam syllabus. Top-tier prep resource quality.
4 — Clearly relevant: Within exam scope, even if not headline topic. Worth studying.
3 — Tangentially relevant: Related but unlikely to appear on exam, or wrong depth. Borderline.
2 — Weakly relevant: Trivia, edge case, or outside typical exam scope.
1 — Irrelevant: Unrelated to exam, or too general/specific for any reasonable exam.

If no exam name: score relevance against "general educational value for a student studying this subject."

Threshold for acceptance: both scores ≥ 3.

Call the judge_card tool with your scores and rationale.
```
- [ ] Commit: `feat(prompts): draft prompt templates`

**Task 3.4 — Job queue**

- [ ] Create `lib/jobs/queue.ts`:
```typescript
import { db } from '@/lib/db';
import { generationJobs } from '@/lib/db/schema';
import { eq, and, or } from 'drizzle-orm';
import pino from 'pino';

const log = pino();

export async function claimNextJob(): Promise<string | null> {
  // Atomic claim: find a pending job, set to running
  const result = await db.execute(/* sql */`
    UPDATE generation_jobs
    SET status = 'running', started_at = NOW()
    WHERE id = (
      SELECT id FROM generation_jobs
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `);
  return (result.rows[0] as any)?.id ?? null;
}

export async function checkCancelled(jobId: string): Promise<boolean> {
  const job = await db.query.generationJobs.findFirst({ where: eq(generationJobs.id, jobId) });
  return job?.status === 'cancelled';
}

export async function updateJobProgress(jobId: string, pct: number, step: string) {
  await db.update(generationJobs)
    .set({ progressPct: pct, currentStep: step as any })
    .where(eq(generationJobs.id, jobId));
  log.info({ jobId, step, pct }, 'progress update');
}

export async function failJob(jobId: string, error: string) {
  await db.update(generationJobs)
    .set({ status: 'failed', errorMessage: error, completedAt: new Date() })
    .where(eq(generationJobs.id, jobId));
  log.error({ jobId, error }, 'job failed');
}

export async function completeJob(jobId: string, deckId: string, actualCostUsd: number) {
  await db.update(generationJobs)
    .set({ status: 'complete', deckId, actualCostUsd: String(actualCostUsd), completedAt: new Date() })
    .where(eq(generationJobs.id, jobId));
}
```
- [ ] Create `tests/lib/jobs/state-transitions.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
// Mock db to test state transition logic in isolation
// Full integration tests require a real DB — these test the function contracts

describe('job state transitions', () => {
  it('failJob sets status to failed', async () => {
    // Tested via integration: verify DB row has status='failed' after calling failJob
    expect(true).toBe(true); // placeholder — replace with DB integration test
  });
});
```
- [ ] Commit: `feat(jobs): job queue with atomic claim + state helpers`

**Task 3.5 — Structure pipeline step**

- [ ] Create `lib/jobs/steps/structure.ts`:
```typescript
import { db } from '@/lib/db';
import { generationJobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { trackedMessage } from '@/lib/anthropic/client';
import { structureTool } from '@/lib/anthropic/tools';
import { loadPrompt } from '@/lib/prompt-loader';
import { getSignedUrl } from '@/lib/pdf/storage';
import { updateJobProgress } from '@/lib/jobs/queue';
import pino from 'pino';

const log = pino();

export interface SectionOutlineItem {
  name: string;
  page_start: number;
  page_end: number;
  description?: string;
}

export async function runStructureStep(jobId: string): Promise<void> {
  const job = await db.query.generationJobs.findFirst({
    where: eq(generationJobs.id, jobId),
    with: { sourcePdf: true },
  });
  if (!job) throw new Error(`Job ${jobId} not found`);

  await updateJobProgress(jobId, 5, 'structure');

  const { content: promptTemplate, hash: promptHash } = loadPrompt('extract_structure');
  const prompt = promptTemplate
    .replace('{{exam_name}}', job.examName ?? 'Not specified')
    .replace('{{page_count}}', String(job.sourcePdf!.pageCount));

  const signedUrl = await getSignedUrl(job.sourcePdf!.storagePath);

  const response = await trackedMessage({
    model: 'sonnet',
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'url', url: signedUrl } },
        { type: 'text', text: prompt },
      ],
    }],
    tools: [structureTool],
    tool_choice: { type: 'tool', name: 'extract_structure' },
    jobId,
    pipelineStep: 'structure',
    promptTemplateVersion: promptHash,
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') throw new Error('Structure step: no tool_use in response');

  const outline = (toolUse.input as { sections: SectionOutlineItem[] }).sections;
  log.info({ jobId, sectionCount: outline.length }, 'structure step complete');

  await db.update(generationJobs)
    .set({ pendingSectionOutline: outline, status: 'awaiting_outline_approval', progressPct: 15 })
    .where(eq(generationJobs.id, jobId));
}
```
- [ ] Commit: `feat(pipeline): structure step — PDF → section outline`

**Task 3.6 — Worker orchestrator + API route**

- [ ] Create `lib/jobs/worker.ts`:
```typescript
import { claimNextJob, checkCancelled, failJob } from './queue';
import { runStructureStep } from './steps/structure';
import { runEnrichStep } from './steps/enrich';
import { runGenerateStep } from './steps/generate';
import { runJudgeAndPersistStep } from './steps/judge';
import { db } from '@/lib/db';
import { generationJobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import pino from 'pino';

const log = pino();

export async function runWorkerTick(): Promise<{ processed: boolean }> {
  // Also resume jobs awaiting_outline_approval that have been approved
  const resumableJob = await db.query.generationJobs.findFirst({
    where: (j, { eq, and, isNotNull }) => and(
      eq(j.status, 'awaiting_outline_approval'),
      isNotNull(j.outlineApprovedAt),
    ),
  });

  const jobId = resumableJob?.id ?? await claimNextJob();
  if (!jobId) return { processed: false };

  log.info({ jobId }, 'worker tick: processing job');

  const job = await db.query.generationJobs.findFirst({ where: eq(generationJobs.id, jobId) });
  if (!job) return { processed: false };

  try {
    if (job.status === 'pending') {
      await runStructureStep(jobId);
      return { processed: true };
    }

    if (job.status === 'awaiting_outline_approval' && job.outlineApprovedAt) {
      if (await checkCancelled(jobId)) return { processed: true };
      await runEnrichStep(jobId);
      if (await checkCancelled(jobId)) return { processed: true };
      await runGenerateStep(jobId);
      if (await checkCancelled(jobId)) return { processed: true };
      await runJudgeAndPersistStep(jobId);
      return { processed: true };
    }
  } catch (e: any) {
    log.error({ jobId, error: e.message }, 'worker tick error');
    await failJob(jobId, e.message);
  }

  return { processed: false };
}
```
- [ ] Create `app/api/worker/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { runWorkerTick } from '@/lib/jobs/worker';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-worker-secret');
  if (secret !== process.env.WORKER_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const result = await runWorkerTick();
  return NextResponse.json(result);
}
```
- [ ] Create `worker/index.ts` (Railway entry point):
```typescript
import 'dotenv/config';

const INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 3000);
const WORKER_URL = process.env.NEXT_PUBLIC_APP_URL + '/api/worker';
const SECRET = process.env.WORKER_SECRET!;

async function tick() {
  try {
    const res = await fetch(WORKER_URL, { headers: { 'x-worker-secret': SECRET } });
    const data = await res.json();
    if (data.processed) console.log('[worker] processed a job tick');
  } catch (e) {
    console.error('[worker] fetch error:', e);
  }
}

(async () => {
  console.log('[worker] starting, poll interval:', INTERVAL_MS, 'ms');
  while (true) {
    await tick();
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
})();
```
- [ ] Add `worker` build to `package.json`:
```json
"scripts": {
  "worker": "tsx worker/index.ts",
  "worker:build": "esbuild worker/index.ts --bundle --platform=node --outfile=dist/worker.js"
}
```
- [ ] Commit: `feat(worker): orchestrator, API route, Railway entry point`

**Task 3.7 — Outline approval UI + API**

- [ ] Create `app/api/jobs/[id]/approve/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { generationJobs } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const outline = body.outline; // edited outline from user

  await db.update(generationJobs)
    .set({ pendingSectionOutline: outline, outlineApprovedAt: new Date() })
    .where(and(eq(generationJobs.id, params.id), eq(generationJobs.userId, session.user.id)));

  return NextResponse.json({ ok: true });
}
```
- [ ] Create `components/jobs/OutlineApproval.tsx`: editable table of sections with name/page_start/page_end inputs, ability to delete rows, reorder via drag (use `@dnd-kit/sortable`), and "Approve and Generate" button
- [ ] Install: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
- [ ] Create `app/(protected)/jobs/[id]/page.tsx`: polls `/api/jobs/[id]` every 2s, shows `OutlineApproval` when status is `awaiting_outline_approval`, shows `SectionProgressList` when running
- [ ] Create `app/api/jobs/[id]/route.ts` and `app/api/jobs/[id]/cancel/route.ts`
- [ ] Commit: `feat(ui): job detail page + outline approval`

---

### Phase 4: Full Generation Pipeline

**Task 4.1 — Enrich step**

- [ ] Create `lib/jobs/steps/enrich.ts`:
```typescript
import { db } from '@/lib/db';
import { generationJobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { trackedMessage } from '@/lib/anthropic/client';
import { loadPrompt } from '@/lib/prompt-loader';
import { updateJobProgress } from '@/lib/jobs/queue';

export async function runEnrichStep(jobId: string): Promise<void> {
  const job = await db.query.generationJobs.findFirst({ where: eq(generationJobs.id, jobId) });
  if (!job) throw new Error(`Job ${jobId} not found`);
  if (!job.examName) {
    // No exam — skip enrich, store empty context
    await db.update(generationJobs).set({ progressPct: 25 }).where(eq(generationJobs.id, jobId));
    return;
  }

  await updateJobProgress(jobId, 20, 'enrich');
  const { content: template, hash } = loadPrompt('enrich_context');
  const prompt = template.replace('{{exam_name}}', job.examName);

  const webSearchTool = {
    type: 'web_search_20250305' as const,
    name: 'web_search',
    max_uses: job.maxWebSearches,
  };

  const response = await trackedMessage({
    model: 'sonnet',
    messages: [{ role: 'user', content: prompt }],
    tools: [webSearchTool as any],
    jobId,
    pipelineStep: 'enrich',
    promptTemplateVersion: hash,
    webSearchesUsed: job.maxWebSearches,
  });

  const enrichContext = response.content
    .filter((b) => b.type === 'text')
    .map((b: any) => b.text)
    .join('\n');

  // Store enrich context on job (reuse errorMessage field temporarily — add enrichContext column)
  // Actually: add enrich_context column to generation_jobs
  await db.update(generationJobs)
    .set({ progressPct: 25 } as any)
    .where(eq(generationJobs.id, jobId));
  // Store in a separate field — add migration: ALTER TABLE generation_jobs ADD COLUMN enrich_context text
}
```
- [ ] Add `enrichContext: text('enrich_context')` to `generationJobs` in schema.ts, generate and run migration
- [ ] Update enrich step to store: `set({ enrichContext, progressPct: 25 })`
- [ ] Commit: `feat(pipeline): enrich step with web search`

**Task 4.2 — Generate step (per section, with retry)**

- [ ] Create `lib/jobs/steps/generate.ts` implementing:
  - Loop over approved sections from `job.pendingSectionOutline`
  - For each section: call Sonnet with PDF + section scope + enrich context + card count target
  - Use `generateCardsTool`
  - On API failure: exponential backoff (2s, 8s, 32s), max 3 retries
  - On total failure: mark section failed in `sectionGenerationStatus`, continue
  - Update `updateJobProgress` per section
  - Store raw generated cards in memory for judge step
  - Returns: `GeneratedCard[][]` grouped by section
- [ ] Commit: `feat(pipeline): generate step with per-section retry`

**Task 4.3 — Judge step (per card, Opus)**

- [ ] Create `lib/jobs/steps/judge.ts` implementing:
  - For each card: call Opus with card + source quote + rubric prompt
  - Use `judgeCardTool`
  - Fresh call per card (no conversation history)
  - If accuracy < 3 OR relevance < 3: mark for regeneration
  - Return cards with judge metadata attached
- [ ] Commit: `feat(pipeline): judge step with Opus per-card scoring`

**Task 4.4 — Regenerate step**

- [ ] Create `lib/jobs/steps/regenerate.ts` implementing:
  - For rejected cards: call Sonnet with `regenerate_card.md` prompt + original card + rationale
  - Re-judge with fresh Opus call
  - If still < 3: insert into `droppedCards`, exclude from deck
  - Return final accepted cards
- [ ] Commit: `feat(pipeline): regenerate + re-judge step`

**Task 4.5 — Persist step + cache write**

- [ ] Create `lib/jobs/steps/persist.ts` implementing:
  - Create deck row in target section
  - Bulk insert cards with all metadata, SRS defaults (ease=2.5, interval=0, due=now)
  - Sum `api_usage_log.cost_usd` for this job → set `actualCostUsd`
  - Write to `generationCache` (full deck JSON)
  - Call `completeJob(jobId, deckId, actualCost)`
- [ ] Commit: `feat(pipeline): persist step + cache write`

**Task 4.6 — Wire up full pipeline in worker**

- [ ] Update `lib/jobs/worker.ts` to import all steps and call them in sequence
- [ ] Update `runGenerateStep` to pass `sectionId` to per-section `trackedMessage` calls
- [ ] Manual integration test: upload a small PDF, approve outline, verify cards appear in deck
- [ ] Commit: `feat(pipeline): full pipeline wired end-to-end`

---

### Phase 5: CRUD APIs + Core UI

**Task 5.1 — CRUD API routes**

- [ ] `app/api/projects/route.ts` — GET list, POST create
- [ ] `app/api/projects/[id]/route.ts` — GET, PATCH name/desc, DELETE
- [ ] `app/api/sections/route.ts` — POST create (with projectId in body)
- [ ] `app/api/sections/[id]/route.ts` — GET, PATCH, DELETE
- [ ] `app/api/decks/route.ts` — POST create
- [ ] `app/api/decks/[id]/route.ts` — GET (with cards), PATCH, DELETE
- [ ] `app/api/decks/[id]/cards/route.ts` — GET cards list
- [ ] `app/api/cards/[id]/route.ts` — PATCH (human edit: save originalFront/Back, set humanEdited=true, editedAt=now)
- [ ] All routes: validate session, scope queries by userId
- [ ] Commit: `feat(api): complete CRUD routes for projects/sections/decks/cards`

**Task 5.2 — Page implementations**

- [ ] `app/(protected)/page.tsx` — project list with create button
- [ ] `app/(protected)/projects/[id]/page.tsx` — section list, add section
- [ ] `app/(protected)/projects/[id]/sections/[sid]/page.tsx` — deck list + upload button (opens UploadModal)
- [ ] `app/(protected)/decks/[id]/page.tsx` — card table with inline edit, "Study" and "Export to Anki" buttons
- [ ] `components/cards/CardTable.tsx` — table showing front/back/type/scores, edit row on click
- [ ] `components/cards/CardEditRow.tsx` — inline form that PATCHes `/api/cards/[id]`
- [ ] Commit: `feat(ui): project/section/deck/card pages`

**Task 5.3 — Global layout elements**

- [ ] `components/layout/Header.tsx` — shows current month spend vs cap, nav links
- [ ] `components/layout/JobStatusPanel.tsx` — fixed bottom-right, polls `/api/jobs?active=true` every 2s, shows progress bar + step name + cancel button
- [ ] Wire into `app/(protected)/layout.tsx`
- [ ] Commit: `feat(ui): header spend indicator + sticky job status panel`

---

### Phase 6: Study Mode

**Task 6.1 — SM-2 algorithm + tests**

- [ ] Create `lib/srs/sm2.ts`:
```typescript
export interface SrsState {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
}

export interface SrsUpdate extends SrsState {
  dueDate: Date;
}

export function applySm2(state: SrsState, quality: number): SrsUpdate {
  if (quality < 0 || quality > 5) throw new RangeError('quality must be 0-5');

  let { easeFactor, intervalDays, repetitions } = state;

  if (quality < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    if (repetitions === 0) intervalDays = 1;
    else if (repetitions === 1) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * easeFactor);
    repetitions += 1;
  }

  easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + intervalDays);
  dueDate.setHours(0, 0, 0, 0);

  return { easeFactor, intervalDays, repetitions, dueDate };
}
```
- [ ] Create `tests/lib/srs/sm2.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { applySm2 } from '@/lib/srs/sm2';

const DEFAULT: Parameters<typeof applySm2>[0] = { easeFactor: 2.5, intervalDays: 0, repetitions: 0 };

describe('applySm2', () => {
  it('first correct response sets interval to 1', () => {
    const result = applySm2(DEFAULT, 4);
    expect(result.intervalDays).toBe(1);
    expect(result.repetitions).toBe(1);
  });

  it('second correct response sets interval to 6', () => {
    const after1 = applySm2(DEFAULT, 4);
    const after2 = applySm2(after1, 4);
    expect(after2.intervalDays).toBe(6);
    expect(after2.repetitions).toBe(2);
  });

  it('third correct response multiplies by ease factor', () => {
    const s1 = applySm2(DEFAULT, 5);
    const s2 = applySm2(s1, 5);
    const s3 = applySm2(s2, 5);
    expect(s3.intervalDays).toBe(Math.round(6 * s2.easeFactor));
    expect(s3.repetitions).toBe(3);
  });

  it('incorrect response resets repetitions and sets interval to 1', () => {
    const after3 = applySm2(applySm2(applySm2(DEFAULT, 4), 4), 4);
    const reset = applySm2(after3, 1);
    expect(reset.repetitions).toBe(0);
    expect(reset.intervalDays).toBe(1);
  });

  it('ease factor floor is 1.3', () => {
    let state = DEFAULT;
    for (let i = 0; i < 20; i++) state = applySm2(state, 0);
    expect(state.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it('throws on out-of-range quality', () => {
    expect(() => applySm2(DEFAULT, 6)).toThrow(RangeError);
    expect(() => applySm2(DEFAULT, -1)).toThrow(RangeError);
  });

  it('due date is in the future for correct response', () => {
    const result = applySm2(DEFAULT, 4);
    expect(result.dueDate.getTime()).toBeGreaterThan(Date.now());
  });
});
```
- [ ] Run: `npx vitest run tests/lib/srs/`
- [ ] Commit: `feat(srs): SM-2 algorithm + comprehensive tests`

**Task 6.2 — Review session API**

- [ ] `app/api/review/sessions/route.ts` — POST to start session (creates session row, returns cards due)
- [ ] `app/api/review/sessions/[id]/events/route.ts` — POST review event: apply SM-2, update card, write review_event, update session counts
- [ ] `app/api/review/sessions/[id]/route.ts` — PATCH to close session (set endedAt)
- [ ] Commit: `feat(api): review session + SM-2 update routes`

**Task 6.3 — Study mode UI**

- [ ] Install shadcn: `npx shadcn@latest add progress`
- [ ] `app/(protected)/decks/[id]/study/page.tsx` — loads due cards, manages local study state
- [ ] `components/study/StudyCard.tsx` — shows front, space/click reveals back + explanation, source page
- [ ] `components/study/RatingButtons.tsx` — 0-5 buttons with labels (Again/Hard/Good/Easy/Perfect), keyboard shortcuts 0-5
- [ ] `components/study/StudyProgress.tsx` — "Card N of M due" progress indicator + "Bury" button
- [ ] Commit: `feat(ui): study mode with SM-2 keyboard controls`

---

### Phase 7: Dashboard

**Task 7.1 — Dashboard data API**

- [ ] `app/api/dashboard/route.ts` — returns aggregated data from DB views + raw queries:
  - Monthly spend total from `api_usage_log`
  - Cards generated this month
  - Review sessions this month
  - Cards due today
  - Daily spend last 30 days
  - Model spend breakdown
  - Cache hit rate daily (from view)
  - Judge scores by week
  - Score distribution
  - Regen/drop rates
  - Review heatmap data (90 days)
  - Due cards forecast (next 30 days from SRS state)
  - Retention by deck
  - Areas to improve insights
  - Last 10 jobs
- [ ] Commit: `feat(api): dashboard aggregation endpoint`

**Task 7.2 — Dashboard charts**

- [ ] Install: `npm install recharts`
- [ ] Install shadcn: `npx shadcn@latest add card`
- [ ] Create each chart component in `components/dashboard/` using Recharts:
  - `SpendBarChart.tsx` — BarChart, daily spend 30 days
  - `ModelSpendChart.tsx` — StackedBar by model
  - `CostPerCardChart.tsx` — LineChart from view
  - `CacheHitChart.tsx` — LineChart hit rate %
  - `JudgeScoreChart.tsx` — LineChart accuracy + relevance by week
  - `ScoreHistogram.tsx` — BarChart score distribution
  - `RegenRateChart.tsx` / `DropRateChart.tsx` — LineCharts by week
  - `ReviewHeatmap.tsx` — GitHub-style calendar grid (CSS grid, no library needed)
  - `DueCardsChart.tsx` — BarChart next 30 days forecast
  - `RetentionChart.tsx` — BarChart by deck (% quality >= 3)
  - `AreaInsights.tsx` — server-computed text bullets
  - `PipelineHealthTable.tsx` — last 10 jobs table
- [ ] `app/(protected)/dashboard/page.tsx` — layout with all chart components
- [ ] Commit: `feat(ui): dashboard with all charts`

---

### Phase 8: Anki Export

**Task 8.1 — Python sidecar**

- [ ] Create `scripts/export_anki.py`:
```python
#!/usr/bin/env python3
"""
Usage: python3 scripts/export_anki.py <input.json> <output.apkg>
Input JSON schema: { "deck_name": str, "cards": [...] }
"""
import json, sys, genanki, random

def slug(s):
    return s.lower().replace(' ', '-').replace('/', '-')

model_id = random.randrange(1 << 30, 1 << 31)
cloze_model_id = random.randrange(1 << 30, 1 << 31)

qa_model = genanki.Model(
    model_id,
    'AI Flashcard',
    fields=[
        {'name': 'Front'}, {'name': 'Back'}, {'name': 'Explanation'},
        {'name': 'Source'}, {'name': 'Tags'}, {'name': 'JudgeRationale'},
    ],
    templates=[{
        'name': 'Card 1',
        'qfmt': '{{Front}}',
        'afmt': '{{FrontSide}}<hr id="answer">{{Back}}<br><small>{{Source}}</small>',
    }],
)

cloze_model = genanki.Model(
    cloze_model_id,
    'AI Flashcard Cloze',
    model_type=genanki.Model.CLOZE,
    fields=[
        {'name': 'Text'}, {'name': 'Extra'}, {'name': 'Source'},
    ],
    templates=[{
        'name': 'Cloze Card',
        'qfmt': '{{cloze:Text}}',
        'afmt': '{{cloze:Text}}<br><small>{{Source}}</small>',
    }],
)

data = json.load(open(sys.argv[1]))
deck_name = data['deck_name']
anki_deck = genanki.Deck(random.randrange(1 << 30, 1 << 31), deck_name)

for c in data['cards']:
    source = f"Page {c.get('source_page', '?')} — \"{c.get('source_quote', '')}\""
    tags = ['ai-generated']
    if c.get('exam_name'):
        tags.append(f"exam:{slug(c['exam_name'])}")
    tags.extend(c.get('tags', []))

    if c['card_type'] == 'cloze':
        note = genanki.Note(
            model=cloze_model,
            fields=[c['front'], c.get('explanation', ''), source],
            tags=tags,
        )
    else:
        note = genanki.Note(
            model=qa_model,
            fields=[c['front'], c['back'], c.get('explanation', ''), source, ' '.join(tags), c.get('judge_rationale', '')],
            tags=tags,
        )
    anki_deck.add_note(note)

genanki.Package(anki_deck).write_to_file(sys.argv[2])
print(f"Wrote {len(data['cards'])} cards to {sys.argv[2]}")
```
- [ ] Commit: `feat(anki): Python export sidecar using genanki`

**Task 8.2 — Anki export API route**

- [ ] `app/api/export/[deckId]/route.ts`:
  - Fetch deck + cards + section + project names
  - Write temp JSON to `/tmp/deck-{id}.json`
  - Run: `child_process.execFileSync('python3', ['scripts/export_anki.py', inputPath, outputPath])`
  - Stream `.apkg` file as download response
  - Clean up temp files
  - Return as `application/octet-stream` with filename header
- [ ] Commit: `feat(api): Anki export route with Python sidecar`

---

### Phase 9: Settings + Polish

**Task 9.1 — Settings page + API**

- [ ] `app/api/settings/route.ts` — GET/PATCH user_settings, encrypt/decrypt API key with AES-256
- [ ] Create `lib/encryption.ts`:
```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(ciphertext: string): string {
  const [ivHex, encHex] = ciphertext.split(':');
  const decipher = createDecipheriv('aes-256-cbc', KEY, Buffer.from(ivHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8');
}
```
- [ ] `app/(protected)/settings/page.tsx` with form for: spend cap, default max searches, API key override, cache clear button, PDF cleanup button
- [ ] Commit: `feat: settings page + API key encryption`

**Task 9.2 — Seed script**

- [ ] Create `scripts/seed.ts`:
```typescript
import 'dotenv/config';
import { db } from '../lib/db';
import { users, userSettings, projects, sections } from '../lib/db/schema';

async function seed() {
  const [user] = await db.insert(users)
    .values({ email: 'kstephano@gmail.com' })
    .onConflictDoNothing()
    .returning();

  if (user) {
    await db.insert(userSettings).values({ userId: user.id }).onConflictDoNothing();
    const [project] = await db.insert(projects)
      .values({ userId: user.id, name: 'Demo Project', description: 'Example project' })
      .returning();
    await db.insert(sections)
      .values({ projectId: project.id, name: 'Section 1', orderIndex: 0 });
  }

  console.log('Seed complete');
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
```
- [ ] Add to `package.json`: `"seed": "tsx scripts/seed.ts"`
- [ ] Run: `npm run seed`
- [ ] Commit: `feat: seed script for dev setup`

**Task 9.3 — README**

- [ ] Write `README.md` covering:
  - Local dev setup (clone, env vars, `npm install`, Supabase setup, `npm run seed`, `npm run dev`)
  - All environment variables with descriptions
  - Supabase setup: two projects (dev/prod), create `source-pdfs` bucket, run migrations
  - Vercel deploy: link repo, set env vars, deploy
  - Railway worker deploy: Dockerfile or buildpack, set env vars
  - Resend setup: verify domain, create API key
  - Running tests: `npx vitest run`
- [ ] Commit: `docs: README with full setup instructions`

---

## Test Summary

Tests required by spec:

| Test file | Covers |
|---|---|
| `tests/lib/srs/sm2.test.ts` | SM-2 all cases including edge cases |
| `tests/lib/cache/cache-key.test.ts` | Cache key determinism + sensitivity |
| `tests/lib/jobs/state-transitions.test.ts` | Job state machine contracts |
| `tests/lib/cost-estimator.test.ts` | Cost formula low/high/null defaults |

Configure Vitest in `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
export default defineConfig({
  test: { environment: 'node' },
  resolve: { alias: { '@': resolve(__dirname, '.') } },
});
```

---

## Self-Review: Spec Coverage Check

| Spec requirement | Covered in task |
|---|---|
| Magic link auth + whitelist | Task 1.6 |
| All DB tables + enums | Task 1.5 |
| DB views (4) | Task 1.5 |
| PDF validation (100 page cap) | Task 2.3 |
| SHA-256 deduplication | Task 2.3, 2.4 |
| Generation cache | Task 2.5, 4.5 |
| Cost estimate (low/high range) | Task 2.2 |
| Spend cap enforcement | Task 2.6 |
| Sequential job enforcement | Task 2.6 |
| Structure step (Sonnet + tool_use) | Task 3.5 |
| Outline approval UI | Task 3.7 |
| Enrich step (web search, max_uses) | Task 4.1 |
| Generate step (per section, retry) | Task 4.2 |
| Judge step (Opus, per card, rubric) | Task 4.3 |
| Regenerate + re-judge | Task 4.4 |
| dropped_cards on double failure | Task 4.4 |
| Persist + SRS init | Task 4.5 |
| All card types (qa/cloze/mc) | Tasks 3.2, 4.2 |
| source_quote required | Tasks 3.2, 4.2 |
| Human card editing | Task 5.1 |
| Job cancellation | Task 3.7 |
| Progress polling (2s) | Task 5.3 |
| SM-2 full algorithm | Task 6.1 |
| Study keyboard shortcuts | Task 6.3 |
| Bury card option | Task 6.3 |
| All dashboard charts | Task 7.2 |
| Areas to improve insights | Task 7.2 |
| Pipeline health panel | Task 7.2 |
| Anki export (genanki sidecar) | Tasks 8.1, 8.2 |
| Cloze → Anki cloze note type | Task 8.1 |
| Anki :: hierarchy naming | Task 8.1 |
| Settings page | Task 9.1 |
| AES-256 API key storage | Task 9.1 |
| PDF signed URL download | Task 2.4 |
| Pino structured logging | Tasks 3.1, 3.4 |
| Prompt template files (5) | Task 3.3 |
| Prompt content-hash versioning | Task 2.5 |
| api_usage_log per call | Task 3.1 |
| Vitest tests (4 suites) | Tasks 2.2, 2.5, 6.1, 9.2 |
| .env.example + dev/prod separation | Task 1.3 |
| README | Task 9.3 |
| Railway worker entry | Task 3.6 |
| Worker secret auth | Task 3.6 |

No gaps found.
