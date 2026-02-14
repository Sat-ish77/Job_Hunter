# 🎯 Job Hunter - Complete System Documentation

**From Solution Architect & AI System Engineer Perspectives**

This document provides a comprehensive explanation of the Job Hunter system architecture, AI/ML components, runtime environments, and technical decisions. Designed for technical interviews and deep understanding.

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture & Tech Stack](#architecture--tech-stack)
3. [Runtime Environments Explained](#runtime-environments-explained)
4. [AI/ML System Deep Dive](#aiml-system-deep-dive)
5. [Data Pipeline & Database](#data-pipeline--database)
6. [Frontend Architecture](#frontend-architecture)
7. [Backend Architecture](#backend-architecture)
8. [Deployment & Scaling](#deployment--scaling)

---

## 🎯 System Overview

**Job Hunter** is a full-stack AI-powered job search platform that:
- **Fetches jobs** from multiple sources using Tavily API
- **Matches resumes to jobs** using semantic similarity and multi-factor scoring
- **Generates documents** (cover letters, interview answers) using LLMs
- **Tracks applications** through a kanban-style pipeline

### Core Value Proposition

Instead of manually browsing job boards, users:
1. Upload their resume (PDF or text)
2. Set preferences (roles, locations, work type)
3. Get AI-matched jobs with match scores
4. Generate personalized cover letters and interview prep
5. Track applications through the pipeline

---

## 🏗️ Architecture & Tech Stack

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                         │
│  React 18 + Vite 6 + TypeScript/JavaScript                  │
│  - Pages: Dashboard, Jobs, Pipeline, Settings, Onboarding    │
│  - Components: JobCard, LocationFilter, Document Generators  │
│  - State: React Query (server state), Context (auth)       │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTPS
                        │ (REST API calls)
┌───────────────────────▼─────────────────────────────────────┐
│              SUPABASE (Backend as a Service)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  PostgreSQL  │  │   Storage    │  │Edge Functions│      │
│  │  + pgvector  │  │  (Resumes)   │  │  (Deno/TS)   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼─────────────────┼─────────────────┼──────────────┘
          │                 │                 │
          │                 │                 │
┌─────────▼─────────────────▼─────────────────▼───────────────┐
│                    EXTERNAL APIs                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   OpenAI     │  │    Tavily    │  │  Supabase    │      │
│  │  (GPT-4o)    │  │  (Job Search)│  │    Auth      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└───────────────────────────────────────────────────────────────┘
```

### Technology Choices & Rationale

| Component | Technology | Why? |
|-----------|-----------|------|
| **Frontend Framework** | React 18 | Industry standard, huge ecosystem, component reusability |
| **Build Tool** | Vite 6 | 10x faster than CRA, native ES modules, optimized production builds |
| **Styling** | Tailwind CSS | Utility-first, rapid development, consistent design system |
| **UI Components** | shadcn/ui (Radix UI) | Accessible, customizable, no vendor lock-in |
| **State Management** | React Query v5 | Automatic caching, background refetching, optimistic updates |
| **Routing** | React Router v6 | Standard for React apps, supports lazy loading |
| **Database** | PostgreSQL 15 | Industry standard, powerful queries, ACID compliance |
| **Vector Search** | pgvector | Native PostgreSQL extension, no separate vector DB needed |
| **Backend Runtime** | Deno (Edge Functions) | TypeScript native, secure by default, Supabase's default |
| **Auth** | Supabase Auth | Built-in, handles JWT, OAuth, email verification |
| **Storage** | Supabase Storage | Integrated with auth, CDN-ready, RLS support |
| **AI APIs** | OpenAI GPT-4o-mini | Fast, cheap, good quality, Structured Outputs support |
| **Job Search** | Tavily API | Real-time web search, aggregates multiple job boards |

---

## ⚙️ Runtime Environments Explained

### What is a Runtime?

A **runtime** is the environment where code executes. Different runtimes have different capabilities, APIs, and constraints.

### 1. **Browser Runtime (JavaScript/TypeScript)**

**Where**: User's browser (Chrome, Firefox, Safari, etc.)

**Language**: JavaScript (or TypeScript compiled to JavaScript)

**What Runs Here**:
- React components (`src/pages/*.jsx`, `src/components/*.jsx`)
- React hooks and state management
- API calls to Supabase (via `@supabase/supabase-js`)

**Key Characteristics**:
- **Sandboxed**: Can't access file system, can't make arbitrary network requests (CORS)
- **Event-Driven**: Responds to user clicks, form submissions, route changes
- **Single-Threaded**: JavaScript runs on one thread (async/await for non-blocking I/O)

**Example**:
```javascript
// This runs in the browser
const handleFetchJobs = async () => {
  const { supabase } = await import('@/api/base44Client');
  const { data, error } = await supabase.functions.invoke('fetch-jobs', {
    body: { role: 'Software Engineer' }
  });
  // Update React state with results
};
```

**Why JavaScript in Browser?**
- Browsers only understand JavaScript (or WebAssembly)
- TypeScript compiles to JavaScript before running
- React is a JavaScript library that manipulates the DOM

### 2. **Deno Runtime (TypeScript)**

**Where**: Supabase Edge Functions (server-side, Supabase's infrastructure)

**Language**: TypeScript (runs directly, no compilation step)

**What Runs Here**:
- Edge Functions (`supabase/functions/*/index.ts`)
- Server-side logic that needs API keys (OpenAI, Tavily)

**Key Characteristics**:
- **Server-Side**: Runs on Supabase's servers, not user's browser
- **Secure by Default**: No file system access unless granted, no network access by default
- **TypeScript Native**: No build step needed, Deno understands TypeScript
- **Isolated**: Each function invocation is isolated (no shared state between requests)

**Example**:
```typescript
// This runs on Supabase's Deno runtime (server-side)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req: Request) => {
  // Read API key from environment (secure, not exposed to browser)
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  
  // Call OpenAI API (server-side, API key never exposed)
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    headers: { 'Authorization': `Bearer ${openaiKey}` },
    // ...
  });
  
  return new Response(JSON.stringify({ result: '...' }));
});
```

**Why Deno for Edge Functions?**
- **Security**: API keys stay server-side (never in browser)
- **Performance**: Runs close to users (edge network)
- **TypeScript**: No compilation needed, faster development
- **Isolation**: Each request is isolated (no memory leaks between requests)

### 3. **PostgreSQL Runtime (SQL)**

**Where**: Supabase's PostgreSQL database server

**Language**: SQL (Structured Query Language)

**What Runs Here**:
- Database queries (SELECT, INSERT, UPDATE, DELETE)
- Stored procedures and triggers
- Row Level Security (RLS) policies

**Key Characteristics**:
- **ACID Compliance**: Transactions are atomic, consistent, isolated, durable
- **Relational**: Data stored in tables with relationships (foreign keys)
- **Concurrent**: Handles multiple queries simultaneously
- **Persistent**: Data survives server restarts

**Example**:
```sql
-- This runs in PostgreSQL
SELECT jobs.*, job_matches.score_total
FROM jobs
JOIN job_matches ON jobs.id = job_matches.job_id
WHERE jobs.user_id = auth.uid()
ORDER BY job_matches.score_total DESC
LIMIT 10;
```

**Why PostgreSQL?**
- **Industry Standard**: Every company uses it
- **Powerful**: Complex queries, joins, aggregations
- **Extensions**: pgvector for vector similarity search
- **Reliability**: ACID guarantees, battle-tested

### Runtime Comparison

| Runtime | Language | Where | Security | Use Case |
|---------|----------|-------|----------|----------|
| **Browser** | JavaScript | User's device | Sandboxed (CORS) | UI, user interactions |
| **Deno (Edge)** | TypeScript | Supabase servers | Secure (API keys) | Server-side logic, API calls |
| **PostgreSQL** | SQL | Database server | RLS policies | Data storage, queries |

---

## 🤖 AI/ML System Deep Dive

### 1. Job Matching Algorithm

**Problem**: Match a user's resume to job postings using semantic understanding, not just keyword matching.

**Solution**: Multi-factor scoring with embeddings.

#### Algorithm Components

**A. Skill Overlap (30% weight)**
```javascript
function computeSkillOverlap(resumeSkills, jobSkills) {
  const resumeSet = new Set(resumeSkills.map(s => s.toLowerCase()));
  const jobSet = new Set(jobSkills.map(s => s.toLowerCase()));
  
  let matches = 0;
  for (const jobSkill of jobSet) {
    if (resumeSet.has(jobSkill)) matches++;
  }
  
  return (matches / jobSkills.length) * 100;
}
```
- **Why 30%**: Important but can be gamed (listing every skill)
- **Future**: Use embeddings for fuzzy skill matching

**B. Semantic Similarity (40% weight) - Most Important**
```javascript
// Generate embeddings for resume and job description
const resumeEmbedding = await generateEmbedding(resumeText);  // 1536-dim vector
const jobEmbedding = await generateEmbedding(jobDescription);  // 1536-dim vector

// Compute cosine similarity
const similarity = cosineSimilarity(resumeEmbedding, jobEmbedding);
const score = ((similarity + 1) / 2) * 100;  // Normalize [-1, 1] to [0, 100]
```

**Why Embeddings?**
- **Semantic Understanding**: "Software Engineer" ≈ "Developer" (similar vectors)
- **Context-Aware**: Understands that "ML Engineer" is related to "Data Scientist"
- **Future-Proof**: Works with new technologies and roles

**Database Query** (pgvector):
```sql
SELECT jobs.*, 
       1 - (jobs.embedding <=> resumes.embedding) as similarity
FROM jobs, resumes
WHERE resumes.user_id = auth.uid()
ORDER BY similarity DESC
LIMIT 10;
```

**C. Project Relevance (20% weight)**
- LLM rates how relevant each project is to the job
- Uses OpenAI with structured JSON output
- Example: "Built a recommendation system" → 90% relevant to "ML Engineer"

**D. Risk Penalty (10% weight)**
- Deducts points for missing requirements
- Missing required skill: -10 points
- Visa sponsorship needed but not offered: -20 points
- Location mismatch: -5 points

#### Final Score Formula

```javascript
score_total = (
  skill_overlap * 0.30 +
  semantic_similarity * 0.40 +
  project_relevance * 0.20 -
  risk_penalty * 0.10
)
```

**Why These Weights?**
- **Semantic Similarity (40%)**: Most important - captures overall fit
- **Skill Overlap (30%)**: Important but can be gamed
- **Project Relevance (20%)**: Shows practical experience
- **Risk Penalty (10%)**: Prevents false positives

### 2. Document Generation

#### Cover Letter Generation

**Input**: Job description + User's resume

**Process**:
1. Build prompt from `ai-prompts.js`
2. Call OpenAI via Edge Function (`invoke-llm`)
3. Return personalized cover letter

**Prompt Engineering**:
- **Role-Playing**: "You are a career coach" → Better outputs
- **Structured Instructions**: Numbered list ensures all sections covered
- **Constraints**: "300-400 words" prevents overly long letters
- **Temperature**: 0.7 (balanced creativity and consistency)

**Model**: `gpt-4o-mini` ($0.15 per 1M input tokens, fast, good quality)

#### Interview Answers Generation

**Format**: STAR (Situation, Task, Action, Result)

**Why STAR?**
- Industry standard for behavioral interviews
- Structured format helps LLM generate consistent answers

**Implementation**:
- Uses OpenAI's Structured Outputs feature
- Guarantees JSON schema compliance
- Returns: `{ answer, keywords, follow_up }`

#### Resume Parsing

**Pipeline**:
1. User uploads PDF → Supabase Storage
2. Edge Function downloads PDF
3. Converts to base64
4. Sends to OpenAI Vision API
5. Returns structured JSON (skills, experience, projects)

**Why OpenAI Vision?**
- Handles complex layouts (columns, tables)
- Works with scanned PDFs
- More reliable than text extraction libraries

**Error Handling**:
- Wrapped in try/catch
- Shows toast notification on error
- Allows user to proceed manually (paste text)

### 3. Job Search Agent (Tavily Integration)

**Purpose**: Automatically fetch jobs from multiple sources

**Query Pattern**:
```
(site:greenhouse.io OR site:lever.co OR site:ashbyhq.com) 
[Role] 
[Location Query] 
"posted X days ago"
```

**Location Handling**:
- Multiple states: `(Texas OR California OR "New York")`
- Multiple cities: `(Dallas OR Austin OR "San Francisco")`
- Combined with OR logic

**Process**:
1. Construct smart query from user filters
2. Call Tavily API
3. Parse results
4. Upsert to database (deduplicate by URL)

**Deduplication**:
- Unique constraint on `jobs.url`
- Upsert checks if URL exists → update, else insert

---

## 📊 Data Pipeline & Database

### Database Schema

**Core Tables**:

1. **`profiles`** - User metadata (extends Supabase Auth)
   - `onboarding_complete` (boolean) - Tracks if user completed setup

2. **`resumes`** - Parsed resume data
   - `resume_text` (text) - Full resume text
   - `skills` (text[]) - Array of skills
   - `experience_bullets` (text[]) - Work experience
   - `projects` (jsonb) - Projects with technologies
   - `embedding` (vector(1536)) - Semantic embedding

3. **`jobs`** - Job postings
   - `url` (text, UNIQUE) - Job listing URL (for deduplication)
   - `title`, `company`, `location` (text)
   - `remote_type` (text) - 'remote', 'hybrid', 'onsite', 'unknown'
   - `description` (text) - Full job description
   - `required_skills` (text[]) - Required skills
   - `posted_at` (timestamptz) - When job was posted
   - `job_source` (text) - Source name ('Tavily', 'Greenhouse', etc.)
   - `embedding` (vector(1536)) - Semantic embedding

4. **`job_matches`** - AI-computed match scores
   - `score_total` (integer, 0-100)
   - `score_breakdown` (jsonb) - Detailed breakdown
   - `matching_skills` (text[])
   - `missing_skills` (text[])

5. **`applications`** - Application tracking
   - `status` (text) - 'saved', 'applying', 'applied', 'interview', 'offer', 'rejected'
   - `timeline` (jsonb) - Status change history

6. **`notifications`** - User notifications
   - `message`, `title` (text)
   - `is_read` (boolean)
   - `type` (text) - 'job_match', 'job_alert', etc.

### Data Flow Examples

#### Example 1: User Uploads Resume

```
1. User selects PDF file
   ↓
2. Frontend: ResumeUpload.jsx
   ↓
3. Service: ai-service.js.uploadResume()
   - Uploads to Supabase Storage
   - Returns public URL
   ↓
4. Edge Function: extract-resume
   - Downloads PDF from Storage
   - Sends to OpenAI Vision API
   - Returns structured JSON
   ↓
5. Database: Insert into resumes table
   ↓
6. Background: Generate embedding
   - Calls OpenAI Embeddings API
   - Stores in resumes.embedding
   ↓
7. Background: Match against all jobs
   - Computes scores
   - Inserts into job_matches table
```

#### Example 2: Fetch Jobs from Tavily

```
1. User clicks "Refresh Jobs"
   ↓
2. Frontend: Dashboard.jsx.handleFetchJobs()
   ↓
3. Edge Function: fetch-jobs
   - Constructs query from user filters
   - Calls Tavily API
   - Parses results
   ↓
4. Database: Upsert jobs
   - Check if URL exists
   - If exists: UPDATE
   - If not: INSERT
   ↓
5. Frontend: Refresh job list
   - React Query invalidates cache
   - Fetches updated jobs
```

### Row Level Security (RLS)

**Purpose**: Ensure users can only access their own data

**Implementation**:
```sql
CREATE POLICY "Users can manage own jobs"
  ON public.jobs FOR ALL
  USING (auth.uid() = user_id);
```

**Why RLS?**
- **Security at Database Level**: Can't bypass (even with direct DB access)
- **No Manual Checks**: No need for permission checks in application code
- **Performance**: Enforced at database level (faster than app-level checks)

---

## 🎨 Frontend Architecture

### Component Hierarchy

```
App (src/App.jsx)
  ├── Layout (src/Layout.jsx)
  │   ├── Sidebar Navigation
  │   └── User Menu
  └── Routes
      ├── Dashboard (src/pages/Dashboard.jsx)
      │   ├── StatsCard (components/dashboard/StatsCard.jsx)
      │   └── JobCard (components/jobs/JobCard.jsx)
      ├── Jobs (src/pages/Jobs.jsx)
      │   ├── LocationFilter (components/jobs/LocationFilter.jsx)
      │   └── JobFilters (components/jobs/JobFilters.jsx)
      ├── Onboarding (src/pages/Onboarding.jsx)
      │   ├── ResumeUpload
      │   ├── RoleSelector
      │   ├── SourcesManager
      │   └── PreferencesForm
      └── ...
```

### State Management

**React Query** (Server State):
- Caches API responses
- Automatic background refetching
- Optimistic updates
- Loading/error states

**React Context** (Client State):
- `AuthContext` - User authentication state
- `useAuth()` hook provides: `user`, `signIn`, `signOut`, etc.

**Local State** (Component State):
- `useState` for form inputs, UI toggles
- `useReducer` for complex state (not used currently)

### Service Layer Pattern

**Problem**: Components directly calling Supabase creates tight coupling.

**Solution**: Abstract all data operations behind service objects.

**Files**:
- `src/services/supabase-data.js` - Database operations
- `src/services/ai-service.js` - AI API calls
- `src/services/ai-prompts.js` - LLM prompt templates

**Benefits**:
- Easy to swap backends (Supabase → Firebase → Custom API)
- Centralized error handling
- Consistent API across all entities
- Easy to test (mock services instead of Supabase)

---

## 🔧 Backend Architecture

### Supabase Edge Functions

**Technology**: Deno runtime (TypeScript)

**Functions**:

1. **`invoke-llm`** - LLM API proxy
   - Purpose: Keep OpenAI API key server-side
   - Input: `{ prompt, model, response_json_schema }`
   - Output: `{ result, model, usage }`
   - Supports: Text mode and JSON mode (Structured Outputs)

2. **`extract-resume`** - PDF parsing
   - Purpose: Extract structured data from resume PDFs
   - Process: PDF → base64 → OpenAI Vision API → JSON
   - Error Handling: Wrapped in try/catch, allows manual fallback

3. **`fetch-jobs`** - Tavily job search
   - Purpose: Automatically fetch jobs from multiple sources
   - Process: Construct query → Tavily API → Parse → Upsert to database
   - Deduplication: Unique constraint on `url` column

### Why Edge Functions?

**Security**:
- API keys never exposed to browser
- Server-side rate limiting
- Cost tracking and logging

**Performance**:
- Runs close to users (edge network)
- Isolated per request (no shared state)
- Fast cold starts

**Simplicity**:
- No separate server to manage
- Automatic scaling
- Built-in auth integration (JWT passed automatically)

---

## 🚀 Deployment & Scaling

### Current Deployment

**Frontend**: Vercel (automatic deployments from GitHub)
**Backend**: Supabase (managed PostgreSQL, Auth, Storage, Edge Functions)

### Scaling Considerations

**Current Scale (MVP)**:
- Users: 1-100
- Jobs: 1,000-10,000
- Matches: 100,000-1,000,000

**Scaling to 10,000 Users**:

**Database**:
- Add read replicas for job listings
- Partition `job_matches` table by `user_id`
- Use connection pooling (Supabase handles this)

**AI API**:
- Implement request queuing (don't hit rate limits)
- Cache common prompts (e.g., "Why this role?" answers)
- Use cheaper models (gpt-4o-mini) for non-critical tasks

**Storage**:
- CDN for resume PDFs (Supabase Storage + CDN)
- Compress PDFs before upload

**Edge Functions**:
- Add retry logic with exponential backoff
- Implement circuit breakers (stop calling if API is down)

**Scaling to 100,000+ Users**:

**Database**:
- Move to dedicated PostgreSQL instance
- Use pgvector with HNSW indexes (already done)
- Implement job queue for match computation (background workers)

**AI API**:
- Batch requests (generate 10 cover letters in one call)
- Use streaming for long responses (cover letters)
- Implement A/B testing for prompts

**Caching**:
- Redis for frequently accessed data (job listings, match scores)
- CDN for static assets

---

## 🎓 Interview Talking Points

### "Why did you choose Supabase over Firebase?"

- **PostgreSQL vs Firestore**: PostgreSQL is more powerful (joins, complex queries, ACID)
- **pgvector**: Native vector similarity search (Firebase doesn't have this)
- **RLS**: More flexible than Firestore security rules
- **Open Source**: Can self-host if needed

### "How does the matching algorithm work?"

- **Multi-factor scoring**: Skill overlap (30%), semantic similarity (40%), project relevance (20%), risk penalty (10%)
- **Semantic similarity**: Uses OpenAI embeddings + pgvector cosine similarity
- **Scores pre-computed**: Stored in `job_matches` table (not computed on-the-fly)
- **Why embeddings**: Captures semantic meaning ("Software Engineer" ≈ "Developer")

### "Why Edge Functions instead of a separate backend?"

- **Simplicity**: No separate server to manage
- **Automatic scaling**: Supabase handles it
- **Built-in auth**: JWT passed automatically
- **Cost-effective**: Pay only for invocations

### "What's your approach to prompt engineering?"

- **Centralized prompts**: All in `ai-prompts.js` for version control
- **Role-playing**: "You are a career coach" → Better outputs
- **Structured outputs**: Guaranteed JSON schema compliance
- **Temperature tuning**: 0.7 for creative tasks, 0.1 for extraction

### "How do you handle API rate limits?"

- **Currently**: Error handling with user-friendly messages
- **Future**: Request queuing, exponential backoff, circuit breakers
- **Caching**: Cache embeddings (don't regenerate if text unchanged)

### "What's the difference between runtime environments?"

- **Browser Runtime**: JavaScript, sandboxed, event-driven (React components)
- **Deno Runtime**: TypeScript, server-side, secure (Edge Functions)
- **PostgreSQL Runtime**: SQL, ACID-compliant, persistent (database queries)

**Why Different Runtimes?**
- **Security**: API keys must be server-side (Deno), not in browser
- **Performance**: Database queries are faster in PostgreSQL than JavaScript
- **Isolation**: Each runtime has specific capabilities (browser = UI, Deno = server logic, SQL = data)

---

## 📝 Key Takeaways

1. **Architecture**: Service layer pattern, React Query for server state, Edge Functions for security
2. **AI System**: Multi-factor matching with embeddings, structured outputs for reliability
3. **Runtime Environments**: Browser (JS), Deno (TS), PostgreSQL (SQL) - each optimized for its purpose
4. **Scalability**: Designed to scale from MVP to 100,000+ users with proper optimizations
5. **Security**: RLS policies, API keys server-side, JWT authentication

---

**This system is production-ready and interview-ready. Every decision has a rationale, and you can explain the trade-offs in technical interviews.**

