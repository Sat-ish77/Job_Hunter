/**
 * src/lib/query-client.js
 *
 * Creates and exports a configured React Query (TanStack Query) client
 * for managing server state throughout the Internship Hunter application.
 *
 * Configuration rationale:
 *
 * - staleTime (5 minutes): Data fetched from Supabase (jobs, applications,
 *   user profile) is considered fresh for 5 minutes. This reduces unnecessary
 *   refetches when navigating between pages, improving perceived performance.
 *   Internship listings don't change every second, so 5 minutes is a
 *   reasonable balance between freshness and efficiency.
 *
 * - retry (1): On failure, retry the request once before showing an error.
 *   A single retry handles transient network issues without making the user
 *   wait too long if the server is genuinely down.
 *
 * - refetchOnWindowFocus (false): Disables automatic refetching when the
 *   user switches back to the browser tab. This prevents unexpected loading
 *   states and unnecessary API calls, especially when users frequently
 *   tab-switch while researching internships.
 */

import { QueryClient } from "@tanstack/react-query";

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes in milliseconds
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
