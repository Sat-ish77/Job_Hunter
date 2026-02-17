/**
 * resume-tailor Edge Function
 * 
 * AI-powered resume and cover letter tailoring for specific jobs
 * 
 * Features:
 * - Generates tailored cover letters
 * - Creates job-specific resume versions
 * - Provides application strategy
 * - Saves generated documents for later use
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.12';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { jobId, type, customInstructions } = await req.json();

    // type can be: 'cover_letter', 'resume_tailored', 'linkedin_message'

    if (!jobId || !type) {
      throw new Error('Missing required fields: jobId and type');
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || req.headers.get('x-supabase-url') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // FETCH JOB AND USER DATA
    // ============================================
    const { data: job } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (!job) {
      throw new Error('Job not found');
    }

    const { data: resume } = await supabase
      .from('resumes')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    const { data: userMemory } = await supabase
      .from('user_memory')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!resume) {
      throw new Error('Please upload your resume first');
    }

    // ============================================
    // GENERATE DOCUMENT BASED ON TYPE
    // ============================================
    let systemPrompt = '';
    let userPrompt = '';

    if (type === 'cover_letter') {
      systemPrompt = `You are an expert career coach specializing in writing compelling cover letters.

Write a professional cover letter that:
1. Opens with enthusiasm and specific reference to the role
2. Highlights 2-3 most relevant experiences from the user's background
3. Explains why they're a great fit for THIS specific role
4. Shows knowledge of the company (if available)
5. Closes with a strong call to action

Tone: Professional yet personable, confident but not arrogant.
Length: 3-4 paragraphs, approximately 300-400 words.
Format: Standard business letter format.`;

      userPrompt = `Generate a cover letter for this job application:

JOB DETAILS:
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location}
- Description: ${(job.description_clean || job.description_raw || '').substring(0, 2000)}
- Required Skills: ${job.required_skills?.join(', ') || 'Not specified'}

CANDIDATE'S PROFILE:
- Name: ${profile?.full_name || 'Candidate'}
- Skills: ${resume.skills?.join(', ') || 'Not specified'}
- Experience:
${resume.experience_bullets?.slice(0, 5).join('\n') || 'Not specified'}
- Education: ${resume.education || 'Not specified'}
- Projects:
${resume.projects?.map((p: any) => `${p.title}: ${p.description}`).join('\n') || 'None'}

${customInstructions ? `SPECIAL INSTRUCTIONS:\n${customInstructions}\n` : ''}

Write the cover letter now. Do NOT include placeholder text like [Your Name] - use actual information.`;

    } else if (type === 'resume_tailored') {
      systemPrompt = `You are an expert resume writer specializing in ATS-optimized resumes.

Create a tailored version of the user's resume that:
1. Emphasizes experiences most relevant to THIS job
2. Uses keywords from the job description naturally
3. Quantifies achievements where possible
4. Reorganizes content to put most relevant items first
5. Is ATS-friendly (no tables, clear sections, standard formatting)

Format: Clean, professional resume layout in plain text/markdown.`;

      userPrompt = `Tailor this resume for the specific job:

TARGET JOB:
- Title: ${job.title}
- Company: ${job.company}
- Required Skills: ${job.required_skills?.join(', ') || 'Not specified'}
- Description Keywords: ${(job.description_clean || job.description_raw || '').substring(0, 1000)}

CURRENT RESUME:
${resume.raw_text?.substring(0, 4000) || 'No resume text available'}

Skills: ${resume.skills?.join(', ') || 'Not specified'}

${customInstructions ? `SPECIAL INSTRUCTIONS:\n${customInstructions}\n` : ''}

Create a tailored resume version that highlights the most relevant experiences for THIS specific role.`;

    } else if (type === 'linkedin_message') {
      systemPrompt = `You are an expert at writing engaging LinkedIn connection requests and messages.

Write a brief, professional message that:
1. Is personalized to the company/role
2. Shows genuine interest
3. Is concise (under 150 words)
4. Includes a clear ask or value proposition

Tone: Professional but warm, confident but humble.`;

      userPrompt = `Write a LinkedIn message to a recruiter or hiring manager at ${job.company} regarding the ${job.title} position.

Keep it brief, personalized, and professional. Mention 1-2 relevant skills or experiences that make the candidate a great fit.

Candidate's background:
${resume.experience_bullets?.slice(0, 3).join('\n') || 'Entry level candidate'}

${customInstructions ? `Additional context: ${customInstructions}` : ''}`;
    }

    // Call OpenAI to generate content
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    const openaiData = await openaiResponse.json();

    if (openaiData.error) {
      throw new Error(openaiData.error.message);
    }

    const generatedContent = openaiData.choices[0].message.content;

    // ============================================
    // SAVE GENERATED DOCUMENT
    // ============================================
    // Save to generated_documents table (NOT generated_docs — that table doesn't exist)
    const { data: savedDoc, error: saveError } = await supabase
      .from('generated_documents')
      .insert({
        user_id: user.id,
        job_id: jobId,
        doc_type: type,       // Column is doc_type, NOT type
        content: generatedContent,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving document:', saveError);
    }

    return new Response(
      JSON.stringify({
        content: generatedContent,
        type: type,
        docId: savedDoc?.id,
        jobTitle: job.title,
        company: job.company,
        usage: openaiData.usage,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Resume tailor error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate document' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

