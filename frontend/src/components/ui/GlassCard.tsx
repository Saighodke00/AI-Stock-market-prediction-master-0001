import React, { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  icon?: ReactNode;
}

export default function GlassCard({ children, className = '', title, icon }: GlassCardProps) {
  return (
    <div className={`bg-[#0d1320]/80 backdrop-blur-md border border-[#1f2937] rounded-xl p-6 shadow-2xl relative overflow-hidden group ${className}`}>
      {/* Subtle premium UI background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
      
      {/* Header section if title or icon are provided */}
      {(title || icon) && (
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#1f2937]/60 relative z-10">
          {icon && <div className="p-1.5 bg-[#1f2937]/50 rounded-lg">{icon}</div>}
          {title && <h3 className="text-sm font-semibold tracking-wider text-gray-300 font-display">{title}</h3>}
        </div>
      )}
      
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
