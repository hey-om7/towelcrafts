import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Scroll management for route transitions.
 *
 * Single-page apps preserve the window scroll position across route changes
 * by default, which is wrong when navigating *forward* into a new page (e.g.
 * opening a product from a long listing lands you partway down). But it is
 * exactly what we want when navigating *back* — the user expects to return to
 * where they were.
 *
 * Behavior:
 *   - PUSH / REPLACE (clicking a link, programmatic navigate): scroll to top.
 *   - POP (browser/back-forward or router back): restore the saved position
 *     for that location, falling back to top if none was recorded.
 *
 * Positions are keyed by the router-provided location key, so each history
 * entry restores independently. Renders nothing; must live inside the Router.
 */

// Module-level cache survives component re-renders for the session.
const scrollPositions = new Map();

export default function ScrollToTop() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const { key } = location;

  // Take over from the browser's native restoration so it doesn't conflict.
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      const previous = window.history.scrollRestoration;
      window.history.scrollRestoration = "manual";
      return () => {
        window.history.scrollRestoration = previous;
      };
    }
  }, []);

  // Continuously record the current location's scroll position so that when
  // the user later navigates back to it, we can restore it.
  useEffect(() => {
    const recordPosition = () => {
      scrollPositions.set(key, window.scrollY);
    };
    // Record on scroll (passive) and once immediately for the current entry.
    window.addEventListener("scroll", recordPosition, { passive: true });
    recordPosition();
    return () => window.removeEventListener("scroll", recordPosition);
  }, [key]);

  // Apply the correct scroll position when the location changes.
  useEffect(() => {
    if (navigationType === "POP") {
      const saved = scrollPositions.get(key);
      // Wait for the restored page to paint before scrolling.
      requestAnimationFrame(() => window.scrollTo(0, saved ?? 0));
    } else {
      window.scrollTo(0, 0);
    }
  }, [key, navigationType]);

  return null;
}
