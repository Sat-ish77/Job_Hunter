// src/services/ai-prompts.js
//
// AI Prompt Templates
// ====================
// All LLM prompts used in Job Hunter are centralized here.
// This makes it easy to:
// 1. Iterate on prompt engineering without touching component code
// 2. A/B test different prompts
// 3. Understand the full AI system at a glance
// 4. Add RAG context or few-shot examples later
//
// PROMPT ENGINEERING TIPS (for future improvement):
// - Be specific about output format and length
// - Provide examples of good output (few-shot learning)
// - Use system prompts to set the AI's persona
// - Reference specific resume data to prevent hallucination
//
// HOW THIS FILE IS ORGANIZED:
// Each exported function takes the data it needs (job, resume, questions, etc.)
// and returns a plain string -- the fully-formatted prompt that gets sent to
// the LLM via the ai-service layer. The ai-service decides *which model* to
// call and whether to request structured JSON output; this file only cares
// about *what* to say to the model.
//
// NAMING CONVENTION:
// - build*Prompt  -- returns a prompt string
// - *_JSON_SCHEMA -- exported constant for the expected response shape


// ---------------------------------------------------------------------------
// 1. COVER LETTER PROMPT
// ---------------------------------------------------------------------------
// Used by: CoverLetterGenerator component
// Model:   Text completion (no JSON schema needed -- returns plain text)
// Source:   Originally in CoverLetterGenerator.jsx lines 18-44
//
// The prompt instructs the LLM to:
//   - Keep the letter to ONE page (~300-400 words)
//   - Reference specific skills and projects from the candidate's resume
//   - Avoid generic filler; tie everything back to the job requirements
//   - Format with standard cover letter sections (greeting, body, closing)
// ---------------------------------------------------------------------------

/**
 * Builds the prompt for generating a tailored cover letter.
 *
 * @param {Object} job - The job listing object from the database.
 *   @param {string}   job.title             - Job title (e.g. "Software Engineer Intern")
 *   @param {string}   job.company           - Company name
 *   @param {string}   [job.location]        - Job location (remote, city, etc.)
 *   @param {string[]} [job.required_skills]  - Skills listed as required
 *   @param {string[]} [job.preferred_skills] - Skills listed as preferred/nice-to-have
 *   @param {string}   [job.description_clean]- Cleaned job description text
 *   @param {string}   [job.description_raw]  - Raw/original job description text
 *
 * @param {Object} resume - The user's parsed resume object.
 *   @param {string}   resume.raw_text       - Full plain-text resume content
 *   @param {Object[]} [resume.projects]     - Array of { name, description } project objects
 *
 * @returns {string} The fully-formatted prompt string to send to the LLM.
 */
export function buildCoverLetterPrompt(job, resume) {
  // We build the prompt as a single template literal. Each section is clearly
  // labeled so the LLM can distinguish between instructions, job data, and
  // candidate data. This separation reduces hallucination because the model
  // can clearly see what facts it has to work with.

  return `Write a professional, tailored cover letter for this job application.
Keep it to ONE PAGE maximum (around 300-400 words).
Be specific about why this candidate is a good fit based on their actual experience.
Don't be generic - reference specific skills and projects from the resume that match the job.
Use a professional but personable tone.

JOB DETAILS:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'Not specified'}
${job.required_skills?.length ? `Required Skills: ${job.required_skills.join(', ')}` : ''}
${job.preferred_skills?.length ? `Preferred Skills: ${job.preferred_skills.join(', ')}` : ''}

Job Description:
${job.description_clean || job.description_raw || 'Not available'}

CANDIDATE'S RESUME:
${resume.raw_text}

${resume.projects?.length ? `Key Projects: ${resume.projects.map(p => `${p.name}: ${p.description}`).join('\n')}` : ''}

Write the cover letter now. Format it properly with:
- Professional greeting
- Opening paragraph (hook + why this role)
- Body paragraphs (relevant experience and projects)
- Closing (enthusiasm + call to action)
- Professional sign-off`;
}


// ---------------------------------------------------------------------------
// 2. APPLICATION ANSWERS PROMPT (BATCH)
// ---------------------------------------------------------------------------
// Used by: AnswersGenerator component (initial generation of all answers)
// Model:   JSON-mode completion (returns structured { answers: [...] })
// Source:   Originally in AnswersGenerator.jsx lines 29-64
//
// The prompt instructs the LLM to:
//   - Answer each question concisely (2-4 sentences for short, paragraph for behavioral)
//   - Base answers on the candidate's ACTUAL resume -- no fabrication
//   - Replace [Company] placeholders with the real company name
//   - Return structured JSON so we can render each Q&A pair independently
// ---------------------------------------------------------------------------

