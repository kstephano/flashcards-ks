-- Enable Row-Level Security on all tables.
-- The app uses a direct Postgres connection (Drizzle via transaction pooler) which
-- runs as the postgres superuser and bypasses RLS, so the app is unaffected.
-- This blocks all anonymous access via the Supabase REST API.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verification_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "source_pdfs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "decks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dropped_cards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "generation_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "section_generation_status" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "generation_cache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "api_usage_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "review_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "review_events" ENABLE ROW LEVEL SECURITY;
