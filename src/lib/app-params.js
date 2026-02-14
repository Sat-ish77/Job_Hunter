/**
 * src/lib/app-params.js
 *
 * Application configuration constants for Internship Hunter.
 *
 * This module centralizes app-wide configuration values so they can be
 * imported from a single location rather than scattered across files.
 *
 * Environment variables are read from Vite's import.meta.env, which
 * injects values from .env files at build time. Only variables prefixed
 * with VITE_ are exposed to client-side code (Vite security feature).
 *
 * SUPABASE_URL and SUPABASE_ANON_KEY are the two values needed to
 * initialize the Supabase client for database queries, authentication,
 * and real-time subscriptions. The anon key is safe to expose in the
 * browser because Supabase uses Row Level Security (RLS) to protect data.
 *
 * To configure these values, copy .env.example to .env and fill in
 * your Supabase project credentials.
 */

/** Display name used in the UI header, page titles, and metadata */
export const APP_NAME = "Job Hunter";

/**
 * Supabase project URL (e.g., https://xyzcompany.supabase.co)
 * Set via VITE_SUPABASE_URL in your .env file
 */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * Supabase anonymous/public API key
 * This key is safe for client-side use; RLS policies protect your data.
 * Set via VITE_SUPABASE_ANON_KEY in your .env file
 */
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
