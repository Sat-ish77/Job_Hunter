// src/services/ai-service.js
//
// AI Service Layer
// =================
// Provides a clean API for all AI operations in Internship Hunter.
// Calls Supabase Edge Functions which proxy requests to OpenAI/Anthropic.
//
// WHY EDGE FUNCTIONS (not direct API calls)?
// - API keys (OPENAI_API_KEY, ANTHROPIC_API_KEY) are secrets that must NEVER
//   be in client-side JavaScript. Anyone can view-source your React app.
// - Edge Functions run server-side on Supabase's Deno runtime.
// - The client sends the prompt to our Edge Function, which adds the API key
//   and forwards the request to OpenAI/Anthropic.
// - This pattern is called "Backend for Frontend" (BFF).
//
// ALTERNATIVE: You could use Vercel API Routes or a separate Express server
// for the same purpose. Edge Functions are chosen because they're already
// part of our Supabase infrastructure (no extra hosting to manage).
//
// REQUEST FLOW (what happens when you call invokeLLM):
// -------------------------------------------------------
//   React Component
//     --> ai-service.js (this file) builds the request body
//       --> supabase.functions.invoke('invoke-llm', { body })
//         --> Supabase Edge Function (runs on Deno, server-side)
//           --> Edge Function reads OPENAI_API_KEY from env
//           --> Edge Function calls OpenAI API (or Anthropic)
//         <-- Edge Function returns the LLM response
//       <-- supabase.functions.invoke returns { data, error }
//     <-- ai-service.js parses and returns the result
//   React Component updates state with the result
//
// ERROR HANDLING STRATEGY:
// Each function in this file throws on failure. The calling component is
// responsible for try/catch and showing user-facing error messages (toasts).
// This keeps the service layer pure (no UI concerns) while giving components
// full control over error UX.

import { supabase } from '@/api/base44Client';
import {
  buildCoverLetterPrompt,
  buildAnswersPrompt,
  buildSingleAnswerPrompt,
  buildBulletTweaksPrompt,
  buildResumeParsePrompt,
  ANSWERS_JSON_SCHEMA,
  BULLET_TWEAKS_JSON_SCHEMA,
  RESUME_PARSE_JSON_SCHEMA,
  RESUME_EXTRACT_JSON_SCHEMA,
} from './ai-prompts';


// ---------------------------------------------------------------------------
// CORE: invokeLLM
// ---------------------------------------------------------------------------
// This is the foundational function that all other AI functions call.
// It replaces `base44.integrations.Core.InvokeLLM()` from the old platform.
//
// TWO MODES OF OPERATION:
//
//   1. Text mode (no jsonSchema):
//      - Sends the prompt, gets back a plain text string.
//      - Used for: cover letters, single answer regeneration.
//      - The Edge Function calls OpenAI with response_format: { type: "text" }
//
//   2. JSON mode (jsonSchema provided):
//      - Sends the prompt + a JSON schema, gets back a parsed JS object.
//      - Used for: batch answers, bullet tweaks, resume parsing.
//      - The Edge Function calls OpenAI with response_format: { type: "json_schema", json_schema: ... }
//      - OpenAI's "Structured Outputs" feature guarantees the response matches
//        our schema, so we never get malformed JSON.
//
// MODEL SELECTION:
// - Default: 'gpt-4o-mini' -- cheapest and fastest, sufficient for most tasks.
// - For complex analysis, callers can pass model: 'gpt-4o' or 'claude-3-5-sonnet'.
// - The Edge Function maps these to the correct API endpoint (OpenAI vs Anthropic).
// ---------------------------------------------------------------------------

