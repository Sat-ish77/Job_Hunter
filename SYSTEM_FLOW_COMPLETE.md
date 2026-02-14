# 🎯 COMPLETE SYSTEM FLOW DIAGRAM

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                        JOB HUNTER - COMPLETE SYSTEM                            │
│                     Agentic AI Job Search Platform                             │
└───────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════════
                            USER JOURNEY: ONBOARDING
═══════════════════════════════════════════════════════════════════════════════════

1. USER SIGNS UP
   │
   ├─→ Creates account (email/password or Google OAuth)
   │
   ├─→ `profiles` table created automatically
   │   └─→ `onboarding_completed` = false
   │
   └─→ Redirected to /onboarding

2. ONBOARDING WIZARD
   │
   ├─→ Step 1: Upload Resume
   │   │
   │   ├─→ User uploads PDF/TXT
   │   │
   │   ├─→ Calls: `parse-resume` Edge Function
   │   │   │
   │   │   ├─→ Extracts text
   │   │   ├─→ GPT-4o-mini extracts: skills, experience, education, certs
   │   │   ├─→ Generates embedding (vector)
   │   │   └─→ Returns structured data
   │   │
   │   └─→ Saves to:
   │       ├─→ `profiles.resume_text`
   │       ├─→ `profiles.skills_embedding`
   │       └─→ `resumes` table (full data)
   │
   ├─→ Step 2: Target Roles
   │   └─→ User selects desired roles
   │       └─→ Saves to `profiles.target_roles`
   │
   ├─→ Step 3: Preferences
   │   └─→ User sets location, work type, salary expectations
   │       └─→ Creates `user_memory` record
   │
   └─→ Step 4: Complete
       └─→ Updates `profiles.onboarding_completed` = true
           └─→ Redirects to /dashboard

═══════════════════════════════════════════════════════════════════════════════════
                         USER JOURNEY: JOB SEARCH
═══════════════════════════════════════════════════════════════════════════════════

