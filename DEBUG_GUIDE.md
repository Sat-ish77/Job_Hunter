# Debug Guide — Job Hunter

## Common Issues & Where to Fix Them

### Auth Issues

**Symptom**: App shows login page even when logged in
- Check `src/lib/AuthContext.jsx` — `getSession()` failing?
- Check browser DevTools → Application → Local Storage → `sb-*` keys present?
- Check `src/App.jsx` — root `/` route waits for `loading` before redirecting

**Symptom**: App skips login, goes straight to dashboard
- Check `src/App.jsx` ProtectedRoute — is `loading` from `useAuth()` being respected?
- Check `src/lib/AuthContext.jsx` — is `setLoading(false)` called correctly?

**Symptom**: Stuck in onboarding loop
- Check `profiles.onboarding_completed` in Supabase dashboard for the user
- Check `src/App.jsx` ProtectedRoute — `checkOnboardingStatus()` queries profiles table
- Run in Supabase SQL editor: `SELECT id, onboarding_completed FROM profiles WHERE id = '<user-id>'`

### Resume Issues

**Symptom**: Resume not saving
- Check RLS policy: `auth.uid() = user_id` on `resumes` table
- Check field name: must use `raw_text` (NOT `resume_text`)
- Check `src/components/dashboard/ResumeManager.jsx` → `handleSave()`
- Check `src/components/onboarding/ResumeUpload.jsx` → `onComplete()` callback

**Symptom**: Unicode/null character error on resume save
- `sanitizeText()` in `src/utils/index.ts` removes `\u0000` before DB insert
- Applied in: ResumeUpload, ResumeManager, Settings resume save
- If error persists: check if Edge Function (extract-resume) returns null chars

**Symptom**: Resume upload fails
- Check Supabase Storage → `resumes` bucket exists and has proper policies
- Check `src/services/ai-service.js` → `uploadResume()` for Storage upload
- Check `src/services/ai-service.js` → `extractResumeFromPDF()` for Edge Function call
- Check `supabase/functions/extract-resume/index.ts` for server-side errors

### Job Search Issues

**Symptom**: Toast says "10 jobs found" but UI shows "No jobs found"
- Check `src/pages/Jobs.jsx` → `filteredJobs` useMemo
- Ensure `matches` query returned data (React Query DevTools)
- Check client-side filters: `minMatchScore`, `categoryFilter`, `remoteOnly`
- If filters are too strict, all jobs get filtered out → lower `minMatchScore` or set category to 'all'

**Symptom**: Supabase 400 error on job queries
- Ensure code uses `score_total` (NOT `overall_score` or `match_score`)
- `score_total` lives in `job_matches` table, NOT in `jobs` table
- Check `src/services/supabase-data.js` → `SORT_FIELD_MAP` has no stale mappings
- Check `src/pages/Jobs.jsx` → joins on `match.score_total`

**Symptom**: Location filter not working
- Check `src/pages/Jobs.jsx` → `selectedLocations` state + `locationString` construction
- Check `src/components/jobs/LocationFilter.jsx` → `onSelectionChange` callback
- Verify the fetch-jobs Edge Function receives `location` param

### AI / Document Generation Issues

**Symptom**: Cover letter generation fails
- Check `src/services/ai-service.js` → `generateCoverLetter()`
- Check `src/services/ai-prompts.js` → `buildCoverLetterPrompt()` uses `resume.raw_text`
- Check `supabase/functions/invoke-llm/index.ts` → OPENAI_API_KEY set?
- Check Supabase Dashboard → Edge Functions → invoke-llm logs

**Symptom**: Documents not saving
- Check `src/pages/JobDetail.jsx` → `handleSaveCoverLetter()`, `handleSaveAnswers()`, `handleSaveBulletTweaks()`
- Field must be `doc_type` (NOT `type`) in generated_documents table
- Check RLS policy on `generated_documents` table

**Symptom**: Chat widget not responding
- Check `src/components/ChatWidget.jsx` → `handleSend()`
- Check `supabase/functions/career-coach/index.ts` → OPENAI_API_KEY set?
- Check Edge Function logs in Supabase dashboard

**Symptom**: Chat history not loading
- Check `chat_history` table exists (created by migration 002)
- Check RLS policies on `chat_history` table
- Check `src/components/ChatWidget.jsx` → `loadHistory` useEffect (runs when `isOpen` becomes true)

### Onboarding Issues

**Symptom**: "Complete Setup" doesn't redirect to dashboard
- Check `src/pages/Onboarding.jsx` → `completeOnboarding()`
- Must: update `profiles.onboarding_completed = true` FIRST
- Then save resume, sources, preferences
- Then navigate to `/dashboard`
- Fallback: `window.location.href = '/dashboard'` after 500ms

**Symptom**: Job sources not saving with correct type
- SourcesManager uses `type` internally → Onboarding maps to `source_type` for DB
- Check `src/pages/Onboarding.jsx` line: `source_type: s.type`
- Settings reads from DB as `source.source_type`

### Pipeline (Kanban) Issues

**Symptom**: Drag and drop not working
- Check `src/pages/Pipeline.jsx` → uses `@hello-pangea/dnd`
- Check `ApplicationCard.jsx` uses `match.score_total` for ScoreRing

### Performance Issues

**Symptom**: Page keeps re-rendering
- Check for useEffect dependency arrays — all effects in this codebase have proper deps
- Check React Query `staleTime` and `refetchOnWindowFocus` in `src/lib/query-client.js`
- React Query DevTools can show if queries are refetching too often

**Symptom**: Slow initial load
- Pages are lazy-loaded via `React.lazy()` in `pages.config.js`
- Check if Supabase queries are blocking render (show Skeleton while loading)

## Key Field Name Reference

| What the code should use | Table | DO NOT USE |
|--------------------------|-------|------------|
| `raw_text` | resumes | ~~resume_text~~ |
| `score_total` | job_matches | ~~overall_score~~, ~~match_score~~ |
| `doc_type` | generated_documents | ~~type~~ |
| `source_type` | job_sources | ~~type~~ (in DB context) |
| `onboarding_completed` | profiles | NOT in user_preferences |

## Quick SQL Checks (run in Supabase SQL Editor)

```sql
-- Check if user has completed onboarding
SELECT id, full_name, onboarding_completed FROM profiles WHERE id = '<user-id>';

-- Check user's resume
SELECT id, raw_text IS NOT NULL as has_text, file_url, target_roles FROM resumes WHERE user_id = '<user-id>';

-- Check job matches with scores
SELECT j.title, j.company, m.score_total
FROM job_matches m JOIN jobs j ON j.id = m.job_id
WHERE m.resume_id IN (SELECT id FROM resumes WHERE user_id = '<user-id>')
ORDER BY m.score_total DESC LIMIT 10;

-- Check generated documents
SELECT job_id, doc_type, length(content) as content_length, created_at
FROM generated_documents WHERE user_id = '<user-id>';

-- Check chat history
SELECT role, left(content, 50), context_type, created_at
FROM chat_history WHERE user_id = '<user-id>'
ORDER BY created_at DESC LIMIT 10;
```