/**
 * Core LLM invocation -- replaces base44.integrations.Core.InvokeLLM().
 *
 * Calls the 'invoke-llm' Supabase Edge Function, which proxies the request
 * to OpenAI (or Anthropic) with the API key stored server-side.
 *
 * @param {Object} options
 * @param {string} options.prompt      - The prompt to send to the LLM.
 * @param {Object} [options.jsonSchema] - If provided, the LLM will return structured
 *                                        JSON matching this schema. If omitted, the
 *                                        LLM returns plain text.
 * @param {string} [options.model='gpt-4o-mini'] - Which model to use.
 *
 * @returns {Promise<string|Object>} Plain text (no schema) or parsed JSON object (with schema).
 *
 * @throws {Error} If the Edge Function returns an error or the HTTP call fails.
 *
 * @example
 * // Text mode -- returns a string
 * const coverLetter = await invokeLLM({ prompt: "Write a cover letter..." });
 *
 * @example
 * // JSON mode -- returns a parsed object
 * const data = await invokeLLM({
 *   prompt: "Extract skills from this resume...",
 *   jsonSchema: { type: "object", properties: { skills: { type: "array", items: { type: "string" } } } }
 * });
 * console.log(data.skills); // ["JavaScript", "React", ...]
 */
export async function invokeLLM({
  prompt,
  jsonSchema = null,
  model = 'gpt-4o-mini',
}) {
  // --- Build the request body ---
  // The Edge Function expects these fields. It will construct the appropriate
  // OpenAI or Anthropic API call based on the model name.
  const body = {
    prompt,
    model,
    // Only include response_json_schema if a schema was provided.
    // When this is null/undefined, the Edge Function knows to request plain text.
    ...(jsonSchema && { response_json_schema: jsonSchema }),
  };

  // --- Call the Edge Function ---
  // supabase.functions.invoke() makes an authenticated POST request to:
  //   https://<project-ref>.supabase.co/functions/v1/invoke-llm
  //
  // The Supabase client automatically includes the user's JWT in the
  // Authorization header, so the Edge Function can verify the user is
  // authenticated and apply rate limiting per-user if needed.
  const { data, error } = await supabase.functions.invoke('invoke-llm', {
    body,
  });

  // --- Handle errors ---
  // Edge Function errors come in two forms:
  //   1. Network/infrastructure errors: `error` is set by the Supabase client
  //   2. Application errors: the Edge Function returns { error: "message" } in `data`
  if (error) {
    console.error('Edge Function invocation error:', error);
    throw new Error(`AI service error: ${error.message}`);
  }

  if (data?.error) {
    console.error('LLM returned error:', data.error);
    throw new Error(`LLM error: ${data.error}`);
  }

  // --- Return the result ---
  // If we requested JSON (schema was provided), `data.result` is already a
  // parsed JavaScript object (the Edge Function JSON.parse()s it for us).
  // If we requested text, `data.result` is a plain string.
  return data.result;
}


// ---------------------------------------------------------------------------
// HIGH-LEVEL AI FUNCTIONS
// ---------------------------------------------------------------------------
// These functions provide a clean, domain-specific API that components call.
// Each one:
//   1. Constructs the appropriate prompt using ai-prompts.js
//   2. Calls invokeLLM with the right parameters (model, schema)
//   3. Returns a well-typed result
//
// This separation means components never need to know about prompts, schemas,
// or Edge Functions. They just call `generateCoverLetter(job, resume)` and
// get back a string.
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// generateCoverLetter
// ---------------------------------------------------------------------------
// Replaces the inline InvokeLLM call in CoverLetterGenerator.jsx.
// Returns plain text (a formatted cover letter).
// ---------------------------------------------------------------------------

/**
 * Generate a tailored cover letter for a specific job application.
 *
 * @param {Object} params
 * @param {Object} params.job    - The job listing from the database.
 * @param {Object} params.resume - The user's parsed resume data.
 *
 * @returns {Promise<string>} The generated cover letter as plain text.
 *
 * @throws {Error} If the LLM call fails.
 *
 * @example
 * const letter = await generateCoverLetter({ job, resume });
 * setContent(letter);
 */
export async function generateCoverLetter({ job, resume }) {
  // Build the prompt from our centralized template.
  // See ai-prompts.js > buildCoverLetterPrompt for the full prompt text.
  const prompt = buildCoverLetterPrompt(job, resume);

  // No jsonSchema -- we want plain text back.
  // gpt-4o-mini is sufficient for cover letter generation and keeps costs low.
  const result = await invokeLLM({ prompt });

  return result;
}


