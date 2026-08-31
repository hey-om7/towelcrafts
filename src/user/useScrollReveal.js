import { useEffect } from "react";

/**
 * Reveals elements carrying a [data-reveal] attribute as they scroll into view.
 *
 * Uses a throttled scroll/resize check against getBoundingClientRect rather
 * than IntersectionObserver — this is fully reliable across React StrictMode
 * double-mounting and fast programmatic scrolling, and can never leave content
 * stuck invisible. Purely presentational.
 *
 * The hidden state itself is gated behind `html.reveal-on` (set in index.js
 * only when motion + scripting are available), so if this hook never runs the
 * content simply shows with no animation.
 */
export function useScrollReveal(deps = []) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;
    const nodes = () => Array.from(document.querySelectorAll("[data-reveal]:not(.is-visible)"));

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReduced) {
      document.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("is-visible"));
      root.classList.remove("reveal-on");
      return;
    }

    let ticking = false;

    const reveal = () => {
      ticking = false;
      const trigger = window.innerHeight * 0.92;
      const remaining = nodes();
      remaining.forEach((el) => {
        if (el.getBoundingClientRect().top < trigger) {
          el.classList.add("is-visible");
        }
      });
      if (document.querySelectorAll("[data-reveal]:not(.is-visible)").length === 0) {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
      }
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(reveal);
      }
    };

    // Reveal whatever is already in view, then watch for scrolling.
    reveal();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    // Safety net: if anything is still hidden shortly after mount (e.g. late
    // layout/image loads shifting positions), re-check.
    const t = window.setTimeout(reveal, 600);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
