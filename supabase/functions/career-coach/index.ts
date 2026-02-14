/**
 * career-coach Edge Function - ENHANCED WITH MEMORY
 * 
 * AI Career Coach with persistent memory and dual modes:
 * 
 * MODE 1: Career Mentor (General)
 *   - Remembers user's goals, certifications, projects
 *   - Provides personalized career advice
 *   - Suggests learning paths, certifications, projects
 *   - Uses Tavily for live 2026 data
 * 
 * MODE 2: Job Analyzer (Job-Specific)
 *   - Analyzes specific job vs user resume
 *   - Identifies skill gaps
 *   - Provides application strategy
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
    const { message, context, jobId } = await req.json();

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
    // LOAD USER MEMORY
    // ============================================
    const { data: userMemory } = await supabase
      .from('user_memory')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    const { data: resume } = await supabase
      .from('resumes')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    // Load recent conversation history (last 10 messages)
    const { data: chatHistory } = await supabase
      .from('chat_history')
      .select('role, content')
      .eq('user_id', user.id)
      .eq('context_type', context || 'general')
      .order('created_at', { ascending: false })
      .limit(10);

    const conversationHistory = chatHistory?.reverse() || [];

    let systemPrompt = '';
    let contextData = '';
    let mode = 'general';

    // ============================================
    // MODE 2: JOB ANALYZER
    // ============================================
    if (context === 'job' && jobId) {
      mode = 'job';
      
      const { data: job } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      const { data: jobMatch } = await supabase
        .from('job_matches')
        .select('*')
        .eq('job_id', jobId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!job) {
        throw new Error('Job not found');
      }

      systemPrompt = `You are an expert Career Coach in 2026. You are helping a user analyze a specific job opportunity.

CURRENT JOB:
- Title: ${job.title || 'Not specified'}
- Company: ${job.company || 'Not specified'}
- Location: ${job.location || 'Not specified'}
- Remote Type: ${job.remote_type || 'Not specified'}
- Match Score: ${jobMatch?.score_total || 'Not calculated'}/100

JOB REQUIREMENTS:
${job.required_skills?.length > 0 ? job.required_skills.join(', ') : 'Not specified'}

USER'S PROFILE:
- Skills: ${resume?.skills?.length > 0 ? resume.skills.join(', ') : 'Not specified'}
- Experience Level: ${profile?.target_roles?.join(', ') || 'Not specified'}
- Career Goals: ${userMemory?.career_goals || 'Not specified'}

YOUR TASK:
1. **Gap Analysis**: Identify what skills/experiences are missing
2. **Application Strategy**: How to position themselves for this role
3. **Interview Prep**: What they'll likely be asked about
4. **Resume Tailoring**: Key points to emphasize

Be concise (under 300 words), actionable, and encouraging.`;

      contextData = `JOB DESCRIPTION:\n${(job.description_clean || job.description_raw || '').substring(0, 2000)}

USER'S EXPERIENCE:\n${resume?.experience_bullets?.slice(0, 5).join('\n') || 'No experience listed'}`;
    } 
    // ============================================
    // MODE 1: CAREER MENTOR (with Memory)
    // ============================================
    else {
      mode = 'general';
      
      systemPrompt = `You are an expert Career Strategist and Mentor in 2026.

YOU KNOW ABOUT THIS USER:
- Name: ${profile?.full_name || 'User'}
- Target Roles: ${profile?.target_roles?.join(', ') || 'Not specified'}
- Skills: ${resume?.skills?.slice(0, 10).join(', ') || 'Not specified'}
- Career Goals: ${userMemory?.career_goals || 'Not set'}
- Current Certifications: ${userMemory?.certifications ? JSON.stringify(userMemory.certifications) : 'None'}
- Projects: ${userMemory?.projects ? JSON.stringify(userMemory.projects) : 'None'}
- Learning Interests: ${userMemory?.learning_interests?.join(', ') || 'None'}
- Job Search Status: ${userMemory?.job_search_status || 'Active'}
- Availability: ${userMemory?.availability_date || 'Immediate'}

YOUR ROLE:
- Provide personalized career advice based on their profile
- Suggest relevant certifications, courses, projects
- Help with career planning and skill development
- Answer questions about tech trends, salaries, job market
- Be encouraging and supportive

When suggesting resources:
- Mention if they're free or paid
- Provide specific recommendations (courses, books, platforms)
- Consider their current skill level and goals

Be concise (under 250 words), actionable, and encouraging. Remember their context from previous messages.`;

      // Check if question needs current web data
      const needsWebSearch = 
        message.toLowerCase().includes('latest') || 
        message.toLowerCase().includes('current') ||
        message.toLowerCase().includes('2026') ||
        message.toLowerCase().includes('trend') ||
        message.toLowerCase().includes('salary') ||
        message.toLowerCase().includes('in demand') ||
        message.toLowerCase().includes('popular');

      if (needsWebSearch) {
        const tavilyKey = Deno.env.get('TAVILY_API_KEY');
        if (tavilyKey) {
          try {
            const tavilyResponse = await fetch('https://api.tavily.com/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                api_key: tavilyKey,
                query: `${message} 2026 tech careers`,
                search_depth: 'basic',
                max_results: 3,
                include_answer: true,
              }),
            });
            
            if (tavilyResponse.ok) {
              const tavilyData = await tavilyResponse.json();
              
              if (tavilyData.results?.length > 0 || tavilyData.answer) {
                contextData = `LIVE DATA FROM WEB (2026):\n\n`;
                
                if (tavilyData.answer) {
                  contextData += `Summary: ${tavilyData.answer}\n\n`;
                }
                
                if (tavilyData.results?.length > 0) {
                  contextData += `Recent Information:\n`;
                  contextData += tavilyData.results.map((r: any, i: number) => 
                    `${i + 1}. ${r.title}\n   ${r.content.substring(0, 200)}...`
                  ).join('\n\n');
                }
              }
            }
          } catch (err) {
            console.error('Tavily search failed:', err);
          }
        }
      }

      // Extract learning goals/interests from message to update memory
      if (message.toLowerCase().includes('want to learn') || 
          message.toLowerCase().includes('interested in') ||
          message.toLowerCase().includes('my goal')) {
        // This will be processed after response to update user_memory
      }
    }

    // Build messages array
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      {
        role: 'user',
        content: contextData ? `${message}\n\n---\nContext:\n${contextData}` : message,
      },
    ];

    // Call OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

    const openaiData = await openaiResponse.json();

    if (openaiData.error) {
      throw new Error(openaiData.error.message);
    }

    const reply = openaiData.choices[0].message.content;

    // ============================================
    // SAVE TO CHAT HISTORY
    // ============================================
    await supabase.from('chat_history').insert([
      {
        user_id: user.id,
        role: 'user',
        content: message,
        context_type: context || 'general',
        job_id: jobId || null,
      },
      {
        user_id: user.id,
        role: 'assistant',
        content: reply,
        context_type: context || 'general',
        job_id: jobId || null,
      }
    ]);

    return new Response(
      JSON.stringify({
        reply,
        mode,
        model: openaiData.model,
        usage: openaiData.usage,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Career coach error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