// ---------------------------------------------------------------------------
// generateAnswers (batch)
// ---------------------------------------------------------------------------
// Replaces the inline InvokeLLM call in AnswersGenerator.jsx (lines 29-65).
// Returns a structured object: { answers: [{ question, answer }, ...] }
// ---------------------------------------------------------------------------

/**
 * Generate personalized answers to multiple application questions.
 *
 * @param {Object}   params
 * @param {Object}   params.job       - The job listing.
 * @param {Object}   params.resume    - The user's resume data.
 * @param {string[]} params.questions - Array of questions to answer.
 *
 * @returns {Promise<{ answers: Array<{ question: string, answer: string }> }>}
 *
 * @throws {Error} If the LLM call fails.
 *
 * @example
 * const { answers } = await generateAnswers({ job, resume, questions: DEFAULT_QUESTIONS });
 * // answers = [{ question: "Why this role?", answer: "Based on my experience..." }, ...]
 */
export async function generateAnswers({ job, resume, questions }) {
  const prompt = buildAnswersPrompt(job, resume, questions);

  // Pass the JSON schema so the LLM returns structured output.
  // This guarantees we get { answers: [{ question, answer }] } and not
  // some arbitrary text that we'd need to parse.
  const result = await invokeLLM({
    prompt,
    jsonSchema: ANSWERS_JSON_SCHEMA,
  });

  // Defensive: ensure the `answers` array exists even if the LLM returns
  // a valid JSON object that's missing the field (shouldn't happen with
  // structured outputs, but defense in depth is good practice).
  return {
    answers: result.answers || [],
  };
}


// ---------------------------------------------------------------------------
// regenerateSingleAnswer
// ---------------------------------------------------------------------------
// Replaces the inline InvokeLLM call in AnswersGenerator.jsx (lines 80-91).
// Returns a plain text string (a single answer).
// ---------------------------------------------------------------------------

/**
 * Regenerate a fresh answer for a single application question.
 *
 * This is called when the user clicks the "refresh" icon on an individual
 * answer card. It sends only the one question (not all of them) so the LLM
 * generates a completely fresh take.
 *
 * @param {Object} params
 * @param {Object} params.job      - The job listing.
 * @param {Object} params.resume   - The user's resume data.
 * @param {string} params.question - The single question to re-answer.
 *
 * @returns {Promise<string>} The new answer as plain text.
 *
 * @throws {Error} If the LLM call fails.
 */
export async function regenerateSingleAnswer({ job, resume, question }) {
  const prompt = buildSingleAnswerPrompt(job, resume, question);

  // Plain text response -- no JSON schema needed for a single string.
  const result = await invokeLLM({ prompt });

  return result;
}


// ---------------------------------------------------------------------------
// generateBulletTweaks
// ---------------------------------------------------------------------------
// Replaces the inline InvokeLLM call in BulletTweaks.jsx (lines 18-55).
// Returns { tweaks: [{ original, suggested, reason }, ...] }
// ---------------------------------------------------------------------------

/**
 * Suggest resume bullet point improvements tailored to a specific job.
 *
 * ETHICAL NOTE: The prompt explicitly instructs the LLM to only REPHRASE
 * existing bullets, never fabricate new experience. This is enforced at the
 * prompt level (see ai-prompts.js > buildBulletTweaksPrompt).
 *
 * @param {Object} params
 * @param {Object} params.job    - The job listing.
 * @param {Object} params.resume - The user's resume data (needs experience_bullets or raw_text).
 *
 * @returns {Promise<{ tweaks: Array<{ original: string, suggested: string, reason: string }> }>}
 *
 * @throws {Error} If the LLM call fails.
 *
 * @example
 * const { tweaks } = await generateBulletTweaks({ job, resume });
 * // tweaks = [{ original: "Built a web app", suggested: "Engineered a full-stack...", reason: "..." }]
 */
export async function generateBulletTweaks({ job, resume }) {
  const prompt = buildBulletTweaksPrompt(job, resume);

  const result = await invokeLLM({
    prompt,
    jsonSchema: BULLET_TWEAKS_JSON_SCHEMA,
  });

  return {
    tweaks: result.tweaks || [],
  };
}


