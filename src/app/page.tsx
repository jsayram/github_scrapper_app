"use client";

import Image from "next/image";
import { useState, FormEvent, useEffect } from "react";
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[600px]">
            <div className="h-full">
              <FileBrowser 
                files={files} 
                onFileSelect={viewFile} 
                selectedFile={selectedFile} 
              />
            </div>
            
            <div className="md:col-span-2 h-full">
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
        )}

        {Object.keys(files).length > 0 && (
          <div className="mt-8 text-center">
            <button
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
        )}
      </main>

      <footer className="mt-16 flex gap-6 flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org/learn"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Learn
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://vercel.com/templates?framework=next.js"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}
