
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

/**
 * MermaidDiagram Component
 * Renders once and stays static - no re-renders on scroll
 */
export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const chartRef = useRef(chart);
  const hasRenderedRef = useRef(false);

  useEffect(() => {
    if (hasRenderedRef.current) return;
    hasRenderedRef.current = true;
    
    let cancelled = false;
    const diagramId = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const render = async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        if (cancelled) return;
        
        const isDark = document.documentElement.classList.contains('dark');

        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          securityLevel: 'loose',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          flowchart: { htmlLabels: true, curve: 'basis' },
        });

        const { svg } = await mermaid.render(diagramId, chartRef.current.trim());
        if (cancelled) return;
        
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
        setStatus('success');
      } catch (err) {
        if (cancelled) return;
        console.error('Mermaid render error:', err);
        setErrorMsg(err instanceof Error ? err.message : 'Render failed');
        setStatus('error');
      }
    };

    render();
    return () => { cancelled = true; };
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(chartRef.current);
  }, []);

  if (status === 'loading') {
    return (
      <div className={`my-4 rounded-lg border border-border ${className}`}>
        <div className="px-4 py-2 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground">
          Mermaid Diagram
        </div>
        <div className="p-6 flex items-center justify-center min-h-[150px]">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
            <span className="text-sm text-muted-foreground">Rendering...</span>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={`my-4 rounded-lg border border-red-300 dark:border-red-800 ${className}`}>
        <div className="px-4 py-2 bg-red-100 dark:bg-red-900/30 border-b border-red-300 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-300">Error: {errorMsg}</p>
        </div>
        <div className="p-4 bg-muted overflow-x-auto">
          <pre className="text-xs whitespace-pre-wrap"><code>{chart}</code></pre>
        </div>
      </div>
    );
  }

  return (
    <div className={`my-4 rounded-lg border border-border ${className}`}>
      <div className="px-4 py-2 bg-muted/50 border-b border-border flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Mermaid Diagram</span>
        <button onClick={handleCopy} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted">
          Copy
        </button>
      </div>
      <div ref={containerRef} className="p-4 bg-background overflow-x-auto flex justify-center min-h-[100px]" />
    </div>
  );
};

export default MermaidDiagram;
