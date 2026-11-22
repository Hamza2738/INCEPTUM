import React from "react";

export default function Logo({ className = "", style }) {
  return (
    <img
      className={className}
      style={style}
      src="/kizuna-logo.png"
      alt=""
      aria-label="Kizuna خير"
    />
  );
}
