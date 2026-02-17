-- ============================================================================
-- JOB HUNTER — MASTER DATABASE SETUP
-- ============================================================================
--
-- This is the ONE script to rule them all. Run this in Supabase SQL Editor
-- to set up the entire database from scratch.
--
-- WHAT THIS DOES:
--   1. Nuclear reset (drops and recreates public schema)
--   2. Creates all 11 tables with correct column names
--   3. Enables RLS on all tables
--   4. Creates RLS policies (strict ownership: users see only their own data)
--   5. Creates triggers (auto-create profile on signup, auto-update timestamps)
--   6. Creates indexes for performance
--   7. Grants permissions to Supabase API roles (AFTER tables exist!)
--   8. Sets default privileges for future tables
--   9. Recreates profiles for existing users (if any)
--
-- WHEN TO RUN THIS:
--   - First-time setup of a new Supabase project
--   - After a nuclear reset (DROP SCHEMA public CASCADE)
--   - When you want to start completely fresh
--
-- WARNING: This DROPS everything in the public schema. All data will be lost.
-- Back up any data you want to keep before running this.
--
-- HOW TO RUN:
--   1. Go to Supabase Dashboard → SQL Editor → New Query
--   2. Paste this entire script
--   3. Click "Run"
--   4. Check the output for errors (there should be none)
-- ============================================================================


-- ============================================================================
-- STEP 1: NUCLEAR RESET
-- ============================================================================
-- Drop the entire public schema and recreate it fresh.
-- This removes ALL tables, functions, triggers, views, and types.
-- The auth schema (auth.users, sessions, etc.) is NOT affected.
-- The storage schema (buckets, objects) is NOT affected.
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;


-- ============================================================================
-- STEP 2: EXTENSIONS
-- ============================================================================
-- pgvector: Adds the 'vector' data type for embedding-based semantic search.
-- Used for future AI matching (cosine similarity between resume and job embeddings).
CREATE EXTENSION IF NOT EXISTS vector;


-- ============================================================================
-- STEP 3: UTILITY FUNCTIONS
-- ============================================================================

-- Auto-update updated_at timestamp on any UPDATE operation.
-- Attached to every table that has an updated_at column.
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- STEP 4: CREATE ALL TABLES
-- ============================================================================

-- ---------- PROFILES ----------
-- User profile info. Auto-created by trigger when a user signs up.
-- Primary key IS the auth.users id (1:1 relationship).
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email text,
  full_name text,
  avatar_url text,
  onboarding_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---------- RESUMES ----------
-- User's uploaded resume with AI-extracted structured data.
-- raw_text = full text of resume (NOT resume_text — that was the old name)
CREATE TABLE public.resumes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  raw_text text,
  file_url text,
  target_roles text[] DEFAULT '{}',
  skills text[] DEFAULT '{}',
  experience_bullets text[] DEFAULT '{}',
  education text,
  projects jsonb DEFAULT '[]'::jsonb,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---------- USER PREFERENCES ----------
-- Job search filters. One row per user (UNIQUE on user_id).
CREATE TABLE public.user_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL UNIQUE,
  location_filters text[] DEFAULT '{}',
  remote_preference text[] DEFAULT '{}',
  min_score_threshold integer DEFAULT 50,
  exclude_keywords text[] DEFAULT '{}',
  require_sponsorship boolean DEFAULT false,
  target_start_date text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---------- JOB SOURCES ----------
-- Where to find jobs (Greenhouse boards, Lever pages, etc.)
-- source_type (NOT type) = 'greenhouse', 'lever', 'career_page', 'other'
CREATE TABLE public.job_sources (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  source_type text NOT NULL,
  url text NOT NULL,
  is_active boolean DEFAULT true,
  last_fetched_at timestamptz,
  jobs_found integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---------- JOBS ----------
-- Individual job postings from Tavily search or manual entry.
-- description_raw / description_clean (NOT description)
-- posted_at / job_source = Tavily integration columns
CREATE TABLE public.jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  source_id uuid REFERENCES public.job_sources(id) ON DELETE SET NULL,
  external_id text,
  title text NOT NULL,
  company text NOT NULL,
  location text,
  remote_type text DEFAULT 'unknown',
  url text NOT NULL,
  apply_url text,
  description_raw text,
  description_clean text,
  required_skills text[] DEFAULT '{}',
  preferred_skills text[] DEFAULT '{}',
  years_experience text,
  education_requirement text,
  internship_dates text,
  salary_range text,
  visa_sponsorship text DEFAULT 'unknown',
  visa_keywords_found text[] DEFAULT '{}',
  ats_type text,
  posted_date date,
  posted_at timestamptz,           -- Tavily: precise post timestamp
  job_source text,                 -- Tavily: 'Tavily', 'Greenhouse', etc.
  last_seen timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, source_id, external_id),
  CONSTRAINT jobs_user_url_unique UNIQUE (user_id, url)
);

