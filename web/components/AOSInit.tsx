"use client";

import {useEffect} from "react";
import {usePathname} from "next/navigation";
import AOS from "aos";
import "aos/dist/aos.css";

let inited = false;

/**
 * Global AOS (Animate On Scroll) bootstrap.
 *
 * Initializes once on mount and re-scans after client-side route changes so
 * dashboard pages (which render behind the login gate and load async data)
 * get their entrance animations registered. Respects prefers-reduced-motion:
 * AOS strips data-aos attributes when disabled, and globals.css adds an extra
 * CSS-level guard for elements mounted after init.
 */
export function AOSInit() {
  const pathname = usePathname();

  useEffect(() => {
    if (inited) return;
    inited = true;
    AOS.init({
      duration: 500,
      easing: "ease-out-cubic",
      once: true,
      offset: 80,
      anchorPlacement: "top-bottom",
      disable: () =>
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(() => AOS.refreshHard());
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  return null;
}
