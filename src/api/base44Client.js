/**
 * Supabase Client Initialization
 * ================================
 *
 * MIGRATION NOTE: This file was originally named "base44Client" because the project
 * started on the Base44 proprietary platform (a no-code/low-code app builder). We
 * migrated to Supabase for full control over our backend, auth, database, and storage.
 * The filename is kept as base44Client.js to avoid breaking existing imports across
 * the codebase during the transition. All Base44 SDK references have been replaced
 * with Supabase equivalents.
 *
 * WHAT THE SUPABASE CLIENT DOES:
 * - Authentication: Manages user sign-up, sign-in (email/password, OAuth providers
 *   like Google), session tokens, and automatic token refresh.
 * - Database Queries: Provides a PostgREST-based query builder for CRUD operations
 *   on PostgreSQL tables, with automatic Row Level Security enforcement.
 * - Storage: Upload, download, and manage files in Supabase Storage buckets
 *   (used for resume PDFs and other user documents).
 * - Realtime Subscriptions: Listen to database changes via WebSocket connections,
 *   enabling live updates when jobs are scraped or application statuses change.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - VITE_SUPABASE_URL: The unique URL for your Supabase project (e.g., https://xyzcompany.supabase.co)
 * - VITE_SUPABASE_ANON_KEY: The public anonymous key for client-side access. This key
 *   is safe to expose in the browser because Row Level Security (RLS) policies on the
 *   database ensure users can only access their own data.
 */

import { createClient } from '@supabase/supabase-js';

// Read environment variables provided by Vite at build time.
// These are prefixed with VITE_ so that Vite exposes them to client-side code.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate that required environment variables are present.
// Without these, every Supabase operation will fail, so we throw early
// to give developers a clear error message during development.
if (!supabaseUrl) {
  throw new Error(
    'Missing VITE_SUPABASE_URL environment variable. ' +
    'Add it to your .env file: VITE_SUPABASE_URL=https://your-project.supabase.co'
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_ANON_KEY environment variable. ' +
    'Add it to your .env file: VITE_SUPABASE_ANON_KEY=your-anon-key-here'
  );
}

/**
 * The configured Supabase client instance.
 *
 * Usage examples:
 *   import { supabase } from '@/api/base44Client';
 *
 *   // Auth
 *   const { data, error } = await supabase.auth.signInWithPassword({ email, password });
 *
 *   // Database query
 *   const { data: jobs } = await supabase.from('jobs').select('*').eq('user_id', userId);
 *
 *   // Storage
 *   const { data } = await supabase.storage.from('resumes').upload(filePath, file);
 *
 *   // Realtime
 *   supabase.channel('jobs').on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, handler).subscribe();
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist the session in localStorage so users stay logged in across tabs and refreshes.
    persistSession: true,
    // Automatically refresh the JWT before it expires.
    autoRefreshToken: true,
    // Detect session changes from other browser tabs (e.g., login/logout in another tab).
    detectSessionInUrl: true,
  },
});
