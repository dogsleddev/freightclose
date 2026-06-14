"use client";

// Light/dark toggle. The actual class is set pre-paint by an inline script in
// the layout (no FOUC); this just flips it and persists the choice. Default is
// the brand parchment light theme unless the visitor has chosen dark before.

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("fc-theme", next ? "dark" : "light");
    } catch {
      /* ignore (private mode) */
    }
  };

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
      title={`Switch to ${dark ? "light" : "dark"} mode`}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-parchment/70 ring-1 ring-inset ring-parchment/20 transition hover:text-parchment hover:ring-parchment/40"
    >
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {mounted && dark ? (
          // sun
          <>
            <circle cx="8" cy="8" r="3" />
            <path d="M8 1.5v1.5M8 13v1.5M2.4 2.4l1 1M12.6 12.6l1 1M1.5 8H3M13 8h1.5M2.4 13.6l1-1M12.6 3.4l1-1" />
          </>
        ) : (
          // moon
          <path d="M13 9.3A5.2 5.2 0 0 1 6.7 3a5.2 5.2 0 1 0 6.3 6.3z" />
        )}
      </svg>
      <span suppressHydrationWarning>{mounted && dark ? "Light" : "Dark"}</span>
    </button>
  );
}
