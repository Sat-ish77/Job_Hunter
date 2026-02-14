-- ============================================================================
-- MIGRATION: Add Tavily Integration Support
-- ============================================================================
-- This migration adds columns and constraints needed for the Tavily job search
-- integration and future notification features.
--
-- Run this in Supabase SQL Editor after the main schema.sql
-- ============================================================================

-- Add unique constraint on (user_id, url) for deduplication
-- This allows upsert operations to work properly with the fetch-jobs Edge Function
-- Same URL can exist for different users, but not twice for the same user
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'jobs_user_url_unique' 
    AND conrelid = 'public.jobs'::regclass
  ) THEN
    ALTER TABLE public.jobs 
    ADD CONSTRAINT jobs_user_url_unique UNIQUE (user_id, url);
  END IF;
END $$;

-- Add posted_at column (timestamptz) if it doesn't exist
-- This is more precise than posted_date for tracking when jobs were posted
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'jobs' 
    AND column_name = 'posted_at'
  ) THEN
    ALTER TABLE public.jobs 
    ADD COLUMN posted_at timestamptz;
    
    -- Migrate existing posted_date values to posted_at
    UPDATE public.jobs 
    SET posted_at = posted_date::timestamptz 
    WHERE posted_date IS NOT NULL AND posted_at IS NULL;
  END IF;
END $$;

-- Add job_source column (text) if it doesn't exist
-- Stores the source name as text (e.g., 'Tavily', 'Greenhouse', 'Lever')
-- This is in addition to source_id which is a foreign key
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'jobs' 
    AND column_name = 'job_source'
  ) THEN
    ALTER TABLE public.jobs 
    ADD COLUMN job_source text;
    
    -- Populate job_source from job_sources table if source_id exists
    UPDATE public.jobs j
    SET job_source = js.name
    FROM public.job_sources js
    WHERE j.source_id = js.id 
    AND j.job_source IS NULL;
  END IF;
END $$;

-- Create index on url for faster lookups during upsert
CREATE INDEX IF NOT EXISTS idx_jobs_url ON public.jobs(url);
CREATE INDEX IF NOT EXISTS idx_jobs_user_url ON public.jobs(user_id, url);

-- Create index on posted_at for date-based queries
CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON public.jobs(posted_at DESC NULLS LAST);

-- ============================================================================
-- TABLE: notifications
-- ============================================================================
-- Stores user notifications for job alerts, match updates, etc.
-- Used for the future Job Watcher feature.

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid default gen_random_uuid() primary key,
  
  -- User who receives this notification
  user_id uuid references auth.users on delete cascade not null,
  
  -- Notification message/content
  message text not null,
  
  -- Notification title/heading
  title text,
  
  -- Type of notification (e.g., 'job_match', 'job_alert', 'application_update')
  type text default 'info',
  
  -- Whether the user has read this notification
  is_read boolean default false,
  
  -- Optional link/action URL
  action_url text,
  
  -- Optional metadata (JSON)
  metadata jsonb default '{}',
  
  created_at timestamptz default now(),
  read_at timestamptz
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policy: System can insert notifications (via service role)
-- Note: In production, you might want to restrict this to service role only
CREATE POLICY "Users can receive notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- Function to automatically set read_at when is_read is set to true
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

-- Trigger to auto-set read_at
DROP TRIGGER IF EXISTS trigger_set_notification_read_at ON public.notifications;
CREATE TRIGGER trigger_set_notification_read_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_notification_read_at();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary of changes:
-- 1. Added UNIQUE constraint on (user_id, url) for deduplication
-- 2. Added jobs.posted_at column (timestamptz)
-- 3. Added jobs.job_source column (text)
-- 4. Created notifications table with RLS policies
-- 5. Added indexes for performance
-- ============================================================================

