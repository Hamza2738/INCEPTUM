import React from "react";

export function CropGlyph({ cropId, size = 26 }) {
  const id = String(cropId || "").toLowerCase();
  const common = { width: size, height: size, viewBox: "0 0 32 32", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  if (id.includes("date") || id.includes("palm") || id.includes("datt")) return <svg {...common}><path d="M16 28V14M16 14C10 10 7 11 5 14M16 14c6-4 9-3 11 0M16 14c-3-5-2-9 1-12M16 14c5-6 9-7 12-5M16 14c-7-6-11-5-13-2" /></svg>;
  if (id.includes("olive") || id.includes("oliv") ) return <svg {...common}><path d="M16 28V6M16 10c-5-4-8-3-10 1M16 15c5-4 8-3 10 1M16 20c-5-4-8-3-10 1M16 25c5-4 8-3 10 1" /><circle cx="6" cy="12" r="2" fill="currentColor" /><circle cx="26" cy="17" r="2" fill="currentColor" /></svg>;
  if (id.includes("tomato") || id.includes("greenhouse") || id.includes("tomate") ) return <svg {...common}><path d="M16 27c7 0 11-5 9-12-2-6-8-8-9-8s-7 2-9 8c-2 7 2 12 9 12zM16 7V3M16 7l-5-3M16 7l5-3" /></svg>;
  if (id.includes("rice") || id.includes("riz") ) return <svg {...common}><path d="M16 29V7M16 12l-6-4M16 17l-7-5M16 22l-6-4M16 12l6-4M16 17l7-5M16 22l6-4" /></svg>;
  if (id.includes("wheat") || id.includes("cereal") || id.includes("ble") ) return <svg {...common}><path d="M16 29V5M16 10l-5-3M16 14l-6-3M16 18l-6-3M16 22l-6-3M16 10l5-3M16 14l6-3M16 18l6-3M16 22l6-3" /></svg>;
  return <svg {...common}><path d="M16 28V10M16 10C9 10 6 6 7 3c6 0 9 3 9 7zm0 0c7 0 10-4 9-7-6 0-9 3-9 7zM16 18c-6 0-9-3-8-6 5 0 8 2 8 6zm0 0c6 0 9-3 8-6-5 0-8 2-8 6z" /></svg>;
}
