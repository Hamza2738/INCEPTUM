import React from "react";

export default function RegionalScene({ regionId }) {
  if (regionId === "JP") return (
    <svg className="regional-scene regional-scene-jp" viewBox="0 0 1200 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <circle className="scene-sun" cx="1002" cy="58" r="38" />
      <path className="scene-mountain far" d="M0 180L170 92l92 54 150-102 180 136 170-96 170 96 268-104v144H0z" />
      <path className="scene-mountain near" d="M0 198l230-74 168 54 190-84 180 104 242-62 190 62v34H0z" />
      <g className="scene-fields">
        <path d="M170 220c65-38 140-52 220-38 92 16 145 7 210-28 62-33 132-48 210-18 84 32 150 16 220-8v92H170z" />
        <path d="M210 220c62-26 123-34 188-24M288 220c72-20 145-24 220-10M410 220c52-20 110-28 168-22M520 220c66-23 140-26 220-8M650 220c70-18 142-13 220 8" />
      </g>
      <g className="scene-mist"><path d="M0 166c170-22 270 16 430-2s270-8 420 6 270-5 350-20" /><path d="M80 188c180-14 300 12 470-3s280-10 440 4" /></g>
    </svg>
  );
  return (
    <svg className="regional-scene regional-scene-tn" viewBox="0 0 1200 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <circle className="scene-sun" cx="985" cy="54" r="44" />
      <path className="scene-dune far" d="M0 175c210-58 390-35 590 10 180 40 390 12 610-34v69H0z" />
      <path className="scene-dune near" d="M0 198c170-38 330-22 500 5 250 40 470-22 700-34v51H0z" />
      <path className="scene-canal" d="M520 220c45-20 130-28 220-15 76 11 150 9 250-12v27H520z" />
      <g className="scene-palm">
        <path d="M170 190c8-48 12-74 18-106M188 84c-25-12-43-10-58 4M188 84c24-18 48-18 67-4M188 84c-6-25-2-43 13-57M188 84c26 4 45 16 55 34" />
        <path d="M1028 194c6-42 10-68 14-94M1042 100c-22-10-38-8-50 4M1042 100c20-16 40-16 56-4M1042 100c-5-22-1-38 11-50M1042 100c22 4 38 14 46 28" />
      </g>
    </svg>
  );
}
