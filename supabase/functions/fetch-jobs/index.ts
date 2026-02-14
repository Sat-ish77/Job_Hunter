/**
 * Supabase Edge Function: fetch-jobs
 * ===================================
 *
 * Smart job search agent using Tavily API to fetch jobs from multiple sources.
 * 
 * FEATURES:
 * - Resume-based matching: Extract top skills from resume to enhance search
 * - Speed-optimized: Uses Tavily 'basic' search for fast results
 * - Multi-source: Searches across Greenhouse, Lever, Ashby, and more
 *
 * INPUT SCHEMA:
 * {
 *   role: string (required) - Job title/role to search
 *   resume_text?: string - Resume content for skill extraction
 *   location?: string - Location filter
 *   work_type?: string - 'remote', 'hybrid', 'onsite'
 *   states?: string[] - Array of state names
 *   cities?: string[] - Array of city names
 *   workTypes?: string[] - Legacy support
 *   daysAgo?: number - Posted within N days (default: 7)
 * }
 *
 * OUTPUT SCHEMA:
 * {
 *   success: boolean
 *   jobsFound: number
 *   jobsUpserted: number
 *   message: string
 *   jobs: Array<{...job data with match_score}>
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.12';

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { 
      role, 
      resume_text,
      location,
      work_type,
      states = [], 
      cities = [], 
      workTypes = [],
      daysAgo = 7 
    } = await req.json();

    if (!role) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tavilyApiKey = Deno.env.get('TAVILY_API_KEY');
    if (!tavilyApiKey) {
      return new Response(
        JSON.stringify({ error: 'TAVILY_API_KEY not configured. Add it to Edge Function secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract top skills from resume for better matching
    let topSkills: string[] = [];
    if (resume_text) {
      topSkills = extractTopSkills(resume_text, 3);
    }

    // Build location query
    const locationParts: string[] = [];
    
    // Handle simple location string
    if (location) {
      locationParts.push(`"${location}"`);
    }
    
    // Handle arrays (backward compatibility)
    if (states.length > 0) {
      locationParts.push(`(${states.map(s => `"${s}"`).join(' OR ')})`);
    }
    if (cities.length > 0) {
      locationParts.push(`(${cities.map(c => `"${c}"`).join(' OR ')})`);
    }
    
    const locationQuery = locationParts.length > 0 ? locationParts.join(' OR ') : '';

    // Build work type query
    let workTypeQuery = '';
    if (work_type) {
      workTypeQuery = work_type.toLowerCase();
    } else if (workTypes.length > 0) {
      workTypeQuery = workTypes.map(t => t.toLowerCase()).join(' OR ');
    }

    // Construct search query with resume-based enhancement
    let query = `(site:greenhouse.io OR site:lever.co OR site:ashbyhq.com OR site:workday.com) ${role}`;
    
    // Add top skills from resume to improve relevance
    if (topSkills.length > 0) {
      query += ` (${topSkills.join(' OR ')})`;
    }
    
    if (locationQuery) {
      query += ` ${locationQuery}`;
    }
    
    if (workTypeQuery) {
      query += ` (${workTypeQuery})`;
    }
    
    query += ` "posted ${daysAgo} days ago" OR "posted ${daysAgo - 1} days ago"`;

    console.log('Tavily search query:', query);

    // Call Tavily API with BASIC search depth for speed
    const tavilyResponse = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: tavilyApiKey,
        query,
        search_depth: 'basic', // CRITICAL: Fast search
        include_answer: false,
        include_raw_content: false,
        max_results: 50,
      }),
    });

    if (!tavilyResponse.ok) {
      const errorText = await tavilyResponse.text();
      console.error('Tavily API error:', errorText);
      return new Response(
        JSON.stringify({ error: `Tavily API error: ${tavilyResponse.status} - ${errorText}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tavilyData = await tavilyResponse.json();
    const results = tavilyData.results || [];

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 
      req.headers.get('x-supabase-url') || 
      '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase configuration missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Edge Function secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user ID from request
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process and upsert jobs with match_score initialization
    const jobsToUpsert = results.map((result: any) => {
      const title = result.title || 'Untitled Job';
      const company = extractCompanyFromUrl(result.url) || extractCompanyFromContent(result.content) || 'Unknown Company';
      const description = result.content || '';
      
      const jobLocation = extractLocation(description, states, cities) || location || 'Remote';
      const remoteType = determineRemoteType(description, work_type || workTypeQuery);
      const externalId = extractExternalId(result.url);
      const requiredSkills = extractSkills(description);
      
      // Calculate initial match score based on resume skills
      const matchScore = topSkills.length > 0 
        ? calculateInitialMatchScore(requiredSkills, topSkills)
        : 0;

      return {
        user_id: userId,
        title,
        company,
        location: jobLocation,
        remote_type: remoteType,
        description: description.substring(0, 50000),
        description_raw: description.substring(0, 50000),
        description_clean: description.substring(0, 50000),
        url: result.url,
        required_skills: requiredSkills,
        visa_sponsorship: checkVisaSponsorship(description) ? 'yes' : 'unknown',
        ats_type: determineATSType(result.url),
        external_id: externalId,
        source_id: null,
        is_active: true,
        match_score: matchScore,
      };
    });

    // Upsert jobs
    const upsertPromises = jobsToUpsert.map(async (job) => {
      const { data: existing } = await supabase
        .from('jobs')
        .select('id')
        .eq('url', job.url)
        .eq('user_id', userId)
        .maybeSingle();
      
      if (existing) {
        return supabase
          .from('jobs')
          .update({
            title: job.title,
            company: job.company,
            location: job.location,
            remote_type: job.remote_type,
            description: job.description,
            required_skills: job.required_skills,
            visa_sponsorship: job.visa_sponsorship,
            ats_type: job.ats_type,
            job_source: 'Tavily',
            posted_at: new Date().toISOString(),
            is_active: job.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select();
      } else {
        return supabase
          .from('jobs')
          .insert({
            ...job,
            job_source: 'Tavily',
            posted_at: new Date().toISOString(),
          })
          .select();
      }
    });

    const upsertResults = await Promise.all(upsertPromises);
    const successful = upsertResults.filter(r => !r.error);
    const jobsData = successful.map(r => r.data?.[0]).filter(Boolean);

    return new Response(
      JSON.stringify({
        success: true,
        jobsFound: results.length,
        jobsUpserted: successful.length,
        message: `Found ${results.length} jobs, upserted ${successful.length} new/updated jobs`,
        jobs: jobsData, // Return the actual job data
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

// Helper functions

/**
 * Extract top N skills from resume text using common tech keywords
 */