// ---------------------------------------------------------------------------
// parseResume
// ---------------------------------------------------------------------------
// Replaces the inline InvokeLLM call in ResumeUpload.jsx (lines 77-101).
// Used when the user pastes resume text (not PDF upload).
// Returns { skills, experience_bullets, education, projects }
// ---------------------------------------------------------------------------

/**
 * Extract structured data from pasted resume text using LLM.
 *
 * This is the "paste text" flow in the ResumeUpload component. When a user
 * pastes their resume as plain text, we send it to the LLM to extract
 * structured fields (skills, experience, education, projects).
 *
 * For the PDF upload flow, see extractResumeFromPDF() below which uses a
 * different Edge Function that handles PDF-to-text conversion server-side.
 *
 * @param {Object} params
 * @param {string} params.resumeText - The raw resume text pasted by the user.
 *
 * @returns {Promise<{
 *   skills: string[],
 *   experience_bullets: string[],
 *   education: string,
 *   projects: Array<{ name: string, description: string, technologies: string[] }>
 * }>}
 *
 * @throws {Error} If the LLM call fails.
 *
 * @example
 * const parsed = await parseResume({ resumeText: "John Doe\nSoftware Engineer\n..." });
 * console.log(parsed.skills); // ["JavaScript", "Python", ...]
 */
export async function parseResume({ resumeText }) {
  const prompt = buildResumeParsePrompt(resumeText);

  const result = await invokeLLM({
    prompt,
    jsonSchema: RESUME_PARSE_JSON_SCHEMA,
  });

  // Normalize the response: ensure all expected fields exist with sensible
  // defaults. This prevents downstream components from crashing if the LLM
  // omits a field (which structured outputs should prevent, but we're cautious).
  return {
    skills: result.skills || [],
    experience_bullets: result.experience_bullets || [],
    education: result.education || '',
    projects: result.projects || [],
  };
}


// ---------------------------------------------------------------------------
// uploadResume
// ---------------------------------------------------------------------------
// Replaces `base44.integrations.Core.UploadFile({ file })`.
// Uploads the file to Supabase Storage and returns its public URL.
//
// STORAGE SETUP REQUIRED:
// You need a 'resumes' bucket in Supabase Storage with:
//   - Public access enabled (so we can generate public URLs for the PDF viewer)
//   - RLS policy: users can only upload to their own folder (user_id prefix)
//   - File size limit: ~10MB (resumes shouldn't be larger)
//   - Allowed MIME types: application/pdf
// ---------------------------------------------------------------------------

/**
 * Upload a resume file (PDF) to Supabase Storage.
 *
 * Files are stored in the 'resumes' bucket under a path that includes the
 * user's ID to enforce isolation: `resumes/{userId}/{timestamp}_{filename}`
 *
 * @param {Object} params
 * @param {File}   params.file - The File object from an <input type="file">.
 *
 * @returns {Promise<{ file_url: string }>} An object containing the public URL
 *   of the uploaded file. This URL can be stored in the database and used to
 *   download or display the resume later.
 *
 * @throws {Error} If the upload fails (network error, bucket doesn't exist,
 *   file too large, wrong MIME type, etc.).
 *
 * @example
 * const { file_url } = await uploadResume({ file: inputElement.files[0] });
 * // file_url = "https://xyzcompany.supabase.co/storage/v1/object/public/resumes/abc123/resume.pdf"
 */
export async function uploadResume({ file }) {
  // --- Get the current user's ID for path isolation ---
  // Each user's files go in their own folder so RLS policies can restrict
  // access. Without this, one user could overwrite another's resume.
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('You must be logged in to upload a resume.');
  }

  // --- Build a unique file path ---
  // Format: {userId}/{timestamp}_{originalFilename}
  // The timestamp prevents filename collisions if the user uploads multiple
  // versions of their resume.
  const timestamp = Date.now();
  const filePath = `${user.id}/${timestamp}_${file.name}`;

  // --- Upload to Supabase Storage ---
  // The 'resumes' bucket must exist in your Supabase project.
  // Create it via the Supabase dashboard: Storage > New Bucket > "resumes"
  const { data, error } = await supabase.storage
    .from('resumes')
    .upload(filePath, file, {
      // Set the content type so browsers can display the PDF inline
      // instead of downloading it.
      contentType: file.type || 'application/pdf',
      // upsert: false means if the file already exists, the upload will fail.
      // Since we include a timestamp, collisions are virtually impossible.
      upsert: false,
    });

  if (error) {
    console.error('Storage upload error:', error);
    throw new Error(`Failed to upload resume: ${error.message}`);
  }

  // --- Get the public URL ---
  // getPublicUrl() returns the full URL that can be used to access the file
  // without authentication (since the bucket is public).
  const { data: publicUrlData } = supabase.storage
    .from('resumes')
    .getPublicUrl(data.path);

  return { file_url: publicUrlData.publicUrl };
}


