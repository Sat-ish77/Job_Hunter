-- =====================================================
-- MIGRATION 002 — Enhanced System Tables
-- Job Hunter / Internship Hunter
-- =====================================================
--
-- WHAT THIS MIGRATION ADDS:
--   1. chat_history   — Persistent AI conversation memory
--   2. user_memory    — Career Coach remembers user goals/interests
--
-- WHAT WAS REMOVED FROM THE ORIGINAL (broken/redundant):
--   ❌ profiles.resume_text etc. — resume data lives in `resumes` table
--   ❌ jobs.match_category/match_score — scores live in `job_matches` table
--   ❌ generated_docs table — conflicts with `generated_documents` in base schema
--   ❌ locations table — frontend uses local constants (us-states.ts)
--   ❌ job_categories table — not used by frontend
--   ❌ match_score trigger on jobs — column doesn't exist, trigger would fail
--
-- PRE-REQUISITE: Run schema.sql first (creates base tables).
-- RUN THIS IN: Supabase SQL Editor → New Query → Paste → Run
-- =====================================================


-- =====================================================
-- 1. CHAT HISTORY — AI Conversation Memory
-- =====================================================
-- Stores all messages between the user and the AI Career Coach.
-- The career-coach Edge Function reads from here on each request
-- to maintain conversational context.
--
-- context_type determines WHICH conversation thread:
--   'general'       → Global floating chat widget (career advice)
--   'job'           → Job-specific analysis sidebar
--   'resume_tailor' → Resume tailoring conversations

CREATE TABLE IF NOT EXISTS chat_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,

  -- 'user' = what the human typed, 'assistant' = AI response, 'system' = system prompt
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),

  -- The actual message content
  content text NOT NULL,

  -- Which conversation thread this belongs to
  context_type text NOT NULL CHECK (context_type IN ('general', 'job', 'resume_tailor')),

  -- If context_type = 'job', this links to the specific job being discussed
  job_id uuid REFERENCES jobs ON DELETE SET NULL,

  -- Extra data (e.g., model used, token count)
  metadata jsonb DEFAULT '{}',

  created_at timestamptz DEFAULT now()
);

-- Fast retrieval: "give me last 10 messages for this user, newest first"
CREATE INDEX IF NOT EXISTS idx_chat_history_user_created
  ON chat_history(user_id, created_at DESC);

-- Fast retrieval: "give me general chat history" or "give me job chat history"
CREATE INDEX IF NOT EXISTS idx_chat_history_context
  ON chat_history(user_id, context_type, created_at DESC);

-- RLS: Users can only see/create/delete their own chat messages
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat history"
  ON chat_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat history"
  ON chat_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat history"
  ON chat_history FOR DELETE
  USING (auth.uid() = user_id);


-- =====================================================
-- 2. USER MEMORY — Career Coach Persistent Memory
-- =====================================================
-- The AI Career Coach uses this to "remember" the user across sessions.
-- One row per user (UNIQUE on user_id).
-- Updated when the user mentions goals, interests, preferences, etc.

CREATE TABLE IF NOT EXISTS user_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- One memory record per user
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL UNIQUE,

  -- Long-term career goals (e.g., "Become a senior ML engineer at a FAANG company")
  career_goals text,

  -- Where the user wants to work
  preferred_locations text[] DEFAULT '{}',

  -- Remote/hybrid/onsite preferences
  preferred_work_types text[] DEFAULT '{}',

  -- Salary expectations
  target_salary_min integer,
  target_salary_max integer,

  -- Certifications the user has or is pursuing
  -- e.g., [{"name": "AWS Solutions Architect", "status": "in_progress"}]
  certifications jsonb DEFAULT '[]',

  -- Notable projects (supplements resume data)
  projects jsonb DEFAULT '[]',

  -- Topics the user wants to learn about
  -- e.g., ['Kubernetes', 'System Design', 'LLM fine-tuning']
  learning_interests text[] DEFAULT '{}',

  -- Current job search status
  job_search_status text CHECK (job_search_status IN ('active', 'passive', 'not_looking')),

  -- When the user is available to start
  availability_date date,

  -- Free-form notes the AI extracts from conversations
  notes text,

  updated_at timestamptz DEFAULT now()
);

-- RLS: Users can only manage their own memory
ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own memory"
  ON user_memory FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memory"
  ON user_memory FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own memory"
  ON user_memory FOR UPDATE
  USING (auth.uid() = user_id);

-- Auto-update the updated_at timestamp (reuses the function from schema.sql)
CREATE TRIGGER trigger_update_user_memory_updated_at
  BEFORE UPDATE ON user_memory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();


-- =====================================================
-- MIGRATION 002 COMPLETE
-- =====================================================
-- Tables created:
--   ✅ chat_history  — AI conversation persistence
--   ✅ user_memory   — Career Coach long-term memory
--
-- What to run next:
--   → add_tavily_support.sql (adds job dedup constraint, notifications)
-- =====================================================
