/**
 * src/utils/index.ts
 *
 * Shared utility functions used across the Internship Hunter application.
 * These handle common formatting, text manipulation, URL generation, and
 * color coding for the UI. Keeping them centralized avoids duplication
 * and ensures consistent behavior throughout the app.
 */

/**
 * Creates a URL path for navigating to a page in the app.
 *
 * MIGRATION NOTE: This replaces Base44's proprietary `createPageUrl()` function
 * which generated URLs in their platform's format. In our standalone app, pages
 * map directly to standard routes defined in pages.config.js.
 *
 * Base44 used a page-name-based system: createPageUrl('Dashboard') → '/Dashboard'
 * We map page names to our route paths for backward compatibility.
 *
 * Supports query parameters via string format: createPageUrl('JobDetail?id=123')
 *
 * @param pageName - The page name, optionally with query params (e.g., 'Dashboard', 'JobDetail?id=abc')
 * @returns URL path string (e.g., '/', '/jobs/abc')
 *
 * Examples:
 *   createPageUrl('Dashboard')           => '/'
 *   createPageUrl('Jobs')                => '/jobs'
 *   createPageUrl('JobDetail?id=abc123') => '/jobs/abc123'
 *   createPageUrl('Pipeline')            => '/pipeline'
 *   createPageUrl('Settings')            => '/settings'
 *   createPageUrl('Onboarding')          => '/onboarding'
 */
export function createPageUrl(pageName: string): string {
  // Parse query parameters if present (e.g., 'JobDetail?id=abc')
  const [name, queryString] = pageName.split('?');
  const params = new URLSearchParams(queryString || '');

  // Map Base44 page names to our route paths
  const routeMap: Record<string, string> = {
    Dashboard: '/',
    Jobs: '/jobs',
    JobDetail: '/jobs', // Will append the ID below
    Pipeline: '/pipeline',
    Settings: '/settings',
    Onboarding: '/onboarding',
  };

  const basePath = routeMap[name] || `/${name.toLowerCase()}`;

  // Special case: JobDetail uses the ID as a route segment, not a query param
  // Base44 format: 'JobDetail?id=abc123' → Our format: '/jobs/abc123'
  if (name === 'JobDetail' && params.has('id')) {
    return `${basePath}/${params.get('id')}`;
  }

  return basePath;
}

/**
 * Formats a date string or Date object into a human-readable format.
 * Uses the user's locale for natural date presentation.
 *
 * @param date - ISO date string or Date object to format
 * @param options - Intl.DateTimeFormat options to customize output
 * @returns Formatted date string, e.g. "Jan 15, 2026"
 *
 * Examples:
 *   formatDate("2026-01-15") => "Jan 15, 2026"
 *   formatDate("2026-01-15", { year: undefined }) => "Jan 15"
 */
export function formatDate(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  }
): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", options);
}

/**
 * Formats a numeric salary value into a readable currency string.
 * Handles both annual salaries and hourly rates.
 *
 * @param amount - The salary number to format
 * @param currency - ISO currency code (default: "USD")
 * @param period - "year" | "hour" to append the appropriate suffix
 * @returns Formatted salary string, e.g. "$75,000/yr" or "$25/hr"
 *
 * Examples:
 *   formatSalary(75000) => "$75,000/yr"
 *   formatSalary(25, "USD", "hour") => "$25/hr"
 *   formatSalary(null) => "Not specified"
 */
export function formatSalary(
  amount: number | null | undefined,
  currency: string = "USD",
  period: "year" | "hour" = "year"
): string {
  if (amount == null) return "Not specified";

  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);

  const suffix = period === "hour" ? "/hr" : "/yr";
  return `${formatted}${suffix}`;
}

/**
 * Truncates text to a maximum length, appending an ellipsis if needed.
 * Useful for job descriptions in card views and list previews.
 *
 * @param text - The string to truncate
 * @param maxLength - Maximum character count before truncation (default: 100)
 * @returns Truncated string with "..." if it exceeded maxLength
 *
 * Examples:
 *   truncateText("Hello world", 5) => "Hello..."
 *   truncateText("Short", 100) => "Short"
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "...";
}

/**
 * Returns a Tailwind color class based on a match score (0-100).
 * Used to visually indicate how well a job matches the user's profile.
 *
 * Score thresholds:
 *   >= 75: Green  - Strong match, worth applying
 *   >= 50: Yellow - Moderate match, review carefully
 *   < 50:  Red    - Weak match, may not be a good fit
 *
 * @param score - Match score from 0 to 100
 * @returns Tailwind text color class string
 */
export function getMatchScoreColor(score: number): string {
  if (score >= 75) return "text-green-600";
  if (score >= 50) return "text-yellow-600";
  return "text-red-600";
}

/**
 * Returns a Tailwind color configuration (text + background) for a given
 * application status. Used in pipeline cards, status badges, and filters
 * to provide consistent, at-a-glance status indication.
 *
 * @param status - The application status string
 * @returns Object with `text` and `bg` Tailwind class strings
 */
/**
 * Sanitizes text by removing null characters (\u0000) and other problematic
 * Unicode control characters that can cause Postgres/JSON errors.
 * 
 * PostgreSQL cannot store \u0000 in text or jsonb columns, and including them
 * in API requests causes 400 errors. PDF extractors sometimes produce these.
 *
 * @param text - The raw text to sanitize
 * @returns Cleaned text safe for database storage
 */
export function sanitizeText(text: string | null | undefined): string {
  if (!text) return '';
  // Remove null characters (\\u0000) and other C0 control chars except
  // newline (\\n), carriage return (\\r), and tab (\\t).
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

export function getStatusColor(status: string): { text: string; bg: string } {
  const statusMap: Record<string, { text: string; bg: string }> = {
    applied: { text: "text-blue-700", bg: "bg-blue-100" },
    interviewing: { text: "text-yellow-700", bg: "bg-yellow-100" },
    offered: { text: "text-green-700", bg: "bg-green-100" },
    rejected: { text: "text-red-700", bg: "bg-red-100" },
    saved: { text: "text-gray-700", bg: "bg-gray-100" },
    withdrawn: { text: "text-gray-700", bg: "bg-gray-100" },
  };

  return statusMap[status.toLowerCase()] ?? {
    text: "text-gray-700",
    bg: "bg-gray-100",
  };
}