/**
 * Builds the prompt for generating answers to multiple application questions at once.
 *
 * @param {Object}   job       - Job listing (same shape as buildCoverLetterPrompt).
 * @param {Object}   resume    - Parsed resume (same shape as buildCoverLetterPrompt).
 * @param {string[]} questions - Array of question strings to answer.
 *
 * @returns {string} The prompt string. The caller should also pass ANSWERS_JSON_SCHEMA
 *                   so the LLM returns structured output.
 */
export function buildAnswersPrompt(job, resume, questions) {
  return `Generate thoughtful, personalized answers to these interview/application questions.
Each answer should be concise (2-4 sentences for short questions, up to a paragraph for behavioral questions).
Base the answers on the candidate's actual resume experience - be specific and authentic.
Replace [Company] with the actual company name.

COMPANY: ${job.company}
ROLE: ${job.title}

JOB DETAILS:
${job.description_clean || job.description_raw || 'Not available'}

CANDIDATE'S RESUME:
${resume.raw_text}

${resume.projects?.length ? `Key Projects: ${JSON.stringify(resume.projects)}` : ''}

QUESTIONS TO ANSWER:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Generate authentic, specific answers that reference the candidate's actual experience.`;
}

/**
 * JSON schema for the batch answers response.
 * The LLM will return an object with an `answers` array, where each element
 * contains the original `question` and the generated `answer`.
 *
 * WHY A SCHEMA?
 * When we pass a JSON schema to the LLM (via OpenAI's "structured outputs" or
 * Anthropic's "tool use"), the model is constrained to return valid JSON matching
 * this shape. This eliminates the need to parse free-text responses and prevents
 * malformed output from crashing the UI.
 */
export const ANSWERS_JSON_SCHEMA = {
  type: "object",
  properties: {
    answers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          answer: { type: "string" }
        }
      }
    }
  }
};


// ---------------------------------------------------------------------------
// 3. SINGLE ANSWER REGENERATION PROMPT
// ---------------------------------------------------------------------------
// Used by: AnswersGenerator component (regenerate button on individual answer)
// Model:   Text completion (returns plain text -- a single answer string)
// Source:   Originally in AnswersGenerator.jsx lines 80-91
//
// This is a simpler prompt used when the user clicks "regenerate" on ONE
// specific answer. It only sends the single question (not the full list)
// to get a fresh take. The response is plain text, not JSON, because we
// only need one string value back.
// ---------------------------------------------------------------------------

/**
 * Builds the prompt for regenerating a single application answer.
 *
 * @param {Object} job      - Job listing object.
 * @param {Object} resume   - Parsed resume object.
 * @param {string} question - The single question to re-answer.
 *
 * @returns {string} The prompt string (expects plain text response, no JSON).
 */
export function buildSingleAnswerPrompt(job, resume, question) {
  return `Regenerate a fresh, thoughtful answer to this question.
Be specific and reference the candidate's actual experience.

COMPANY: ${job.company}
ROLE: ${job.title}
QUESTION: ${question}

CANDIDATE'S RESUME:
${resume.raw_text}

Generate ONE concise, authentic answer.`;
}


// ---------------------------------------------------------------------------
// 4. BULLET TWEAKS PROMPT
// ---------------------------------------------------------------------------
// Used by: BulletTweaks component
// Model:   JSON-mode completion (returns { tweaks: [...] })
// Source:   Originally in BulletTweaks.jsx lines 18-54
//
// IMPORTANT SAFETY GUARDRAIL:
// The prompt explicitly tells the LLM to ONLY REPHRASE existing bullets --
// never fabricate new experience or add claims the candidate didn't make.
// This is critical for ethical resume help: we optimize wording, not truth.
//
// The prompt instructs the LLM to:
//   - Rephrase (not fabricate) existing bullets for the target job
//   - Use strong action verbs and preserve any existing metrics/numbers
//   - Weave in keywords from the job posting for ATS optimization
//   - Return up to 5 of the most impactful suggested rewrites
// ---------------------------------------------------------------------------

