CREATE TYPE "public"."card_type" AS ENUM('qa', 'cloze', 'multiple_choice');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending', 'running', 'awaiting_outline_approval', 'complete', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."pipeline_step" AS ENUM('structure', 'enrich', 'generate', 'judge', 'regenerate', 'persist');--> statement-breakpoint
CREATE TYPE "public"."section_status" AS ENUM('pending', 'running', 'complete', 'failed');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL,
	"type" varchar(255) NOT NULL,
	"provider" varchar(255) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" varchar(255),
	"scope" varchar(255),
	"id_token" text,
	"session_state" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "api_usage_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"job_id" uuid,
	"section_id" uuid,
	"pipeline_step" "pipeline_step" NOT NULL,
	"model" varchar(100) NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"cache_read_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(10, 6) NOT NULL,
	"latency_ms" integer,
	"cache_hit" boolean DEFAULT false NOT NULL,
	"prompt_template_version" varchar(64),
	"web_searches_used" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"card_type" "card_type" NOT NULL,
	"front" text NOT NULL,
	"back" text NOT NULL,
	"explanation" text,
	"source_page" integer,
	"source_quote" varchar(200),
	"difficulty" integer,
	"tags" text[],
	"accuracy_score" integer,
	"relevance_score" integer,
	"judge_rationale" text,
	"was_regenerated" boolean DEFAULT false NOT NULL,
	"prompt_template_version" varchar(64),
	"human_edited" boolean DEFAULT false NOT NULL,
	"original_front" text,
	"original_back" text,
	"edited_at" timestamp,
	"ease_factor" real DEFAULT 2.5 NOT NULL,
	"interval_days" integer DEFAULT 0 NOT NULL,
	"repetitions" integer DEFAULT 0 NOT NULL,
	"due_date" timestamp DEFAULT now() NOT NULL,
	"last_reviewed_at" timestamp,
	"last_review_quality" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"source_pdf_id" uuid,
	"exam_name" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dropped_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"attempted_front" text,
	"attempted_back" text,
	"final_accuracy_score" integer,
	"final_relevance_score" integer,
	"final_rationale" text,
	"attempts" integer DEFAULT 2 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cache_key" varchar(64) NOT NULL,
	"output_deck_json" jsonb NOT NULL,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_hit_at" timestamp,
	CONSTRAINT "generation_cache_cache_key_unique" UNIQUE("cache_key")
);
--> statement-breakpoint
CREATE TABLE "generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"deck_id" uuid,
	"source_pdf_id" uuid NOT NULL,
	"exam_name" varchar(255),
	"requested_card_count" integer,
	"max_web_searches" integer DEFAULT 3 NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"current_step" "pipeline_step",
	"progress_pct" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"enrich_context" text,
	"estimated_cost_low_usd" numeric(10, 4),
	"estimated_cost_high_usd" numeric(10, 4),
	"actual_cost_usd" numeric(10, 4),
	"pending_section_outline" jsonb,
	"outline_approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"quality" integer NOT NULL,
	"reviewed_at" timestamp DEFAULT now() NOT NULL,
	"prev_ease_factor" real NOT NULL,
	"new_ease_factor" real NOT NULL,
	"prev_interval" integer NOT NULL,
	"new_interval" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"deck_id" uuid NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"cards_reviewed" integer DEFAULT 0 NOT NULL,
	"cards_correct" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "section_generation_status" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"section_name" varchar(255) NOT NULL,
	"status" "section_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"order_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_pdfs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"filename" varchar(500) NOT NULL,
	"byte_size" bigint NOT NULL,
	"page_count" integer NOT NULL,
	"sha256_hash" varchar(64) NOT NULL,
	"storage_path" varchar(1000) NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "source_pdfs_sha256_hash_unique" UNIQUE("sha256_hash")
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"monthly_spend_cap_usd" numeric(10, 4) DEFAULT '50' NOT NULL,
	"default_max_web_searches" integer DEFAULT 3 NOT NULL,
	"anthropic_api_key_encrypted" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255),
	"email" varchar(255) NOT NULL,
	"email_verified" timestamp,
	"image" varchar(1000),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage_log" ADD CONSTRAINT "api_usage_log_job_id_generation_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."generation_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_source_pdf_id_source_pdfs_id_fk" FOREIGN KEY ("source_pdf_id") REFERENCES "public"."source_pdfs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dropped_cards" ADD CONSTRAINT "dropped_cards_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_source_pdf_id_source_pdfs_id_fk" FOREIGN KEY ("source_pdf_id") REFERENCES "public"."source_pdfs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_events" ADD CONSTRAINT "review_events_session_id_review_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."review_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_events" ADD CONSTRAINT "review_events_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_sessions" ADD CONSTRAINT "review_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_sessions" ADD CONSTRAINT "review_sessions_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_generation_status" ADD CONSTRAINT "section_generation_status_job_id_generation_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."generation_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_pdfs" ADD CONSTRAINT "source_pdfs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "usage_log_timestamp_idx" ON "api_usage_log" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "cards_deck_due_idx" ON "cards" USING btree ("deck_id","due_date");--> statement-breakpoint
CREATE INDEX "jobs_user_status_idx" ON "generation_jobs" USING btree ("user_id","status");