-- ---------- JOB MATCHES ----------
-- AI-computed match scores. Scores live HERE, not on the jobs table.
-- score_total = 0-100 composite score
CREATE TABLE public.job_matches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  score_total integer NOT NULL CHECK (score_total >= 0 AND score_total <= 100),
  score_breakdown jsonb DEFAULT '{}'::jsonb,
  matching_skills text[] DEFAULT '{}',
  missing_skills text[] DEFAULT '{}',
  matching_bullets text[] DEFAULT '{}',
  recommended_projects text[] DEFAULT '{}',
  why_match text,
  risk_flags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, job_id)
);

-- ---------- APPLICATIONS ----------
-- Kanban pipeline: saved → applying → applied → interview → offer/rejected
CREATE TABLE public.applications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'saved',
  applied_date date,
  followup_date date,
  notes text,
  interview_dates jsonb DEFAULT '[]'::jsonb,
  timeline jsonb DEFAULT '[]'::jsonb,
  offer_details jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, job_id)
);

-- ---------- GENERATED DOCUMENTS ----------
-- AI-generated cover letters, answers, resume variants.
-- doc_type (NOT type) = 'cover_letter', 'answers', 'resume_variant'
CREATE TABLE public.generated_documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  doc_type text NOT NULL,
  content text,
  file_url text,
  answers jsonb DEFAULT '[]'::jsonb,
  bullet_tweaks jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---------- CHAT HISTORY ----------
-- AI Career Coach conversation memory.
-- context_type = 'general', 'job', 'resume_tailor'
CREATE TABLE public.chat_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  context_type text NOT NULL CHECK (context_type IN ('general', 'job', 'resume_tailor')),
  job_id uuid REFERENCES public.jobs ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- ---------- USER MEMORY ----------
-- Career Coach persistent memory (one row per user).
CREATE TABLE public.user_memory (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL UNIQUE,
  career_goals text,
  preferred_locations text[] DEFAULT '{}',
  preferred_work_types text[] DEFAULT '{}',
  target_salary_min integer,
  target_salary_max integer,
  certifications jsonb DEFAULT '[]',
  projects jsonb DEFAULT '[]',
  learning_interests text[] DEFAULT '{}',
  job_search_status text,
  availability_date date,
  notes text,
  updated_at timestamptz DEFAULT now()
);

-- ---------- NOTIFICATIONS ----------
-- Job alerts and system notifications.
CREATE TABLE public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  message text NOT NULL,
  title text,
  type text DEFAULT 'info',
  is_read boolean DEFAULT false,
  action_url text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  read_at timestamptz
);


-- ============================================================================
-- STEP 5: ENABLE RLS ON ALL TABLES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- STEP 6: RLS POLICIES (Strict Ownership)
-- ============================================================================
-- Every user can only see/modify their own data.
-- "FOR ALL" = covers SELECT, INSERT, UPDATE, DELETE in one policy.
-- USING clause = applied to SELECT/UPDATE/DELETE (filters which rows are visible).
-- WITH CHECK defaults to USING for INSERT (checks the NEW row matches).

-- Profiles: id IS the user_id (primary key = auth.users id)
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- All other tables: user_id column links to auth.users
CREATE POLICY "Users can manage own resumes"
  ON public.resumes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own preferences"
  ON public.user_preferences FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own sources"
  ON public.job_sources FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own jobs"
  ON public.jobs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own matches"
  ON public.job_matches FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own applications"
  ON public.applications FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own documents"
  ON public.generated_documents FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own chat"
  ON public.chat_history FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own memory"
  ON public.user_memory FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own notifications"
  ON public.notifications FOR ALL USING (auth.uid() = user_id);


-- ============================================================================
-- STEP 7: TRIGGERS
-- ============================================================================

-- Auto-update timestamps on every UPDATE
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_resumes_updated_at BEFORE UPDATE ON public.resumes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_job_sources_updated_at BEFORE UPDATE ON public.job_sources FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_job_matches_updated_at BEFORE UPDATE ON public.job_matches FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_generated_documents_updated_at BEFORE UPDATE ON public.generated_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_user_memory_updated_at BEFORE UPDATE ON public.user_memory FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-set read_at when notification is marked as read
CREATE OR REPLACE FUNCTION public.set_notification_read_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_read = true AND OLD.is_read = false THEN
    NEW.read_at = now();
  ELSIF NEW.is_read = false THEN
    NEW.read_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_notification_read_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_notification_read_at();