/**
 * Builds the prompt for suggesting resume bullet point improvements.
 *
 * @param {Object} job    - Job listing object (same shape as above).
 * @param {Object} resume - Parsed resume object.
 *   @param {string[]} [resume.experience_bullets] - Individual bullet points from resume
 *   @param {string}   resume.raw_text             - Fallback: full resume text
 *
 * @returns {string} The prompt string. Caller should also pass BULLET_TWEAKS_JSON_SCHEMA.
 */
export function buildBulletTweaksPrompt(job, resume) {
  return `Suggest resume bullet point improvements for this specific job application.
IMPORTANT:
- Only REPHRASE existing bullets - do NOT add new claims or fabricate experience
- Keep the same facts, just optimize wording for this specific role
- Use action verbs and quantify where the original has numbers
- Highlight relevant keywords from the job posting

JOB DETAILS:
Title: ${job.title}
Company: ${job.company}
${job.required_skills?.length ? `Required Skills: ${job.required_skills.join(', ')}` : ''}
${job.preferred_skills?.length ? `Preferred Skills: ${job.preferred_skills.join(', ')}` : ''}

Job Description:
${job.description_clean || job.description_raw || ''}

CANDIDATE'S RESUME BULLETS:
${resume.experience_bullets?.join('\n') || resume.raw_text}

Suggest up to 5 bullet rewrites that would be most impactful for this specific role.`;
}

/**
 * JSON schema for the bullet tweaks response.
 * Each tweak includes the `original` bullet, a `suggested` rewrite, and a
 * `reason` explaining why the change helps for this specific job.
 */
export const BULLET_TWEAKS_JSON_SCHEMA = {
  type: "object",
  properties: {
    tweaks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          original: { type: "string" },
          suggested: { type: "string" },
          reason: { type: "string" }
        }
      }
    }
  }
};


// ---------------------------------------------------------------------------
// 5. RESUME PARSING PROMPT
// ---------------------------------------------------------------------------
// Used by: ResumeUpload component (paste-text flow)
// Model:   JSON-mode completion (returns structured resume data)
// Source:   Originally in ResumeUpload.jsx lines 77-101
//
// When a user pastes their resume as text (instead of uploading a PDF), we
// use the LLM to extract structured data. The PDF upload flow uses a
// different mechanism (ExtractDataFromUploadedFile) but falls back to this
// prompt if needed.
//
// The prompt instructs the LLM to:
//   - Extract ALL skills (technical and soft)
//   - Extract ALL experience bullet points as individual strings
//   - Extract education information
//   - Extract project details with names, descriptions, and technologies
// ---------------------------------------------------------------------------

/**
 * Builds the prompt for extracting structured data from pasted resume text.
 *
 * @param {string} resumeText - The raw resume text pasted by the user.
 *
 * @returns {string} The prompt string. Caller should also pass RESUME_PARSE_JSON_SCHEMA.
 */
export function buildResumeParsePrompt(resumeText) {
  return `Extract structured data from this resume text. Be thorough in extracting ALL skills mentioned (technical and soft skills), ALL experience bullet points, and ALL projects.

Resume:
${resumeText}`;
}

/**
 * JSON schema for the resume parsing response.
 *
 * This schema tells the LLM exactly what structure to return. The `description`
 * fields inside the schema act as additional instructions to the model about
 * what each field should contain -- this is a useful trick for improving
 * extraction accuracy without cluttering the main prompt.
 */
export const RESUME_PARSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    skills: {
      type: "array",
      items: { type: "string" },
      description: "All skills mentioned"
    },
    experience_bullets: {
      type: "array",
      items: { type: "string" },
      description: "Key experience achievements"
    },
    education: { type: "string" },
    projects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          technologies: {
            type: "array",
            items: { type: "string" }
          }
        }
      }
    }
  }
};

/**
 * JSON schema used by the PDF extraction Edge Function.
 * This is the same shape as RESUME_PARSE_JSON_SCHEMA but includes the
 * `full_text` field because when extracting from a PDF we also want the
 * complete text content (which we already have when the user pastes text).
 */
export const RESUME_EXTRACT_JSON_SCHEMA = {
  type: "object",
  properties: {
    full_text: { type: "string" },
    skills: {
      type: "array",
      items: { type: "string" }
    },
    experience_bullets: {
      type: "array",
      items: { type: "string" }
    },
    education: { type: "string" },
    projects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          technologies: {
            type: "array",
            items: { type: "string" }
          }
        }
      }
    }
  }
};