// ---------------------------------------------------------------------------
// extractResumeFromPDF
// ---------------------------------------------------------------------------
// Replaces `base44.integrations.Core.ExtractDataFromUploadedFile()`.
// Calls an Edge Function that:
//   1. Downloads the PDF from the provided URL
//   2. Extracts text from it (using a PDF parsing library like pdf-parse)
//   3. Sends the text to the LLM with our JSON schema
//   4. Returns the structured data
//
// WHY AN EDGE FUNCTION (not client-side PDF parsing)?
// - PDF parsing libraries (pdf.js, pdf-parse) add ~500KB+ to the bundle.
// - Server-side parsing is more reliable (no browser compatibility issues).
// - The Edge Function can use Node.js/Deno PDF libraries not available in browsers.
// - The LLM call happens server-side too, keeping the API key secure.
// ---------------------------------------------------------------------------

/**
 * Extract text and structured data from an uploaded PDF resume.
 *
 * This calls the 'extract-resume' Edge Function, which handles the full
 * pipeline: PDF download -> text extraction -> LLM structuring.
 *
 * @param {Object} params
 * @param {string} params.fileUrl - The public URL of the uploaded PDF
 *   (returned by uploadResume()).
 *
 * @returns {Promise<{
 *   full_text: string,
 *   skills: string[],
 *   experience_bullets: string[],
 *   education: string,
 *   projects: Array<{ name: string, description: string, technologies: string[] }>
 * }>}
 *
 * @throws {Error} If the Edge Function fails, the PDF can't be parsed, or
 *   the LLM can't extract structured data.
 *
 * @example
 * const { file_url } = await uploadResume({ file });
 * const resumeData = await extractResumeFromPDF({ fileUrl: file_url });
 * console.log(resumeData.skills); // ["React", "Node.js", ...]
 * console.log(resumeData.full_text); // "John Doe\nSoftware Engineer\n..."
 */
export async function extractResumeFromPDF({ fileUrl }) {
  // --- Call the Edge Function ---
  // The 'extract-resume' Edge Function is a separate function from 'invoke-llm'
  // because it has additional responsibilities:
  //   1. Download the PDF from the provided URL
  //   2. Parse the PDF to extract raw text (using a Deno PDF library)
  //   3. Send the extracted text + our JSON schema to OpenAI
  //   4. Return both the raw text and the structured data
  const { data, error } = await supabase.functions.invoke('extract-resume', {
    body: {
      file_url: fileUrl,
      // Pass the schema so the Edge Function knows what structure to extract.
      // This is the same schema that was used in the original Base44
      // ExtractDataFromUploadedFile call.
      json_schema: RESUME_EXTRACT_JSON_SCHEMA,
    },
  });

  if (error) {
    console.error('Resume extraction Edge Function error:', error);
    throw new Error(`Failed to extract resume data: ${error.message}`);
  }

  // --- Validate the response ---
  // The Edge Function returns { status: 'success', output: { ... } } on success
  // or { status: 'error', error: '...' } on failure.
  if (data?.status !== 'success' || !data?.output) {
    throw new Error(
      `Resume extraction failed: ${data?.error || 'Unknown error from Edge Function'}`
    );
  }

  // --- Normalize and return ---
  // Ensure all expected fields have sensible defaults, matching the shape
  // that the ResumeUpload component expects.
  const output = data.output;

  return {
    full_text: output.full_text || '',
    skills: output.skills || [],
    experience_bullets: output.experience_bullets || [],
    education: output.education || '',
    projects: output.projects || [],
  };
}
