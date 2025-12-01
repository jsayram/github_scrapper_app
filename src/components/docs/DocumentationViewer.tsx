'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronDown, FileText, Book, ExternalLink, X, Download, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import JSZip from 'jszip';
import { Callout } from './Callout';
import { CodeBlock } from './CodeBlock';

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

interface DocumentationViewerProps {
  chapters: Chapter[];
  projectName: string;
  indexContent?: string;
  format: 'md' | 'mdx';
  className?: string;
  onClose?: () => void;
}

export const DocumentationViewer: React.FC<DocumentationViewerProps> = ({
  chapters,
  projectName,
  indexContent,
  format,
  className,
  onClose,
}) => {
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [activeHeading, setActiveHeading] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Download all documentation as a zip file
  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    try {
      const zip = new JSZip();
      const folderName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const folder = zip.folder(folderName);
      
      if (!folder) {
        throw new Error('Failed to create zip folder');
      }

      // Add index file if it exists
      if (indexContent) {
        folder.file(`index.${format}`, indexContent);
      }

      // Add all chapters
      chapters.forEach((chapter) => {
        const fileName = chapter.filename.endsWith(`.${format}`) 
          ? chapter.filename 
          : `${chapter.filename}.${format}`;
        folder.file(fileName, chapter.content);
      });

      // Generate the zip file
      const blob = await zip.generateAsync({ type: 'blob' });
      
      // Create download link and trigger download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${folderName}_tutorial.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download documentation:', error);
    } finally {
      setIsDownloading(false);
    }
  }, [chapters, projectName, indexContent, format]);

  // Get current chapter content
  const currentChapter = useMemo(() => {
    if (!selectedChapter) return null;
    if (selectedChapter === 'index') {
      return { filename: 'index', title: projectName, content: indexContent || '' };
    }
    return chapters.find(c => c.filename === selectedChapter);
  }, [selectedChapter, chapters, indexContent, projectName]);

  // Parse headings for TOC
  const tocItems = useMemo((): TocItem[] => {
    if (!currentChapter?.content) return [];
    
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const items: TocItem[] = [];
    let match;
    
    while ((match = headingRegex.exec(currentChapter.content)) !== null) {
      const level = match[1].length;
      const title = match[2].trim();
      const id = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-');
      
      items.push({ id, title, level });
    }
    
    return items;
  }, [currentChapter?.content]);

  // Handle scroll spy for TOC
  useEffect(() => {
    const handleScroll = () => {
      const headings = document.querySelectorAll('.doc-content h1, .doc-content h2, .doc-content h3');
      let currentActive: string | null = null;
      
      headings.forEach((heading) => {
        const rect = heading.getBoundingClientRect();
        if (rect.top <= 100) {
          currentActive = heading.id;
        }
      });
      
      setActiveHeading(currentActive);
    };

    const contentArea = document.querySelector('.doc-content-scroll');
    contentArea?.addEventListener('scroll', handleScroll);
    return () => contentArea?.removeEventListener('scroll', handleScroll);
  }, [currentChapter]);

  // Scroll to heading
  const scrollToHeading = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Select first chapter on mount
  useEffect(() => {
    if (chapters.length > 0 && !selectedChapter) {
      setSelectedChapter(indexContent ? 'index' : chapters[0].filename);
    }
  }, [chapters, selectedChapter, indexContent]);

  // Custom renderer for markdown
  const renderMarkdown = (content: string) => {
    // Process MDX-like components for MDX format
    let processedContent = content;
    
    if (format === 'mdx') {
      // Remove frontmatter
      processedContent = processedContent.replace(/^---[\s\S]*?---\n*/m, '');
      // Remove import statements
      processedContent = processedContent.replace(/^import\s+.*$/gm, '');
    }

    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children, ...props }) => {
            const id = String(children)
              .toLowerCase()
              .replace(/[^a-z0-9\s-]/g, '')
              .replace(/\s+/g, '-');
            return <h1 id={id} className="text-3xl font-bold mt-8 mb-4 scroll-mt-20" {...props}>{children}</h1>;
          },
          h2: ({ children, ...props }) => {
            const id = String(children)
              .toLowerCase()
              .replace(/[^a-z0-9\s-]/g, '')
              .replace(/\s+/g, '-');
            return <h2 id={id} className="text-2xl font-semibold mt-8 mb-3 scroll-mt-20 pb-2 border-b" {...props}>{children}</h2>;
          },
          h3: ({ children, ...props }) => {
            const id = String(children)
              .toLowerCase()
              .replace(/[^a-z0-9\s-]/g, '')
              .replace(/\s+/g, '-');
            return <h3 id={id} className="text-xl font-semibold mt-6 mb-2 scroll-mt-20" {...props}>{children}</h3>;
          },
          h4: ({ children, ...props }) => (
            <h4 className="text-lg font-semibold mt-4 mb-2" {...props}>{children}</h4>
          ),
          p: ({ children, ...props }) => (
            <p className="my-4 leading-7" {...props}>{children}</p>
          ),
          ul: ({ children, ...props }) => (
            <ul className="my-4 ml-6 list-disc space-y-2" {...props}>{children}</ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="my-4 ml-6 list-decimal space-y-2" {...props}>{children}</ol>
          ),
          li: ({ children, ...props }) => (
            <li className="leading-7" {...props}>{children}</li>
          ),
          blockquote: ({ children, ...props }) => (
            <Callout type="info">{children}</Callout>
          ),
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;
            
            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-muted font-mono text-sm"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            
            // Handle mermaid diagrams
            if (match?.[1] === 'mermaid') {
              return (
                <div className="my-4 p-4 bg-muted rounded-lg overflow-x-auto">
                  <pre className="text-sm">
                    <code className="text-muted-foreground">{String(children).trim()}</code>
                  </pre>
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    (Mermaid diagram - view in a Mermaid-compatible renderer)
                  </p>
                </div>
              );
            }
            
            return (
              <CodeBlock language={match?.[1] || 'plaintext'}>
                {String(children).trim()}
              </CodeBlock>
            );
          },
          pre: ({ children, ...props }) => {
            // Let the code component handle the pre styling
            return <>{children}</>;
          },
          a: ({ href, children, ...props }) => {
            const isExternal = href?.startsWith('http');
            const isChapterLink = href?.endsWith('.md') || href?.endsWith('.mdx');
            
            if (isChapterLink && href) {
              const targetFilename = href.replace('.mdx', '').replace('.md', '');
              return (
                <button
                  onClick={() => {
                    const chapter = chapters.find(c => 
                      c.filename.replace('.mdx', '').replace('.md', '').includes(targetFilename.replace(/^\d+_/, ''))
                    );
                    if (chapter) {
                      setSelectedChapter(chapter.filename);
                    }
                  }}
                  className="text-primary hover:underline cursor-pointer"
                >
                  {children}
                </button>
              );
            }
            
            return (
              <a
                href={href}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                className="text-primary hover:underline inline-flex items-center gap-1"
                {...props}
              >
                {children}
                {isExternal && <ExternalLink className="h-3 w-3" />}
              </a>
            );
          },
          table: ({ children, ...props }) => (
            <div className="my-4 overflow-x-auto">
              <table className="w-full border-collapse border border-border" {...props}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children, ...props }) => (
            <thead className="bg-muted" {...props}>{children}</thead>
          ),
          th: ({ children, ...props }) => (
            <th className="px-4 py-2 text-left font-semibold border border-border" {...props}>{children}</th>
          ),
          td: ({ children, ...props }) => (
            <td className="px-4 py-2 border border-border" {...props}>{children}</td>
          ),
          hr: () => <hr className="my-8 border-border" />,
        }}
      >
        {processedContent}
      </ReactMarkdown>
    );
  };

  return (
    <div className={cn('w-full border rounded-lg bg-background flex flex-col', className)} style={{ height: '80vh' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 rounded-t-lg">
        <div className="flex items-center gap-3">
          <Book className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">{projectName} Tutorial</h1>
          <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary uppercase font-medium">
            {format}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Download documentation as zip"
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Download</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              title="Close viewer"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - Chapter list */}
        <aside className={cn(
          'border-r bg-muted/20 transition-all duration-300 flex flex-col flex-shrink-0',
          sidebarCollapsed ? 'w-12' : 'w-56'
        )}>
          <div className="p-2 border-b">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full p-2 hover:bg-muted rounded-lg transition-colors flex items-center justify-center"
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
          
          {!sidebarCollapsed && (
            <nav className="flex-1 overflow-y-auto p-2 space-y-1">
              {/* Index */}
              {indexContent && (
                <button
                  onClick={() => setSelectedChapter('index')}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2',
                    selectedChapter === 'index'
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  )}
                >
                  <Book className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">Overview</span>
                </button>
              )}
              
              {/* Chapters */}
              {chapters.map((chapter, index) => (
                <button
                  key={chapter.filename}
                  onClick={() => setSelectedChapter(chapter.filename)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2',
                    selectedChapter === chapter.filename
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  )}
                >
                  <FileText className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{chapter.title || `Chapter ${index + 1}`}</span>
                </button>
              ))}
            </nav>
          )}
        </aside>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto doc-content-scroll min-w-0">
          <article className="doc-content max-w-3xl mx-auto px-6 py-6">
            {currentChapter ? (
              renderMarkdown(currentChapter.content)
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                Select a chapter to view
              </div>
            )}
          </article>
        </main>

        {/* Right sidebar - Table of Contents */}
        <aside className="hidden xl:block w-56 border-l bg-muted/20 overflow-y-auto flex-shrink-0">
          <div className="p-4">
            <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wide">
              On This Page
            </h3>
            <nav className="space-y-1">
              {tocItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToHeading(item.id)}
                  className={cn(
                    'block w-full text-left text-sm py-1.5 transition-colors hover:text-foreground',
                    item.level === 1 && 'font-semibold',
                    item.level === 2 && 'pl-2',
                    item.level === 3 && 'pl-4',
                    item.level >= 4 && 'pl-6',
                    activeHeading === item.id
                      ? 'text-primary font-medium'
                      : 'text-muted-foreground'
                  )}
                >
                  {item.title}
                </button>
              ))}
              {tocItems.length === 0 && (
                <p className="text-sm text-muted-foreground italic">
                  No headings found
                </p>
              )}
            </nav>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default DocumentationViewer;
