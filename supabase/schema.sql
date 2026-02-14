-- ============================================================================
-- Internship/JOb Hunter - Complete PostgreSQL Schema for Supabase
-- ============================================================================
--
-- This schema defines the entire database structure for the Internship Hunter
-- application. Run this against a Supabase project's PostgreSQL database via
-- the Supabase SQL Editor or the CLI with `supabase db push`.
--
-- ARCHITECTURE OVERVIEW:
--
--   auth.users (managed by Supabase Auth)
--       |
--       +-- profiles            (auto-created via trigger, user display info)
--       +-- resumes             (uploaded resumes with parsed skills/projects)
--       +-- user_preferences    (job search filters and preferences)
--       +-- job_sources         (where to find jobs: Greenhouse, Lever, etc.)
--       +-- jobs                (individual job postings scraped/added)
--       |     +-- job_matches         (AI-computed match scores per job)
--       |     +-- applications        (application pipeline tracking)
--       |     +-- generated_documents (cover letters, answers, resume variants)
--
-- ENTITY MAPPING:
--   This schema is derived directly from the JSON entity definitions in the
--   /entities directory. Each entity file (Application.js, Job.js, etc.) maps
--   to a corresponding table below. Where the entity schema uses nested objects
--   or arrays of objects, we use JSONB columns. Where it uses simple string
--   arrays, we use PostgreSQL text[] arrays.
--
-- KEY DESIGN DECISIONS:
--
-- 1. ROW LEVEL SECURITY (RLS):
--    Every table has RLS enabled with policies restricting access to the owning
--    user's rows. The Supabase anon key is safe to expose in the browser
--    because RLS enforces authorization at the database level.
--
-- 2. PGVECTOR FOR SEMANTIC MATCHING:
--    We enable the pgvector extension for future embedding-based semantic
--    similarity search between resumes and job descriptions. The vector
--    columns are not added yet but the extension is ready.
--
-- 3. USER_ID FOREIGN KEYS:
--    All user-owned tables reference auth.users(id) with ON DELETE CASCADE.
--    If a user deletes their account, all their data is automatically removed.
--    This is critical for GDPR/privacy compliance.
--
-- 4. JSONB COLUMNS:
--    Used for semi-structured nested data: score_breakdown, interview_dates,
--    timeline, projects, answers, bullet_tweaks, offer_details. JSONB gives
--    schema flexibility and supports indexing/querying inside the JSON.
--
-- 5. TEXT[] ARRAY COLUMNS:
--    PostgreSQL native arrays for simple string lists (skills, locations,
--    keywords). More efficient than junction tables and support containment
--    operators like @> (contains) and && (overlaps) for filtering.
--
-- 6. UNIQUE CONSTRAINTS:
--    - One user_preferences row per user (user_id UNIQUE)
--    - One job_match per job (user_id, job_id UNIQUE)
--    - One application per job per user (user_id, job_id UNIQUE)
--    - Job deduplication via (user_id, source_id, external_id) UNIQUE
--
-- ============================================================================


-- ============================================================================
-- EXTENSIONS
-- ============================================================================

-- Enable pgvector for storing and querying embedding vectors.
-- pgvector adds the 'vector' data type and operators for similarity search
-- (cosine distance, inner product, L2 distance). We enable this now so
-- embedding columns can be added to resumes and jobs tables in the future
-- when the AI matching pipeline is built.
create extension if not exists vector;


-- ============================================================================
-- UTILITY: Auto-update updated_at timestamp
-- ============================================================================
-- This trigger function is attached to every table that has an updated_at
-- column. It automatically sets updated_at to the current time on any UPDATE,
-- so application code never needs to manually track modification times.
--
-- BEFORE UPDATE triggers modify the NEW row before it is written to disk.
-- FOR EACH ROW means the trigger fires once per modified row.

create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;


-- ============================================================================
-- TABLE: profiles
-- ============================================================================
-- Stores public-facing user profile information. Automatically populated when
-- a new user signs up via the handle_new_user() trigger.
--
-- WHY A SEPARATE TABLE FROM auth.users?
-- Supabase's auth.users lives in the auth schema, which is not directly
-- accessible from the client. The profiles table in the public schema holds
-- only the info we want to expose (email, name, avatar) plus app-specific
-- fields like onboarding_completed.

