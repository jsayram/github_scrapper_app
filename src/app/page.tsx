"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { getAllExcludedPatterns } from "@/lib/excludedPatterns";
import {
  githubFileCrawler,
  simulateError,
  FileStats,
  CrawlerResult,
} from "@/lib/githubFileCrawler";
import { VersionInfo } from "@/components/SaveToFile";
import FileSummary from "@/components/FileSummary";

// Import all the new components we've created
import Header from "@/components/Header";
import NotificationSystem, {
  useNotifications,
} from "@/components/NotificationSystem";
import RepositoryForm, { LLMConfig } from "@/components/RepositoryForm";
import FilterSection from "@/components/FilterSection";
import ActionButtons from "@/components/ActionButtons";
import ErrorMessage from "@/components/ErrorMessage";
import LoadingIndicator, { TutorialProgress } from "@/components/LoadingIndicator";
import StatsDisplay from "@/components/StatsDisplay";
import FileExplorer from "@/components/FileExplorer";
import {
  PROVIDER_IDS,
  OPENAI_MODELS,
} from "@/lib/constants/llm";
import CodeAnalyticsDisplay, {
  CodeAnalytics,
} from "@/components/CodeAnalyticsDisplay";
import Footer from "@/components/Footer";
import { DocumentationViewer } from "@/components/docs";

