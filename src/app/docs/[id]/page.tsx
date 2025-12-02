'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronDown, FileText, Book, ExternalLink, ArrowLeft, Download, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import JSZip from 'jszip';
import { Callout } from '@/components/docs/Callout';
import { CodeBlock } from '@/components/docs/CodeBlock';

interface TocItem {
  id: string;
  title: string;
  level: number;
}

interface Chapter {
  filename: string;
  title: string;
  content: string;
}

interface DocData {
  chapters: Chapter[];
  projectName: string;
  indexContent?: string;
  format: 'md' | 'mdx';
}

// Completely static Mermaid - renders once into a div, no React state updates
function StaticMermaidDiagram({ chart }: { chart: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const rendered = React.useRef(false);

  React.useLayoutEffect(() => {
    if (rendered.current || !containerRef.current) return;
    rendered.current = true;
    
    const container = containerRef.current;
    const id = `mermaid-${Math.random().toString(36).slice(2, 11)}`;
    
    // Render async but don't use any state
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        const isDark = document.documentElement.classList.contains('dark');
        
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          securityLevel: 'loose',
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: 'basis',
          },
          themeVariables: isDark ? {
            primaryColor: '#6366f1',
            primaryTextColor: '#f8fafc',
            primaryBorderColor: '#818cf8',
            lineColor: '#94a3b8',
            secondaryColor: '#1e293b',
            tertiaryColor: '#334155',
            background: '#0f172a',
            mainBkg: '#1e293b',
            nodeBorder: '#475569',
            clusterBkg: '#1e293b',
            clusterBorder: '#475569',
            titleColor: '#f8fafc',
            edgeLabelBackground: '#1e293b',
          } : {
            primaryColor: '#6366f1',
            primaryTextColor: '#1e293b',
            primaryBorderColor: '#818cf8',
            lineColor: '#64748b',
            secondaryColor: '#f1f5f9',
            tertiaryColor: '#e2e8f0',
            background: '#ffffff',
            mainBkg: '#f8fafc',
            nodeBorder: '#cbd5e1',
            clusterBkg: '#f1f5f9',
            clusterBorder: '#cbd5e1',
            titleColor: '#1e293b',
            edgeLabelBackground: '#ffffff',
          },
        });

        const { svg } = await mermaid.render(id, chart.trim());
        
        // Direct DOM - no React involvement
        if (container) {
          container.innerHTML = `
            <div class="mermaid-wrapper my-6">
              <div class="mermaid-content overflow-x-auto p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                ${svg}
              </div>
            </div>
          `;
          // Let SVG scale naturally
          const svgEl = container.querySelector('svg');
          if (svgEl) {
            svgEl.removeAttribute('height');
            svgEl.style.maxWidth = '100%';
            svgEl.style.height = 'auto';
          }
        }
      } catch (err) {
        if (container) {
          container.innerHTML = `
            <div class="my-6 p-4 border border-red-300 rounded-lg bg-red-50 dark:bg-red-900/20">
              <p class="text-sm text-red-600 dark:text-red-400 mb-2 font-medium">⚠️ Diagram rendering error</p>
              <p class="text-xs text-red-500 dark:text-red-400 mb-2">${err instanceof Error ? err.message : 'Failed to render'}</p>
              <details class="text-xs">
                <summary class="cursor-pointer text-muted-foreground hover:text-foreground">View source</summary>
                <pre class="mt-2 overflow-auto bg-red-100 dark:bg-red-900/30 p-2 rounded text-xs"><code>${chart.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
              </details>
            </div>
          `;
        }
      }
    })();
  }, []); // Empty - only runs once on mount

  // Initial placeholder - will be replaced by direct DOM manipulation
  return (
    <div 
      ref={containerRef}
      className="mermaid-container w-full"
      style={{ contain: 'layout style', contentVisibility: 'auto' }}
    >
      <div className="my-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="flex justify-center items-center min-h-[150px]">
          <div className="animate-pulse text-muted-foreground text-sm">Loading diagram...</div>
        </div>
      </div>
    </div>
  );
}

// Wrap with memo that ALWAYS returns true (never re-render from parent)
const StaticMermaid = React.memo(StaticMermaidDiagram, () => true);

