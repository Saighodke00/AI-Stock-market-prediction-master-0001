import React, { useState, useEffect } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';

interface StreamlitViewProps {
  pageUrl: string; // e.g. "http://localhost:8501/Market_Scanner"
  title: string;
}

export const StreamlitView: React.FC<StreamlitViewProps> = ({ pageUrl, title }) => {
  const [isLoading, setIsLoading] = useState(true);

  // When the URL changes, show the loader again
  useEffect(() => {
    setIsLoading(true);
  }, [pageUrl]);

  return (
    <div className="relative w-full h-[calc(100vh-64px-44px)] bg-void overflow-hidden">
      {/* Neural Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#020409] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan/10 via-base to-base">
          <div className="relative">
            <Loader2 className="w-16 h-16 text-cyan animate-spin-slow opacity-20" />
            <Loader2 className="absolute top-0 left-0 w-16 h-16 text-cyan animate-spin" />
          </div>
          <div className="mt-8 flex flex-col items-center gap-2">
            <h2 className="text-xl font-display font-black text-white tracking-widest uppercase animate-pulse">
              Initializing <span className="text-cyan">Neural Stream</span>
            </h2>
            <p className="text-[10px] font-mono font-bold text-muted uppercase tracking-[0.3em]">
              Synchronizing with Port 8501 // {title}
            </p>
          </div>
          
          {/* Diagnostic Stats (Visual only) */}
          <div className="absolute bottom-12 left-0 right-0 flex justify-center gap-12 text-[8px] font-mono text-slate-700 tracking-[0.2em] uppercase">
            <span>Protocol: WebSocket</span>
            <span>Frames: Buffered</span>
            <span>Bridge: Active</span>
          </div>
        </div>
      )}

      {/* The Streamlit Frame */}
      <iframe
        src={pageUrl}
        title={title}
        onLoad={() => setIsLoading(false)}
        className="w-full h-full border-none opacity-0 transition-opacity duration-1000 animate-in fade-in fill-mode-forwards"
        style={{ opacity: isLoading ? 0 : 1 }}
      />
      
      {/* External Link Fallback (visible if frame fails or user needs full screen) */}
      <a 
        href={pageUrl} 
        target="_blank" 
        rel="noopener noreferrer"
        className="absolute bottom-4 right-6 p-2 bg-white/5 border border-mid rounded-lg text-muted hover:text-cyan hover:bg-cyan/10 hover:border-cyan/30 transition-all group z-40"
        title="Open in new tab"
      >
        <ExternalLink size={14} className="group-hover:scale-110 transition-transform" />
      </a>
    </div>
  );
};
