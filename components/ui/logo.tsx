import React from "react";

interface LogoProps {
  size?: number;
  className?: string;
}

interface LogoTextProps {
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 40, className = "" }) => {
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-sm"
      >
        {/* Background circle with gradient */}
        <defs>
          <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: "#3B82F6", stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: "#1E40AF", stopOpacity: 1 }} />
          </linearGradient>
          <linearGradient id="iconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: "#FFFFFF", stopOpacity: 0.9 }} />
            <stop offset="100%" style={{ stopColor: "#E5E7EB", stopOpacity: 0.8 }} />
          </linearGradient>
        </defs>

        {/* Main circle background */}
        <circle cx="20" cy="20" r="18" fill="url(#bgGradient)" />

        {/* Search magnifying glass */}
        <g transform="translate(12, 12)">
          {/* Search circle */}
          <circle cx="7" cy="7" r="5" stroke="url(#iconGradient)" strokeWidth="2" fill="none" />

          {/* Search handle */}
          <path d="11 11L15 15" stroke="url(#iconGradient)" strokeWidth="2" strokeLinecap="round" />

          {/* Inner highlight for depth */}
          <circle
            cx="7"
            cy="7"
            r="3"
            fill="none"
            stroke="rgba(255, 255, 255, 0.4)"
            strokeWidth="1"
          />
        </g>

        {/* Small accent dots for modern touch */}
        <circle cx="24" cy="8" r="1.5" fill="rgba(255, 255, 255, 0.6)" />
        <circle cx="8" cy="24" r="1" fill="rgba(255, 255, 255, 0.4)" />
      </svg>
    </div>
  );
};

export const LogoText: React.FC<LogoTextProps> = ({ className = "" }) => {
  return (
    <div
      className={`font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent ${className}`}
    >
      더나와
    </div>
  );
};
