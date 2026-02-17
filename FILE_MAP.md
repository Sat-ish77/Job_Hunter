# File Map — Job Hunter

## Root

| File | Purpose |
|------|---------|
| `src/main.jsx` | App entry point. Wraps App in AuthProvider, QueryClientProvider, BrowserRouter |
| `src/App.jsx` | Root component. Routes, ProtectedRoute, auth loading gate, ChatWidget mount |
| `src/Layout.jsx` | Sidebar + header shell for authenticated pages |
| `src/pages.config.js` | Route → component mapping (lazy loaded) |
| `src/index.css` | Tailwind CSS imports + global styles |

## Pages (`src/pages/`)

| File | Route | Purpose |
|------|-------|---------|
| `Login.jsx` | `/login` | Email/password + Google OAuth sign-in/sign-up |
| `Onboarding.jsx` | `/onboarding` | 4-step wizard: resume → roles → sources → preferences |
| `Dashboard.jsx` | `/dashboard` | Stats, recommended jobs, resume manager, quick actions |
| `Jobs.jsx` | `/jobs` | Job search with multi-select location, filters, category grouping |
| `JobDetail.jsx` | `/jobs/:id` | Full job view, match insights, AI document generation tabs |
| `Pipeline.jsx` | `/pipeline` | Kanban board (saved → applied → interview → offer → rejected) |
| `settings.jsx` | `/settings` | Resume editing, job sources management, preferences |

## Components

### Auth & Layout
| File | Purpose |
|------|---------|
| `src/lib/AuthContext.jsx` | React Context for auth state (user, session, loading, signIn, signOut) |
| `src/lib/NavigationTracker.jsx` | Scroll-to-top on route change + analytics |
| `src/lib/PageNotFound.jsx` | 404 page |
| `src/lib/query-client.js` | React Query client configuration |
| `src/lib/utils.js` | shadcn `cn()` utility |

### Chat
| File | Purpose |
|------|---------|
| `src/components/ChatWidget.jsx` | Floating AI Career Coach. Context-aware (general vs job). Loads/saves chat_history from DB |

### Dashboard
| File | Purpose |
|------|---------|
| `src/components/dashboard/ResumeManager.jsx` | View/upload/edit/delete resume from dashboard |
| `src/components/dashboard/StatsCard.jsx` | Metric card (jobs found, top matches, applied, interviews) |

### Jobs
| File | Purpose |
|------|---------|
| `src/components/jobs/JobCard.jsx` | Job listing card with score ring, save/unsave |
| `src/components/jobs/JobFilters.jsx` | Filter controls (score threshold, category, remote) |
| `src/components/jobs/LocationFilter.jsx` | Multi-select location dropdown (states + Remote) |
| `src/components/jobs/MatchInsights.jsx` | Score breakdown visualization for a job match |
| `src/components/jobs/ApplySection.jsx` | Application readiness checklist + mark as applied |

### Documents
| File | Purpose |
|------|---------|
| `src/components/documents/CoverLetterGenerator.jsx` | AI cover letter generation + editing |
| `src/components/documents/AnswersGenerator.jsx` | AI application question answers |
| `src/components/documents/BulletTweaks.jsx` | AI resume bullet point suggestions |

### Onboarding
| File | Purpose |
|------|---------|
| `src/components/onboarding/ResumeUpload.jsx` | PDF upload or text paste + AI extraction |
| `src/components/onboarding/RoleSelector.jsx` | Target role selection |
| `src/components/onboarding/SourcesManager.jsx` | Add job sources (Greenhouse, Lever, career pages) |
| `src/components/onboarding/PreferencesForm.jsx` | Score threshold, remote preference, sponsorship |

### Pipeline
| File | Purpose |
|------|---------|
| `src/components/pipeline/ApplicationCard.jsx` | Draggable card for kanban board |

### UI (`src/components/ui/`)
shadcn/ui components: Button, Card, Badge, Input, Textarea, Select, Slider, Checkbox, Tabs, Dialog, Popover, Command, DropdownMenu, Skeleton, ScoreRing, etc.

## Services (`src/services/`)

| File | Purpose |
|------|---------|
| `supabase-data.js` | Data access layer. Factory-generated CRUD services for all 7 tables. Exports `db` object |
| `ai-service.js` | AI operations: invokeLLM, generateCoverLetter, generateAnswers, generateBulletTweaks, parseResume, uploadResume, extractResumeFromPDF |
| `ai-prompts.js` | All LLM prompt templates and JSON schemas for structured outputs |

## API (`src/api/`)

| File | Purpose |
|------|---------|
| `base44Client.js` | Supabase client initialization (URL + anon key from env vars) |

## Utils (`src/utils/`)

| File | Purpose |
|------|---------|
| `index.ts` | createPageUrl, formatDate, formatSalary, truncateText, sanitizeText, getMatchScoreColor, getStatusColor |

## Constants (`src/constants/`)

| File | Purpose |
|------|---------|
| `us-states.ts` | US states list for location dropdown |

## Supabase Edge Functions (`supabase/functions/`)

| Function | Purpose |
|----------|---------|
| `invoke-llm` | Proxies LLM calls to OpenAI/Anthropic with server-side API keys |
| `career-coach` | Dual-mode AI chat (general mentor + job analyzer). Reads/writes chat_history |
| `fetch-jobs` | Searches for jobs via Tavily API, stores in DB, scores against resume |
| `extract-resume` | Downloads PDF, extracts text, structures via LLM |
| `parse-resume` | Structures pasted resume text via LLM |
| `resume-tailor` | Tailors resume for specific job |

## Database Schema (`supabase/schema.sql`, `supabase/migrations/`)

| Table | Key Columns |
|-------|-------------|
| `profiles` | id (= auth.uid), full_name, avatar_url, **onboarding_completed** |
| `resumes` | user_id, **raw_text**, file_url, skills[], experience_bullets[], target_roles[] |
| `user_preferences` | user_id, min_score_threshold, remote_preference, require_sponsorship |
| `job_sources` | user_id, name, **source_type**, url, is_active, jobs_found |
| `jobs` | user_id, title, company, location, description_raw, required_skills[], remote_type |
| `job_matches` | job_id, resume_id, **score_total** (0-100), score_breakdown (jsonb) |
| `applications` | user_id, job_id, status, applied_date, notes |
| `generated_documents` | user_id, job_id, **doc_type**, content, answers, bullet_tweaks |
| `chat_history` | user_id, role, content, context_type, job_id |