export default function Home() {
  // State management
  const [repoUrl, setRepoUrl] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  
  // New LLM configuration state
  const [llmConfig, setLLMConfig] = useState<LLMConfig>({
    providerId: PROVIDER_IDS.OPENAI,
    modelId: OPENAI_MODELS.GPT_4O_MINI,
  });
  
  const [files, setFiles] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<FileStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingTutorial, setIsProcessingTutorial] = useState(false);
  const [tutorialProgress, setTutorialProgress] = useState<TutorialProgress | null>(null);
  const [tutorialResult, setTutorialResult] = useState<{
    chapters: { filename: string; title: string; content: string }[];
    indexContent: string;
    projectName: string;
  } | null>(null);
  const [showTutorialViewer, setShowTutorialViewer] = useState(false);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [activeVersion, setActiveVersion] = useState<VersionInfo | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showExcludePatterns, setShowExcludePatterns] = useState(false);
  const [includePatterns, setIncludePatterns] = useState<string[]>([
    "*.py",
    "*.md",
    "*.js",
    "*.ts",
    "*.tsx",
    "*.cs",
    "*.java",
  ]);
  const [excludePatterns, setExcludePatterns] = useState<string[]>(
    getAllExcludedPatterns()
  );
  const [showSummary, setShowSummary] = useState(false);
  const [codeAnalytics, setCodeAnalytics] = useState<CodeAnalytics>({
    totalLines: 0,
    totalFiles: 0,
    languageDistribution: {},
    fileExtensions: {},
    avgLinesPerFile: 0,
    totalFunctions: 0,
    totalClasses: 0,
    commentRatio: 0,
  });
  
  // Calculate total characters for cost estimation
  const totalChars = Object.values(files).reduce((sum, content) => sum + content.length, 0);
  const fileCount = Object.keys(files).length;

  const editorRef = useRef<any>(null);

  // Use the custom hook for notifications
  const { notifications, showNotification, dismissNotification } =
    useNotifications();

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

  // Warn user before navigating away during active operations
  useEffect(() => {
    const isWorking = isLoading || isProcessingTutorial;
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isWorking) {
        e.preventDefault();
        // Modern browsers require returnValue to be set
        e.returnValue = '';
        return '';
      }
    };

    if (isWorking) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isLoading, isProcessingTutorial]);

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
        commentRatio: 0,
      };

      let totalComments = 0;

      Object.entries(files).forEach(([path, content]) => {
        // Count lines
        const lines = content.split("\n").length;
        analytics.totalLines += lines;

        // Track file extensions
        const extension = path.split(".").pop()?.toLowerCase() || "unknown";
        analytics.fileExtensions[extension] =
          (analytics.fileExtensions[extension] || 0) + 1;

        // Language distribution based on extension
        let language = "Unknown";
        if (["js", "jsx"].includes(extension)) language = "JavaScript";
        else if (["ts", "tsx"].includes(extension)) language = "TypeScript";
        else if (["py"].includes(extension)) language = "Python";
        else if (["java"].includes(extension)) language = "Java";
        else if (["cs"].includes(extension)) language = "C#";
        else if (["cpp", "cc", "c", "h", "hpp"].includes(extension))
          language = "C/C++";
        else if (["rb"].includes(extension)) language = "Ruby";
        else if (["go"].includes(extension)) language = "Go";
        else if (["php"].includes(extension)) language = "PHP";
        else if (["rs"].includes(extension)) language = "Rust";
        else if (["swift"].includes(extension)) language = "Swift";
        else if (["md", "markdown"].includes(extension)) language = "Markdown";
        else if (["json"].includes(extension)) language = "JSON";
        else if (["html", "htm"].includes(extension)) language = "HTML";
        else if (["css"].includes(extension)) language = "CSS";
        else if (["xml"].includes(extension)) language = "XML";
        else if (["yml", "yaml"].includes(extension)) language = "YAML";

        analytics.languageDistribution[language] =
          (analytics.languageDistribution[language] || 0) + 1;

        // Count functions and classes
        const functionMatches =
          content.match(
            /function\s+\w+\s*\([^)]*\)\s*{|=>\s*{|\w+\s*\([^)]*\)\s*{/g
          ) || [];
        const classMatches = content.match(/class\s+\w+/g) || [];
        const commentMatches =
          content.match(/\/\/.*$|\/\*[\s\S]*?\*\//gm) || [];

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
      if (repoUrl.startsWith("test:")) {
        const errorType = repoUrl.split(":")[1];

        try {
          // If errorType is defined and not "mock", simulate that error
          if (errorType && errorType !== "mock") {
            await simulateError(errorType);
          }
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "An unknown error occurred"
          );
        } finally {
          setIsLoading(false);
        }
        return;
      }

      // Only send include patterns if there are some selected
      // If no patterns are selected, send an empty array to explicitly indicate no patterns
      // This prevents the backend from using getAllIncludedPatterns()
      const patternsToInclude =
        includePatterns.length > 0 ? includePatterns : [];

      let result: CrawlerResult;
      console.log(
        `[TutorialGen] Fetching files from ${repoUrl} with patterns: ${patternsToInclude.join(
          ", "
        )} and excluded patterns: ${excludePatterns.join(", ")}`
      );
      result = await githubFileCrawler({
        repoUrl,
        token: githubToken,
        useRelativePaths: true,
        includePatterns: patternsToInclude,
        excludePatterns,
        maxFileSize: 500000,
      });
      setFiles(result.files);
      setStats(result.stats);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTutorial = async () => {
    console.log("[TutorialGen] Create tutorial button clicked");

    // Check if we have a repository URL
    if (!repoUrl) {
      setError("Please enter a GitHub repository URL before creating a tutorial.");
      return;
    }

    setIsProcessingTutorial(true);
    setError("");

    try {
      // First, ensure we have the latest files by fetching them
      console.log("[TutorialGen] Fetching latest files before tutorial generation");
      
      // Only send include patterns if there are some selected
      const patternsToInclude = includePatterns.length > 0 ? includePatterns : [];
      
      console.log(
        `[TutorialGen] Fetching files from ${repoUrl} with patterns: ${patternsToInclude.join(
          ", "
        )} and excluded patterns: ${excludePatterns.join(", ")}`
      );
      
      // Fetch the files using the same crawler function used in handleSubmit
      const crawlerResult = await githubFileCrawler({
        repoUrl,
        token: githubToken,
        useRelativePaths: true,
        includePatterns: patternsToInclude,
        excludePatterns,
        maxFileSize: 500000,
      });
      
      // Update state with the latest files
      setFiles(crawlerResult.files);
      setStats(crawlerResult.stats);
      
      // Convert files object to array format for API
      const filesArray = Object.entries(crawlerResult.files);
      console.log(`[TutorialGen] Using ${filesArray.length} files for tutorial generation`);
      console.log(`[TutorialGen] Repository URL: ${repoUrl}`);
      console.log(`[TutorialGen] Regeneration mode: ${llmConfig.regenerationMode || 'auto'}`);
      console.log(`[TutorialGen] LLM Config:`, {
        providerId: llmConfig.providerId,
        modelId: llmConfig.modelId,
        hasApiKey: !!llmConfig.apiKey,
        hasBaseUrl: !!llmConfig.baseUrl,
        hasLegacyApiKey: !!openaiApiKey,
      });

      // Prepare payload for API request
      const payload = {
        files: filesArray,
        repo_url: repoUrl,
        include_patterns: patternsToInclude.length > 0 ? patternsToInclude : ["*"],
        exclude_patterns: excludePatterns.length > 0 ? excludePatterns : [],
        project_name: repoUrl.split("/").pop()?.replace(/\.git$/, "") || "GitHub-Tutorial",
        language: "english",
        use_cache: true,
        max_abstraction_num: 5,
        max_file_size: 500000,
        // New multi-provider LLM configuration
        llm_provider: llmConfig.providerId,
        llm_model: llmConfig.modelId,
        llm_api_key: llmConfig.apiKey || openaiApiKey || undefined,
        llm_base_url: llmConfig.baseUrl || undefined,
        // Regeneration mode for partial cache usage
        regeneration_mode: llmConfig.regenerationMode || undefined,
        force_full_regeneration: llmConfig.regenerationMode === 'full',
        // Legacy: also pass openai_api_key for backward compatibility
        openai_api_key: llmConfig.apiKey || openaiApiKey || undefined,
      };

      console.log(`[TutorialGen] Making API request to /api/tutorial-generator/stream`);
      
      // Reset progress
      setTutorialProgress({ stage: 'starting', message: 'Connecting...', progress: 0 });

      // Use SSE for streaming progress updates
      const response = await fetch("/api/tutorial-generator/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Handle SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error("No response body");
      }

      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7);
            continue;
          }
          
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.stage) {
                // Progress update
                setTutorialProgress(data);
                console.log(`[TutorialGen] Progress:`, data);
              }
              
              if (data.success) {
                // Completion event
                console.log("[TutorialGen] Tutorial created successfully", data.result);
                showNotification(
                  "success",
                  "Tutorial created successfully!",
                  "The tutorial flow has finished running."
                );
                
                // Store the result for the viewer
                if (data.result?.generatedChapters) {
                  setTutorialResult({
                    chapters: data.result.generatedChapters,
                    indexContent: data.result.generatedIndex || '',
                    projectName: data.result.projectName || repoUrl.split("/").pop()?.replace(/\.git$/, "") || "Tutorial",
                  });
                  // Show the viewer automatically
                  setShowTutorialViewer(true);
                }
              }
              
              if (data.message && !data.stage && !data.success) {
                // Error event
                throw new Error(data.message);
              }
            } catch (parseError) {
              // Ignore parse errors for incomplete data
              if (line.slice(6).trim()) {
                console.warn("[TutorialGen] Failed to parse SSE data:", line);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("[TutorialGen] Tutorial creation error:", err);
      setError(
        err instanceof Error ? err.message : "An error occurred while creating the tutorial"
      );
      showNotification(
        "error",
        "Tutorial creation failed",
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    } finally {
      console.log("[TutorialGen] Tutorial creation process finished");
      setTutorialProgress(null);
      setIsProcessingTutorial(false);
    }
  };

  const viewFile = (filePath: string) => {
    setSelectedFile(filePath);
    setFileContent(files[filePath]);
  };

  const handleLoadVersion = (
    versionFiles: Record<string, string>,
    versionInfo: VersionInfo
  ) => {
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
      exclude_patterns: null,
    });

    // If the version is from a different repo, update the repo URL
    if (versionInfo.repository !== repoUrl) {
      setRepoUrl(versionInfo.repository);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 pb-20 font-sans">
      {/* Notification system */}
      <NotificationSystem
        notifications={notifications}
        onDismiss={dismissNotification}
      />

      {/* Header */}
      <Header
        activeVersion={activeVersion}
        onClearVersion={() => setActiveVersion(null)}
      />

      <main className="max-w-7xl mx-auto">
        <form onSubmit={handleSubmit} className="mb-6">
          {/* Repository URL and GitHub Token form */}
          <RepositoryForm
            repoUrl={repoUrl}
            onRepoUrlChange={setRepoUrl}
            githubToken={githubToken}
            onGithubTokenChange={setGithubToken}
            openaiApiKey={openaiApiKey}
            onOpenaiApiKeyChange={setOpenaiApiKey}
            llmConfig={llmConfig}
            onLLMConfigChange={setLLMConfig}
            fileCount={fileCount}
            totalChars={totalChars}
          />

          {/* Filter section */}
          <FilterSection
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            showExcludePatterns={showExcludePatterns}
            setShowExcludePatterns={setShowExcludePatterns}
            includePatterns={includePatterns}
            setIncludePatterns={setIncludePatterns}
            excludePatterns={excludePatterns}
            setExcludePatterns={setExcludePatterns}
          />

          {/* Action buttons */}
          <ActionButtons
            isLoading={isLoading}
            isProcessingTutorial={isProcessingTutorial}
            handleCreateTutorial={handleCreateTutorial}
            files={files}
            repoUrl={repoUrl}
            onLoadVersion={handleLoadVersion}
          />
        </form>

        {/* Error message */}
        <ErrorMessage message={error} />

        {/* Loading indicators */}
        <LoadingIndicator type="repository" isLoading={isLoading} />
        <LoadingIndicator type="tutorial" isLoading={isProcessingTutorial} progress={tutorialProgress} />

        {/* Repository stats */}
        {stats && <StatsDisplay stats={stats} activeVersion={activeVersion} />}

        {/* View Tutorial Button - shows when tutorial is available */}
        {tutorialResult && !showTutorialViewer && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-semibold text-green-800 dark:text-green-200">
                    Tutorial Generated Successfully!
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    {tutorialResult.chapters.length} chapters created
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTutorialViewer(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                View Tutorial
              </button>
            </div>
          </div>
        )}

        {/* Content when files are loaded */}
        {Object.keys(files).length > 0 && (
          <div className="space-y-6">
            {/* File explorer with code editor */}
            <FileExplorer
              files={files}
              selectedFile={selectedFile}
              onFileSelect={viewFile}
              fileContent={fileContent}
            />

            {/* Code analytics section */}
            {/* <CodeAnalyticsDisplay analytics={codeAnalytics} /> */}

            {/* Generate Repository Summary Button */}
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() => setShowSummary(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg shadow-md transition-colors flex items-center mx-auto"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
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

        {/* Documentation Viewer - Inline within main content */}
        {showTutorialViewer && tutorialResult && (
          <div className="mt-6">
            <DocumentationViewer
              chapters={tutorialResult.chapters}
              projectName={tutorialResult.projectName}
              indexContent={tutorialResult.indexContent}
              format="md"
              onClose={() => setShowTutorialViewer(false)}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