export default function DocsViewerPage() {
  const params = useParams();
  const router = useRouter();
  const docId = params.id as string;

  const [docData, setDocData] = useState<DocData | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [activeHeading, setActiveHeading] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load doc data from localStorage
  useEffect(() => {
    if (!docId) return;
    
    try {
      const stored = localStorage.getItem(`doc-${docId}`);
      if (stored) {
        const data = JSON.parse(stored) as DocData;
        setDocData(data);
        setSelectedChapter(data.indexContent ? 'index' : data.chapters[0]?.filename || null);
      }
    } catch (err) {
      console.error('Failed to load doc:', err);
    } finally {
      setLoading(false);
    }
  }, [docId]);

  // Download handler
  const handleDownload = useCallback(async () => {
    if (!docData) return;
    setIsDownloading(true);
    try {
      const zip = new JSZip();
      const folderName = docData.projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const folder = zip.folder(folderName);
      
      if (folder) {
        if (docData.indexContent) {
          folder.file(`index.${docData.format}`, docData.indexContent);
        }
        docData.chapters.forEach((chapter) => {
          const fileName = chapter.filename.endsWith(`.${docData.format}`) 
            ? chapter.filename 
            : `${chapter.filename}.${docData.format}`;
          folder.file(fileName, chapter.content);
        });

        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${folderName}_docs.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  }, [docData]);

  // Current chapter
  const currentChapter = useMemo(() => {
    if (!docData || !selectedChapter) return null;
    if (selectedChapter === 'index') {
      return { filename: 'index', title: docData.projectName, content: docData.indexContent || '' };
    }
    return docData.chapters.find(c => c.filename === selectedChapter);
  }, [selectedChapter, docData]);

  // TOC items
  const tocItems = useMemo((): TocItem[] => {
    if (!currentChapter?.content) return [];
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const items: TocItem[] = [];
    let match;
    while ((match = headingRegex.exec(currentChapter.content)) !== null) {
      const level = match[1].length;
      const title = match[2].trim();
      const id = title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
      items.push({ id, title, level });
    }
    return items;
  }, [currentChapter?.content]);

  // Scroll spy - uses window scroll now since main content scrolls with page
  // Throttled to prevent scroll jank
  useEffect(() => {
    let ticking = false;
    let lastActiveHeading: string | null = null;
    
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      
      requestAnimationFrame(() => {
        const headings = document.querySelectorAll('.doc-content h1, .doc-content h2, .doc-content h3');
        let currentActive: string | null = null;
        headings.forEach((heading) => {
          const rect = heading.getBoundingClientRect();
          if (rect.top <= 120) {
            currentActive = heading.id;
          }
        });
        // Only update state if heading changed to minimize re-renders
        if (currentActive !== lastActiveHeading) {
          lastActiveHeading = currentActive;
          setActiveHeading(currentActive);
        }
        ticking = false;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentChapter]);

  const scrollToHeading = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Markdown renderer
  const renderMarkdown = (content: string) => {
    let processedContent = content;
    if (docData?.format === 'mdx') {
      processedContent = processedContent.replace(/^---[\s\S]*?---\n*/m, '');
      processedContent = processedContent.replace(/^import\s+.*$/gm, '');
    }

    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => {
            const id = String(children).toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
            return <h1 id={id} className="text-3xl font-bold mt-8 mb-4 scroll-mt-24">{children}</h1>;
          },
          h2: ({ children }) => {
            const id = String(children).toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
            return <h2 id={id} className="text-2xl font-semibold mt-8 mb-3 scroll-mt-24 pb-2 border-b">{children}</h2>;
          },
          h3: ({ children }) => {
            const id = String(children).toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
            return <h3 id={id} className="text-xl font-semibold mt-6 mb-2 scroll-mt-24">{children}</h3>;
          },
          h4: ({ children }) => <h4 className="text-lg font-semibold mt-4 mb-2">{children}</h4>,
          p: ({ children }) => <p className="my-4 leading-7">{children}</p>,
          ul: ({ children }) => <ul className="my-4 ml-6 list-disc space-y-2">{children}</ul>,
          ol: ({ children }) => <ol className="my-4 ml-6 list-decimal space-y-2">{children}</ol>,
          li: ({ children }) => <li className="leading-7">{children}</li>,
          blockquote: ({ children }) => <Callout type="info">{children}</Callout>,
          code: ({ className, children }) => {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;
            
            if (isInline) {
              return <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-sm">{children}</code>;
            }
            
            if (match?.[1] === 'mermaid') {
              return <StaticMermaid chart={String(children).trim()} />;
            }
            
            return <CodeBlock language={match?.[1] || 'plaintext'}>{String(children).trim()}</CodeBlock>;
          },
          pre: ({ children }) => <>{children}</>,
          a: ({ href, children }) => {
            const isExternal = href?.startsWith('http');
            return (
              <a
                href={href}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                {children}
                {isExternal && <ExternalLink className="h-3 w-3" />}
              </a>
            );
          },
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto">
              <table className="w-full border-collapse border border-border">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
          th: ({ children }) => <th className="px-4 py-2 text-left font-semibold border border-border">{children}</th>,
          td: ({ children }) => <td className="px-4 py-2 border border-border">{children}</td>,
          hr: () => <hr className="my-8 border-border" />,
        }}
      >
        {processedContent}
      </ReactMarkdown>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading documentation...</p>
        </div>
      </div>
    );
  }

  if (!docData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <p className="text-muted-foreground">Documentation not found</p>
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to App
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Book className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">{docData.projectName}</h1>
              <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary uppercase font-medium">
                {docData.format}
              </span>
            </div>
          </div>
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
          >
            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download
          </button>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-57px)]">
        {/* Left sidebar - Chapters (sticky) */}
        <aside 
          className={cn(
            'border-r bg-muted/30 transition-all duration-300 flex-shrink-0 h-[calc(100vh-57px)] sticky top-[57px]',
            sidebarCollapsed ? 'w-12' : 'w-64'
          )}
          style={{ willChange: 'transform' }}
        >
          <div className="h-full flex flex-col">
            <div className="p-2 border-b flex-shrink-0">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="w-full p-2 hover:bg-muted rounded-lg transition-colors flex items-center justify-center"
              >
                {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
            
            {!sidebarCollapsed && (
              <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                {docData.indexContent && (
                  <button
                    onClick={() => setSelectedChapter('index')}
                    className={cn(
                      'w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2',
                      selectedChapter === 'index' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                    )}
                  >
                    <Book className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">Overview</span>
                  </button>
                )}
                
                {docData.chapters.map((chapter, index) => (
                  <button
                    key={chapter.filename}
                    onClick={() => setSelectedChapter(chapter.filename)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2',
                      selectedChapter === chapter.filename ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                    )}
                  >
                    <FileText className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{chapter.title || `Chapter ${index + 1}`}</span>
                  </button>
                ))}
              </nav>
            )}
          </div>
        </aside>

        {/* Main content (scrolls naturally) */}
        <main 
          id="doc-main-content" 
          className="flex-1 min-w-0"
          style={{ overflowAnchor: 'none' }}
        >
          <article className="doc-content max-w-4xl mx-auto px-8 py-8">
            {currentChapter ? renderMarkdown(currentChapter.content) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                Select a chapter to view
              </div>
            )}
          </article>
        </main>

        {/* Right sidebar - TOC (sticky) */}
        <aside 
          className="hidden xl:block w-64 border-l bg-muted/30 flex-shrink-0 h-[calc(100vh-57px)] sticky top-[57px]"
          style={{ willChange: 'transform' }}
        >
          <div className="h-full overflow-y-auto p-4">
            <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wide">
              On This Page
            </h3>
            <nav className="space-y-1">
              {tocItems.map((item, index) => (
                <button
                  key={`${item.id}-${index}`}
                  onClick={() => scrollToHeading(item.id)}
                  className={cn(
                    'block w-full text-left text-sm py-1.5 transition-colors hover:text-foreground',
                    item.level === 1 && 'font-semibold',
                    item.level === 2 && 'pl-2',
                    item.level === 3 && 'pl-4',
                    item.level >= 4 && 'pl-6',
                    activeHeading === item.id ? 'text-primary font-medium' : 'text-muted-foreground'
                  )}
                >
                  {item.title}
                </button>
              ))}
              {tocItems.length === 0 && (
                <p className="text-sm text-muted-foreground italic">No headings</p>
              )}
            </nav>
          </div>
        </aside>
      </div>
    </div>
  );
}
