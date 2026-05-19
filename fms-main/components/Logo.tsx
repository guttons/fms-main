import React from 'react';

interface LogoProps {
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className = "h-12 w-auto" }) => {
  return (
    <svg 
      className={className} 
      viewBox="0 0 120 120" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Dynamic Background Glow */}
      <defs>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      
      <circle cx="60" cy="60" r="50" fill="url(#glow)" />

      {/* Abstract Tech/Fuel Shape */}
      <path 
        d="M60 15 L100 38 V82 L60 105 L20 82 V38 Z" 
        stroke="currentColor" 
        strokeWidth="8" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      
      {/* Droplet / Core indicator */}
      <path 
        d="M60 35 C60 35 45 55 45 65 C45 73.284 51.716 80 60 80 C68.284 80 75 73.284 75 65 C75 55 60 35 60 35 Z" 
        fill="currentColor" 
      />
      
      {/* Connecting nodes */}
      <circle cx="60" cy="15" r="6" fill="currentColor" />
      <circle cx="100" cy="38" r="6" fill="currentColor" />
      <circle cx="100" cy="82" r="6" fill="currentColor" />
      <circle cx="60" cy="105" r="6" fill="currentColor" />
      <circle cx="20" cy="82" r="6" fill="currentColor" />
      <circle cx="20" cy="38" r="6" fill="currentColor" />
    </svg>
  );
};
