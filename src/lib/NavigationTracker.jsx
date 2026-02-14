/**
 * NavigationTracker Component
 * ============================
 *
 * A utility component that listens for route changes via react-router-dom's
 * useLocation hook and performs side effects on each navigation:
 *
 * 1. Scrolls to the top of the page (so users don't land mid-page on route change)
 * 2. Optionally logs the navigation event for analytics purposes
 *
 * This component renders nothing to the DOM (returns null). It should be placed
 * inside the Router context, typically alongside your route definitions in App.jsx.
 *
 * Usage:
 *   <BrowserRouter>
 *     <NavigationTracker />
 *     <Routes>
 *       ...
 *     </Routes>
 *   </BrowserRouter>
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function NavigationTracker() {
  const location = useLocation();

  useEffect(() => {
    // --- Scroll to Top ---
    // When navigating between pages, the browser may retain the scroll position
    // from the previous page. This ensures every page starts at the top, which
    // is the expected behavior for most single-page applications.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    // --- Analytics Logging (Optional) ---
    // Log the page view for analytics. This is a lightweight implementation that
    // logs to the console in development. In production, you could send this data
    // to an analytics service like PostHog, Mixpanel, or Google Analytics.
    if (import.meta.env.DEV) {
      console.log(`[Navigation] ${location.pathname}${location.search}`);
    }

    // You can extend this with a real analytics call, for example:
    // analytics.page({
    //   path: location.pathname,
    //   search: location.search,
    //   hash: location.hash,
    //   timestamp: new Date().toISOString(),
    // });

  }, [location.pathname, location.search]);

  // This component has no visual output - it exists purely for side effects.
  return null;
}
