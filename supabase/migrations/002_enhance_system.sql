-- =====================================================
-- ENHANCED SCHEMA MIGRATION
-- Job Hunter - Next Level System
-- =====================================================

-- 1. Add missing columns to profiles for resume management
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS resume_text text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS resume_file_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS resume_updated_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS target_roles text[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS certifications jsonb DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS career_goals text;

-- 2. Add skills_embedding for vector similarity (requires pgvector extension)
-- First enable pgvector if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS skills_embedding vector(1536);

-- 3. Enhance jobs table with better matching and categorization
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS match_category text CHECK (match_category IN ('top_pick', 'good_match', 'slight_match', 'poor_match'));
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS match_reasoning text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS salary_min integer;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS salary_max integer;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS work_type text CHECK (work_type IN ('remote', 'hybrid', 'on_site', 'unknown'));

-- 4. Create chat_history table for AI memory
CREATE TABLE IF NOT EXISTS chat_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  context_type text NOT NULL CHECK (context_type IN ('general', 'job', 'resume_tailor')),
  job_id uuid REFERENCES jobs ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Index for fast retrieval
CREATE INDEX IF NOT EXISTS idx_chat_history_user_created ON chat_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_history_context ON chat_history(user_id, context_type, created_at DESC);

-- RLS for chat_history
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

-- 5. Create generated_docs table for tailored resumes/cover letters
CREATE TABLE IF NOT EXISTS generated_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  job_id uuid REFERENCES jobs ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('cover_letter', 'resume_tailored', 'linkedin_message')),
  content text NOT NULL,
  version integer DEFAULT 1,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for fast retrieval
CREATE INDEX IF NOT EXISTS idx_generated_docs_user_job ON generated_docs(user_id, job_id, type);
CREATE INDEX IF NOT EXISTS idx_generated_docs_created ON generated_docs(user_id, created_at DESC);

-- RLS for generated_docs
ALTER TABLE generated_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own generated docs"
  ON generated_docs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generated docs"
  ON generated_docs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own generated docs"
  ON generated_docs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own generated docs"
  ON generated_docs FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_generated_docs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_generated_docs_updated_at
  BEFORE UPDATE ON generated_docs
  FOR EACH ROW
  EXECUTE FUNCTION update_generated_docs_updated_at();

-- 6. Create user_memory table for Career Coach to remember user preferences
CREATE TABLE IF NOT EXISTS user_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL UNIQUE,
  career_goals text,
  preferred_locations text[] DEFAULT '{}',
  preferred_work_types text[] DEFAULT '{}',
  target_salary_min integer,
  target_salary_max integer,
  certifications jsonb DEFAULT '[]',
  projects jsonb DEFAULT '[]',
  learning_interests text[] DEFAULT '{}',
  job_search_status text CHECK (job_search_status IN ('active', 'passive', 'not_looking')),
  availability_date date,
  notes text,
  updated_at timestamptz DEFAULT now()
);

-- RLS for user_memory
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

-- Trigger for updated_at
CREATE TRIGGER trigger_update_user_memory_updated_at
  BEFORE UPDATE ON user_memory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 7. Add locations reference table for multi-select
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('city', 'state', 'country')),
  name text NOT NULL,
  state_code text,
  country_code text DEFAULT 'US',
  display_name text,
  UNIQUE(type, name, state_code)
);

-- Populate with common US locations
INSERT INTO locations (type, name, state_code, display_name) VALUES
  -- States
  ('state', 'California', 'CA', 'California'),
  ('state', 'Texas', 'TX', 'Texas'),
  ('state', 'New York', 'NY', 'New York'),
  ('state', 'Florida', 'FL', 'Florida'),
  ('state', 'Illinois', 'IL', 'Illinois'),
  ('state', 'Washington', 'WA', 'Washington'),
  ('state', 'Massachusetts', 'MA', 'Massachusetts'),
  ('state', 'Colorado', 'CO', 'Colorado'),
  ('state', 'Georgia', 'GA', 'Georgia'),
  ('state', 'North Carolina', 'NC', 'North Carolina'),
  ('state', 'Virginia', 'VA', 'Virginia'),
  ('state', 'Oregon', 'OR', 'Oregon'),
  ('state', 'Pennsylvania', 'PA', 'Pennsylvania'),
  ('state', 'Ohio', 'OH', 'Ohio'),
  ('state', 'Michigan', 'MI', 'Michigan'),
  
  -- Major Cities
  ('city', 'San Francisco', 'CA', 'San Francisco, CA'),
  ('city', 'Los Angeles', 'CA', 'Los Angeles, CA'),
  ('city', 'San Diego', 'CA', 'San Diego, CA'),
  ('city', 'Austin', 'TX', 'Austin, TX'),
  ('city', 'Dallas', 'TX', 'Dallas, TX'),
  ('city', 'Houston', 'TX', 'Houston, TX'),
  ('city', 'New York', 'NY', 'New York, NY'),
  ('city', 'Boston', 'MA', 'Boston, MA'),
  ('city', 'Seattle', 'WA', 'Seattle, WA'),
  ('city', 'Chicago', 'IL', 'Chicago, IL'),
  ('city', 'Denver', 'CO', 'Denver, CO'),
  ('city', 'Atlanta', 'GA', 'Atlanta, GA'),
  ('city', 'Miami', 'FL', 'Miami, FL'),
  ('city', 'Portland', 'OR', 'Portland, OR'),
  ('city', 'Phoenix', 'AZ', 'Phoenix, AZ'),
  ('city', 'Raleigh', 'NC', 'Raleigh, NC'),
  ('city', 'Charlotte', 'NC', 'Charlotte, NC'),
  ('city', 'Philadelphia', 'PA', 'Philadelphia, PA')
ON CONFLICT (type, name, state_code) DO NOTHING;

-- Make locations public (read-only)
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view locations"
  ON locations FOR SELECT
  USING (true);

-- 8. Create job_categories for intelligent grouping
CREATE TABLE IF NOT EXISTS job_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  color text DEFAULT '#3b82f6',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE job_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own categories"
  ON job_categories FOR ALL
  USING (auth.uid() = user_id);

-- 9. Add helper function to calculate match category
CREATE OR REPLACE FUNCTION calculate_match_category(score integer)
RETURNS text AS $$
BEGIN
  IF score >= 80 THEN
    RETURN 'top_pick';
  ELSIF score >= 60 THEN
    RETURN 'good_match';
  ELSIF score >= 40 THEN
    RETURN 'slight_match';
  ELSE
    RETURN 'poor_match';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 10. Update existing jobs to set match_category based on match_score
UPDATE jobs 
SET match_category = calculate_match_category(COALESCE(match_score, 0))
WHERE match_category IS NULL;

-- 11. Add trigger to auto-update match_category when match_score changes
CREATE OR REPLACE FUNCTION update_job_match_category()
RETURNS TRIGGER AS $$
BEGIN
  NEW.match_category = calculate_match_category(COALESCE(NEW.match_score, 0));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_job_match_category
  BEFORE INSERT OR UPDATE OF match_score ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_job_match_category();

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Verify tables exist
DO $$
BEGIN
  RAISE NOTICE 'Migration complete. Tables created:';
  RAISE NOTICE '  - chat_history';
  RAISE NOTICE '  - generated_docs';
  RAISE NOTICE '  - user_memory';
  RAISE NOTICE '  - locations';
  RAISE NOTICE '  - job_categories';
  RAISE NOTICE 'Enhanced tables:';
  RAISE NOTICE '  - profiles (resume management, embeddings)';
  RAISE NOTICE '  - jobs (categorization, work_type)';
END $$;

