"use client";

import Image from "next/image";
import { useState, FormEvent, useEffect, useRef } from "react";
import CodeEditor from "../components/CodeEditor";
import FileBrowser from "../components/FileBrowser";
import SaveToFile, { VersionInfo } from "../components/SaveToFile";
import FileSummary from "../components/FileSummary";
import { ThemeToggle } from "@/components/theme-toggle";

interface FileStats {
  downloaded_count: number;
  skipped_count: number;
  skipped_files: [string, number][];
  base_path: string | null;
  include_patterns: string[] | null;
  exclude_patterns: string[] | null;
}

interface CrawlerResult {
  files: Record<string, string>;
  stats: FileStats;
}

interface CodeAnalytics {
  totalLines: number;
  totalFiles: number;
  languageDistribution: Record<string, number>;
  fileExtensions: Record<string, number>;
  avgLinesPerFile: number;
  totalFunctions: number;
  totalClasses: number;
  commentRatio: number;
}

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [files, setFiles] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<FileStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [activeVersion, setActiveVersion] = useState<VersionInfo | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [includePatterns, setIncludePatterns] = useState<string[]>(["*.py", "*.md", "*.js", "*.ts", "*.tsx", "*.cs", "*.java"]);
  const [excludePatterns, setExcludePatterns] = useState<string[]>(["tests/*", "**/node_modules/**", "**/.vscode/**", "**/.venv/**", "**/__pycache__/**"]);
  const [showSummary, setShowSummary] = useState(false);
  const [codeAnalytics, setCodeAnalytics] = useState<CodeAnalytics>({
    totalLines: 0,
    totalFiles: 0,
    languageDistribution: {},
    fileExtensions: {},
    avgLinesPerFile: 0,
    totalFunctions: 0,
    totalClasses: 0,
    commentRatio: 0
  });
  const editorRef = useRef<any>(null);

  // Load token from env if available
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_GITHUB_TOKEN;
    if (token) {
      setGithubToken(token);
    }

    // Also attempt to load default repo URL if present
    const defaultRepo = process.env.NEXT_PUBLIC_GITHUB_URL;
    if (defaultRepo) {
      setRepoUrl(defaultRepo);
    }
  }, []);

  // Calculate code analytics whenever files change
  useEffect(() => {
    if (Object.keys(files).length > 0) {
      const analytics: CodeAnalytics = {
        totalLines: 0,
        totalFiles: Object.keys(files).length,
        languageDistribution: {},
        fileExtensions: {},
        avgLinesPerFile: 0,
        totalFunctions: 0,
        totalClasses: 0,
        commentRatio: 0
      };
      
      let totalComments = 0;
      
      Object.entries(files).forEach(([path, content]) => {
        // Count lines
        const lines = content.split('\n').length;
        analytics.totalLines += lines;
        
        // Track file extensions
        const extension = path.split('.').pop()?.toLowerCase() || 'unknown';
        analytics.fileExtensions[extension] = (analytics.fileExtensions[extension] || 0) + 1;
        
        // Language distribution based on extension
        let language = 'Unknown';
        if (['js', 'jsx'].includes(extension)) language = 'JavaScript';
        else if (['ts', 'tsx'].includes(extension)) language = 'TypeScript';
        else if (['py'].includes(extension)) language = 'Python';
        else if (['java'].includes(extension)) language = 'Java';
        else if (['cs'].includes(extension)) language = 'C#';
        else if (['cpp', 'cc', 'c', 'h', 'hpp'].includes(extension)) language = 'C/C++';
        else if (['rb'].includes(extension)) language = 'Ruby';
        else if (['go'].includes(extension)) language = 'Go';
        else if (['php'].includes(extension)) language = 'PHP';
        else if (['rs'].includes(extension)) language = 'Rust';
        else if (['swift'].includes(extension)) language = 'Swift';
        else if (['md', 'markdown'].includes(extension)) language = 'Markdown';
        else if (['json'].includes(extension)) language = 'JSON';
        else if (['html', 'htm'].includes(extension)) language = 'HTML';
        else if (['css'].includes(extension)) language = 'CSS';
        else if (['xml'].includes(extension)) language = 'XML';
        else if (['yml', 'yaml'].includes(extension)) language = 'YAML';
        
        analytics.languageDistribution[language] = (analytics.languageDistribution[language] || 0) + 1;
        
        // Count functions and classes
        const functionMatches = content.match(/function\s+\w+\s*\([^)]*\)\s*{|=>\s*{|\w+\s*\([^)]*\)\s*{/g) || [];
        const classMatches = content.match(/class\s+\w+/g) || [];
        const commentMatches = content.match(/\/\/.*$|\/\*[\s\S]*?\*\//gm) || [];
        
        analytics.totalFunctions += functionMatches.length;
        analytics.totalClasses += classMatches.length;
        totalComments += commentMatches.length;
      });
      
      // Calculate averages
      analytics.avgLinesPerFile = analytics.totalLines / analytics.totalFiles;
      analytics.commentRatio = totalComments / analytics.totalLines;
      
      setCodeAnalytics(analytics);
    }
  }, [files]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setFiles({});
    setStats(null);
    setSelectedFile("");
    setFileContent("");
    setActiveVersion(null);

    try {
      const response = await fetch("/api/github-crawler", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repoUrl,
          token: githubToken,
          useRelativePaths: true,
          includePatterns,
          excludePatterns,
          maxFileSize: 500000,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${await response.text()}`);
      }

      const result: CrawlerResult = await response.json();
      setFiles(result.files);
      setStats(result.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const viewFile = (filePath: string) => {
    setSelectedFile(filePath);
    setFileContent(files[filePath]);
    
  };

  const handleLoadVersion = (versionFiles: Record<string, string>, versionInfo: VersionInfo) => {
    setFiles(versionFiles);
    setSelectedFile("");
    setFileContent("");
    setActiveVersion(versionInfo);
    
    // Create stats for the loaded version
    setStats({
      downloaded_count: versionInfo.fileCount,
      skipped_count: 0,
      skipped_files: [],
      base_path: null,
      include_patterns: null,
      exclude_patterns: null
    });
    
    // If the version is from a different repo, update the repo URL
    if (versionInfo.repository !== repoUrl) {
      setRepoUrl(versionInfo.repository);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 pb-20 font-sans">
      <header className="mb-6 flex flex-col items-center relative">
        <div className="absolute right-0 top-0">
          <ThemeToggle />
        </div>
        <Image
          className="dark:invert mb-4"
          src="/next.svg"
          alt="Next.js logo"
          width={180}
          height={38}
          priority
        />
        <h1 className="text-2xl font-bold mb-2">GitHub Repository Crawler</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Browse and save files from any GitHub repository
        </p>
        {activeVersion && (
          <div className="mt-2 py-1 px-3 bg-blue-100 dark:bg-blue-900 rounded-full text-sm">
            Viewing saved version: <span className="font-bold">{activeVersion.name}</span>
            <button 
              type="button"
              className="ml-2 text-blue-600 dark:text-blue-400 text-xs hover:underline"
              onClick={() => setActiveVersion(null)}
            >
              Clear
            </button>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto">
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label
                htmlFor="repoUrl"
                className="block text-sm font-medium mb-1"
              >
                GitHub Repository URL
              </label>
              <input
                id="repoUrl"
                type="text"
                className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/username/repository"
                required
              />
            </div>

            <div>
              <label
                htmlFor="githubToken"
                className="block text-sm font-medium mb-1"
              >
                GitHub Token (optional)
              </label>
              <input
                id="githubToken"
                type="password"
                className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxx"
              />
              <p className="text-xs text-gray-500 mt-1">
                Required for private repositories
              </p>
            </div>
          </div>
          
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1"
            >
              {showFilters ? '▼' : '►'} {showFilters ? 'Hide' : 'Show'} file filters
            </button>
          </div>
          
          {showFilters && (
            <div className="mb-6 border rounded-md p-4">
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Include File Types</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { label: "Python", pattern: "*.py" },
                      { label: "JavaScript", pattern: "*.js" },
                      { label: "TypeScript", pattern: "*.ts" },
                      { label: "TSX", pattern: "*.tsx" },
                      { label: "JSX", pattern: "*.jsx" },
                      { label: "C#", pattern: "*.cs" },
                      { label: "Java", pattern: "*.java" },
                      { label: "Markdown", pattern: "*.md" },
                      { label: "HTML", pattern: "*.html" },
                      { label: "CSS", pattern: "*.css" },
                      { label: "JSON", pattern: "*.json" },
                      { label: "XML", pattern: "*.xml" },
                      { label: "YAML", pattern: "*.yml,*.yaml" },
                      { label: "Rust", pattern: "*.rs" },
                      { label: "Go", pattern: "*.go" },
                      { label: "Ruby", pattern: "*.rb" },
                      { label: "PHP", pattern: "*.php" },
                      { label: "Swift", pattern: "*.swift" },
                      { label: "C/C++", pattern: "*.c,*.cpp,*.h,*.hpp" },
                      { label: "SQL", pattern: "*.sql" },
                      { label: "Kotlin", pattern: "*.kt" },
                      { label: "Dart", pattern: "*.dart" },
                      { label: "Shell", pattern: "*.sh" },
                      { label: "Bash", pattern: "*.bash" },
                      { label: "PowerShell", pattern: "*.ps1" },
                      { label: "Assembly", pattern: "*.asm" },
                      { label: "Lua", pattern: "*.lua" },
                      { label: "R", pattern: "*.r" },
                      { label: "MATLAB", pattern: "*.m" },
                      { label: "Julia", pattern: "*.jl" },
                      { label: "Haskell", pattern: "*.hs" },
                      { label: "Elixir", pattern: "*.ex,*.exs" },
                      { label: "Erlang", pattern: "*.erl,*.hrl" },
                      { label: "Scala", pattern: "*.scala" },
                    ].map((type) => (
                      <div key={type.label} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`include-${type.label}`}
                          checked={type.pattern.split(',').some(p => includePatterns.includes(p))}
                          onChange={(e) => {
                            const patterns = type.pattern.split(',');
                            if (e.target.checked) {
                              setIncludePatterns([...includePatterns, ...patterns.filter(p => !includePatterns.includes(p))]);
                            } else {
                              setIncludePatterns(includePatterns.filter(p => !patterns.includes(p)));
                            }
                          }}
                          className="mr-2"
                        />
                        <label htmlFor={`include-${type.label}`} className="text-sm">
                          {type.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Exclude Patterns</label>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { label: "Test Files", pattern: "tests/*" },
                      { label: "Node Modules", pattern: "**/node_modules/**" },
                      { label: "VS Code Config", pattern: "**/.vscode/**" },
                      { label: "Virtual Env", pattern: "**/.venv/**" },
                      { label: "Python Cache", pattern: "**/__pycache__/**" },
                      { label: "Build Output", pattern: "**/dist/**,**/build/**" },
                      { label: "Git Files", pattern: "**/.git/**" },
                      { label: "Coverage Reports", pattern: "**/coverage/**" },
                      { label: "Logs", pattern: "**/logs/**,**/*.log" },
                      { label: "Temp Files", pattern: "**/tmp/**,**/.tmp/**,**/*.tmp" },
                    ].map((type) => (
                      <div key={type.label} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`exclude-${type.label}`}
                          checked={type.pattern.split(',').some(p => excludePatterns.includes(p))}
                          onChange={(e) => {
                            const patterns = type.pattern.split(',');
                            if (e.target.checked) {
                              setExcludePatterns([...excludePatterns, ...patterns.filter(p => !excludePatterns.includes(p))]);
                            } else {
                              setExcludePatterns(excludePatterns.filter(p => !patterns.includes(p)));
                            }
                          }}
                          className="mr-2"
                        />
                        <label htmlFor={`exclude-${type.label}`} className="text-sm">
                          {type.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="col-span-full">
                  <label className="block text-sm font-medium mb-1">Custom Patterns</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <input
                        type="text"
                        placeholder="Custom include pattern (e.g., src/**/*.jsx)"
                        className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.currentTarget.value) {
                            e.preventDefault();
                            setIncludePatterns([...includePatterns, e.currentTarget.value]);
                            e.currentTarget.value = '';
                          }
                        }}
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        {includePatterns.map((pattern, i) => (
                          <span key={i} className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded-full text-xs flex items-center">
                            {pattern}
                            <button
                              type="button"
                              onClick={() => setIncludePatterns(includePatterns.filter((_, idx) => idx !== i))}
                              className="ml-1 text-red-500 font-bold"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Custom exclude pattern (e.g., **/.git/**)"
                        className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.currentTarget.value) {
                            e.preventDefault();
                            setExcludePatterns([...excludePatterns, e.currentTarget.value]);
                            e.currentTarget.value = '';
                          }
                        }}
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        {excludePatterns.map((pattern, i) => (
                          <span key={i} className="bg-red-100 dark:bg-red-900 px-2 py-1 rounded-full text-xs flex items-center">
                            {pattern}
                            <button
                              type="button"
                              onClick={() => setExcludePatterns(excludePatterns.filter((_, idx) => idx !== i))}
                              className="ml-1 text-red-500 font-bold"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm px-4 h-10"
            >
              {isLoading ? "Loading..." : "Crawl Repository"}
            </button>
            
            {Object.keys(files).length > 0 && (
              <SaveToFile 
                files={files} 
                repoUrl={repoUrl} 
                onLoadVersion={handleLoadVersion} 
              />
            )}
          </div>
        </form>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            <p>{error}</p>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}

        {stats && (
          <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <h2 className="text-lg font-semibold mb-2">
              {activeVersion ? 'Saved Version Info' : 'Repository Stats'}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-lg font-bold">{stats.downloaded_count}</span>
                <p className="text-sm text-gray-600 dark:text-gray-300">Files Downloaded</p>
              </div>
              {activeVersion ? (
                <div>
                  <span className="text-lg font-bold">
                    {new Date(activeVersion.timestamp).toLocaleDateString()}
                  </span>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Date Saved</p>
                </div>
              ) : (
                <div>
                  <span className="text-lg font-bold">{stats.skipped_count}</span>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Files Skipped</p>
                </div>
              )}
              {stats.base_path && (
                <div className="col-span-2">
                  <span className="text-sm font-mono">{stats.base_path}</span>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Base Path</p>
                </div>
              )}
            </div>
          </div>
        )}

        {Object.keys(files).length > 0 && (
          <div className="space-y-6">
            {/* Editor and File Browser Section - Top Half of Page */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-1 h-[400px] overflow-hidden border rounded-md">
                <FileBrowser 
                  files={files} 
                  onFileSelect={viewFile} 
                  selectedFile={selectedFile} 
                />
              </div>
              
              <div className="md:col-span-3">
                {selectedFile ? (
                  <CodeEditor
                    code={fileContent}
                    filePath={selectedFile}
                    readOnly={true}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center border rounded-lg text-gray-500">
                    <div className="text-center">
                      <p className="mb-2">👈 Select a file from the browser</p>
                      <p className="text-sm">Files will be displayed in the editor</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Code Analytics Section - Bottom Half */}
            <div className="border rounded-lg p-6 bg-white dark:bg-gray-800 shadow-sm">
              <h2 className="text-xl font-bold mb-4 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Repository Analytics for Recruiters
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Key Metrics */}
                <div className="space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">Key Metrics</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-2xl font-bold">{codeAnalytics.totalFiles}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Total Files</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{codeAnalytics.totalLines.toLocaleString()}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Lines of Code</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{codeAnalytics.totalFunctions}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Functions</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{codeAnalytics.totalClasses}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Classes</div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-gray-600 dark:text-gray-300">
                      Avg {Math.round(codeAnalytics.avgLinesPerFile)} lines per file
                    </div>
                  </div>
                  
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">Code Quality Indicators</h3>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Comment Ratio</span>
                          <span>{(codeAnalytics.commentRatio * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full">
                          <div className="bg-green-500 h-1.5 rounded-full" style={{ 
                            width: `${Math.min(100, codeAnalytics.commentRatio * 200)}%` 
                          }}></div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {codeAnalytics.commentRatio > 0.1 ? 'Good documentation' : 'Could use more comments'}
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Code Complexity</span>
                          <span>{Math.round(codeAnalytics.totalFunctions / Math.max(1, codeAnalytics.totalFiles))}/file</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {codeAnalytics.totalFunctions / Math.max(1, codeAnalytics.totalFiles) < 5 
                            ? 'Good modularization' 
                            : 'Some files may be too complex'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Language Distribution */}
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-2">Programming Languages</h3>
                  <div className="space-y-2">
                    {Object.entries(codeAnalytics.languageDistribution)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 6)
                      .map(([language, count]) => (
                        <div key={language}>
                          <div className="flex justify-between text-sm mb-1">
                            <span>{language}</span>
                            <span>{count} files</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full">
                            <div className="bg-purple-500 h-1.5 rounded-full" style={{ 
                              width: `${Math.min(100, count / codeAnalytics.totalFiles * 100)}%` 
                            }}></div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
                
                {/* File Extensions */}
                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-2">File Extensions</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(codeAnalytics.fileExtensions)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 8)
                      .map(([ext, count]) => (
                        <div key={ext} className="flex items-center justify-between text-sm">
                          <span className="font-mono">.{ext}</span>
                          <span className="text-gray-600 dark:text-gray-300">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
                
                {/* Project Complexity */}
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-2">Project Complexity</h3>
                  
                  <div className="space-y-3">
                    {/* Calculate different complexity metrics */}
                    <div>
                      <div className="flex justify-between text-sm">
                        <span>Overall Size</span>
                        <span className="font-medium">
                          {codeAnalytics.totalLines < 1000 ? 'Small' : 
                           codeAnalytics.totalLines < 10000 ? 'Medium' : 'Large'}
                        </span>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm">
                        <span>Architecture</span>
                        <span className="font-medium">
                          {codeAnalytics.totalFiles < 10 ? 'Simple' : 
                           codeAnalytics.totalFiles < 50 ? 'Moderate' : 'Complex'}
                        </span>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm">
                        <span>Technical Debt</span>
                        <span className="font-medium">
                          {codeAnalytics.commentRatio > 0.1 && 
                           codeAnalytics.totalFunctions / Math.max(1, codeAnalytics.totalFiles) < 5 ? 'Low' : 'Moderate'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-600 dark:text-gray-300 pt-2">
                      {Object.keys(codeAnalytics.languageDistribution).length} languages used across the project
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Generate Repository Summary Button */}
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() => setShowSummary(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg shadow-md transition-colors flex items-center mx-auto"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
                  <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
                </svg>
                Generate Repository Summary
              </button>
              
              <FileSummary
                files={files}
                isOpen={showSummary}
                onClose={() => setShowSummary(false)}
              />
            </div>
          </div>
        )}
      </main>

      <footer className="mt-16 flex gap-6 flex-wrap items-center justify-center text-sm text-gray-500">
        <div>© {new Date().getFullYear()} GitHub Scraper</div>
        <div>Analyze any repository with ease</div>
      </footer>
    </div>
  );
}
