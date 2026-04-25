// Create a new file: components/VNCViewer.tsx
"use client";

import { useEffect, useRef } from "react";

interface VNCViewerProps {
  streamUrl: string | null;
}

export default function VNCViewer({ streamUrl }: VNCViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Inject CSS to hide fullscreen button
  useEffect(() => {
    if (!iframeRef.current) return;
    
    const hideFullscreenButton = () => {
      try {
        const iframe = iframeRef.current;
        if (!iframe || !iframe.contentDocument) return;
        
        // Hide the fullscreen button in the iframe
        const style = iframe.contentDocument.createElement('style');
        style.textContent = `
          button[title*="Fullscreen"],
          button[aria-label*="Fullscreen"],
          .fullscreen-btn,
          [data-testid="fullscreen"] {
            display: none !important;
          }
        `;
        iframe.contentDocument.head.appendChild(style);
      } catch (e) {
        // Cross-origin restrictions - ignore
        console.log("Cannot modify iframe content due to CORS");
      }
    };
    
    // Attempt to hide after iframe loads
    const iframeElement = iframeRef.current;
    iframeElement?.addEventListener('load', hideFullscreenButton);
    
    return () => {
      iframeElement?.removeEventListener('load', hideFullscreenButton);
    };
  }, [streamUrl]);

  if (!streamUrl) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin text-2xl mb-2">⚪</div>
          <p className="text-sm">Loading desktop...</p>
        </div>
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      src={streamUrl}
      className="w-full h-full"
      title="Desktop Stream"
      allow="fullscreen"
      sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"
    />
  );
}