# System Flow — Job Hunter

## Authentication Flow

```
Browser loads app
  └─ AuthProvider (src/lib/AuthContext.jsx)
       ├─ Calls supabase.auth.getSession()
       ├─ Sets loading=true until complete
       └─ Subscribes to onAuthStateChange

Route: "/"
  └─ App.jsx checks { user, loading }
       ├─ loading=true  → LoadingSpinner
       ├─ user exists   → Navigate to /dashboard
       └─ no user       → Navigate to /login

Route: "/login"
  └─ Login.jsx (public, no auth required)
       ├─ signIn(email, password)   → onAuthStateChange → user set → Navigate to "/"
       ├─ signUp(email, password)   → confirmation email
       └─ signInWithGoogle()        → OAuth redirect → callback → session set

Route: any protected route
  └─ ProtectedRoute (in App.jsx)
       ├─ loading=true         → LoadingSpinner
       ├─ no user              → Navigate to /login
       ├─ checkingOnboarding   → LoadingSpinner
       ├─ path=/onboarding AND onboarding_completed=true → Navigate to /dashboard
       ├─ onboarding_completed=false AND path≠/onboarding → Navigate to /onboarding
       └─ else                 → render children
```

## Onboarding Flow

```
/onboarding (Onboarding.jsx)
  Step 0: ResumeUpload
    ├─ Upload PDF → uploadResume() → Supabase Storage
    │   └─ extractResumeFromPDF() → extract-resume Edge Function → AI parsing
    └─ Paste text → parseResume() → invoke-llm Edge Function → AI parsing
    → Stores: { raw_text, file_url, skills, experience_bullets, education, projects }

  Step 1: RoleSelector
    → Stores: target_roles[]

  Step 2: SourcesManager
    → Stores: [{ name, source_type, url }]

  Step 3: PreferencesForm
    → Stores: { min_score_threshold, remote_preference, require_sponsorship, exclude_keywords }

  completeOnboarding():
    1. UPDATE profiles SET onboarding_completed=true WHERE id=user.id
    2. INSERT INTO resumes (raw_text, target_roles, skills, ...)
    3. INSERT INTO job_sources (name, source_type, url, is_active)
    4. INSERT INTO user_preferences (min_score_threshold, ...)
    5. Navigate to /dashboard
```

## Job Search Flow

```
/jobs (Jobs.jsx)
  1. User enters search query + selects locations + work type
  2. Calls supabase.functions.invoke('fetch-jobs', { role, location, work_type, daysAgo })
  3. Edge Function (fetch-jobs):
     ├─ Fetches jobs from Tavily/external APIs
     ├─ Inserts new jobs into `jobs` table
     ├─ Scores each job against user resume → inserts into `job_matches`
     └─ Returns { jobsFound: N }
  4. Client refetches jobs + matches via React Query
  5. Client-side filtering:
     ├─ Join jobs + matches on job_id
     ├─ Apply minMatchScore filter (match.score_total >= threshold)
     ├─ Apply categoryFilter (derived from score: 80+=top_pick, 60-79=good_match, <60=slight_match)
     ├─ Apply remoteOnly filter (job.remote_type === 'remote')
     └─ Sort by score DESC
  6. Render grouped by category: Top Picks / Good Match / Worth Exploring
```

## Job Detail + Document Generation Flow

```
/jobs/:id (JobDetail.jsx)
  1. Fetches: job, matches, applications, documents (generated_documents), resumes
  2. Tabs: Overview | Requirements | Insights | Documents | Apply

  Documents tab:
    CoverLetterGenerator → generateCoverLetter({ job, resume })
      → invoke-llm Edge Function → returns plain text cover letter
      → Save: INSERT/UPDATE generated_documents WHERE doc_type='cover_letter'

    AnswersGenerator → generateAnswers({ job, resume, questions })
      → invoke-llm Edge Function → returns { answers: [{ question, answer }] }
      → Save: INSERT/UPDATE generated_documents WHERE doc_type='answers'

    BulletTweaks → generateBulletTweaks({ job, resume })
      → invoke-llm Edge Function → returns { tweaks: [{ original, suggested, reason }] }
      → Save: INSERT/UPDATE generated_documents WHERE doc_type='resume_variant'
```

## AI Chat Flow (Dual Mode)

```
ChatWidget.jsx (floating, all pages)
  ├─ Opens → loads chat_history from DB (last 20 messages, context_type='general')
  ├─ Detects page context:
  │   ├─ /jobs/:id → context='job', jobId=params.id
  │   └─ other    → context='general', jobId=null
  └─ Sends message → career-coach Edge Function

career-coach Edge Function:
  ├─ Loads: user_memory, profile, resume, chat_history (last 10)
  ├─ Mode 1 (general): Career Mentor
  │   ├─ Personalizes based on profile/resume/memory
  │   ├─ Optionally searches Tavily for live 2026 data
  │   └─ Returns career advice
  ├─ Mode 2 (job): Job Analyzer
  │   ├─ Loads specific job + job_match (score_total)
  │   ├─ Provides gap analysis, application strategy, interview prep
  │   └─ Returns job-specific advice
  └─ Saves both messages to chat_history table
```

## Data Flow: Database Tables

```
profiles (auto-created by handle_new_user trigger)
  └─ onboarding_completed: boolean

resumes (1 per user)
  └─ raw_text, file_url, skills[], experience_bullets[], education, projects[], target_roles[]

user_preferences (1 per user)
  └─ min_score_threshold, remote_preference, require_sponsorship, exclude_keywords[]

job_sources (N per user)
  └─ name, source_type, url, is_active, jobs_found

jobs (N per user, created by fetch-jobs Edge Function)
  └─ title, company, location, description_raw, description_clean, required_skills[], preferred_skills[], remote_type, apply_url

job_matches (1 per job per resume, created by scoring pipeline)
  └─ score_total (0-100), score_breakdown (jsonb)

applications (N per user, created by user actions)
  └─ job_id, status (saved/applied/interview/offer/rejected), applied_date, notes

generated_documents (N per job, created by AI generation)
  └─ job_id, doc_type (cover_letter/answers/resume_variant), content, answers, bullet_tweaks

chat_history (N per user, created by career-coach Edge Function)
  └─ role, content, context_type, job_id
```

