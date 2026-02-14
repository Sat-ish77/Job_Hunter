/**
 * Supabase Edge Function: invoke-llm
 * ====================================
 *
 * Server-side proxy for LLM API calls (OpenAI / Anthropic).
 *
 * WHY THIS EXISTS:
 * API keys (OPENAI_API_KEY, ANTHROPIC_API_KEY) must NEVER be in client-side
 * JavaScript -- anyone can view-source your React app and steal them.
 * This Edge Function runs server-side on Supabase's Deno runtime, reads the
 * API key from environment variables, and proxies the request.
 *
 * REQUEST FLOW:
 *   Browser (ai-service.js)
 *     --> supabase.functions.invoke('invoke-llm', { body })
 *       --> This Edge Function (runs on Deno, server-side)
 *         --> Reads OPENAI_API_KEY from Deno.env
 *         --> Calls OpenAI Chat Completions API
 *       <-- Returns { result: string | object }
 *     <-- ai-service.js returns result to component
 *
 * SUPPORTED MODES:
 * 1. Text mode (no response_json_schema):
 *    Returns a plain text string from the LLM.
 *    Used for: cover letters, single answer regeneration.
 *
 * 2. JSON mode (response_json_schema provided):
 *    Returns a parsed JSON object matching the provided schema.
 *    Uses OpenAI's "Structured Outputs" feature.
 *    Used for: batch answers, bullet tweaks, resume parsing.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 *   - OPENAI_API_KEY: Your OpenAI API key (set via Supabase Dashboard > Edge Functions > Secrets)
 *
 * DEPLOYMENT:
 *   supabase functions deploy invoke-llm --no-verify-jwt
 *   (--no-verify-jwt allows the function to be called without a JWT, but
 *    our client always sends one. For production, remove --no-verify-jwt
 *    and the function will require authentication.)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req: Request) => {
  // Handle CORS preflight requests (OPTIONS).
  // Browsers send these before the actual POST to check if cross-origin is allowed.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // --- Parse the request body ---
    const { prompt, model = 'gpt-4o-mini', response_json_schema } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: prompt' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Read the API key from environment ---
    // This is set via Supabase Dashboard > Edge Functions > Secrets
    // or via CLI: supabase secrets set OPENAI_API_KEY=sk-...
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY not configured. Add it to Edge Function secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Build the OpenAI request ---
    // We use the Chat Completions API with the specified model.
    // If a JSON schema was provided, we use OpenAI's Structured Outputs feature
    // which guarantees the response matches the schema.
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful assistant for an internship job hunting application. Provide clear, professional, and accurate responses.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    // Build the request body for OpenAI
    const openaiBody: Record<string, unknown> = {
      model,
      messages,
      temperature: 0.7,
      max_tokens: 4096,
    };

    // If a JSON schema was provided, use Structured Outputs.
    // This tells OpenAI to return valid JSON matching our schema,
    // eliminating the need for manual JSON parsing or error handling.
    if (response_json_schema) {
      openaiBody.response_format = {
        type: 'json_schema',
        json_schema: {
          name: 'response',
          strict: true,
          schema: response_json_schema,
        },
      };
    }

    // --- Call OpenAI API ---
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(openaiBody),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', errorText);
      return new Response(
        JSON.stringify({ error: `OpenAI API error: ${openaiResponse.status} - ${errorText}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiData = await openaiResponse.json();

    // --- Extract the response ---
    const content = openaiData.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: 'No content in OpenAI response' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If we requested JSON, parse the response.
    // OpenAI's Structured Outputs guarantees valid JSON, but we parse it
    // here so the client receives a proper JavaScript object.
    let result;
    if (response_json_schema) {
      try {
        result = JSON.parse(content);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        // Fallback: return raw text if JSON parsing fails
        result = content;
      }
    } else {
      // Text mode: return the raw string
      result = content;
    }

    // --- Return the result ---
    return new Response(
      JSON.stringify({
        result,
        model: openaiData.model,
        usage: openaiData.usage,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge Function error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
