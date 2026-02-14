/**
 * src/lib/utils.js
 *
 * Core utility module for shadcn/ui class name management.
 *
 * Exports the `cn()` function, which is the standard shadcn/ui pattern
 * for combining CSS class names. It merges:
 *   - clsx: Handles conditional classes, arrays, and objects
 *   - tailwind-merge: Intelligently resolves Tailwind CSS class conflicts
 *     (e.g., "px-4 px-6" becomes "px-6", the last one wins)
 *
 * Every shadcn/ui component uses cn() to merge default styles with
 * user-provided className props, ensuring proper Tailwind class resolution.
 *
 * Usage:
 *   cn("px-4 py-2", isActive && "bg-primary", className)
 */

import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
