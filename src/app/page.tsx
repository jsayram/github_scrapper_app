"use client";

import { useState, FormEvent, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import FileSelectionModal from "@/components/FileSelectionModal";
import FileTypeSelector, { detectFileTypes, FileTypeInfo } from "@/components/FileTypeSelector";
import {
  PROVIDER_IDS,
  OPENAI_MODELS,
} from "@/lib/constants/llm";
import Footer from "@/components/Footer";

export default function Home() {
  const router = useRouter();
  // State management
  const [repoUrl, setRepoUrl] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  
  // New LLM configuration state
  const [llmConfig, setLLMConfig] = useState<LLMConfig>({
    providerId: PROVIDER_IDS.OPENAI,
    modelId: OPENAI_MODELS.GPT_4O_MINI,
    documentationMode: 'architecture',
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
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [activeVersion, setActiveVersion] = useState<VersionInfo | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showExcludePatterns, setShowExcludePatterns] = useState(false);
  const [includePatterns, setIncludePatterns] = useState<string[]>([
    "*.py", "**/*.py",
    "*.md", "**/*.md",
    "*.js", "**/*.js",
    "*.ts", "**/*.ts",
    "*.tsx", "**/*.tsx",
    "*.cs", "**/*.cs",
    "*.java", "**/*.java",
  ]);
  const [excludePatterns, setExcludePatterns] = useState<string[]>(
    getAllExcludedPatterns()
  );
  const [showSummary, setShowSummary] = useState(false);
  
  // New state for file selection modal
  const [showFileSelection, setShowFileSelection] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedFilesForTutorial, setSelectedFilesForTutorial] = useState<Record<string, string>>({});
  
  // New state for file type selector (auto-detection)
  const [showFileTypeSelector, setShowFileTypeSelector] = useState(false);
  const [detectedFileTypes, setDetectedFileTypes] = useState<FileTypeInfo[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  
  // Calculate total characters for cost estimation
  const totalChars = Object.values(files).reduce((sum, content) => sum + content.length, 0);
  const fileCount = Object.keys(files).length;

  // Workflow step tracking: 1 = detect types, 2 = crawl files, 3 = generate tutorial
  const workflowStep = fileCount > 0 ? (tutorialResult ? 3 : 2) : 1;

  // Use the custom hook for notifications
  const { notifications, showNotification, dismissNotification } =
    useNotifications();

  // Navigate to docs viewer page
  const openDocsViewer = useCallback((
    chapters: { filename: string; title: string; content: string }[],
    indexContent: string,
    projectName: string,
    format: 'md' | 'mdx' = 'md'
  ) => {
    // Generate a unique ID for this doc session
    const docId = `doc-${Date.now().toString(36)}`;
    
    // Store doc data in localStorage
    localStorage.setItem(`doc-${docId}`, JSON.stringify({
      chapters,
      indexContent,
      projectName,
      format,
    }));
    
    // Navigate to the docs viewer page
    router.push(`/docs/${docId}`);
  }, [router]);


  // Auto-save documentation to versions when generation completes
  const autoSaveDocumentation = (
    chapters: { filename: string; title: string; content: string }[],
    indexContent: string,
    projectName: string,
    mode: 'architecture' | 'tutorial'
  ) => {
    try {
      // Convert chapters to files format
      const docsFiles: Record<string, string> = {};
      
      // Add index file
      if (indexContent) {
        docsFiles['index.md'] = indexContent;
      }
      
      // Add each chapter as a file
      chapters.forEach((chapter) => {
        docsFiles[chapter.filename] = chapter.content;
      });
      
      // Generate version info
      const versionId = `docs-${Date.now().toString(36)}`;
      const modeLabel = mode === 'architecture' ? 'Architecture' : 'Tutorial';
      const dateStr = new Date().toISOString().slice(0, 10);
      const versionName = `${modeLabel}-${projectName}-${dateStr}`;
      
      const versionInfo: VersionInfo = {
        id: versionId,
        name: versionName,
        timestamp: new Date().toISOString(),
        repository: repoUrl,
        fileCount: Object.keys(docsFiles).length,
      };
      
      const dataToSave = {
        ...versionInfo,
        files: docsFiles,
        documentationType: mode, // Extra metadata for documentation type
      };
      
      // Load existing versions
      const existingVersions = localStorage.getItem('savedRepoVersions');
      const versions: VersionInfo[] = existingVersions ? JSON.parse(existingVersions) : [];
      
      // Add new version
      versions.push(versionInfo);
      localStorage.setItem('savedRepoVersions', JSON.stringify(versions));
      localStorage.setItem(`repoVersion-${versionId}`, JSON.stringify(dataToSave));
      
      console.log(`[AutoSave] Documentation auto-saved as "${versionName}"`);
      showNotification(
        "success",
        "Documentation auto-saved",
        `Saved as "${versionName}" with ${Object.keys(docsFiles).length} files`
      );
    } catch (error) {
      console.error('[AutoSave] Failed to auto-save documentation:', error);
      // Don't show error notification - auto-save is a convenience feature
    }
  };

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

  // Step 1: Quick crawl to detect file types (doesn't fetch content, just file list)
  const handleDetectFileTypes = async () => {
    if (!repoUrl) {
      setError("Please enter a repository URL");
      return;
    }
    
    setIsDetecting(true);
    setError("");
    setDetectedFileTypes([]);

    try {
      // Use broad patterns to discover all file types
      // Use **/*.ext to match files in any directory
      const broadPatterns = [
        "**/*.py", "**/*.js", "**/*.ts", "**/*.tsx", "**/*.jsx", "**/*.java", "**/*.cs", "**/*.rb", "**/*.php", "**/*.go", "**/*.rs",
        "**/*.swift", "**/*.kt", "**/*.dart", "**/*.c", "**/*.cpp", "**/*.h", "**/*.hpp", "**/*.sql", "**/*.sh", "**/*.bash",
        "**/*.md", "**/*.mdx", "**/*.txt", "**/*.rst", "**/*.json", "**/*.yml", "**/*.yaml", "**/*.xml", "**/*.toml",
        "**/*.html", "**/*.css", "**/*.scss", "**/*.sass", "**/*.less", "**/*.vue", "**/*.svelte", "**/*.astro",
        "**/*.graphql", "**/*.gql", "**/*.prisma", "**/*.proto", "**/*.tf", "**/*.lua", "**/*.r", "**/*.R", "**/*.jl",
        "**/*.hs", "**/*.ex", "**/*.exs", "**/*.erl", "**/*.scala", "**/*.clj", "**/*.cljs", "**/*.groovy", "**/*.pl",
        "**/*.fs", "**/*.fsx", "**/*.re", "**/*.rei", "**/*.mjs", "**/*.cjs", "**/*.mts", "**/*.cts",
        "**/Dockerfile", "**/*.dockerfile",
        // Also match root-level files
        "*.py", "*.js", "*.ts", "*.tsx", "*.jsx", "*.java", "*.cs", "*.md", "*.json", "*.yml", "*.yaml", "*.xml", "*.toml"
      ];

      console.log(`[TutorialGen] Detecting file types in ${repoUrl}`);
      
      const result: CrawlerResult = await githubFileCrawler({
        repoUrl,
        token: githubToken,
        useRelativePaths: true,
        includePatterns: broadPatterns,
        excludePatterns,
        maxFileSize: 500000,
      });
      
      // Detect file types from the crawled files
      const detectedTypes = detectFileTypes(result.files);
      setDetectedFileTypes(detectedTypes);
      
      // Show file type selector modal
      setShowFileTypeSelector(true);
      
      showNotification(
        "info",
        `Found ${detectedTypes.length} file types`,
        "Select which file types to include in the full crawl."
      );
      
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    } finally {
      setIsDetecting(false);
    }
  };

  // Step 2: Full crawl with selected file types (called after user confirms file type selection)
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

      // Use the include patterns selected in the filter section
      const patternsToInclude = includePatterns.length > 0 ? includePatterns : [];

      console.log(`[TutorialGen] Full crawl of ${repoUrl} with patterns: ${patternsToInclude.join(", ")}`);
      
      const result: CrawlerResult = await githubFileCrawler({
        repoUrl,
        token: githubToken,
        useRelativePaths: true,
        includePatterns: patternsToInclude,
        excludePatterns,
        maxFileSize: 500000,
      });
      
      setFiles(result.files);
      setStats(result.stats);
      
      // Show success notification
      const fileCount = Object.keys(result.files).length;
      if (fileCount > 0) {
        showNotification(
          "success",
          `Crawled ${fileCount} files`,
          "Click 'Select Files & Generate' to choose which files to include in the tutorial."
        );
      }
      
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Called when user confirms file type selection - triggers full crawl
  const handleFileTypeSelectionConfirm = async (selectedPatterns: string[]) => {
    console.log("[TutorialGen] File types selected:", selectedPatterns);
    setShowFileTypeSelector(false);
    
    // Update include patterns based on selection
    setIncludePatterns(selectedPatterns);
    
    // Trigger full crawl with selected patterns
    setIsLoading(true);
    setError("");
    setFiles({});
    setStats(null);

    try {
      console.log(`[TutorialGen] Full crawl with selected patterns: ${selectedPatterns.join(", ")}`);
      
      const result: CrawlerResult = await githubFileCrawler({
        repoUrl,
        token: githubToken,
        useRelativePaths: true,
        includePatterns: selectedPatterns,
        excludePatterns,
        maxFileSize: 500000,
      });
      
      setFiles(result.files);
      setStats(result.stats);
      
      const fileCount = Object.keys(result.files).length;
      showNotification(
        "success",
        `Crawled ${fileCount} files`,
        "Click 'Select Files & Generate' to choose which files to include in the tutorial."
      );
      
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

    // Check if we have files crawled
    if (Object.keys(files).length === 0) {
      setError("Please crawl a repository first before creating a tutorial.");
      return;
    }

    // Show file selection modal
    setShowFileSelection(true);
  };

  // Called when user confirms file selection in modal
  const handleFileSelectionConfirm = async (selectedFiles: Record<string, string>) => {
    console.log("[TutorialGen] Files selected for tutorial generation");
    setShowFileSelection(false);
    setSelectedFilesForTutorial(selectedFiles);
    
    setIsProcessingTutorial(true);
    setError("");

    try {
      // Convert files object to array format for API
      const filesArray = Object.entries(selectedFiles);
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

      // Only send include patterns if there are some selected
      const patternsToInclude = includePatterns.length > 0 ? includePatterns : [];

      // Get generation settings (use defaults if not set)
      const genSettings = llmConfig.generationSettings || {
        maxChapters: 5,
        maxLinesPerFile: 150,
        maxFileSize: 500000,
        temperature: 0.2,
        useCache: true,
        language: 'english',
      };

      // Prepare payload for API request
      const payload = {
        files: filesArray,
        repo_url: repoUrl,
        include_patterns: patternsToInclude.length > 0 ? patternsToInclude : ["*"],
        exclude_patterns: excludePatterns.length > 0 ? excludePatterns : [],
        project_name: repoUrl.split("/").pop()?.replace(/\.git$/, "") || "GitHub-Tutorial",
        // User-configurable settings (from GenerationSettings)
        language: genSettings.language,
        use_cache: genSettings.useCache,
        max_abstraction_num: genSettings.maxChapters,
        max_file_size: genSettings.maxFileSize,
        max_lines_per_file: genSettings.maxLinesPerFile,
        temperature: genSettings.temperature,
        // New multi-provider LLM configuration
        llm_provider: llmConfig.providerId,
        llm_model: llmConfig.modelId,
        llm_api_key: llmConfig.apiKey || openaiApiKey || undefined,
        llm_base_url: llmConfig.baseUrl || undefined,
        // Regeneration mode for partial cache usage
        regeneration_mode: llmConfig.regenerationMode || undefined,
        force_full_regeneration: llmConfig.regenerationMode === 'full',
        // Documentation mode: 'tutorial' or 'architecture'
        documentation_mode: llmConfig.documentationMode || 'tutorial',
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
            // Event type marker - continue to next line for data
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
                  const projectName = data.result.projectName || repoUrl.split("/").pop()?.replace(/\.git$/, "") || "Tutorial";
                  const chapters = data.result.generatedChapters;
                  const indexContent = data.result.generatedIndex || '';
                  
                  setTutorialResult({
                    chapters,
                    indexContent,
                    projectName,
                  });
                  
                  // Auto-save the documentation to versions
                  autoSaveDocumentation(
                    chapters,
                    indexContent,
                    projectName,
                    llmConfig.documentationMode
                  );
                  
                  // Auto-open the docs viewer page
                  openDocsViewer(chapters, indexContent, projectName);
                }
              }
              
              if (data.message && !data.stage && !data.success) {
                // Error event
                throw new Error(data.message);
              }
            } catch {
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
    
    // Auto-detect documentation by checking file structure if not explicitly set
    const fileNames = Object.keys(versionFiles);
    const hasIndexMd = fileNames.includes('index.md');
    const hasNumberedMdFiles = fileNames.some(f => /^\d{2}_.*\.md$/.test(f));
    const allAreMdFiles = fileNames.length > 0 && fileNames.every(f => f.endsWith('.md'));
    
    const isDocumentation = versionInfo.documentationType || (hasIndexMd && hasNumberedMdFiles && allAreMdFiles);
    
    // If this is a documentation version, show the viewer immediately
    if (isDocumentation) {
      // Convert files back to chapters format
      const chapters: { filename: string; title: string; content: string }[] = [];
      let indexContent = '';
      
      Object.entries(versionFiles).forEach(([filename, content]) => {
        if (filename === 'index.md') {
          indexContent = content;
        } else {
          // Extract title from first heading or filename
          const titleMatch = content.match(/^#\s+(.+)$/m);
          const title = titleMatch 
            ? titleMatch[1] 
            : filename.replace(/^\d+_/, '').replace(/\.md$/, '').replace(/_/g, ' ');
          
          chapters.push({
            filename,
            title,
            content,
          });
        }
      });
      
      // Sort chapters by filename (they should be numbered like 01_xxx.md)
      chapters.sort((a, b) => a.filename.localeCompare(b.filename));
      
      // Extract project name from version name (e.g., "Architecture-ProjectName-2025-12-01")
      const projectName = versionInfo.name
        .replace(/^(Architecture|Tutorial)-/, '')
        .replace(/-\d{4}-\d{2}-\d{2}$/, '')
        || 'Documentation';
      
      // Set tutorial result
      setTutorialResult({
        chapters,
        indexContent,
        projectName,
      });
      
      // Navigate to docs viewer page
      openDocsViewer(chapters, indexContent, projectName);
      
      showNotification(
        "success",
        "Documentation loaded",
        `Opening ${chapters.length} chapters from "${versionInfo.name}"`
      );
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
        {/* Workflow Steps Indicator */}
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${workflowStep >= 1 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">1</span>
            Crawl Repository
          </div>
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${workflowStep >= 2 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
            <span className={`w-5 h-5 rounded-full text-white text-xs flex items-center justify-center ${workflowStep >= 2 ? 'bg-green-600' : 'bg-gray-400'}`}>2</span>
            Select Files & Generate
          </div>
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${workflowStep >= 3 ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
            <span className={`w-5 h-5 rounded-full text-white text-xs flex items-center justify-center ${workflowStep >= 3 ? 'bg-purple-600' : 'bg-gray-400'}`}>3</span>
            View Tutorial
          </div>
        </div>

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

          {/* Action buttons - moved up closer to repo input */}
          <ActionButtons
            isLoading={isLoading}
            isProcessingTutorial={isProcessingTutorial}
            isDetecting={isDetecting}
            handleDetectFileTypes={handleDetectFileTypes}
            handleCreateTutorial={handleCreateTutorial}
            files={files}
            repoUrl={repoUrl}
            onLoadVersion={handleLoadVersion}
            hasFiles={fileCount > 0}
            hasTutorial={!!tutorialResult}
            onViewTutorial={() => {
              if (tutorialResult) {
                openDocsViewer(
                  tutorialResult.chapters,
                  tutorialResult.indexContent,
                  tutorialResult.projectName
                );
              }
            }}
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
        </form>

        {/* File Type Selector Modal - shown after detect file types */}
        <FileTypeSelector
          detectedTypes={detectedFileTypes}
          isOpen={showFileTypeSelector}
          onClose={() => setShowFileTypeSelector(false)}
          onConfirm={handleFileTypeSelectionConfirm}
          repoName={repoUrl.split('/').pop()?.replace(/\.git$/, '') || 'Repository'}
        />

        {/* File Selection Modal */}
        <FileSelectionModal
          files={files}
          isOpen={showFileSelection}
          onClose={() => setShowFileSelection(false)}
          onConfirm={handleFileSelectionConfirm}
          isProcessing={isProcessingTutorial}
          providerId={llmConfig.providerId}
          modelId={llmConfig.modelId}
          documentationMode={llmConfig.documentationMode || 'architecture'}
          onModelChange={(newProviderId, newModelId) => {
            setLLMConfig(prev => ({
              ...prev,
              providerId: newProviderId,
              modelId: newModelId,
            }));
          }}
        />

        {/* Error message - with token limit recovery options */}
        <ErrorMessage 
          message={error} 
          onModelChange={(newProviderId, newModelId) => {
            setLLMConfig(prev => ({
              ...prev,
              providerId: newProviderId,
              modelId: newModelId,
            }));
            setError(''); // Clear error after model change
            showNotification(
              'info',
              'Model changed',
              `Switched to ${newModelId}. Try generating again.`
            );
          }}
        />

        {/* Loading indicators */}
        <LoadingIndicator type="repository" isLoading={isLoading} />
        <LoadingIndicator 
          type="tutorial" 
          isLoading={isProcessingTutorial} 
          progress={tutorialProgress}
          documentationMode={llmConfig.documentationMode || 'architecture'}
        />

        {/* Repository stats */}
        {stats && <StatsDisplay stats={stats} activeVersion={activeVersion} />}

        {/* View Tutorial/Architecture Button - shows when documentation is available */}
        {tutorialResult && (
          <div className={`mb-6 p-4 rounded-lg border ${
            llmConfig.documentationMode === 'architecture'
              ? 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800'
              : 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className={`h-6 w-6 ${
                  llmConfig.documentationMode === 'architecture'
                    ? 'text-purple-600 dark:text-purple-400'
                    : 'text-green-600 dark:text-green-400'
                }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className={`font-semibold ${
                    llmConfig.documentationMode === 'architecture'
                      ? 'text-purple-800 dark:text-purple-200'
                      : 'text-green-800 dark:text-green-200'
                  }`}>
                    {llmConfig.documentationMode === 'architecture' 
                      ? '🏗️ Architecture Documentation Generated!' 
                      : '📚 Tutorial Generated Successfully!'}
                  </p>
                  <p className={`text-sm ${
                    llmConfig.documentationMode === 'architecture'
                      ? 'text-purple-600 dark:text-purple-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}>
                    {tutorialResult.chapters.length} {llmConfig.documentationMode === 'architecture' ? 'sections' : 'chapters'} created
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (tutorialResult) {
                    openDocsViewer(
                      tutorialResult.chapters,
                      tutorialResult.indexContent,
                      tutorialResult.projectName
                    );
                  }
                }}
                className={`px-4 py-2 text-white font-medium rounded-lg transition-colors flex items-center gap-2 ${
                  llmConfig.documentationMode === 'architecture'
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                View {llmConfig.documentationMode === 'architecture' ? 'Architecture Docs' : 'Tutorial'}
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
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
