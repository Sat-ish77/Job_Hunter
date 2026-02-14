# 🗄️ Database Migration Instructions

## Step 1: Run the SQL Migration

Copy and paste the entire contents of `supabase/migrations/add_tavily_support.sql` into your Supabase SQL Editor and run it.

**What it does:**
1. ✅ Adds UNIQUE constraint on `(user_id, url)` for deduplication
2. ✅ Adds `posted_at` column (timestamptz) 
3. ✅ Adds `job_source` column (text)
4. ✅ Creates `notifications` table with RLS policies
5. ✅ Adds indexes for performance

**Important**: Run this AFTER you've run the main `supabase/schema.sql` file.

---

## Step 2: Verify the Migration

After running the SQL, verify the changes:

```sql
-- Check if unique constraint exists
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'public.jobs'::regclass 
AND conname = 'jobs_user_url_unique';

-- Check if columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'jobs' 
AND column_name IN ('posted_at', 'job_source');

-- Check if notifications table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'notifications';
```

---

## Step 3: Deploy Edge Functions

```bash
# Set secrets
supabase secrets set TAVILY_API_KEY=your-tavily-key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Deploy
supabase functions deploy fetch-jobs --no-verify-jwt
supabase functions deploy invoke-llm --no-verify-jwt
supabase functions deploy extract-resume --no-verify-jwt
```

---

## ✅ All Set!

Your database is now ready for the Tavily integration. The `fetch-jobs` Edge Function will be able to upsert jobs without duplicates.

