import React from "react";

// Shield + drop mark. Uses the theme colours so it re-skins per country.
export default function Logo({ className = "", mono = false, style }) {
  return (
    <svg className={className} style={style} viewBox="0 0 64 64" role="img" aria-label="SalinityShield">
      <path d="M32 4 56 14v18c0 14-10 24-24 28C18 56 8 46 8 32V14z" fill={mono ? "#fff" : "var(--primary)"} />
      <path d="M32 18c-7 9-10 14-10 19a10 10 0 0 0 20 0c0-5-3-10-10-19z" fill={mono ? "var(--primary)" : "var(--accent)"} />
    </svg>
  );
}
