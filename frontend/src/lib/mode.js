import { useEffect, useState } from "react";

// Light / dark display mode. Stored per browser; the first visit follows the system setting.
const KEY = "ss_mode";

function initial() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch (e) { /* storage blocked: fall back to the system */ }
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyMode(mode) {
  document.documentElement.setAttribute("data-mode", mode);
}

// Apply as soon as this module loads, before React renders, so the page never flashes the wrong theme.
applyMode(initial());

export function useMode() {
  const [mode, setMode] = useState(() => document.documentElement.getAttribute("data-mode") || initial());
  useEffect(() => { applyMode(mode); }, [mode]);
  const toggle = () => setMode((m) => {
    const next = m === "dark" ? "light" : "dark";
    try { localStorage.setItem(KEY, next); } catch (e) { /* ignore */ }
    return next;
  });
  return [mode, toggle];
}
