/**
 * src/hooks/use-mobile.jsx
 *
 * Custom React hook that detects whether the current viewport is
 * mobile-sized (width < 768px). This is the standard shadcn/ui
 * mobile detection hook.
 *
 * How it works:
 * - Uses window.matchMedia() to listen for viewport width changes,
 *   which is more performant than listening to the "resize" event
 *   because matchMedia only fires when the breakpoint is crossed,
 *   not on every pixel change.
 *
 * - The 768px breakpoint matches Tailwind's "md" breakpoint, keeping
 *   JS-based responsive logic in sync with CSS-based responsive design.
 *
 * - Returns `undefined` during SSR/initial render (before useEffect runs),
 *   then the actual boolean value once mounted. The !! coercion ensures
 *   undefined becomes false for consumers that expect a boolean.
 *
 * Usage:
 *   const isMobile = useIsMobile();
 *   if (isMobile) { // Show mobile layout }
 */

import * as React from "react";

/** Breakpoint in pixels below which the viewport is considered mobile */
const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(undefined);

  React.useEffect(() => {
    // Create a media query list that matches viewports narrower than 768px
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    // Handler fires only when crossing the breakpoint threshold
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // Listen for future breakpoint crossings
    mql.addEventListener("change", onChange);

    // Set the initial value on mount
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);

    // Cleanup: remove the listener when the component unmounts
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Coerce undefined to false so callers always get a boolean
  return !!isMobile;
}