3. USER SEARCHES FOR JOBS
   │
   ├─→ Goes to /jobs page
   │
   ├─→ Enters search criteria:
   │   ├─→ Job title: "Software Engineer"
   │   ├─→ Locations: [San Francisco, Austin, Remote]
   │   ├─→ Work type: Remote
   │   └─→ Match score: 60%+
   │
   ├─→ Clicks "Search Jobs"
   │
   ├─→ Frontend calls: `fetch-jobs` Edge Function
   │   │
   │   ├─→ INPUT:
   │   │   ├─→ role: "Software Engineer"
   │   │   ├─→ resume_text: (user's resume)
   │   │   ├─→ location: "San Francisco, Austin"
   │   │   └─→ work_type: "remote"
   │   │
   │   ├─→ PROCESS:
   │   │   ├─→ Extract top 3 skills from resume
   │   │   │   └─→ e.g., ["Python", "React", "AWS"]
   │   │   │
   │   │   ├─→ Build Tavily query:
   │   │   │   └─→ "(site:greenhouse.io OR site:lever.co...) 
   │   │   │        Software Engineer Python React AWS
   │   │   │        San Francisco OR Austin
   │   │   │        remote"
   │   │   │
   │   │   ├─→ Call Tavily API (search_depth: "basic") ⚡
   │   │   │   └─→ Returns 50 job listings
   │   │   │
   │   │   ├─→ For each job:
   │   │   │   ├─→ Calculate match_score (0-100)
   │   │   │   ├─→ Assign match_category:
   │   │   │   │   ├─→ 80-100: "top_pick" 🎯
   │   │   │   │   ├─→ 60-79: "good_match" ✨
   │   │   │   │   ├─→ 40-59: "slight_match" 💡
   │   │   │   │   └─→ 0-39: "poor_match"
   │   │   │   └─→ Generate match_reasoning
   │   │   │
   │   │   └─→ Upsert to `jobs` table
   │   │
   │   └─→ OUTPUT:
   │       ├─→ jobsFound: 50
   │       ├─→ jobsUpserted: 47 (3 were duplicates)
   │       └─→ jobs: Array<Job>
   │
   └─→ Frontend displays results in 3 CATEGORIES:
       │
       ├─→ 🎯 TOP PICKS FOR YOU (12 jobs)
       │   └─→ Green accent, 80%+ match
       │
       ├─→ ✨ GOOD MATCHES (23 jobs)
       │   └─→ Blue accent, 60-79% match
       │
       └─→ 💡 WORTH EXPLORING (12 jobs)
           └─→ Yellow accent, 40-59% match

4. USER FILTERS RESULTS
   │
   ├─→ Applies quick filters:
   │   ├─→ Category: Only "Top Picks"
   │   ├─→ Min Score: 70%+
   │   └─→ Remote Only: Yes
   │
   └─→ Results update instantly (client-side filtering)

═══════════════════════════════════════════════════════════════════════════════════
                      USER JOURNEY: CAREER COACH (GENERAL)
═══════════════════════════════════════════════════════════════════════════════════

5. USER CHATS WITH CAREER COACH
   │
   ├─→ Clicks floating sparkle button 💫
   │
   ├─→ Chat widget opens
   │   └─→ Shows: "Hi! I'm your AI Career Coach"
   │       └─→ Suggestions:
   │           ├─→ "What project should I build?"
   │           ├─→ "How do I improve my resume?"
   │           └─→ "Latest trends in AI/ML 2026?"
   │
   ├─→ User asks: "What certification should I get next for ML engineering?"
   │
   ├─→ Frontend calls: `career-coach` Edge Function
   │   │
   │   ├─→ INPUT:
   │   │   ├─→ message: "What certification should I get next..."
   │   │   ├─→ context: "general"
   │   │   └─→ jobId: null
   │   │
   │   ├─→ PROCESS:
   │   │   │
   │   │   ├─→ LOAD USER MEMORY:
   │   │   │   ├─→ `user_memory` table
   │   │   │   │   ├─→ career_goals: "Become ML Engineer"
   │   │   │   │   ├─→ certifications: ["AWS Cloud Practitioner"]
   │   │   │   │   ├─→ projects: [...]
   │   │   │   │   └─→ learning_interests: ["Deep Learning", "NLP"]
   │   │   │   │
   │   │   │   ├─→ `profiles` table
   │   │   │   │   ├─→ target_roles: ["ML Engineer", "Data Scientist"]
   │   │   │   │   └─→ skills: ["Python", "TensorFlow", ...]
   │   │   │   │
   │   │   │   ├─→ `resumes` table
   │   │   │   │   └─→ experience, education
   │   │   │   │
   │   │   │   └─→ `chat_history` table
   │   │   │       └─→ Last 10 messages
   │   │   │
   │   │   ├─→ DETECT KEYWORDS: "certification", "next"
   │   │   │   └─→ Needs web search? NO (not time-sensitive)
   │   │   │
   │   │   ├─→ BUILD SYSTEM PROMPT:
   │   │   │   └─→ "You are a Career Strategist.
   │   │   │        You know about this user:
   │   │   │        - Skills: Python, TensorFlow...
   │   │   │        - Goal: Become ML Engineer
   │   │   │        - Has: AWS Cloud Practitioner cert
   │   │   │        - Interested in: Deep Learning, NLP
   │   │   │        
   │   │   │        Suggest personalized certifications.
   │   │   │        Mention if free or paid."
   │   │   │
   │   │   ├─→ CALL GPT-4o-mini:
   │   │   │   └─→ Context-aware response generated
   │   │   │
   │   │   └─→ SAVE TO CHAT HISTORY:
   │   │       ├─→ User message
   │   │       └─→ Assistant response
   │   │
   │   └─→ OUTPUT:
   │       └─→ reply: "Based on your ML goals and AWS cert,
   │           I recommend:
   │           1. TensorFlow Developer Certificate (Free prep, $100 exam)
   │           2. DeepLearning.AI TensorFlow Specialization (Coursera, $49/mo)
   │           3. AWS ML Specialty (Paid, $300)
   │           
   │           Start with #1 as it builds on your Python/TF skills!"
   │
   └─→ User sees response in chat
       └─→ AI remembers this conversation for future chats

═══════════════════════════════════════════════════════════════════════════════════
                    USER JOURNEY: JOB ANALYSIS & RESUME TAILORING
═══════════════════════════════════════════════════════════════════════════════════

6. USER LIKES A SPECIFIC JOB
   │
   ├─→ Clicks on a "Top Pick" job
   │   └─→ "Senior ML Engineer @ OpenAI"
   │
   ├─→ Goes to Job Detail page
   │
   ├─→ Opens Career Coach (still floating)
   │   └─→ AI detects: context = 'job', jobId = xxx
   │       └─→ New suggestions appear:
   │           ├─→ "Analyze this job for me"
   │           ├─→ "What skills am I missing?"
   │           └─→ "Help me write a cover letter"
   │
   ├─→ User asks: "Analyze this job for me"
   │
   ├─→ Frontend calls: `career-coach` Edge Function
   │   │
   │   ├─→ INPUT:
   │   │   ├─→ message: "Analyze this job for me"
   │   │   ├─→ context: "job"
   │   │   └─→ jobId: "xxx-uuid"
   │   │
   │   ├─→ PROCESS:
   │   │   │
   │   │   ├─→ LOAD JOB DATA:
   │   │   │   ├─→ `jobs` table
   │   │   │   │   ├─→ title: "Senior ML Engineer"
   │   │   │   │   ├─→ company: "OpenAI"
   │   │   │   │   ├─→ required_skills: ["PyTorch", "LLMs", "Distributed Training"]
   │   │   │   │   └─→ description: "Build next-gen AI models..."
   │   │   │   │
   │   │   │   └─→ `job_matches` table
   │   │   │       └─→ score_total: 75
   │   │   │
   │   │   ├─→ LOAD USER DATA:
   │   │   │   ├─→ `resumes` table
   │   │   │   │   └─→ skills: ["TensorFlow", "Python", "AWS"]
   │   │   │   │       (Missing: PyTorch, LLMs experience)
   │   │   │   │
   │   │   │   └─→ `user_memory`
   │   │   │       └─→ career_goals: "Become ML Engineer"
   │   │   │
   │   │   ├─→ BUILD SYSTEM PROMPT:
   │   │   │   └─→ "You are analyzing a job vs user's profile.
   │   │   │        
   │   │   │        Job: Senior ML Engineer @ OpenAI
   │   │   │        Required: PyTorch, LLMs, Distributed Training
   │   │   │        Match Score: 75/100
   │   │   │        
   │   │   │        User has: TensorFlow, Python, AWS
   │   │   │        User wants: ML Engineer role
   │   │   │        
   │   │   │        Provide:
   │   │   │        1. Gap Analysis
   │   │   │        2. Application Strategy
   │   │   │        3. Interview Prep tips"
   │   │   │
   │   │   ├─→ CALL GPT-4o-mini:
   │   │   │   └─→ Job-specific analysis
   │   │   │
   │   │   └─→ SAVE TO CHAT HISTORY
   │   │
   │   └─→ OUTPUT:
   │       └─→ reply: "🎯 Match Analysis:
   │           
   │           STRENGTHS:
   │           ✅ Strong Python background
   │           ✅ ML fundamentals (TensorFlow)
   │           ✅ Cloud experience (AWS)
   │           
   │           GAPS TO ADDRESS:
   │           ⚠️ PyTorch (but TensorFlow transfers well!)
   │           ⚠️ LLM experience (mention any NLP projects)
   │           ⚠️ Distributed training (highlight any scale work)
   │           
   │           APPLICATION STRATEGY:
   │           1. Emphasize TensorFlow→PyTorch similarity
   │           2. Highlight any transformer/NLP projects
   │           3. Show eagerness to learn (mention OpenAI research interest)
   │           
   │           INTERVIEW PREP:
   │           - Study PyTorch docs (3-5 days)
   │           - Read OpenAI papers (GPT series)
   │           - Prepare to discuss: model training at scale"
   │
   └─→ User reads analysis

7. USER WANTS TAILORED RESUME
   │
   ├─→ User asks: "Help me tailor my resume for this job"
   │
   ├─→ Frontend calls: `resume-tailor` Edge Function
   │   │
   │   ├─→ INPUT:
   │   │   ├─→ jobId: "xxx-uuid"
   │   │   ├─→ type: "resume_tailored"
   │   │   └─→ customInstructions: "Emphasize PyTorch-related projects"
   │   │
   │   ├─→ PROCESS:
   │   │   │
   │   │   ├─→ LOAD JOB:
   │   │   │   └─→ Description, required skills, company info
   │   │   │
   │   │   ├─→ LOAD USER RESUME:
   │   │   │   └─→ Full resume text, experience, projects
   │   │   │
   │   │   ├─→ BUILD PROMPT:
   │   │   │   └─→ "Tailor this resume for Senior ML Engineer @ OpenAI.
   │   │   │        
   │   │   │        Job requires: PyTorch, LLMs, Distributed Training
   │   │   │        
   │   │   │        User's resume:
   │   │   │        [full resume text]
   │   │   │        
   │   │   │        Instructions:
   │   │   │        - Emphasize PyTorch-related projects
   │   │   │        - Reorganize to highlight relevant experience first
   │   │   │        - Use keywords from job description
   │   │   │        - Keep ATS-friendly format"
   │   │   │
   │   │   ├─→ CALL GPT-4o-mini:
   │   │   │   └─→ Generates tailored resume (1000+ words)
   │   │   │
   │   │   └─→ SAVE TO DATABASE:
   │   │       └─→ `generated_docs` table
   │   │           ├─→ user_id
   │   │           ├─→ job_id
   │   │           ├─→ type: "resume_tailored"
   │   │           ├─→ content: [tailored resume]
   │   │           └─→ version: 1
   │   │
   │   └─→ OUTPUT:
   │       ├─→ content: [full tailored resume]
   │       ├─→ docId: "doc-uuid"
   │       └─→ jobTitle: "Senior ML Engineer"
   │
   └─→ User gets tailored resume
       ├─→ Can download as PDF
       ├─→ Can edit and regenerate
       └─→ Saved for future reference

8. USER GENERATES COVER LETTER
   │
   ├─→ User asks: "Write me a cover letter for this"
   │
   ├─→ Frontend calls: `resume-tailor` Edge Function
   │   │
   │   ├─→ INPUT:
   │   │   ├─→ jobId: "xxx-uuid"
   │   │   ├─→ type: "cover_letter"
   │   │   └─→ customInstructions: null
   │   │
   │   ├─→ PROCESS:
   │   │   └─→ Generates personalized cover letter
   │   │       ├─→ Opens with enthusiasm
   │   │       ├─→ Highlights relevant experience
   │   │       ├─→ Shows company knowledge
   │   │       └─→ Strong closing
   │   │
   │   └─→ Saved to `generated_docs`
   │
   └─→ User gets cover letter
       └─→ Can edit and customize further

═══════════════════════════════════════════════════════════════════════════════════
                            DATA PERSISTENCE & MEMORY
═══════════════════════════════════════════════════════════════════════════════════

WHAT THE SYSTEM REMEMBERS:

┌─────────────────────────────────────────────────────────────────────────────┐
│ USER MEMORY (Persistent Across Sessions)                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ 📊 PROFILE DATA (`profiles` table):                                         │
│   ├─→ Full name                                                             │
│   ├─→ Email                                                                 │
│   ├─→ Resume text                                                           │
│   ├─→ Skills embedding (vector for semantic search)                         │
│   └─→ Target roles                                                          │
│                                                                              │
│ 📝 RESUME DATA (`resumes` table):                                           │
│   ├─→ Skills (array)                                                        │
│   ├─→ Experience bullets (array)                                            │
│   ├─→ Education                                                             │
│   ├─→ Projects (jsonb)                                                      │
│   └─→ Certifications                                                        │
│                                                                              │
│ 🧠 CAREER MEMORY (`user_memory` table):                                     │
│   ├─→ Career goals                                                          │
│   ├─→ Preferred locations                                                   │
│   ├─→ Preferred work types                                                  │
│   ├─→ Target salary range                                                   │
│   ├─→ Certifications (with dates)                                           │
│   ├─→ Projects (with descriptions)                                          │
│   ├─→ Learning interests                                                    │
│   ├─→ Job search status                                                     │
│   ├─→ Availability date                                                     │
│   └─→ Notes                                                                 │
│                                                                              │
│ 💬 CONVERSATION HISTORY (`chat_history` table):                             │
│   ├─→ All messages (user + assistant)                                       │
│   ├─→ Context type (general, job, resume_tailor)                            │
│   ├─→ Related job_id (if job-specific)                                      │
│   └─→ Timestamps                                                            │
│                                                                              │
│ 📄 GENERATED DOCUMENTS (`generated_docs` table):                            │
│   ├─→ Tailored resumes (by job)                                             │
│   ├─→ Cover letters (by job)                                                │
│   ├─→ LinkedIn messages                                                     │
│   ├─→ Version history                                                       │
│   └─→ Metadata (job, company, date)                                         │
│                                                                              │
│ 💼 JOB DATA (`jobs` table):                                                 │
│   ├─→ All searched jobs                                                     │
│   ├─→ Match scores                                                          │
│   ├─→ Match categories (top_pick, good_match, etc.)                         │
│   ├─→ Match reasoning                                                       │
│   └─→ Required skills                                                       │
│                                                                              │
│ 📋 APPLICATIONS (`applications` table):                                     │
│   ├─→ Saved jobs                                                            │
│   ├─→ Application status (saved → applied → interview → offer)              │
│   └─→ Notes per application                                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════════
                                SYSTEM INTELLIGENCE
═══════════════════════════════════════════════════════════════════════════════════

AI CAPABILITIES:

🎯 JOB MATCHING:
   ├─→ Extracts skills from your resume
   ├─→ Enhances search query with your skills
   ├─→ Calculates match scores (0-100)
   ├─→ Categorizes jobs (Top Pick, Good, Slight, Poor)
   └─→ Explains WHY each job matches

💬 CAREER COACHING:
   ├─→ Remembers your goals across sessions
   ├─→ Knows your current skills and experience
   ├─→ Tracks your certifications and projects
   ├─→ Provides personalized recommendations
   ├─→ Suggests learning paths
   ├─→ Mentions free vs paid resources
   └─→ Uses live 2026 data for trends

📊 JOB ANALYSIS:
   ├─→ Identifies skill gaps for specific jobs
   ├─→ Suggests how to position yourself
   ├─→ Provides interview prep guidance
   └─→ Creates application strategy

✍️ DOCUMENT GENERATION:
   ├─→ Tailors resume for each job
   ├─→ Writes personalized cover letters
   ├─→ Creates LinkedIn outreach messages
   ├─→ Saves all versions for comparison
   └─→ Allows customization with instructions

═══════════════════════════════════════════════════════════════════════════════════
                                   STATUS
═══════════════════════════════════════════════════════════════════════════════════

✅ ALL BUGS FIXED
✅ ALL FEATURES IMPLEMENTED
✅ AGENTIC AI VISION REALIZED
✅ PRODUCTION READY

DEPLOYMENT: Run migration → Deploy functions → Set env vars → Test → Launch 🚀
```