function extractTopSkills(resumeText: string, count: number): string[] {
  const commonSkills = [
    'Python', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'Java', 'C++', 'C#',
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Machine Learning', 'AI',
    'Data Science', 'SQL', 'MongoDB', 'PostgreSQL', 'GraphQL', 'REST API',
    'Git', 'CI/CD', 'Agile', 'Scrum', 'TensorFlow', 'PyTorch', 'Vue', 'Angular',
    'Go', 'Rust', 'Swift', 'Kotlin', 'Flutter', 'React Native', 'DevOps',
  ];
  
  const found: string[] = [];
  const text = resumeText.toLowerCase();
  
  for (const skill of commonSkills) {
    if (text.includes(skill.toLowerCase())) {
      found.push(skill);
      if (found.length >= count) break;
    }
  }
  
  return found;
}

/**
 * Calculate initial match score (0-100) based on skill overlap
 */
function calculateInitialMatchScore(jobSkills: string[], resumeSkills: string[]): number {
  if (jobSkills.length === 0 || resumeSkills.length === 0) return 0;
  
  const resumeSkillsLower = resumeSkills.map(s => s.toLowerCase());
  const matchCount = jobSkills.filter(skill => 
    resumeSkillsLower.some(rs => rs.includes(skill.toLowerCase()) || skill.toLowerCase().includes(rs))
  ).length;
  
  return Math.min(100, Math.round((matchCount / jobSkills.length) * 100));
}

function extractCompanyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    if (hostname.includes('greenhouse.io')) {
      return hostname.split('.')[0].replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    if (hostname.includes('lever.co')) {
      const parts = hostname.split('.');
      return parts[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    return null;
  } catch {
    return null;
  }
}

function extractCompanyFromContent(content: string): string | null {
  // Try to extract company name from common patterns
  const patterns = [
    /(?:at|@)\s+([A-Z][a-zA-Z\s&.]+?)(?:\s+is|\s+seeks|\s+-|\.|,)/,
    /([A-Z][a-zA-Z\s&.]+?)\s+is\s+(?:hiring|looking|seeking)/,
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return null;
}

function extractLocation(description: string, states: string[], cities: string[]): string | null {
  const locationPatterns = [
    ...states.map(s => new RegExp(s, 'i')),
    ...cities.map(c => new RegExp(c, 'i')),
  ];
  
  for (const pattern of locationPatterns) {
    const match = description.match(pattern);
    if (match) return match[0];
  }
  
  const commonPatterns = [
    /(?:located in|based in|office in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /([A-Z][a-z]+,\s*[A-Z]{2})/,
  ];
  
  for (const pattern of commonPatterns) {
    const match = description.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

function determineRemoteType(description: string, workType: string): string {
  const desc = description.toLowerCase();
  const wt = workType.toLowerCase();
  
  if (wt.includes('remote') || desc.includes('remote') || desc.includes('work from home')) {
    return 'remote';
  }
  if (wt.includes('hybrid') || desc.includes('hybrid')) {
    return 'hybrid';
  }
  if (wt.includes('onsite') || wt.includes('on-site')) {
    return 'on_site';
  }
  
  return 'on_site';
}

function extractSkills(description: string): string[] {
  const commonSkills = [
    'Python', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'Java', 'C++', 'C#',
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Machine Learning', 'AI',
    'Data Science', 'SQL', 'MongoDB', 'PostgreSQL', 'GraphQL', 'REST API',
    'Git', 'CI/CD', 'Agile', 'TensorFlow', 'PyTorch', 'Vue', 'Angular',
  ];
  
  const found: string[] = [];
  const desc = description.toLowerCase();
  
  for (const skill of commonSkills) {
    if (desc.includes(skill.toLowerCase())) {
      found.push(skill);
    }
  }
  
  return found;
}

function checkVisaSponsorship(description: string): boolean {
  const desc = description.toLowerCase();
  return desc.includes('visa sponsorship') || desc.includes('sponsor visa') || desc.includes('h1b');
}

function determineATSType(url: string): string {
  if (url.includes('greenhouse.io')) return 'greenhouse';
  if (url.includes('lever.co')) return 'lever';
  if (url.includes('ashbyhq.com')) return 'ashby';
  if (url.includes('workday.com')) return 'workday';
  return 'custom';
}

function extractExternalId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    if (url.includes('greenhouse.io')) {
      const match = url.match(/jobs\/(\d+)/);
      return match ? match[1] : null;
    }
    if (url.includes('lever.co')) {
      const match = url.match(/positions\/([^/?]+)/);
      return match ? match[1] : null;
    }
    return urlObj.pathname;
  } catch {
    return null;
  }
}
