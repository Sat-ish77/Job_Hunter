# 🎯 Job Hunter

**A full-stack AI-powered job hunting platform** that matches your resume to jobs, generates personalized cover letters, and tracks your application pipeline.

Built with **React + Vite**, **Supabase** (PostgreSQL + Auth + Storage), and **OpenAI** for intelligent matching and document generation.

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** and npm
- **Supabase account** (free tier works)
- **OpenAI API key** (paid account required)

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. **Create a new Supabase project** at [supabase.com](https://supabase.com)
2. **Run the database schema:**
   - Go to **SQL Editor** in your Supabase Dashboard
   - Copy the contents of `supabase/schema.sql`
   - Paste and **Run** it (this creates all tables, RLS policies, and indexes)

3. **Create a Storage bucket:**
   - Go to **Storage** in Supabase Dashboard
   - Create a new bucket named `resumes`
   - Set it to **Public** (or configure RLS if you prefer private)

4. **Get your Supabase credentials:**
   - Go to **Settings > API**
   - Copy your **Project URL** and **anon/public key**

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Deploy Supabase Edge Functions

The Edge Functions handle AI API calls server-side (keeping your OpenAI key secure).

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Set your OpenAI API key as a secret
supabase secrets set OPENAI_API_KEY=sk-your-openai-key-here

# Deploy the Edge Functions
supabase functions deploy invoke-llm --no-verify-jwt
supabase functions deploy extract-resume --no-verify-jwt
```

**How to find your project ref:**
- In Supabase Dashboard, go to **Settings > General**
- Your **Reference ID** is the project ref (e.g., `abcdefghijklmnop`)

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📚 Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture, tech stack, and design decisions
- **[AI_SYSTEM.md](./AI_SYSTEM.md)** - AI/ML system deep dive: matching algorithms, embeddings, prompts
- **[DATA_PIPELINE.md](./DATA_PIPELINE.md)** - Data flow, ETL processes, and database design
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Production deployment guide (Vercel + Supabase)
- **[TODO.md](./TODO.md)** - Future enhancements and improvements

---

## 🏗️ Project Structure

```
Internship_Hunter/
├── src/
│   ├── pages/              # Main application pages
│   │   ├── Dashboard.jsx   # Stats and overview
│   │   ├── Jobs.jsx        # Job listings with filters
│   │   ├── JobDetail.jsx   # Job details + match insights
│   │   ├── Pipeline.jsx   # Application kanban board
│   │   ├── Onboarding.jsx # First-time setup flow
│   │   └── settings.jsx   # User preferences
│   ├── components/         # Reusable UI components
│   │   ├── documents/     # AI document generators
│   │   ├── jobs/          # Job-related components
│   │   ├── onboarding/    # Onboarding flow components
│   │   └── ui/            # shadcn/ui component library
│   ├── services/          # Business logic layer
│   │   ├── supabase-data.js  # Database operations
│   │   ├── ai-service.js     # AI API calls
│   │   └── ai-prompts.js     # LLM prompt templates
│   ├── lib/               # Utilities and contexts
│   │   ├── AuthContext.jsx   # Supabase auth
│   │   └── query-client.js   # React Query config
│   └── api/               # API clients
│       └── base44Client.js  # Supabase client (renamed for compatibility)
├── supabase/
│   ├── schema.sql         # Database schema
│   └── functions/         # Edge Functions (server-side AI)
│       ├── invoke-llm/    # LLM API proxy
│       └── extract-resume/ # PDF parsing + extraction
└── entities/              # Data model definitions (reference)
```

---

## 🧪 Testing Edge Functions Locally

### Option 1: Test via Supabase CLI (Recommended)

```bash
# Start local Supabase (requires Docker)
supabase start

# Set local secrets
supabase secrets set OPENAI_API_KEY=sk-your-key-here --env-file .env.local

# Serve functions locally
supabase functions serve invoke-llm --env-file .env.local
supabase functions serve extract-resume --env-file .env.local
```

Then test with curl:

```bash
# Test invoke-llm
curl -X POST http://localhost:54321/functions/v1/invoke-llm \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a short cover letter for a software engineering internship.",
    "model": "gpt-4o-mini"
  }'
```

### Option 2: Test via Supabase Dashboard

1. Go to **Edge Functions** in your Supabase Dashboard
2. Click on `invoke-llm` or `extract-resume`
3. Use the **Invoke** tab to test with sample payloads

### Option 3: Test from Your React App

The Edge Functions are automatically called when you:
- Generate a cover letter (CoverLetterGenerator component)
- Generate interview answers (AnswersGenerator component)
- Upload a resume (ResumeUpload component)
- Generate bullet tweaks (BulletTweaks component)

Check the browser console and Network tab to see the requests.

---

## 🔑 Key Features

### 1. **AI-Powered Job Matching**
- Semantic similarity scoring using embeddings
- Skill overlap analysis
- Project relevance matching
- Risk assessment (missing skills, visa requirements)

### 2. **Intelligent Document Generation**
- **Cover Letters**: Personalized based on job description + your resume
- **Interview Answers**: Generate STAR-format answers for common questions
- **Resume Tweaks**: AI-suggested improvements to bullet points

### 3. **Resume Parsing**
- Upload PDF resume → automatic extraction of:
  - Skills (technical + soft)
  - Work experience bullets
  - Projects with technologies
  - Education history

### 4. **Application Pipeline**
- Kanban board tracking (Saved → Applying → Applied → Interview → Offer → Rejected)
- Timeline tracking
- Interview date reminders

### 5. **Job Source Management**
- Configure multiple job boards (LinkedIn, Indeed, Greenhouse, etc.)
- Automatic job fetching (future: webhook/cron integration)

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite 6, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL + pgvector, Auth, Storage, Edge Functions)
- **AI**: OpenAI GPT-4o-mini (with Structured Outputs)
- **State Management**: React Query v5, React Context
- **Routing**: React Router v6
- **UI Libraries**: framer-motion, @hello-pangea/dnd, Recharts, Sonner

---

## 📖 Learning Resources

This project is designed to be **interview-ready**. Key concepts to understand:

1. **AI/ML System Design**: See [AI_SYSTEM.md](./AI_SYSTEM.md)
   - Embedding-based semantic search
   - Multi-factor scoring algorithms
   - Prompt engineering for structured outputs

2. **Data Engineering**: See [DATA_PIPELINE.md](./DATA_PIPELINE.md)
   - ETL pipelines
   - Vector databases (pgvector)
   - Row Level Security (RLS)

3. **System Architecture**: See [ARCHITECTURE.md](./ARCHITECTURE.md)
   - Service layer pattern
   - Edge Functions for API key security
   - React Query for server state

---

## 🐛 Troubleshooting

### "OPENAI_API_KEY not configured"
- Make sure you ran `supabase secrets set OPENAI_API_KEY=...`
- Verify the secret exists: `supabase secrets list`

### "Failed to download PDF" in extract-resume
- Check that your Storage bucket `resumes` is set to **Public**
- Or update the Edge Function to use a service role key for private buckets

### "RLS policy violation"
- Make sure you ran `supabase/schema.sql` completely
- Check that you're logged in (auth context should have a user)

### Edge Functions return 401 Unauthorized
- Make sure you deployed with `--no-verify-jwt` flag (for development)
- Or ensure your Supabase client is sending the JWT in the Authorization header

---

## 📝 License

MIT License - feel free to use this for your portfolio and interviews!

---

## 🙏 Credits

Migrated from Base44 platform to independent Supabase + OpenAI stack.
Built with ❤️ for CS students hunting internships.
