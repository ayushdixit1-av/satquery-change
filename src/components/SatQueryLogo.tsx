import React from 'react';

interface SatQueryLogoProps {
  className?: string;
  size?: number;
}

export const SatQueryLogo: React.FC<SatQueryLogoProps> = ({
  className = 'w-9 h-9',
  size,
}) => {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      aria-label="SatQuery Earth and Satellite Logo"
    >
      <defs>
        {/* Outer Dark Cosmic Vignette */}
        <radialGradient
          id="spaceAura"
          cx="50%"
          cy="50%"
          r="50%"
          fx="50%"
          fy="50%"
        >
          <stop offset="0%" stopColor="#040814" />
          <stop offset="65%" stopColor="#081126" />
          <stop offset="85%" stopColor="#0d1b3a" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </radialGradient>

        {/* 3D Earth Ocean Gradient */}
        <radialGradient
          id="earthSphere"
          cx="42%"
          cy="38%"
          r="55%"
          fx="35%"
          fy="30%"
        >
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="45%" stopColor="#1e3a8a" />
          <stop offset="80%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </radialGradient>

        {/* Specular Highlight on Earth */}
        <radialGradient
          id="earthGloss"
          cx="36%"
          cy="30%"
          r="40%"
        >
          <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#60a5fa" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0" />
        </radialGradient>

        {/* Atmosphere Limb Glow */}
        <radialGradient
          id="earthAtmosphere"
          cx="50%"
          cy="50%"
          r="50%"
        >
          <stop offset="82%" stopColor="#38bdf8" stopOpacity="0" />
          <stop offset="94%" stopColor="#38bdf8" stopOpacity="0.45" />
          <stop offset="99%" stopColor="#93c5fd" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#e0f2fe" stopOpacity="1" />
        </radialGradient>

        {/* Orbit Ring Gradient */}
        <linearGradient id="orbitGlow" x1="20" y1="160" x2="160" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
          <stop offset="30%" stopColor="#bae6fd" />
          <stop offset="70%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.85" />
        </linearGradient>

        {/* Solar Panels Gradient */}
        <linearGradient id="solarCell" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>

        {/* Satellite Metal Body */}
        <linearGradient id="satMetal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e0f2fe" />
          <stop offset="50%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>

        {/* Clip Earth Globe */}
        <clipPath id="earthClip">
          <circle cx="95" cy="110" r="48" />
        </clipPath>

        {/* Outer Glow Filter */}
        <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Dark Outer Space Nebula Cloud Background */}
      <circle cx="100" cy="100" r="88" fill="url(#spaceAura)" />

      {/* Background Stars */}
      <g transform="translate(68, 68)">
        <path
          d="M0 -7 Q0 0 7 0 Q0 0 0 7 Q0 0 -7 0 Q0 0 0 -7 Z"
          fill="#93c5fd"
          filter="url(#cyanGlow)"
        />
        <circle cx="0" cy="0" r="1.5" fill="#ffffff" />
      </g>

      <g transform="translate(138, 118)">
        <path
          d="M0 -5 Q0 0 5 0 Q0 0 0 5 Q0 0 -5 0 Q0 0 0 -5 Z"
          fill="#93c5fd"
        />
        <circle cx="0" cy="0" r="1" fill="#ffffff" />
      </g>

      {/* Back Half of Orbit Ring */}
      <g opacity="0.5">
        <ellipse
          cx="96"
          cy="108"
          rx="62"
          ry="32"
          transform="rotate(-28 96 108)"
          stroke="#38bdf8"
          strokeWidth="2.5"
          strokeDasharray="90 140"
          strokeDashoffset="75"
        />
      </g>

      {/* EARTH SPHERE */}
      <g>
        <circle cx="95" cy="110" r="48" fill="url(#earthSphere)" />

        <g clipPath="url(#earthClip)">
          <circle cx="95" cy="110" r="48" fill="url(#earthGloss)" />

          <g fill="#e2e8f0" stroke="#f8fafc" strokeWidth="0.5" opacity="0.95">
            {/* Greenland */}
            <path d="M96 74 C100 73, 105 77, 103 82 C100 85, 94 84, 93 80 Z" />

            {/* North America */}
            <path d="M68 85 C73 80, 84 81, 91 85 C95 87, 100 92, 97 97 C94 100, 93 98, 89 97 C86 96, 85 99, 83 103 C80 106, 76 106, 73 102 C70 99, 66 98, 64 94 C63 90, 65 87, 68 85 Z" />

            {/* Central America & Caribbean */}
            <path d="M78 103 C81 104, 82 107, 85 110 C86 112, 85 114, 83 113 C80 111, 79 107, 78 103 Z" />

            {/* South America */}
            <path d="M83 113 C87 112, 95 114, 102 120 C106 124, 105 130, 101 137 C97 143, 93 151, 89 154 C87 155, 85 152, 86 146 C87 140, 84 135, 82 130 C80 126, 80 119, 83 113 Z" />

            {/* Right continent edge */}
            <path d="M125 90 C130 92, 137 98, 140 106 C141 113, 137 118, 134 122 C131 125, 128 120, 129 114 C130 108, 126 102, 123 97 C122 93, 123 91, 125 90 Z" />

            {/* Islands */}
            <circle cx="75" cy="80" r="1.5" />
            <circle cx="88" cy="108" r="1.2" />
            <circle cx="106" cy="128" r="1" />
          </g>

          {/* Atmosphere Rim Shading */}
          <circle cx="95" cy="110" r="48" fill="url(#earthAtmosphere)" />

          {/* Terminator Shadow */}
          <path
            d="M95 62 C115 72, 126 95, 123 125 C121 145, 108 155, 95 158 C122 158, 143 137, 143 110 C143 83, 122 62, 95 62 Z"
            fill="#020617"
            opacity="0.35"
          />
        </g>

        {/* Outer Rim */}
        <circle
          cx="95"
          cy="110"
          r="48.5"
          stroke="#60a5fa"
          strokeWidth="1.5"
          opacity="0.8"
        />
      </g>

      {/* Front Half of Orbit */}
      <g filter="url(#cyanGlow)">
        <ellipse
          cx="96"
          cy="108"
          rx="62"
          ry="32"
          transform="rotate(-28 96 108)"
          stroke="url(#orbitGlow)"
          strokeWidth="3.2"
          strokeDasharray="140 90"
          strokeDashoffset="-25"
          strokeLinecap="round"
        />
      </g>

      {/* Orbit Beacon */}
      <g transform="translate(62, 142)">
        <circle cx="0" cy="0" r="5" fill="#38bdf8" filter="url(#cyanGlow)" />
        <circle cx="0" cy="0" r="4.2" fill="#e0f2fe" />
        <circle cx="-1" cy="-1" r="1.5" fill="#ffffff" />
      </g>

      {/* UPPER-RIGHT SATELLITE */}
      <g transform="translate(132, 66) rotate(-38)">
        <rect
          x="-7"
          y="-8"
          width="14"
          height="16"
          rx="2.5"
          fill="url(#satMetal)"
          stroke="#e0f2fe"
          strokeWidth="1"
        />
        <rect x="-4" y="-5" width="8" height="10" rx="1" fill="#0f172a" />
        <circle cx="0" cy="0" r="2" fill="#38bdf8" />

        {/* Dish */}
        <path
          d="M-5 9 C-5 13, 5 13, 5 9"
          stroke="#e0f2fe"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
        <line x1="0" y1="8" x2="0" y2="13" stroke="#e0f2fe" strokeWidth="1.2" />
        <circle cx="0" cy="14" r="1.5" fill="#38bdf8" />

        {/* Wing Rods */}
        <line x1="-7" y1="0" x2="-13" y2="0" stroke="#bae6fd" strokeWidth="2" strokeLinecap="round" />
        <line x1="7" y1="0" x2="13" y2="0" stroke="#bae6fd" strokeWidth="2" strokeLinecap="round" />

        {/* Left Solar Panel */}
        <g transform="translate(-13, 0)">
          <rect
            x="-24"
            y="-9"
            width="24"
            height="18"
            rx="1.5"
            fill="url(#solarCell)"
            stroke="#bae6fd"
            strokeWidth="1.2"
          />
          <line x1="-16" y1="-9" x2="-16" y2="9" stroke="#93c5fd" strokeWidth="0.8" opacity="0.8" />
          <line x1="-8" y1="-9" x2="-8" y2="9" stroke="#93c5fd" strokeWidth="0.8" opacity="0.8" />
          <line x1="-24" y1="0" x2="0" y2="0" stroke="#93c5fd" strokeWidth="0.8" opacity="0.8" />
        </g>

        {/* Right Solar Panel */}
        <g transform="translate(13, 0)">
          <rect
            x="0"
            y="-9"
            width="24"
            height="18"
            rx="1.5"
            fill="url(#solarCell)"
            stroke="#bae6fd"
            strokeWidth="1.2"
          />
          <line x1="8" y1="-9" x2="8" y2="9" stroke="#93c5fd" strokeWidth="0.8" opacity="0.8" />
          <line x1="16" y1="-9" x2="16" y2="9" stroke="#93c5fd" strokeWidth="0.8" opacity="0.8" />
          <line x1="0" y1="0" x2="24" y2="0" stroke="#93c5fd" strokeWidth="0.8" opacity="0.8" />
        </g>
      </g>
    </svg>
  );
};
