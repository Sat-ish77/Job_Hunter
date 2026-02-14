/**
 * parse-resume Edge Function
 * 
 * Extracts text and skills from resume files (PDF or TXT)
 * Generates embeddings for semantic matching
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { file_url, file_type, resume_text } = await req.json();

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    let extractedText = resume_text || '';

    // If file_url provided, fetch and extract (simplified for now)
    if (file_url && !resume_text) {
      // For PDF, would need PDF.js or similar - for now assume text
      const response = await fetch(file_url);
      extractedText = await response.text();
    }

    if (!extractedText) {
      throw new Error('No resume text provided');
    }

    // Use OpenAI to extract structured information
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a resume parser. Extract key information from resumes and return it as JSON.
            
Output format:
{
  "skills": ["skill1", "skill2", ...],
  "experience": ["bullet1", "bullet2", ...],
  "education": "degree info",
  "certifications": ["cert1", "cert2", ...]
}

Focus on technical skills, work experience bullet points, education, and certifications.`
          },
          {
            role: 'user',
            content: `Parse this resume:\n\n${extractedText.substring(0, 4000)}`
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      }),
    });

    const openaiData = await openaiResponse.json();
    
    if (openaiData.error) {
      throw new Error(openaiData.error.message);
    }

    const parsed = JSON.parse(openaiData.choices[0].message.content);

    // Generate embedding for semantic search
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: extractedText.substring(0, 8000),
      }),
    });

    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data?.[0]?.embedding;

    return new Response(
      JSON.stringify({
        resume_text: extractedText,
        skills: parsed.skills || [],
        experience: parsed.experience || [],
        education: parsed.education || '',
        certifications: parsed.certifications || [],
        embedding: embedding,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Parse resume error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to parse resume' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

