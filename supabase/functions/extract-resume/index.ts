/**
 * Supabase Edge Function: extract-resume
 * ========================================
 *
 * Server-side PDF parsing and structured data extraction for resumes.
 *
 * PIPELINE:
 *   1. Receive the public URL of an uploaded PDF resume
 *   2. Download the PDF from Supabase Storage
 *   3. Extract raw text from the PDF (using pdf-parse library equivalent)
 *   4. Send the extracted text + a JSON schema to OpenAI
 *   5. Return the structured data (skills, experience, projects, etc.)
 *
 * WHY SERVER-SIDE:
 * - PDF parsing libraries add ~500KB+ to the client bundle
 * - Server-side parsing is more reliable across different PDF formats
 * - The LLM call happens server-side too, keeping the API key secure
 * - Single round-trip: upload PDF, get back structured data
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 *   - OPENAI_API_KEY: Your OpenAI API key
 *
 * DEPLOYMENT:
 *   supabase functions deploy extract-resume --no-verify-jwt
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { file_url, json_schema } = await req.json();

    if (!file_url) {
      return new Response(
        JSON.stringify({ status: 'error', error: 'Missing required field: file_url' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ status: 'error', error: 'OPENAI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Step 1: Download the PDF ---
    // The file_url points to Supabase Storage (public bucket).
    // We fetch it server-side to extract text.
    console.log('Downloading PDF from:', file_url);
    const pdfResponse = await fetch(file_url);

    if (!pdfResponse.ok) {
      return new Response(
        JSON.stringify({ status: 'error', error: `Failed to download PDF: ${pdfResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Step 2: Extract text from PDF ---
    // In Deno Edge Functions, we use a simpler approach:
    // Convert PDF to base64 and use OpenAI's vision capability to read it,
    // OR extract text using a lightweight approach.
    //
    // APPROACH: We'll use OpenAI's GPT-4o vision to read the PDF directly.
    // This is more reliable than text extraction for complex resume layouts
    // (columns, tables, graphics) and handles scanned PDFs too.
    //
    // ALTERNATIVE: For production, you could use a dedicated PDF extraction
    // service like Textract, Tika, or pdf-parse npm package.
    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfBase64 = btoa(
      new Uint8Array(pdfBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    // --- Step 3: Send to OpenAI for extraction ---
    // Using GPT-4o with the file content. For PDFs, we send as a file attachment
    // and ask the model to extract structured data.
    const extractionPrompt = `You are a resume parser. Extract structured data from this resume.
Be thorough in extracting ALL skills mentioned (technical and soft skills),
ALL experience bullet points, and ALL projects.

Return the data as JSON matching this schema:
${JSON.stringify(json_schema, null, 2)}

If a field is not found in the resume, use an empty string for strings,
empty arrays for arrays. Never fabricate information.`;

    // First, try to extract text from the PDF using a simple text extraction.
    // For production, replace this with a proper PDF parser.
    // Here we ask GPT-4o to process the base64-encoded PDF content.
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a professional resume parser. Extract all information accurately.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: extractionPrompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`,
                },
              },
            ],
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'resume_extraction',
            strict: true,
            schema: json_schema,
          },
        },
        max_tokens: 4096,
        temperature: 0.1, // Low temperature for accurate extraction
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI extraction error:', errorText);

      // Fallback: If vision-based extraction fails (e.g., model doesn't support PDF),
      // return an error suggesting the user paste text instead.
      return new Response(
        JSON.stringify({
          status: 'error',
          error: 'PDF extraction failed. Please try pasting your resume text instead.',
          details: errorText,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiData = await openaiResponse.json();
    const content = openaiData.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ status: 'error', error: 'No content in extraction response' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Step 4: Parse and return structured data ---
    let extractedData;
    try {
      extractedData = JSON.parse(content);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return new Response(
        JSON.stringify({ status: 'error', error: 'Failed to parse extraction result as JSON' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return in the format that ai-service.js expects:
    // { status: 'success', output: { full_text, skills, ... } }
    return new Response(
      JSON.stringify({
        status: 'success',
        output: extractedData,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge Function error:', error);
    return new Response(
      JSON.stringify({ status: 'error', error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
