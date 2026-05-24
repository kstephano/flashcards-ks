import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  real,
  bigint,
  jsonb,
  numeric,
  index,
} from 'drizzle-orm/pg-core';

// Enums
export const cardTypeEnum = pgEnum('card_type', ['qa', 'cloze', 'multiple_choice']);
export const jobStatusEnum = pgEnum('job_status', [
  'pending',
  'running',
  'awaiting_outline_approval',
  'complete',
  'failed',
  'cancelled',
]);
export const pipelineStepEnum = pgEnum('pipeline_step', [
  'structure',
  'enrich',
  'generate',
  'judge',
  'regenerate',
  'persist',
]);
export const sectionStatusEnum = pgEnum('section_status', [
  'pending',
  'running',
  'complete',
  'failed',
]);

// Auth.js required tables
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: timestamp('email_verified'),
  image: varchar('image', { length: 1000 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const accounts = pgTable('accounts', {
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
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
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires').notNull(),
});

export const verificationTokens = pgTable('verification_tokens', {
  identifier: varchar('identifier', { length: 255 }).notNull(),
  token: varchar('token', { length: 255 }).notNull(),
  expires: timestamp('expires').notNull(),
});

// App tables
export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  monthlySpendCapUsd: numeric('monthly_spend_cap_usd', {
    precision: 10,
    scale: 4,
  })
    .default('10')
    .notNull(),
  defaultMaxWebSearches: integer('default_max_web_searches').default(3).notNull(),
  anthropicApiKeyEncrypted: text('anthropic_api_key_encrypted'),
});

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const sections = pgTable('sections', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  orderIndex: integer('order_index').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const sourcePdfs = pgTable('source_pdfs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  filename: varchar('filename', { length: 500 }).notNull(),
  byteSize: bigint('byte_size', { mode: 'number' }).notNull(),
  pageCount: integer('page_count').notNull(),
  sha256Hash: varchar('sha256_hash', { length: 64 }).notNull().unique(),
  storagePath: varchar('storage_path', { length: 1000 }).notNull(),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
});

export const decks = pgTable('decks', {
  id: uuid('id').primaryKey().defaultRandom(),
  sectionId: uuid('section_id')
    .notNull()
    .references(() => sections.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  sourcePdfId: uuid('source_pdf_id').references(() => sourcePdfs.id, {
    onDelete: 'set null',
  }),
  examName: varchar('exam_name', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const cards = pgTable(
  'cards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deckId: uuid('deck_id')
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
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
  },
  (t) => [index('cards_deck_due_idx').on(t.deckId, t.dueDate)],
);

export const droppedCards = pgTable('dropped_cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  deckId: uuid('deck_id')
    .notNull()
    .references(() => decks.id, { onDelete: 'cascade' }),
  attemptedFront: text('attempted_front'),
  attemptedBack: text('attempted_back'),
  finalAccuracyScore: integer('final_accuracy_score'),
  finalRelevanceScore: integer('final_relevance_score'),
  finalRationale: text('final_rationale'),
  attempts: integer('attempts').default(2).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const generationJobs = pgTable(
  'generation_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deckId: uuid('deck_id').references(() => decks.id, { onDelete: 'set null' }),
    sourcePdfId: uuid('source_pdf_id')
      .notNull()
      .references(() => sourcePdfs.id),
    targetSectionId: uuid('target_section_id').references(() => sections.id, { onDelete: 'set null' }),
    examName: varchar('exam_name', { length: 255 }),
    requestedCardCount: integer('requested_card_count'),
    maxWebSearches: integer('max_web_searches').default(3).notNull(),
    status: jobStatusEnum('status').default('pending').notNull(),
    currentStep: pipelineStepEnum('current_step'),
    progressPct: integer('progress_pct').default(0).notNull(),
    errorMessage: text('error_message'),
    enrichContext: text('enrich_context'),
    estimatedCostLowUsd: numeric('estimated_cost_low_usd', {
      precision: 10,
      scale: 4,
    }),
    estimatedCostHighUsd: numeric('estimated_cost_high_usd', {
      precision: 10,
      scale: 4,
    }),
    actualCostUsd: numeric('actual_cost_usd', { precision: 10, scale: 4 }),
    pendingSectionOutline: jsonb('pending_section_outline'),
    outlineApprovedAt: timestamp('outline_approved_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
  },
  (t) => [index('jobs_user_status_idx').on(t.userId, t.status)],
);

export const sectionGenerationStatus = pgTable('section_generation_status', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id')
    .notNull()
    .references(() => generationJobs.id, { onDelete: 'cascade' }),
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

export const apiUsageLog = pgTable(
  'api_usage_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
    jobId: uuid('job_id').references(() => generationJobs.id, {
      onDelete: 'set null',
    }),
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
  },
  (t) => [index('usage_log_timestamp_idx').on(t.timestamp)],
);

export const reviewSessions = pgTable('review_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  deckId: uuid('deck_id')
    .notNull()
    .references(() => decks.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
  cardsReviewed: integer('cards_reviewed').default(0).notNull(),
  cardsCorrect: integer('cards_correct').default(0).notNull(),
});

export const reviewEvents = pgTable('review_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => reviewSessions.id, { onDelete: 'cascade' }),
  cardId: uuid('card_id')
    .notNull()
    .references(() => cards.id, { onDelete: 'cascade' }),
  quality: integer('quality').notNull(),
  reviewedAt: timestamp('reviewed_at').defaultNow().notNull(),
  prevEaseFactor: real('prev_ease_factor').notNull(),
  newEaseFactor: real('new_ease_factor').notNull(),
  prevInterval: integer('prev_interval').notNull(),
  newInterval: integer('new_interval').notNull(),
});
