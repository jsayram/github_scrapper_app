'use client';

import React, { useEffect, useRef, useState, useId } from 'react';
import { useTheme } from 'next-themes';

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

/**
 * MermaidDiagram Component
 * Renders Mermaid diagrams with theme support and error handling
 * 
 * Requires: npm install mermaid
 */
export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { resolvedTheme } = useTheme();
  const uniqueId = useId().replace(/:/g, '-');

  useEffect(() => {
    let isMounted = true;

    const renderDiagram = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Dynamically import mermaid to avoid SSR issues
        const mermaid = (await import('mermaid')).default;

        // Initialize mermaid with theme based on current app theme
        mermaid.initialize({
          startOnLoad: false,
          theme: resolvedTheme === 'dark' ? 'dark' : 'default',
          securityLevel: 'loose',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          flowchart: {
            htmlLabels: true,
            curve: 'basis',
          },
          themeVariables: resolvedTheme === 'dark' ? {
            primaryColor: '#6366f1',
            primaryTextColor: '#f3f4f6',
            primaryBorderColor: '#4f46e5',
            lineColor: '#9ca3af',
            secondaryColor: '#374151',
            tertiaryColor: '#1f2937',
            background: '#111827',
            mainBkg: '#1f2937',
            nodeBorder: '#4b5563',
            clusterBkg: '#1f2937',
            clusterBorder: '#374151',
            titleColor: '#f9fafb',
            edgeLabelBackground: '#374151',
          } : {
            primaryColor: '#6366f1',
            primaryTextColor: '#1f2937',
            primaryBorderColor: '#4f46e5',
            lineColor: '#6b7280',
            secondaryColor: '#e5e7eb',
            tertiaryColor: '#f3f4f6',
          },
        });

        // Generate unique ID for this render
        const diagramId = `mermaid-diagram-${uniqueId}-${Date.now()}`;
        
        // Render the diagram
        const { svg: renderedSvg } = await mermaid.render(diagramId, chart.trim());
        
        if (isMounted) {
          setSvg(renderedSvg);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to render diagram');
          setIsLoading(false);
        }
      }
    };

    renderDiagram();

    return () => {
      isMounted = false;
    };
  }, [chart, resolvedTheme, uniqueId]);

  // Loading state
  if (isLoading) {
    return (
      <div className={`my-4 p-6 bg-muted rounded-lg flex items-center justify-center ${className}`}>
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">Rendering diagram...</span>
        </div>
      </div>
    );
  }

  // Error state - show the raw code with error message
  if (error) {
    return (
      <div className={`my-4 rounded-lg overflow-hidden ${className}`}>
        <div className="px-4 py-2 bg-red-100 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Diagram Error: {error}
          </p>
        </div>
        <div className="p-4 bg-muted overflow-x-auto">
          <pre className="text-sm">
            <code className="text-muted-foreground">{chart}</code>
          </pre>
        </div>
      </div>
    );
  }

  // Successfully rendered diagram
  return (
    <div className={`my-4 rounded-lg overflow-hidden border border-border ${className}`}>
      {/* Header */}
      <div className="px-4 py-2 bg-muted/50 border-b border-border flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-2">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3h18v18H3zM12 8v8M8 12h8" />
          </svg>
          Mermaid Diagram
        </span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(chart);
          }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
          title="Copy diagram source"
        >
          Copy Source
        </button>
      </div>
      
      {/* Diagram - with proper scroll container */}
      <div 
        ref={containerRef}
        className="p-4 bg-background overflow-auto max-h-[600px]"
        style={{ minHeight: '200px' }}
      >
        <div 
          className="flex justify-center min-w-fit"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
};

export default MermaidDiagram;
