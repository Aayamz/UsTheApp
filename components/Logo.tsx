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
      {/* Official U& Logo Image from the app folder */}
      <img
        src="/icon-192.png"
        alt="U& Logo"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="rounded-xl object-cover shadow-md shrink-0 border border-[#FF8966]/40 bg-[#1F1324]"
      />

      {showWordmark && (
        <span className="font-extrabold text-lg text-[#F6EFE9] tracking-tight">
          U<span className="text-[#FF8966]">&</span>
        </span>
      )}
    </div>
  );
}