create table public.profiles (
  -- Primary key matches auth.users id (UUID). This is a 1:1 relationship.
  -- ON DELETE CASCADE: when a user is deleted from auth.users, their profile
  -- is automatically removed.
  id uuid references auth.users on delete cascade primary key,

  -- Email duplicated from auth.users for convenience, avoiding joins against
  -- the auth schema for common queries.
  email text,

  -- Display name, populated from OAuth metadata or set by the user.
  full_name text,

  -- Profile picture URL, typically from Google OAuth or user upload.
  avatar_url text,

  -- Tracks whether the user has completed onboarding (resume upload,
  -- preference selection, source setup). The app redirects to /onboarding
  -- if this is false.
  onboarding_completed boolean default false,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS: Users can only view and update their own profile.
-- No INSERT policy needed because profiles are created by the trigger
-- (which runs as SECURITY DEFINER, bypassing RLS).
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();


-- ============================================================================
-- TRIGGER: Auto-create profile on signup
-- ============================================================================
-- Fires automatically when a new row is inserted into auth.users (i.e., when
-- someone signs up). Creates a corresponding profile row, pulling name and
-- avatar from the user's raw_user_meta_data (populated by OAuth providers).
--
-- SECURITY DEFINER: runs with the privileges of the function owner (postgres),
-- not the calling user. Necessary because the trigger fires in the auth schema
-- context but needs to INSERT into public.profiles which has RLS enabled.

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    -- raw_user_meta_data is JSONB in auth.users storing provider-specific
    -- data. For Google OAuth it contains full_name and avatar_url.
    -- For email signup these will be null.
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- AFTER INSERT (not BEFORE) because the auth.users row must exist first
-- so the foreign key constraint on profiles.id is satisfied.
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================================
-- TABLE: resumes
-- ============================================================================
-- Maps to entity: Resume
-- Stores uploaded resumes with parsed/extracted structured data.
--
-- Entity fields mapped:
--   resume_text      -> raw_text (text)       -- full plain text of resume
--   file_url         -> file_url (text)       -- Supabase Storage URL
--   target_roles     -> target_roles (text[]) -- e.g., ['Data Engineer Intern']
--   skills           -> skills (text[])       -- extracted skills list
--   experience_bullets -> experience_bullets (text[]) -- key experience bullets
--   education        -> education (text)      -- education summary string
--   projects         -> projects (jsonb)      -- array of {name, description, technologies[]}
--
-- JSONB is used for projects because each project is a nested object with
-- its own sub-array (technologies). text[] is used for flat string lists
-- like skills and target_roles.

create table public.resumes (
  id uuid default gen_random_uuid() primary key,

  -- Owner of this resume. CASCADE delete ensures cleanup when user is removed.
  user_id uuid references auth.users on delete cascade not null,

  -- Full plain text extracted from the uploaded PDF/DOCX.
  -- Kept for full-text search and re-processing if parsing logic improves.
  -- Maps to entity field: resume_text
  raw_text text,

  -- Supabase Storage URL pointing to the uploaded file.
  -- Generated by supabase.storage.from('resumes').upload().
  -- Maps to entity field: file_url
  file_url text,

  -- Job titles the user is targeting with this resume.
  -- Example: ['Software Engineer Intern', 'Data Engineer Intern', 'ML Intern']
  -- Maps to entity field: target_roles
  target_roles text[] default '{}',

  -- Skills extracted from the resume by AI parsing.
  -- Example: ['Python', 'React', 'SQL', 'Docker', 'AWS']
  -- Maps to entity field: skills
  skills text[] default '{}',

  -- Key experience bullet points for matching against job descriptions.
  -- Example: ['Built REST API serving 10k requests/day', 'Led team of 4 in hackathon']
  -- Maps to entity field: experience_bullets
  experience_bullets text[] default '{}',

  -- Education summary as a single string.
  -- Example: 'B.S. Computer Science, University of Texas at Dallas, GPA 3.8'
  -- Maps to entity field: education
  education text,

  -- Structured project data stored as JSONB because each project contains
  -- nested fields including a sub-array of technologies.
  -- Expected structure:
  -- [
  --   {
  --     "name": "Internship Hunter",
  --     "description": "AI-powered job search assistant",
  --     "technologies": ["React", "Supabase", "OpenAI"]
  --   }
  -- ]
  -- Maps to entity field: projects
  projects jsonb default '[]'::jsonb,

  -- Whether this is the user's primary resume for default matching.
  -- Only one resume per user should have is_primary = true (app-level enforcement).
  is_primary boolean default false,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.resumes enable row level security;

-- RLS: Users can SELECT, INSERT, UPDATE, DELETE only their own resumes.
create policy "Users can manage own resumes"
  on public.resumes for all
  using (auth.uid() = user_id);

create trigger update_resumes_updated_at
  before update on public.resumes
  for each row execute function public.update_updated_at();


-- ============================================================================
-- TABLE: user_preferences
-- ============================================================================
-- Maps to entity: UserPreferences
-- Stores job search preferences that drive filtering and matching.
-- Each user has exactly ONE preferences row (enforced by UNIQUE on user_id).
--
-- Entity fields mapped:
--   onboarding_completed  -> onboarding_completed (boolean, default false)
--   location_filters      -> location_filters (text[])
--   remote_preference     -> remote_preference (text[], array of enum values)
--   min_score_threshold   -> min_score_threshold (integer, default 50)
--   exclude_keywords      -> exclude_keywords (text[])
--   require_sponsorship   -> require_sponsorship (boolean, default false)
--   target_start_date     -> target_start_date (text)
--
-- NOTE: remote_preference is text[] (not a single text) because the entity
-- schema defines it as an array of enum values ['remote', 'hybrid', 'onsite'].
-- A user might accept both remote and hybrid positions.

create table public.user_preferences (
  id uuid default gen_random_uuid() primary key,

  -- One preferences row per user. The UNIQUE constraint prevents duplicates.
  -- Application code should use UPSERT (INSERT ... ON CONFLICT) to ensure
  -- only one row exists per user.
  user_id uuid references auth.users on delete cascade not null unique,

  -- Whether the user has completed the onboarding wizard.
  -- Mirrors profiles.onboarding_completed but lives here because preferences
  -- are the entity that onboarding creates/updates.
  -- Maps to entity field: onboarding_completed
  onboarding_completed boolean default false,

  -- Geographic locations the user is willing to work in.
  -- Example: ['Dallas, TX', 'Austin, TX', 'San Francisco, CA']
  -- Maps to entity field: location_filters
  location_filters text[] default '{}',

  -- Work arrangement preferences. Stored as an array because users may
  -- accept multiple types (e.g., both remote and hybrid).
  -- Valid values: 'remote', 'hybrid', 'onsite'
  -- Maps to entity field: remote_preference
  remote_preference text[] default '{}',

  -- Minimum match score (0-100) for a job to appear in recommendations.
  -- Jobs below this threshold are hidden from the user's feed.
  -- Default 50 means only moderate-or-better matches are shown.
  -- Maps to entity field: min_score_threshold
  min_score_threshold integer default 50,

  -- Keywords that should disqualify a job from results.
  -- Example: ['security clearance', 'US citizen required', 'senior']
  -- Maps to entity field: exclude_keywords
  exclude_keywords text[] default '{}',

  -- Whether the user requires visa sponsorship.
  -- When true, jobs with visa_sponsorship = 'no' are filtered out.
  -- Maps to entity field: require_sponsorship
  require_sponsorship boolean default false,

  -- When the user wants to start working.
  -- Example: 'Summer 2026', 'Fall 2025', 'January 2026'
  -- Stored as text because formats vary (season+year, month+year, etc.)
  -- Maps to entity field: target_start_date
  target_start_date text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.user_preferences enable row level security;

create policy "Users can manage own preferences"
  on public.user_preferences for all
  using (auth.uid() = user_id);

create trigger update_user_preferences_updated_at
  before update on public.user_preferences
  for each row execute function public.update_updated_at();


-- ============================================================================
-- TABLE: job_sources
-- ============================================================================
-- Maps to entity: JobSource
-- Defines where the app discovers job listings for each user: Greenhouse
-- boards, Lever career pages, company career sites, etc.
--
-- Entity fields mapped:
--   name         -> name (text, not null)
--   type         -> source_type (text, not null) -- 'greenhouse'/'lever'/'career_page'/'other'
--   url          -> url (text, not null)
--   is_active    -> is_active (boolean, default true)
--   last_fetched -> last_fetched_at (timestamptz)
--   jobs_found   -> jobs_found (integer, default 0)
--
-- WHY PER-USER SOURCES?
-- Different users target different companies. A CS student might add Google's
-- Greenhouse board, while a finance student adds JPMorgan's career page.
-- Per-user sources also let us track scraping status individually.

create table public.job_sources (
  id uuid default gen_random_uuid() primary key,

  user_id uuid references auth.users on delete cascade not null,

  -- Human-readable name for display in the UI.
  -- Example: 'Google Careers', 'Stripe Greenhouse', 'My University Board'
  -- Maps to entity field: name
  name text not null,

  -- How this source is accessed. Determines which fetching/scraping logic
  -- the backend uses to import jobs.
  -- Values from entity enum: 'greenhouse', 'lever', 'career_page', 'other'
  -- Maps to entity field: type
  source_type text not null,

  -- Base URL for the job source.
  -- Example: 'https://boards.greenhouse.io/stripe'
  -- Maps to entity field: url
  url text not null,

  -- Toggle to enable/disable a source without deleting its configuration.
  -- When false, the scraper skips this source on scheduled runs.
  -- Maps to entity field: is_active
  is_active boolean default true,

  -- When this source was last checked for new jobs.
  -- Used to schedule scraping intervals and show freshness in the UI.
  -- Maps to entity field: last_fetched
  last_fetched_at timestamptz,

  -- Running count of how many jobs have been imported from this source.
  -- Updated by the scraping pipeline after each successful fetch.
  -- Maps to entity field: jobs_found
  jobs_found integer default 0,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.job_sources enable row level security;

create policy "Users can manage own sources"
  on public.job_sources for all
  using (auth.uid() = user_id);

create trigger update_job_sources_updated_at
  before update on public.job_sources
  for each row execute function public.update_updated_at();


-- ============================================================================
-- TABLE: jobs
-- ============================================================================
-- Maps to entity: Job
-- Individual job postings, either scraped from sources or manually added.
-- This is the central table - most other tables reference it.
--
-- Entity fields mapped:
--   source_id            -> source_id (uuid FK to job_sources)
--   external_id          -> external_id (text)
--   title                -> title (text, not null)
--   company              -> company (text, not null)
--   location             -> location (text)
--   remote_type          -> remote_type (text) -- 'remote'/'hybrid'/'onsite'/'unknown'
--   url                  -> url (text, not null)
--   apply_url            -> apply_url (text)
--   description_raw      -> description_raw (text)
--   description_clean    -> description_clean (text)
--   required_skills      -> required_skills (text[])
--   preferred_skills     -> preferred_skills (text[])
--   years_experience     -> years_experience (text)
--   education_requirement -> education_requirement (text)
--   internship_dates     -> internship_dates (text)
--   salary_range         -> salary_range (text)
--   visa_sponsorship     -> visa_sponsorship (text) -- 'yes'/'no'/'unknown'
--   visa_keywords_found  -> visa_keywords_found (text[])
--   ats_type             -> ats_type (text)
--   posted_date          -> posted_date (date)
--   last_seen            -> last_seen (timestamptz)
--   is_active            -> is_active (boolean, default true)
--
-- DEDUPLICATION: The UNIQUE constraint on (user_id, source_id, external_id)
-- prevents the same job from being imported twice from the same source.
-- NULL external_ids are treated as distinct by PostgreSQL, so manually
-- added jobs (null external_id) won't conflict.

create table public.jobs (
  id uuid default gen_random_uuid() primary key,

  user_id uuid references auth.users on delete cascade not null,

  -- Reference to the source this job came from.
  -- SET NULL on delete: preserve job data even if the source is removed.
  -- Maps to entity field: source_id
  source_id uuid references public.job_sources(id) on delete set null,

  -- The job's ID on the source platform, used for deduplication.
  -- Example: Greenhouse job ID '4567890', Lever posting slug 'swe-intern-2025'
  -- NULL for manually added jobs.
  -- Maps to entity field: external_id
  external_id text,

  -- Core job information (required fields from entity schema)
  -- Maps to entity field: title
  title text not null,

  -- Maps to entity field: company
  company text not null,

  -- Maps to entity field: location
  location text,

  -- Work arrangement classification.
  -- Values from entity enum: 'remote', 'hybrid', 'onsite', 'unknown'
  -- Defaults to 'unknown' because many job postings don't specify this clearly.
  -- Maps to entity field: remote_type
  remote_type text default 'unknown',

  -- Job listing URL (the page where the job description is displayed).
  -- Required field from entity schema.
  -- Maps to entity field: url
  url text not null,

  -- Direct application URL. May differ from listing URL if the company
  -- uses a separate ATS portal for applications.
  -- Maps to entity field: apply_url
  apply_url text,

  -- Raw job description as scraped from the source. Preserved for
  -- re-processing if cleaning/parsing logic improves.
  -- Maps to entity field: description_raw
  description_raw text,

  -- Cleaned/normalized description text with HTML tags stripped, whitespace
  -- normalized, and boilerplate removed. Used for display and AI analysis.
  -- Maps to entity field: description_clean
  description_clean text,

  -- Skills explicitly listed as required in the job posting.
  -- Extracted by AI parsing of the description.
  -- Example: ['Python', 'SQL', 'REST APIs', 'Git']
  -- Maps to entity field: required_skills
  required_skills text[] default '{}',

  -- Skills listed as "nice to have" or "preferred" in the posting.
  -- Example: ['Kubernetes', 'GraphQL', 'TypeScript']
  -- Maps to entity field: preferred_skills
  preferred_skills text[] default '{}',

  -- Experience requirement as stated in the posting.
  -- Stored as text because formats vary: '0-2 years', 'Entry level', etc.
  -- Maps to entity field: years_experience
  years_experience text,

  -- Education requirement as stated in the posting.
  -- Example: 'Currently pursuing BS in Computer Science or related field'
  -- Maps to entity field: education_requirement
  education_requirement text,

  -- When the internship runs, if specified.
  -- Example: 'Summer 2026 (June-August)', 'Spring 2026', 'Year-round'
  -- Maps to entity field: internship_dates
  internship_dates text,

  -- Compensation information as stated in the posting.
  -- Stored as text to handle varied formats: '$25-35/hr', '$60k-80k/yr', etc.
  -- Maps to entity field: salary_range
  salary_range text,

  -- Whether the company offers visa sponsorship for this position.
  -- Values from entity enum: 'yes', 'no', 'unknown'
  -- Critical for international students filtering jobs.
  -- Maps to entity field: visa_sponsorship
  visa_sponsorship text default 'unknown',

  -- Specific keywords found in the posting related to visa/work authorization.
  -- Used to justify the visa_sponsorship classification.
  -- Example: ['H-1B', 'OPT', 'CPT', 'work authorization required']
  -- Maps to entity field: visa_keywords_found
  visa_keywords_found text[] default '{}',

  -- The Applicant Tracking System used by this company.
  -- Helps determine the best application strategy and form-filling approach.
  -- Example: 'greenhouse', 'lever', 'workday', 'icims', 'taleo'
  -- Maps to entity field: ats_type
  ats_type text,

  -- When the job was originally posted on the source platform.
  -- Different from created_at (when we imported it into our database).
  -- Maps to entity field: posted_date
  posted_date date,

  -- Last time this job was seen as active on the source during a scrape.
  -- If last_seen is significantly older than the current date, the job
  -- may have been taken down.
  -- Maps to entity field: last_seen
  last_seen timestamptz,

  -- Whether this job listing is still active/open for applications.
  -- Set to false when the job is no longer found during scraping or
  -- when the posting has expired.
  -- Maps to entity field: is_active
  is_active boolean default true,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Prevent importing the same job twice from the same source for the same user.
  -- PostgreSQL treats NULLs as distinct in UNIQUE constraints, so manually
  -- added jobs (null external_id or null source_id) won't conflict.
  unique(user_id, source_id, external_id)
);

alter table public.jobs enable row level security;

create policy "Users can manage own jobs"
  on public.jobs for all
  using (auth.uid() = user_id);

create trigger update_jobs_updated_at
  before update on public.jobs
  for each row execute function public.update_updated_at();


-- ============================================================================
-- TABLE: job_matches
-- ============================================================================
-- Maps to entity: JobMatch
-- Stores AI-computed match scores between a job posting and the user's resume.
-- This is the core intelligence of the app.
--
-- Entity fields mapped:
--   job_id               -> job_id (uuid FK to jobs, not null)
--   score_total          -> score_total (integer, 0-100, not null)
--   score_breakdown      -> score_breakdown (jsonb) -- nested object
--   matching_skills      -> matching_skills (text[])
--   missing_skills       -> missing_skills (text[])
--   matching_bullets     -> matching_bullets (text[])
--   recommended_projects -> recommended_projects (text[])
--   why_match            -> why_match (text)
--   risk_flags           -> risk_flags (text[])
--
-- SCORING: score_total is a weighted composite (0-100). The score_breakdown
-- JSONB stores the individual dimension scores:
--   {
--     "skill_overlap": 85,        -- How many required skills match the resume
--     "semantic_similarity": 72,  -- Cosine similarity between embeddings
--     "project_relevance": 68,    -- How relevant the user's projects are
--     "risk_penalty": -10         -- Deduction for red flags (visa, experience)
--   }
--
-- UNIQUE CONSTRAINT: One match per job per user. When the user updates their
-- resume or the scoring algorithm changes, the existing match is replaced
-- via UPSERT (INSERT ... ON CONFLICT ... DO UPDATE).

create table public.job_matches (
  id uuid default gen_random_uuid() primary key,

  user_id uuid references auth.users on delete cascade not null,

  -- The job being scored. CASCADE delete removes match data when the job
  -- is deleted (scores are meaningless without the job).
  -- Maps to entity field: job_id
  job_id uuid references public.jobs(id) on delete cascade not null,

  -- Composite match score from 0 to 100.
  -- 90-100: Excellent match, definitely apply
  -- 70-89:  Good match, worth reviewing
  -- 50-69:  Moderate match, may need to address gaps
  -- 0-49:   Poor match, likely not a fit
  -- Maps to entity field: score_total
  score_total integer not null check (score_total >= 0 and score_total <= 100),

  -- Breakdown of how the score was computed, stored as JSONB because it is
  -- a nested object with multiple numeric sub-scores.
  -- Expected structure:
  -- {
  --   "skill_overlap": 85,
  --   "semantic_similarity": 72,
  --   "project_relevance": 68,
  --   "risk_penalty": -10
  -- }
  -- Maps to entity field: score_breakdown
  score_breakdown jsonb default '{}'::jsonb,

  -- Skills that appear in both the resume and the job requirements.
  -- Displayed as "Your matching qualifications" in the UI.
  -- Example: ['Python', 'React', 'SQL', 'REST APIs']
  -- Maps to entity field: matching_skills
  matching_skills text[] default '{}',

  -- Skills mentioned in the job that are NOT on the resume.
  -- Displayed as "Skills to develop" or "Address in cover letter".
  -- Example: ['Kubernetes', 'Terraform', 'GraphQL']
  -- Maps to entity field: missing_skills
  missing_skills text[] default '{}',

  -- Resume experience bullets that are most relevant to this job.
  -- Used to suggest which bullets to emphasize in a tailored resume.
  -- Example: ['Built REST API serving 10k requests/day', 'Deployed ML model to production']
  -- Maps to entity field: matching_bullets
  matching_bullets text[] default '{}',

  -- Projects from the resume to highlight for this specific job.
  -- Example: ['Internship Hunter', 'Real-time Chat App']
  -- Maps to entity field: recommended_projects
  recommended_projects text[] default '{}',

  -- AI-generated natural language explanation of the match.
  -- Example: "Strong match! Your Python and React experience aligns well
  -- with this role. Your API development project is directly relevant.
  -- Gap: The job mentions Kubernetes, which isn't on your resume."
  -- Maps to entity field: why_match
  why_match text,

  -- Red flags identified during scoring that may affect the application.
  -- Example: ['Requires 3+ years experience', 'US citizenship required', 'Senior-level role']
  -- Maps to entity field: risk_flags
  risk_flags text[] default '{}',

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- One match score per job per user. The application uses UPSERT to replace
  -- the old match when re-scoring occurs.
  unique(user_id, job_id)
);

alter table public.job_matches enable row level security;

create policy "Users can manage own matches"
  on public.job_matches for all
  using (auth.uid() = user_id);

create trigger update_job_matches_updated_at
  before update on public.job_matches
  for each row execute function public.update_updated_at();


-- ============================================================================
-- TABLE: applications
-- ============================================================================
-- Maps to entity: Application
-- Tracks the user's application pipeline from saving a job through to
-- offer/rejection. This is the Kanban board data model.
--
-- Entity fields mapped:
--   job_id           -> job_id (uuid FK to jobs, not null)
--   status           -> status (text) -- enum: saved/applying/applied/interview/offer/rejected
--   applied_date     -> applied_date (date)
--   followup_date    -> followup_date (date)
--   notes            -> notes (text)
--   interview_dates  -> interview_dates (jsonb) -- array of {date, type, notes}
--   timeline         -> timeline (jsonb)        -- array of {date, action, details}
--
-- STATUS FLOW:
--   saved -> applying -> applied -> interview -> offer
--                                            \-> rejected
--
-- JSONB for interview_dates and timeline:
--   Both are arrays of objects with heterogeneous fields (date + type + notes
--   for interviews, date + action + details for timeline events). JSONB
--   handles this naturally without needing separate join tables.

create table public.applications (
  id uuid default gen_random_uuid() primary key,

  user_id uuid references auth.users on delete cascade not null,

  -- The job this application is for. CASCADE delete removes the application
  -- if the job posting is deleted (no orphaned applications).
  -- Maps to entity field: job_id
  job_id uuid references public.jobs(id) on delete cascade not null,

  -- Current status in the application pipeline.
  -- Values from entity enum: 'saved', 'applying', 'applied', 'interview', 'offer', 'rejected'
  -- Default 'saved' means the user has bookmarked the job but not started applying.
  -- Maps to entity field: status
  status text default 'saved',

  -- When the application was actually submitted (not when the row was created).
  -- NULL until status transitions to 'applied' or later.
  -- Maps to entity field: applied_date
  applied_date date,

  -- Reminder date for following up on the application.
  -- The app shows notifications when this date arrives.
  -- Maps to entity field: followup_date
  followup_date date,

  -- Free-text notes the user attaches to track application details.
  -- Example: "Submitted via company portal. Referral from John. Recruiter: jane@company.com"
  -- Maps to entity field: notes
  notes text,

  -- Scheduled interviews stored as JSONB because each interview is a
  -- nested object with date, type, and notes fields.
  -- Expected structure:
  -- [
  --   {
  --     "date": "2026-03-15T14:00:00Z",
  --     "type": "phone_screen",
  --     "notes": "30 min with HR recruiter"
  --   },
  --   {
  --     "date": "2026-03-22T10:00:00Z",
  --     "type": "technical",
  --     "notes": "1 hour coding interview, expect LeetCode medium"
  --   }
  -- ]
  -- Maps to entity field: interview_dates
  interview_dates jsonb default '[]'::jsonb,

  -- Chronological log of all events in this application's lifecycle.
  -- Stored as JSONB array of objects for the same reason as interview_dates.
  -- Expected structure:
  -- [
  --   { "date": "2026-03-01T00:00:00Z", "action": "saved", "details": "Found on Greenhouse" },
  --   { "date": "2026-03-05T00:00:00Z", "action": "applied", "details": "Submitted resume + cover letter" },
  --   { "date": "2026-03-10T00:00:00Z", "action": "interview_scheduled", "details": "Phone screen with HR" }
  -- ]
  -- Maps to entity field: timeline
  timeline jsonb default '[]'::jsonb,

  -- Details about a received offer, stored as JSONB for flexibility.
  -- Expected structure:
  -- {
  --   "salary": 85000,
  --   "salary_period": "yearly",
  --   "signing_bonus": 5000,
  --   "start_date": "2026-06-01",
  --   "deadline": "2026-04-15",
  --   "benefits": ["health", "401k", "remote"],
  --   "notes": "Negotiable on start date"
  -- }
  -- This field is populated only when status = 'offer'.
  offer_details jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- A user can only have one application per job.
  -- Enforces data integrity: no duplicate pipeline entries for the same job.
  unique(user_id, job_id)
);

alter table public.applications enable row level security;

create policy "Users can manage own applications"
  on public.applications for all
  using (auth.uid() = user_id);

create trigger update_applications_updated_at
  before update on public.applications
  for each row execute function public.update_updated_at();


-- ============================================================================
-- TABLE: generated_documents
-- ============================================================================
-- Maps to entity: GeneratedDocument
-- Stores AI-generated documents: cover letters, application answers, and
-- resume variants with bullet point tweaks.
--
-- Entity fields mapped:
--   job_id        -> job_id (uuid FK to jobs)
--   type          -> doc_type (text) -- 'cover_letter'/'answers'/'resume_variant'
--   content       -> content (text)
--   file_url      -> file_url (text)
--   answers       -> answers (jsonb)       -- array of {question, answer}
--   bullet_tweaks -> bullet_tweaks (jsonb) -- array of {original, suggested, reason}
--
-- WHY STORE GENERATED CONTENT?
-- 1. Avoid re-generating (saves API costs and latency)
-- 2. User can edit and refine generated content
-- 3. Audit trail of what was generated for each application
-- 4. Content persists even if the generation API changes
--
-- JSONB for answers and bullet_tweaks:
--   Both are arrays of objects with specific fields. answers contains
--   {question, answer} pairs for application questions. bullet_tweaks
--   contains {original, suggested, reason} for resume optimization.
--   These don't fit cleanly into text[] because each element has
--   multiple named fields.

create table public.generated_documents (
  id uuid default gen_random_uuid() primary key,

  user_id uuid references auth.users on delete cascade not null,

  -- Link to the job this document was generated for.
  -- SET NULL on delete: preserve the generated document even if the job
  -- posting is removed. Users may want to keep a well-written cover letter
  -- as a template for future applications.
  -- Maps to entity field: job_id
  job_id uuid references public.jobs(id) on delete set null,

  -- The type of document generated.
  -- Values from entity enum: 'cover_letter', 'answers', 'resume_variant'
  --   cover_letter   - Tailored cover letter for the specific job
  --   answers        - Prepared answers for application/interview questions
  --   resume_variant - Suggested resume bullet tweaks for the job
  -- Maps to entity field: type
  doc_type text not null,

  -- The main text content of the generated document.
  -- For cover_letter: the full letter text
  -- For answers: may contain a summary or overview (detail in answers jsonb)
  -- For resume_variant: may contain a summary (detail in bullet_tweaks jsonb)
  -- Maps to entity field: content
  content text,

  -- URL to a generated file (e.g., PDF of cover letter) in Supabase Storage.
  -- NULL if no file has been exported yet.
  -- Maps to entity field: file_url
  file_url text,

  -- For doc_type = 'answers': structured Q&A pairs stored as JSONB.
  -- Expected structure:
  -- [
  --   {
  --     "question": "Why do you want to work at [Company]?",
  --     "answer": "I am drawn to [Company]'s focus on..."
  --   },
  --   {
  --     "question": "Describe a challenging project you've worked on.",
  --     "answer": "During my internship at..."
  --   }
  -- ]
  -- Maps to entity field: answers
  answers jsonb default '[]'::jsonb,

  -- For doc_type = 'resume_variant': suggested changes to resume bullets.
  -- Each tweak explains what to change and why it's better for this job.
  -- Expected structure:
  -- [
  --   {
  --     "original": "Built REST API for data processing",
  --     "suggested": "Architected REST API handling 10K req/sec using Python FastAPI and PostgreSQL",
  --     "reason": "Quantifies impact and matches job's requirement for Python and API experience"
  --   }
  -- ]
  -- Maps to entity field: bullet_tweaks
  bullet_tweaks jsonb default '[]'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.generated_documents enable row level security;

create policy "Users can manage own documents"
  on public.generated_documents for all
  using (auth.uid() = user_id);

create trigger update_generated_documents_updated_at
  before update on public.generated_documents
  for each row execute function public.update_updated_at();


-- ============================================================================
-- INDEXES
-- ============================================================================
-- Indexes speed up common query patterns. Without them, PostgreSQL performs
-- sequential scans on every query. We index columns that appear frequently
-- in WHERE clauses, ORDER BY, and JOIN conditions.
--
-- NAMING CONVENTION: idx_{table}_{columns}
--
-- Every table is already indexed on its primary key (id) automatically.
-- user_id appears in WHERE clauses on every query due to RLS, so it gets
-- an index on every table.

-- Profiles: Looked up by id (primary key, already indexed).
-- No additional index needed.

-- Resumes: Filtered by user_id on every query.
create index idx_resumes_user_id
  on public.resumes(user_id);

-- User Preferences: Looked up by user_id (already has UNIQUE constraint
-- which creates an implicit unique index). No additional index needed.

-- Job Sources: Filtered by user_id and is_active for showing active sources.
create index idx_job_sources_user_active
  on public.job_sources(user_id, is_active);

-- Jobs: The most heavily queried table. Multiple index strategies:

-- Primary filter: every jobs query includes user_id via RLS.
create index idx_jobs_user_id
  on public.jobs(user_id);

-- Active jobs filter: dashboard and job list pages filter is_active = true.
create index idx_jobs_user_active
  on public.jobs(user_id, is_active)
  where is_active = true;

-- Company search: users frequently filter/search by company name.
create index idx_jobs_user_company
  on public.jobs(user_id, company);

-- Remote type filter: users filter by remote/hybrid/onsite preference.
create index idx_jobs_user_remote_type
  on public.jobs(user_id, remote_type);

-- Deduplication lookup: used during scraping to check if job already exists.
-- (The UNIQUE constraint on user_id, source_id, external_id already creates
-- an implicit index, but we add this for clarity.)

-- Posted date sorting: users want to see newest jobs first.
create index idx_jobs_user_posted_date
  on public.jobs(user_id, posted_date desc nulls last);

-- Job Matches: Sorted by score to show best matches first.
create index idx_job_matches_user_score
  on public.job_matches(user_id, score_total desc);

-- Job Matches: Lookup by job_id for displaying match on job detail page.
create index idx_job_matches_job_id
  on public.job_matches(job_id);

-- Applications: Grouped by status for the Kanban pipeline view.
create index idx_applications_user_status
  on public.applications(user_id, status);

-- Applications: Lookup by job_id for checking if user already has an application.
create index idx_applications_job_id
  on public.applications(job_id);

-- Applications: Followup date for reminder notifications.
-- Partial index: only rows where followup_date is set need to be scanned.
create index idx_applications_followup
  on public.applications(user_id, followup_date)
  where followup_date is not null;

-- Generated Documents: Filtered by user_id and doc_type for listing.
create index idx_generated_docs_user_type
  on public.generated_documents(user_id, doc_type);

-- Generated Documents: Lookup by job_id for showing docs on job detail page.
create index idx_generated_docs_job_id
  on public.generated_documents(job_id);


-- ============================================================================
-- SUMMARY
-- ============================================================================
--
-- Tables created (8):
--   1. profiles            - User display info, auto-created on signup
--   2. resumes             - Uploaded resumes with parsed skills and projects
--   3. user_preferences    - Job search filters (one per user)
--   4. job_sources         - Where to find jobs (Greenhouse, Lever, etc.)
--   5. jobs                - Individual job postings
--   6. job_matches         - AI match scores (one per job per user)
--   7. applications        - Application pipeline tracking (one per job per user)
--   8. generated_documents - AI-generated cover letters, answers, resume variants
--
-- Security:
--   - RLS enabled on all 8 tables
--   - Every table has a policy restricting access to auth.uid() = user_id
--   - Profiles use auth.uid() = id (since id IS the user_id)
--   - Profile creation bypasses RLS via SECURITY DEFINER trigger
--
-- Triggers:
--   - on_auth_user_created: auto-creates profile row on signup
--   - update_*_updated_at: auto-sets updated_at on every table
--
-- Indexes: 14 indexes covering all common query patterns
--
-- Extensions: pgvector enabled for future embedding columns
--
-- ============================================================================