-- Auto-create profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, onboarding_completed)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate the trigger (safe to run multiple times)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ============================================================================
-- STEP 8: INDEXES (Performance)
-- ============================================================================
CREATE INDEX idx_resumes_user_id ON public.resumes(user_id);
CREATE INDEX idx_job_sources_user_active ON public.job_sources(user_id, is_active);
CREATE INDEX idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX idx_jobs_user_active ON public.jobs(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_jobs_user_company ON public.jobs(user_id, company);
CREATE INDEX idx_jobs_user_remote_type ON public.jobs(user_id, remote_type);
CREATE INDEX idx_jobs_user_posted_date ON public.jobs(user_id, posted_date DESC NULLS LAST);
CREATE INDEX idx_job_matches_user_score ON public.job_matches(user_id, score_total DESC);
CREATE INDEX idx_job_matches_job_id ON public.job_matches(job_id);
CREATE INDEX idx_applications_user_status ON public.applications(user_id, status);
CREATE INDEX idx_applications_job_id ON public.applications(job_id);
CREATE INDEX idx_applications_followup ON public.applications(user_id, followup_date) WHERE followup_date IS NOT NULL;
CREATE INDEX idx_generated_docs_user_type ON public.generated_documents(user_id, doc_type);
CREATE INDEX idx_generated_docs_job_id ON public.generated_documents(job_id);
CREATE INDEX idx_chat_history_user_created ON public.chat_history(user_id, created_at DESC);
CREATE INDEX idx_chat_history_context ON public.chat_history(user_id, context_type, created_at DESC);


-- ============================================================================
-- STEP 9: GRANT PERMISSIONS TO SUPABASE API ROLES
-- ============================================================================
-- CRITICAL: This MUST run AFTER table creation.
-- The Supabase frontend connects as the 'authenticated' or 'anon' role.
-- Without these grants, PostgREST returns 403 on every query.
--
-- The Edge Functions use 'service_role' which bypasses RLS entirely.

-- Grant schema-level access
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- Grant table-level access (for ALL tables that now exist)
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- Grant sequence access (for UUID generation via gen_random_uuid())
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- Grant function access (for triggers and utility functions)
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- Set default privileges for FUTURE tables/sequences/functions
-- This ensures any table created later (e.g., by a migration) also gets grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;


-- ============================================================================
-- STEP 10: RECREATE PROFILES FOR EXISTING USERS
-- ============================================================================
-- After a nuclear reset, auth.users still has all the users but public.profiles
-- is empty. This re-creates a profile row for every existing user.
-- The trigger only fires on NEW signups, not existing ones.
INSERT INTO public.profiles (id, email, full_name, onboarding_completed)
SELECT
  id,
  email,
  raw_user_meta_data->>'full_name',
  false  -- Force re-onboarding after reset
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);


-- ============================================================================
-- DONE! VERIFICATION SUMMARY
-- ============================================================================
--
-- Tables created (11):
--   ✅ profiles            — User display info (auto-created on signup)
--   ✅ resumes             — Resume data (raw_text, skills, etc.)
--   ✅ user_preferences    — Job search filters
--   ✅ job_sources         — Where to find jobs
--   ✅ jobs                — Job postings (with Tavily columns)
--   ✅ job_matches         — AI match scores (score_total 0-100)
--   ✅ applications        — Kanban pipeline
--   ✅ generated_documents — AI-generated cover letters, answers
--   ✅ chat_history        — AI conversation memory
--   ✅ user_memory         — Career Coach persistent memory
--   ✅ notifications       — System notifications
--
-- Security:
--   ✅ RLS enabled on all 11 tables
--   ✅ Ownership policies on all 11 tables
--   ✅ Grants for anon, authenticated, service_role (AFTER tables)
--   ✅ Default privileges for future tables
--
-- Triggers:
--   ✅ Auto-create profile on signup
--   ✅ Auto-update timestamps on all tables
--   ✅ Auto-set notification read_at
--
-- Indexes: 16 indexes covering all common query patterns
--
-- NEXT STEPS:
--   1. Deploy Edge Functions (see deployment commands in README)
--   2. Set secrets: OPENAI_API_KEY, TAVILY_API_KEY
--   3. Run the app: npm run dev
-- ============================================================================

