/**
 * Shared CORS headers for Supabase Edge Functions.
 *
 * WHY CORS IS NEEDED:
 * Our React app runs on http://localhost:5173 (development) or https://yourapp.vercel.app (production).
 * The Supabase Edge Functions run on https://your-project.supabase.co/functions/v1/...
 * Since these are different origins, the browser blocks requests by default (Same-Origin Policy).
 * CORS headers tell the browser "it's OK, this origin is allowed to call us."
 *
 * HEADERS EXPLAINED:
 * - Access-Control-Allow-Origin: '*' — allows any origin (for development).
 *   In production, you'd restrict this to your app's domain.
 * - Access-Control-Allow-Headers: — lists which request headers are permitted.
 *   'authorization' is needed for the Supabase JWT.
 *   'x-client-info' is sent by the Supabase client library.
 *   'apikey' is the Supabase anon key.
 *   'content-type' is needed for JSON request bodies.
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
