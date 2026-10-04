'use client';

import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
  showWordmark?: boolean;
}

export default function Logo({ className = '', size = 34, showWordmark = false }: LogoProps) {
  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      {/* Official U& Brand Icon Badge */}
      <div
        style={{ width: size, height: size }}
        className="relative rounded-xl bg-[#1F1324] border border-[#FF8966]/50 flex items-center justify-center shadow-md overflow-hidden shrink-0"
      >
        <svg viewBox="0 0 512 512" className="w-full h-full p-0.5">
          <rect width="512" height="512" rx="112" fill="#1F1324" />
          <text
            x="50%"
            y="54%"
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="'Space Grotesk', system-ui, -apple-system, sans-serif"
            fontWeight="700"
            fontSize="220"
            letterSpacing="-4"
          >
            <tspan fill="#F6EFE9">U</tspan>
            <tspan fill="#FF8966">&amp;</tspan>
          </text>
        </svg>
      </div>

      {showWordmark && (
        <span className="font-extrabold text-lg text-[#F6EFE9] tracking-tight">
          U<span className="text-[#FF8966]">&</span>
        </span>
      )}
    </div>
  );
}
