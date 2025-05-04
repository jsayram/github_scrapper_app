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
  api_requests?: number;
  method?: string;
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
  const [excludePatterns, setExcludePatterns] = useState<string[]>([
    // Test files
    "test/*", "tests/*", "**/test/**", "**/tests/**", "**/__tests__/**", "**/*test.js", "**/*spec.js", "**/*test.ts", "**/*spec.ts",
    
    // Large binary files
    "**/*.mp4", "**/*.mov", "**/*.avi", "**/*.mkv", "**/*.iso", 
    "**/*.zip", "**/*.tar", "**/*.gz", "**/*.rar",
    
    // Binary datasets
    "**/*.bin", "**/*.dat", "**/*.pkl", "**/*.h5", "**/*.hdf5",
    
    // Generated content and dependencies
    "**/node_modules/**", "**/node_module/**", "**/package-lock.json", "**/yarn.lock", "**/pnpm-lock.yaml",
    "**/*.min.js", "**/*.min.css", "**/dist/**", "**/build/**", "**/.next/**", "**/out/**", "**/output/**", "**/target/**", "**/.output/**", "**/_build/**",
    
    // Repository management
    "**/.git/**", "**/.gitignore", "**/.gitattributes", "**/.gitmodules", "**/.github/**",
    "**/bower_components/**", "**/.pnp/**", "**/jspm_packages/**", 
    
    // Python environments and cache
    "**/.venv/**", "**/venv/**", "**/.env/**", "**/env/**", "**/.virtualenv/**", "**/virtualenv/**",
    "**/__pycache__/**", "**/*.py[cod]", "**/*.so", "**/*.egg", "**/*.egg-info/**", "**/.pytest_cache/**",
    
    // Editor configurations
    "**/.vscode/**", "**/.idea/**", "**/.eclipse/**", "**/.nbproject/**", "**/.sublime-*",
    
    // Coverage reports
    "**/coverage/**", "**/.coverage", "**/.nyc_output/**", "**/htmlcov/**",
    
    // Logs and temp files
    "**/logs/**", "**/log/**", "**/*.log", "**/*.log.*",
    "**/tmp/**", "**/temp/**", "**/.tmp/**", "**/.temp/**", "**/*.tmp", "**/*.temp", "**/.cache/**", "**/cache/**",
    
    // Configuration files
    "**/docker-compose.yml", "**/docker-compose.yaml", "**/Dockerfile", "**/.dockerignore",
    "**/.travis.yml", "**/.gitlab-ci.yml", "**/.circleci/**", "**/.github/workflows/**",
    
    // Documentation
    "**/docs/**", "**/doc/**", "**/*.md", "**/*.mdx", "**/*.markdown",
    
    // TypeScript maps
    "**/*.js.map", "**/*.d.ts.map",
    
    // Frontend Build Artifacts and Dependencies
    "**/node_modules/.cache/**", "**/.sass-cache/**", "**/.parcel-cache/**", "**/webpack-stats.json", 
    "**/.turbo/**", "**/storybook-static/**",
    
    // Backend/Language-specific Files
    "**/.gradle/**", "**/.m2/**", "**/vendor/**", "**/__snapshots__/**", "**/Pods/**",
    "**/.serverless/**", "**/venv.bak/**", "**/.rts2_cache_*/**",
    
    // Configuration and Environment Files
    "**/.env.local", "**/.env.development", "**/.env.production", "**/.direnv/**",
    "**/terraform.tfstate*", "**/cdk.out/**", "**/.terraform/**",
    
    // IDE and Editor Files
    "**/.settings/**", "**/.project", "**/.classpath", "**/*.swp", "**/*~", 
    "**/*.bak", "**/.DS_Store", "**/Thumbs.db",
    
    // Compiled Binary Files
    "**/*.class", "**/*.o", "**/*.dll", "**/*.exe", "**/*.obj", "**/*.apk", "**/*.ipa"
  ]);
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
      // Test mode - simulate errors with special URL prefixes
      if (repoUrl.startsWith('test:')) {
        const errorType = repoUrl.split(':')[1];
        await simulateError(errorType);
        return;
      }

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

      // Extract rate limit information from response headers if present
      const rateLimit = response.headers.get('x-ratelimit-limit');
      const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
      const rateLimitReset = response.headers.get('x-ratelimit-reset');

      if (!response.ok) {
        const errorText = await response.text();
        // Special handling for rate limit errors
        if (response.status === 403 && errorText.includes('rate limit')) {
          let resetTime = '';
          if (rateLimitReset) {
            const resetDate = new Date(parseInt(rateLimitReset) * 1000);
            resetTime = resetDate.toLocaleTimeString();
          }
          
          throw new Error(
            `GitHub API rate limit exceeded. ` + 
            `${rateLimit ? `Limit: ${rateLimit} requests per hour. ` : ''}` +
            `${rateLimitRemaining ? `Remaining: ${rateLimitRemaining} ` : ''}` +
            `${resetTime ? `Rate limit will reset at: ${resetTime}` : ''}` +
            `\n\nTip: Add a GitHub personal access token to increase your rate limit from 60 to 5,000 requests per hour.`
          );
        }
        throw new Error(`Error ${response.status}: ${errorText}`);
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

  // Helper function to simulate various error conditions
  const simulateError = async (errorType: string) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    switch(errorType) {
      case 'rate-limit':
        // Simulate a rate limit error
        const resetTime = new Date();
        resetTime.setMinutes(resetTime.getMinutes() + 30); // Reset in 30 minutes
        
        throw new Error(
          `GitHub API rate limit exceeded. ` + 
          `Limit: 60 requests per hour. ` + 
          `Remaining: 0 ` + 
          `Rate limit will reset at: ${resetTime.toLocaleTimeString()}` + 
          `\n\nTip: Add a GitHub personal access token to increase your rate limit from 60 to 5,000 requests per hour.`
        );
      
      case '404':
        // Simulate repository not found
        throw new Error('Error 404: Not Found - The repository does not exist or requires authentication');
        
      case '401':
        // Simulate unauthorized access
        throw new Error('Error 401: Unauthorized - Authentication is required for this repository');
        
      case '500':
        // Simulate server error
        throw new Error('Error 500: Internal Server Error - GitHub is experiencing issues');
        
      case 'timeout':
        // Simulate timeout
        await new Promise(resolve => setTimeout(resolve, 5000));
        throw new Error('Request timed out - The GitHub API is taking too long to respond');
        
      case 'network':
        // Simulate network error
        throw new Error('Network error - Unable to connect to GitHub API');
        
      case 'parse':
        // Simulate JSON parse error
        throw new Error('Failed to parse response from GitHub - Invalid JSON received');
        
      default:
        // Default error
        throw new Error(`Test error: ${errorType || 'unspecified error'}`);
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
                      { label: "TypeScript", pattern: "*.ts,*.d.ts" },
                      { label: "TSX", pattern: "*.tsx" },
                      { label: "JSX", pattern: "*.jsx" },
                      { label: "C#", pattern: "*.cs" },
                      { label: "Java", pattern: "*.java" },
                      { label: "Markdown", pattern: "*.md,README.*,CONTRIBUTING.*,CHANGELOG.*" },
                      { label: "MDX", pattern: "*.mdx" },
                      { label: "HTML", pattern: "*.html,*.htm" },
                      { label: "CSS", pattern: "*.css" },
                      { label: "SCSS/SASS", pattern: "*.scss,*.sass" },
                      { label: "Less", pattern: "*.less" },
                      { label: "JSON", pattern: "*.json" },
                      { label: "XML", pattern: "*.xml" },
                      { label: "YAML", pattern: "*.yml,*.yaml" },
                      { label: "Rust", pattern: "*.rs" },
                      { label: "Go", pattern: "*.go" },
                      { label: "Ruby", pattern: "*.rb" },
                      { label: "PHP", pattern: "*.php" },
                      { label: "Swift", pattern: "*.swift" },
                      { label: "C/C++", pattern: "*.c,*.cpp,*.h,*.hpp,*.cc" },
                      { label: "SQL", pattern: "*.sql" },
                      { label: "Kotlin", pattern: "*.kt,*.kts" },
                      { label: "Dart", pattern: "*.dart" },
                      { label: "Shell/Bash", pattern: "*.sh,*.bash" },
                      { label: "PowerShell", pattern: "*.ps1" },
                      { label: "Assembly", pattern: "*.asm" },
                      { label: "Lua", pattern: "*.lua" },
                      { label: "R", pattern: "*.r,*.R" },
                      { label: "MATLAB/Objective-C", pattern: "*.m" },
                      { label: "Julia", pattern: "*.jl" },
                      { label: "Haskell", pattern: "*.hs,*.lhs" },
                      { label: "Elixir", pattern: "*.ex,*.exs" },
                      { label: "Erlang", pattern: "*.erl,*.hrl" },
                      { label: "Scala", pattern: "*.scala,*.sc" },
                      { label: "Clojure", pattern: "*.clj,*.cljs,*.cljc" },
                      { label: "GraphQL", pattern: "*.graphql,*.gql" },
                      { label: "Docker", pattern: "Dockerfile,*.dockerfile,docker-compose.yml,docker-compose.yaml" },
                      { label: "Terraform", pattern: "*.tf,*.tfvars" },
                      { label: "Web Frameworks", pattern: "*.svelte,*.vue,*.astro" },
                      { label: "ReasonML", pattern: "*.re,*.rei" },
                      { label: "F#", pattern: "*.fs,*.fsx" },
                      { label: "Groovy", pattern: "*.groovy" },
                      { label: "Perl", pattern: "*.pl,*.pm" },
                      { label: "ASP.NET", pattern: "*.aspx,*.ascx,*.asax" },
                      { label: "Config Files", pattern: "*.config,*.conf,*.ini,*.env,*.toml,*.properties" },
                      { label: "Documentation", pattern: "*.txt,*.rst,*.adoc,LICENSE.*,AUTHORS" },
                      { label: "Project Config", pattern: "*.lock" },
                      { label: "CI/CD", pattern: ".github/workflows/*.yml,.gitlab-ci.yml,.circleci/*.yml,azure-pipelines.yml,Jenkinsfile" },
                      { label: "Markup Formats", pattern: "*.adoc,*.asciidoc,*.rst" },
                      { label: "Protobuf", pattern: "*.proto" },
                      { label: "WebAssembly", pattern: "*.wasm,*.wat" },
                      { label: "Objective-C", pattern: "*.mm" },
                      { label: "Blockchain", pattern: "*.sol" },
                      { label: "Jupyter Notebook", pattern: "*.ipynb" },
                      { label: "ML/AI", pattern: "**/models/*.py,**/nn/*.py,**/torch/*.py,**/tensorflow/*.py,**/keras/*.py" },
                      { label: "CUDA", pattern: "*.cu,*.cuh" },
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
                      { label: "Test Files", pattern: "test/*,tests/*,**/test/**,**/tests/**,**/__tests__/**,**/*test.js,**/*spec.js,**/*test.ts,**/*spec.ts", required: true, reason: "Test files often duplicate source code logic and can double API usage without adding value to code understanding" },
                      { label: "Node Modules", pattern: "**/node_modules/**,**/node_module/**", required: true, reason: "Contains 100,000+ files that would exceed API rate limits" },
                      { label: "Package Files", pattern: "**/package-lock.json,**/yarn.lock,**/pnpm-lock.yaml", required: true, reason: "Auto-generated files that can be 10,000+ lines long" },
                      { label: "Editor Config", pattern: "**/.vscode/**,**/.idea/**,**/.eclipse/**,**/.nbproject/**,**/.sublime-*", required: true, reason: "IDE configuration files that don't contain actual project code" },
                      { label: "Virtual Env", pattern: "**/.venv/**,**/venv/**,**/.env/**,**/env/**,**/.virtualenv/**,**/virtualenv/**", required: true, reason: "Contains binary files and dependencies that aren't part of the source code" },
                      { label: "Python Cache", pattern: "**/__pycache__/**,**/*.py[cod],**/*.so,**/*.egg,**/*.egg-info/**,**/.pytest_cache/**", required: true, reason: "Contains binary compilation artifacts, not source code" },
                      { label: "Build Output", pattern: "**/dist/**,**/build/**,**/_build/**,**/out/**,**/output/**,**/target/**,**/.output/**", required: true, reason: "Contains generated files that aren't part of the source code" },
                      { label: "Git Files", pattern: "**/.git/**, **/.gitignore, **/.gitattributes, **/.gitmodules, **/.github/**", required: true, reason: "Contains repository history which would dramatically increase download size" },
                      { label: "Coverage Reports", pattern: "**/coverage/**,**/.coverage,**/.nyc_output/**,**/htmlcov/**", required: true, reason: "Generated test coverage reports that don't contain original code" },
                      { label: "Logs", pattern: "**/logs/**,**/log/**,**/*.log,**/*.log.*", required: true, reason: "Runtime logs that contain execution data but not meaningful code" },
                      { label: "Temp Files", pattern: "**/tmp/**,**/temp/**,**/.tmp/**,**/.temp/**,**/*.tmp,**/*.temp,**/.cache/**,**/cache/**", required: true, reason: "Temporary files that aren't part of the source code" },
                      { label: "Docker Files", pattern: "**/docker-compose.yml,**/docker-compose.yaml,**/Dockerfile,**/.dockerignore", required: true, reason: "Environment configuration that doesn't represent the core application code" },
                      { label: "CI Files", pattern: "**/.travis.yml,**/.gitlab-ci.yml,**/.circleci/**,**/.github/workflows/**", required: true, reason: "CI/CD configuration that doesn't contain application logic" },
                      { label: "Dependency Dirs", pattern: "**/bower_components/**,**/.pnp/**,**/jspm_packages/**", required: true, reason: "Contains thousands of third-party dependencies, not project source code" },
                      { label: "Documentation", pattern: "**/docs/**,**/doc/**,**/*.md,**/*.mdx,**/*.markdown", required: false, reason: "Written documentation that explains but doesn't implement functionality" },
                      { label: "Minified Files", pattern: "**/*.min.js,**/*.min.css", required: true, reason: "Single-line files that are hard to analyze and have unminified counterparts" },
                      { label: "TypeScript Maps", pattern: "**/*.js.map,**/*.d.ts.map", required: true, reason: "Debug files not needed for code analysis" },
                      { label: "Large Media Files", pattern: "**/*.mp4,**/*.mov,**/*.avi,**/*.mkv,**/*.iso,**/*.zip,**/*.tar,**/*.gz,**/*.rar", required: true, reason: "Binary files that don't contain readable code and would use up API quota" },
                      { label: "Binary Datasets", pattern: "**/*.bin,**/*.dat,**/*.pkl,**/*.h5,**/*.hdf5", required: true, reason: "Large data files that don't contain readable code" },  
                      { label: "Frontend Build Caches", pattern: "**/node_modules/.cache/**,**/.sass-cache/**,**/.parcel-cache/**,**/webpack-stats.json,**/.turbo/**,**/storybook-static/**", required: true, reason: "Build tool cache files and generated artifacts that don't contain source code" },
                      { label: "Backend Build Files", pattern: "**/.gradle/**,**/.m2/**,**/vendor/**,**/__snapshots__/**,**/Pods/**,**/.serverless/**,**/venv.bak/**,**/.rts2_cache_*/**", required: true, reason: "Build artifacts and framework-specific files that aren't actual source code" },
                      { label: "Env & Config Files", pattern: "**/.env.local,**/.env.development,**/.env.production,**/.direnv/**,**/terraform.tfstate*,**/cdk.out/**,**/.terraform/**", required: true, reason: "Environment configuration files that often contain sensitive data and aren't source code" },
                      { label: "Editor & OS Files", pattern: "**/.settings/**,**/.project,**/.classpath,**/*.swp,**/*~,**/*.bak,**/.DS_Store,**/Thumbs.db", required: true, reason: "Editor and operating system metadata files that don't contain project code" },
                      { label: "Compiled Binaries", pattern: "**/*.class,**/*.o,**/*.dll,**/*.exe,**/*.obj,**/*.apk,**/*.ipa", required: true, reason: "Compiled binary files that are generated from source code" },
                    ].map((type) => (
                      <div key={type.label} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`exclude-${type.label}`}
                          checked={type.pattern.split(',').some(p => excludePatterns.includes(p))}
                          onChange={(e) => {
                            // If this is a required exclusion, don't allow it to be unchecked
                            if (type.required && !e.target.checked) {
                              return;
                            }
                            
                            const patterns = type.pattern.split(',');
                            if (e.target.checked) {
                              setExcludePatterns([...excludePatterns, ...patterns.filter(p => !excludePatterns.includes(p))]);
                            } else {
                              setExcludePatterns(excludePatterns.filter(p => !patterns.includes(p)));
                            }
                          }}
                          className="mr-2"
                          disabled={type.required}
                        />
                        <label htmlFor={`exclude-${type.label}`} className={`text-sm flex items-center ${type.required ? 'cursor-not-allowed' : ''}`}>
                          {type.label}
                          {type.required && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900 px-2 py-0.5 text-xs text-amber-800 dark:text-amber-200">
                              Required
                            </span>
                          )}
                          {type.required && (
                            <span className="ml-2 group relative">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500 cursor-help" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                              </svg>
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 -translate-y-1 invisible group-hover:visible w-64 bg-black dark:bg-white text-white dark:text-black text-xs rounded p-2 z-10">
                                {type.reason}
                              </div>
                            </span>
                          )}
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
                        {excludePatterns.map((pattern, i) => {
                          // Check if this pattern is part of any required exclude group
                          const isRequiredPattern = [
                            // Test files
                            "test/*", "tests/*", "**/test/**", "**/tests/**", "**/__tests__/**", "**/*test.js", "**/*spec.js", "**/*test.ts", "**/*spec.ts",
                            // Node Modules
                            "**/node_modules/**", "**/node_module/**", "**/node_modules/.cache/**",
                            // Package Files
                            "**/package-lock.json", "**/yarn.lock", "**/pnpm-lock.yaml",
                            // Editor Config
                            "**/.vscode/**", "**/.idea/**", "**/.eclipse/**", "**/.nbproject/**", "**/.sublime-*",
                            // Virtual Env
                            "**/.venv/**", "**/venv/**", "**/.env/**", "**/env/**", "**/.virtualenv/**", "**/virtualenv/**", "**/venv.bak/**",
                            // Python Cache
                            "**/__pycache__/**", "**/*.py[cod]", "**/*.so", "**/*.egg", "**/*.egg-info/**", "**/.pytest_cache/**",
                            // Build Output
                            "**/dist/**", "**/build/**", "**/_build/**", "**/out/**", "**/output/**", "**/target/**", "**/.output/**","**/.next/**",
                            // Git Files
                            "**/.git/**", "**/.gitignore", "**/.gitattributes", "**/.gitmodules", "**/.github/**",
                            // Coverage Reports
                            "**/coverage/**", "**/.coverage", "**/.nyc_output/**", "**/htmlcov/**",
                            // Logs
                            "**/logs/**", "**/log/**", "**/*.log", "**/*.log.*",
                            // Temp Files
                            "**/tmp/**", "**/temp/**", "**/.tmp/**", "**/.temp/**", "**/*.tmp", "**/*.temp", "**/.cache/**", "**/cache/**",
                            // Docker Files
                            "**/docker-compose.yml", "**/docker-compose.yaml", "**/Dockerfile", "**/.dockerignore",
                            // CI Files
                            "**/.travis.yml", "**/.gitlab-ci.yml", "**/.circleci/**", "**/.github/workflows/**",
                            // Dependency Dirs
                            "**/bower_components/**", "**/.pnp/**", "**/jspm_packages/**",
                            // Documentation
                            "**/docs/**", "**/doc/**", "**/*.md", "**/*.mdx", "**/*.markdown",
                            // Minified Files
                            "**/*.min.js", "**/*.min.css",
                            // TypeScript Maps
                            "**/*.js.map", "**/*.d.ts.map",
                            // Large Media Files
                            "**/*.mp4", "**/*.mov", "**/*.avi", "**/*.mkv", "**/*.iso", "**/*.zip", "**/*.tar", "**/*.gz", "**/*.rar",
                            // Binary Datasets
                            "**/*.bin", "**/*.dat", "**/*.pkl", "**/*.h5", "**/*.hdf5",
                            // Frontend Build Artifacts
                            "**/.sass-cache/**", "**/.parcel-cache/**", "**/webpack-stats.json", "**/.turbo/**", "**/storybook-static/**",
                            // Backend/Language Files
                            "**/.gradle/**", "**/.m2/**", "**/vendor/**", "**/__snapshots__/**", "**/Pods/**", "**/.serverless/**", "**/.rts2_cache_*/**",
                            // Environment and Config
                            "**/.env.local", "**/.env.development", "**/.env.production", "**/.direnv/**", "**/terraform.tfstate*", "**/cdk.out/**", "**/.terraform/**",
                            // IDE/Editor and OS Files
                            "**/.settings/**", "**/.project", "**/.classpath", "**/*.swp", "**/*~", "**/*.bak", "**/.DS_Store", "**/Thumbs.db",
                            // Compiled Binaries
                            "**/*.class", "**/*.o", "**/*.dll", "**/*.exe", "**/*.obj", "**/*.apk", "**/*.ipa"
                          ].includes(pattern);
                          
                          return (
                            <span key={i} className={`${isRequiredPattern ? 'bg-gray-200 dark:bg-gray-700' : 'bg-red-100 dark:bg-red-900'} px-2 py-1 rounded-full text-xs flex items-center`}>
                              {pattern}
                              {!isRequiredPattern && (
                                <button
                                  type="button"
                                  onClick={() => setExcludePatterns(excludePatterns.filter((_, idx) => idx !== i))}
                                  className="ml-1 text-red-500 font-bold"
                                >
                                  ×
                                </button>
                              )}
                              {isRequiredPattern && (
                                <span className="ml-1 text-gray-500" title="This pattern is required and can't be removed">
                                  🔒
                                </span>
                              )}
                            </span>
                          );
                        })}
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
              
              {/* Display API method and request count if available */}
              {!activeVersion && stats.method && (
                <div>
                  <span className="text-lg font-bold">
                    {stats.method === 'tree_api' ? 'Git Tree API' : 'Contents API'}
                  </span>
                  <p className="text-sm text-gray-600 dark:text-gray-300">API Method</p>
                </div>
              )}
              
              {!activeVersion && stats.api_requests !== undefined && (
                <div>
                  <span className="text-lg font-bold">{stats.api_requests}</span>
                  <p className="text-sm text-gray-600 dark:text-gray-300">API Requests</p>
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
