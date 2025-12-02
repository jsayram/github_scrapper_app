/* -------------------------------------------------------------------------
 * nodes.ts
 * -------------------------------------------------------------------------
 * TypeScript conversion of the Python nodes.py script for Next.js.
 * Assumes availability of pocketflow Node/BatchNode, js-yaml, and utility
 * functions (githubFileCrawler, callLLM).
 * Handles async operations and uses Node.js built-in modules.
 * ------------------------------------------------------------------------- */

import fs from "node:fs/promises"; // Use promises API for async operations
import path from "node:path";
import yaml from "js-yaml";
import { Node, BatchNode } from "pocketflow"; // Assuming pocketflow types are available

// Assuming these utility functions exist and are async
import { githubFileCrawler } from "@/lib/githubFileCrawler"; // Assuming this is the correct import path
// import { crawlLocalFiles } from "@/utils/crawl_local_files";
import { callLLM } from "@/lib/llmMultiProvider"; // Updated to use multi-provider LLM
import { CrawlerResult } from "@/lib/githubFileCrawler"; // Assuming this is the correct import path
import { PROVIDER_IDS } from "@/lib/constants/llm";
import { cacheLog } from "@/lib/cacheLogger";

// Simple type for output format - always 'md' now
type OutputFormat = 'md';

// Helper functions for filenames (simplified since we only support md)
function getFileExtension(): string {
  return '.md';
}

function createSafeFilenameWithFormat(name: string, prefix: number): string {
  // Sanitize name for filesystem
  const safeName = name
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
  
  const paddedPrefix = String(prefix).padStart(2, '0');
  return `${paddedPrefix}_${safeName}.md`;
}

// Define types for shared data for better type safety
interface SharedData {
  repo_url?: string;
  local_dir?: string;
  project_name?: string;
  github_token?: string;
  include_patterns?: string[];
  exclude_patterns?: string[];
  max_file_size?: number;
  max_lines_per_file?: number; // Maximum lines per file for truncation (default: 150)
  files?: [string, string][]; // Array of [path, content] tuples
  language?: string;
  use_cache?: boolean;
  max_abstraction_num?: number;
  abstractions?: Abstraction[];
  relationships?: RelationshipData;
  chapter_order?: number[];
  chapters?: string[]; // Array of Markdown chapter content
  output_dir?: string;
  final_output_dir?: string;
  openai_api_key?: string; // Legacy: Custom API key from frontend
  
  // Multi-provider LLM configuration
  llm_provider?: string;  // Provider ID (openai, anthropic, google, groq, etc.)
  llm_model?: string;     // Model ID
  llm_api_key?: string;   // API key for the provider
  llm_base_url?: string;  // Custom base URL (for Ollama, Azure, etc.)
  model_context_window?: number;  // Model's context window in tokens (dynamic per model)
  
  // Partial regeneration support
  regeneration_mode?: 'full' | 'partial' | 'partial_reidentify' | 'skip';
  chapters_to_regenerate?: string[];  // Chapter slugs to regenerate
  cached_chapters?: Record<string, string>;  // slug -> cached content
  cached_abstractions?: Abstraction[];
  cached_relationships?: RelationshipData;
  
  // Output format (md or mdx)
  output_format?: OutputFormat;
  
  // Documentation mode: 'tutorial' for step-by-step, 'architecture' for high-level overview
  documentation_mode?: 'tutorial' | 'architecture';
  
  // Generated tutorial data (for viewer)
  generated_chapters?: { filename: string; title: string; content: string }[];
  generated_index?: string;
}

interface Abstraction {
  name: string;
  description: string;
  files: number[]; // List of file indices
}

interface Relationship {
  from: number; // Source abstraction index
  to: number; // Target abstraction index
  label: string; // Relationship label
}

interface RelationshipData {
  summary: string;
  details: Relationship[];
}

interface ChapterFilenameInfo {
  num: number;
  name: string;
  filename: string;
}

/* -------------------------------------------------------------------------
 * helpers
 * ------------------------------------------------------------------------- */

/**
 * Given the full `files` array ([path, content]) and a list of indices, return
 * a map keyed `"idx # path"` → file contents. Used to build LLM context.
 */
function getContentForIndices(
  filesData: [string, string][],
  indices: number[]
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const i of indices) {
    if (i >= 0 && i < filesData.length) {
      const [p, c] = filesData[i];
      map[`${i} # ${p}`] = c;
    }
  }
  return map;
}

/**
 * Smart file content truncation to reduce token count while preserving key information.
 * Keeps the first N lines (imports, class definitions, function signatures) and last M lines.
 * @param content - The file content to truncate
 * @param maxStartLines - Maximum lines to keep from the start (default: 200)
 * @param maxEndLines - Maximum lines to keep from the end (default: 50)
 * @returns Truncated content with indicator if truncation occurred
 */
function truncateFileContent(
  content: string,
  maxStartLines: number = 200,
  maxEndLines: number = 50
): string {
  const lines = content.split('\n');
  const totalLines = lines.length;
  const maxTotalLines = maxStartLines + maxEndLines;
  
  // If file is small enough, return as-is
  if (totalLines <= maxTotalLines) {
    return content;
  }
  
  // Take first N lines and last M lines
  const startPortion = lines.slice(0, maxStartLines);
  const endPortion = lines.slice(-maxEndLines);
  const omittedCount = totalLines - maxTotalLines;
  
  return [
    ...startPortion,
    `\n// ... [${omittedCount} lines omitted for brevity - file has ${totalLines} total lines] ...\n`,
    ...endPortion
  ].join('\n');
}

/**
 * Gets content for specific file indices with smart truncation applied.
 * Returns a map keyed `"idx # path"` → truncated file contents.
 */
function getContentForIndicesTruncated(
  filesData: [string, string][],
  indices: number[],
  maxLinesPerFile: number = 150
): Record<string, string> {
  const map: Record<string, string> = {};
  const maxStartLines = Math.floor(maxLinesPerFile * 0.8);
  const maxEndLines = maxLinesPerFile - maxStartLines;
  
  for (const i of indices) {
    if (i >= 0 && i < filesData.length) {
      const [p, c] = filesData[i];
      map[`${i} # ${p}`] = truncateFileContent(c, maxStartLines, maxEndLines);
    }
  }
  return map;
}

/**
 * Extracts high-level signatures from file content for architecture documentation.
 * Captures imports, exports, interfaces, types, function/class signatures without implementation.
 * This dramatically reduces token count while preserving structural understanding.
 */
function extractFileSignatures(content: string, filePath: string): string {
  const lines = content.split('\n');
  const signatures: string[] = [];
  let inMultiLineImport = false;
  let inInterface = false;
  let inType = false;
  let braceDepth = 0;
  let currentBlock: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Skip empty lines and comments (unless in a block we're capturing)
    if (!inMultiLineImport && !inInterface && !inType) {
      if (trimmed === '' || trimmed.startsWith('//')) continue;
    }
    
    // Capture import statements (single and multi-line)
    if (trimmed.startsWith('import ') || inMultiLineImport) {
      signatures.push(line);
      if (trimmed.includes('{') && !trimmed.includes('}')) {
        inMultiLineImport = true;
      }
      if (trimmed.includes('}') || (trimmed.includes('from ') && trimmed.endsWith(';') || trimmed.endsWith("'") || trimmed.endsWith('"'))) {
        inMultiLineImport = false;
      }
      continue;
    }
    
    // Capture export statements
    if (trimmed.startsWith('export ') && !trimmed.startsWith('export default function') && !trimmed.startsWith('export default class') && !trimmed.startsWith('export class') && !trimmed.startsWith('export function') && !trimmed.startsWith('export async function')) {
      // Simple exports like "export { thing }" or "export type"
      if (trimmed.startsWith('export type ') || trimmed.startsWith('export interface ')) {
        // Will be handled below
      } else {
        signatures.push(line);
        continue;
      }
    }
    
    // Capture interface definitions (with body structure)
    if (trimmed.startsWith('interface ') || trimmed.startsWith('export interface ')) {
      inInterface = true;
      braceDepth = 0;
      currentBlock = [line];
      if (trimmed.includes('{')) braceDepth++;
      if (trimmed.includes('}')) braceDepth--;
      if (braceDepth === 0 && trimmed.includes('}')) {
        signatures.push(currentBlock.join('\n'));
        inInterface = false;
        currentBlock = [];
      }
      continue;
    }
    
    if (inInterface) {
      currentBlock.push(line);
      if (trimmed.includes('{')) braceDepth++;
      if (trimmed.includes('}')) braceDepth--;
      if (braceDepth === 0) {
        signatures.push(currentBlock.join('\n'));
        inInterface = false;
        currentBlock = [];
      }
      continue;
    }
    
    // Capture type definitions
    if (trimmed.startsWith('type ') || trimmed.startsWith('export type ')) {
      if (trimmed.includes('=') && (trimmed.endsWith(';') || trimmed.endsWith("'") || trimmed.endsWith('"') || trimmed.endsWith('>'))) {
        // Single-line type
        signatures.push(line);
      } else {
        // Multi-line type
        inType = true;
        braceDepth = 0;
        currentBlock = [line];
        if (trimmed.includes('{') || trimmed.includes('(')) braceDepth++;
        if (trimmed.includes('}') || trimmed.includes(')')) braceDepth--;
      }
      continue;
    }
    
    if (inType) {
      currentBlock.push(line);
      if (trimmed.includes('{') || trimmed.includes('(')) braceDepth++;
      if (trimmed.includes('}') || trimmed.includes(')')) braceDepth--;
      if (braceDepth === 0 && (trimmed.endsWith(';') || trimmed.endsWith('}') || trimmed.endsWith(')'))) {
        signatures.push(currentBlock.join('\n'));
        inType = false;
        currentBlock = [];
      }
      continue;
    }
    
    // Capture function signatures (just the signature, not the body)
    if (trimmed.match(/^(export\s+)?(async\s+)?function\s+\w+/) || 
        trimmed.match(/^(export\s+)?const\s+\w+\s*=\s*(async\s+)?\(/) ||
        trimmed.match(/^(export\s+)?const\s+\w+\s*=\s*(async\s+)?function/)) {
      // Extract just the function signature
      const funcMatch = trimmed.match(/^(.+?)\s*[{=]/);
      if (funcMatch) {
        signatures.push(`${funcMatch[1]} { /* ... */ }`);
      } else {
        signatures.push(`${trimmed.split('{')[0].trim()} { /* ... */ }`);
      }
      continue;
    }
    
    // Capture class declarations (just the class line and constructor/method signatures)
    if (trimmed.match(/^(export\s+)?(default\s+)?class\s+\w+/)) {
      signatures.push(`${trimmed.split('{')[0].trim()} {`);
      // Look ahead for constructor and method signatures
      let classDepth = 1;
      for (let j = i + 1; j < lines.length && classDepth > 0; j++) {
        const classLine = lines[j].trim();
        if (classLine.includes('{')) classDepth++;
        if (classLine.includes('}')) classDepth--;
        
        // Capture method signatures
        if (classLine.match(/^(async\s+)?(private\s+|public\s+|protected\s+)?\w+\s*\(/) ||
            classLine.match(/^constructor\s*\(/)) {
          const methodSig = classLine.split('{')[0].trim();
          signatures.push(`  ${methodSig} { /* ... */ }`);
        }
      }
      signatures.push('}');
      continue;
    }
    
    // Capture React component declarations
    if (trimmed.match(/^(export\s+)?(default\s+)?function\s+[A-Z]\w*/) ||
        trimmed.match(/^(export\s+)?const\s+[A-Z]\w+\s*[=:]/)) {
      const compMatch = trimmed.match(/^(.+?)\s*[{=(\n]/);
      if (compMatch) {
        signatures.push(`${compMatch[1]} { /* React Component */ }`);
      }
      continue;
    }
  }
  
  // Add file path context
  const extension = filePath.split('.').pop() || '';
  const fileType = getFileTypeLabel(extension);
  
  return `// ${fileType}: ${filePath}\n${signatures.join('\n')}`;
}

/**
 * Get a human-readable label for file type
 */
function getFileTypeLabel(extension: string): string {
  const labels: Record<string, string> = {
    'tsx': 'React Component/Page',
    'ts': 'TypeScript Module',
    'jsx': 'React Component',
    'js': 'JavaScript Module',
    'py': 'Python Module',
    'java': 'Java Class',
    'cs': 'C# Class',
    'go': 'Go Package',
    'rs': 'Rust Module',
    'md': 'Documentation',
    'json': 'Configuration',
    'yaml': 'Configuration',
    'yml': 'Configuration',
  };
  return labels[extension] || 'Source File';
}

/**
 * Creates a filesystem-safe filename from a potentially translated name.
 * Always uses .md format.
 */
function createSafeFilename(name: string, prefix: number): string {
  return createSafeFilenameWithFormat(name, prefix);
}

/* -------------------------------------------------------------------------
 * FetchRepo
 * ------------------------------------------------------------------------- */
export class FetchRepo extends Node<SharedData> {
  async prep(shared: SharedData) {
    let {
      repo_url: repoUrl,
      local_dir: localDir,
      project_name: projectName,
    } = shared;

    // Determine project name if not provided
    if (!projectName) {
      projectName = repoUrl
        ? repoUrl
            .split("/")
            .pop()!
            .replace(/\.git$/, "") // Get last part of URL, remove .git
        : path.basename(path.resolve(localDir!)); // Get base directory name
      shared.project_name = projectName; // Update shared data
    }

    // Get necessary parameters from shared data
    const {
      include_patterns: includePatterns,
      exclude_patterns: excludePatterns,
      max_file_size: maxFileSize,
      github_token: token,
      use_cache: useCache = true,
    } = shared;

    // Ensure required patterns/size are provided (or handle defaults if applicable)
    if (!includePatterns || !excludePatterns || maxFileSize === undefined) {
      throw new Error(
        "Missing required parameters: include_patterns, exclude_patterns, or max_file_size"
      );
    }
    if (!repoUrl && !localDir) {
      throw new Error(
        "Missing required parameters: repo_url or local_dir must be provided"
      );
    }

    return {
      repoUrl,
      localDir,
      token,
      includePatterns,
      excludePatterns,
      maxFileSize,
      useRelativePaths: true, // Consistent with Python code
      useCache,
    } as const; // Use 'as const' for stricter typing of the return object
  }

  async exec(prepRes: ReturnType<this["prep"]>): Promise<[string, string][]> {
    const {
      repoUrl,
      localDir,
      token,
      includePatterns,
      excludePatterns,
      maxFileSize,
      useRelativePaths,
      useCache,
    } = await prepRes;

    let result: CrawlerResult;
    if(repoUrl){
    console.log(`Crawling repository: ${repoUrl}...`);
    result = await githubFileCrawler({
      // Assuming async
      repoUrl: repoUrl,
      token: token,
      includePatterns: includePatterns,
      excludePatterns: excludePatterns,
      maxFileSize: maxFileSize,
      useRelativePaths: useRelativePaths,
    });
    } else { 
      throw new Error("No repository URL or local directory provided.");
    }

    // Convert the result's files map (or empty object) into an array of [path, content] tuples
    const filesList = Object.entries(result.files ?? {});

    // Check if any files were fetched
    if (filesList.length === 0) {
      throw new Error(
        "Failed to fetch files or no files matched the criteria."
      );
    }

    console.log(`Fetched ${filesList.length} files.`);
    return filesList as [string, string][]; // Ensure correct type casting
  }

  async post(
    shared: SharedData,
    _prepRes: any,
    execRes: [string, string][]
  ): Promise<string | undefined> {
    // Store the fetched files list in shared data
    shared.files = execRes;
    return undefined;
  }
}

/* -------------------------------------------------------------------------
 * IdentifyAbstractions
 * ------------------------------------------------------------------------- */
export class IdentifyAbstractions extends Node<SharedData> {
  private _shared?: SharedData;
  
  async prep(shared: SharedData) {
    // Store shared reference for progress callback access
    this._shared = shared;
    
    const filesData = shared.files;
    const projectName = shared.project_name;
    const language = shared.language ?? "english";
    const useCache = shared.use_cache ?? true;
    const maxAbs = shared.max_abstraction_num ?? 10;
    const maxLinesPerFile = shared.max_lines_per_file ?? 150; // Default: 120 start + 30 end = 150 total
    const documentationMode = shared.documentation_mode ?? 'tutorial'; // 'tutorial' or 'architecture'
    const customApiKey = shared.llm_api_key || shared.openai_api_key; // Get custom API key (prefer new, fallback to legacy)
    const llmProvider = shared.llm_provider || PROVIDER_IDS.OPENAI;
    const llmModel = shared.llm_model;
    const llmBaseUrl = shared.llm_base_url;
    
    // Get model context window dynamically (passed from API route)
    const modelContextWindow = shared.model_context_window ?? 128000;

    if (!filesData || filesData.length === 0) {
      throw new Error(
        "No files data found in shared state for IdentifyAbstractions."
      );
    }
    if (!projectName) {
      throw new Error("Project name not found in shared state.");
    }

    let context = "";
    const fileInfo: [number, string][] = []; // Store [index, path] tuples

    // Calculate start/end line split (80% start, 20% end)
    const maxStartLines = Math.floor(maxLinesPerFile * 0.8);
    const maxEndLines = maxLinesPerFile - maxStartLines;

    // Track original vs truncated sizes for logging
    let originalTotalChars = 0;
    let processedTotalChars = 0;
    let filesWithTruncation = 0;

    // Dynamic context limit based on model's context window
    // Reserve ~15% for prompt overhead and ~15% for response, use 70% for file context
    const CONTEXT_USAGE_RATIO = 0.70;
    const MAX_CONTEXT_TOKENS = Math.floor(modelContextWindow * CONTEXT_USAGE_RATIO);
    const CHARS_PER_TOKEN = 3.5;
    const MAX_CONTEXT_CHARS = MAX_CONTEXT_TOKENS * CHARS_PER_TOKEN;
    
    console.log(`📊 Model context window: ${modelContextWindow.toLocaleString()} tokens (using ${MAX_CONTEXT_TOKENS.toLocaleString()} for file context)`);

    // Build the context string and file info list
    // In architecture mode, use signature extraction for massive token reduction
    // In tutorial mode, apply smart truncation to large files
    
    // First pass: process all files and calculate sizes
    const processedFiles: { path: string; content: string; index: number; chars: number }[] = [];
    
    filesData.forEach(([path, content], index) => {
      const originalLength = content.length;
      let processedContent: string;
      
      if (documentationMode === 'architecture') {
        // Architecture mode: extract only signatures, imports, exports, interfaces
        processedContent = extractFileSignatures(content, path);
      } else {
        // Tutorial mode: use truncation
        processedContent = truncateFileContent(content, maxStartLines, maxEndLines);
      }
      
      const processedLength = processedContent.length;
      
      originalTotalChars += originalLength;
      
      if (processedLength < originalLength) {
        filesWithTruncation++;
      }
      
      processedFiles.push({
        path,
        content: processedContent,
        index,
        chars: processedLength,
      });
    });
    
    // Sort files by importance for context limit (prioritize entry points and main files)
    const priorityPatterns = [
      /page\.(tsx?|jsx?)$/,
      /index\.(tsx?|jsx?|ts|js|py)$/,
      /main\.(tsx?|jsx?|ts|js|py)$/,
      /app\.(tsx?|jsx?|ts|js|py)$/,
      /route\.(tsx?|jsx?)$/,
      /layout\.(tsx?|jsx?)$/,
      /\/(api|lib|utils|components)\//,
    ];
    
    processedFiles.sort((a, b) => {
      const aScore = priorityPatterns.findIndex(p => p.test(a.path));
      const bScore = priorityPatterns.findIndex(p => p.test(b.path));
      // Higher priority (lower index or -1 becomes last) goes first
      const aPriority = aScore === -1 ? 999 : aScore;
      const bPriority = bScore === -1 ? 999 : bScore;
      return aPriority - bPriority;
    });
    
    // Second pass: build context respecting the token limit
    let currentChars = 0;
    let filesIncluded = 0;
    let filesSkipped = 0;
    
    for (const file of processedFiles) {
      const fileHeader = `--- File Index ${file.index}: ${file.path} ---\n`;
      const fileEntry = fileHeader + file.content + '\n\n';
      const entryChars = fileEntry.length;
      
      if (currentChars + entryChars <= MAX_CONTEXT_CHARS) {
        context += fileEntry;
        fileInfo.push([file.index, file.path]);
        currentChars += entryChars;
        processedTotalChars += file.chars;
        filesIncluded++;
      } else {
        filesSkipped++;
      }
    }

    // Log token savings and context limit info
    const originalTokens = Math.ceil(originalTotalChars / 3.5);
    const processedTokens = Math.ceil(processedTotalChars / 3.5);
    const savedTokens = originalTokens - processedTokens;
    const savingsPercent = originalTokens > 0 ? ((savedTokens / originalTokens) * 100).toFixed(1) : '0';
    
    const modeLabel = documentationMode === 'architecture' ? '🏗️ Architecture mode (signatures only)' : '📚 Tutorial mode (truncated)';
    console.log(`${modeLabel}: ${filesWithTruncation}/${filesData.length} files processed`);
    console.log(`📉 Token savings: ~${savedTokens.toLocaleString()} tokens saved (${savingsPercent}% reduction)`);
    console.log(`📈 Context size: ~${processedTokens.toLocaleString()} tokens (was ~${originalTokens.toLocaleString()})`);
    
    if (filesSkipped > 0) {
      console.log(`⚠️ Context limit: ${filesIncluded}/${processedFiles.length} files included, ${filesSkipped} files skipped to stay under ${MAX_CONTEXT_TOKENS.toLocaleString()} token limit`);
    };

    // Create a formatted string listing files for the LLM prompt
    const fileListing = fileInfo
      .map(([index, path]) => `- ${index} # ${path}`)
      .join("\n");

    return {
      context,
      fileListing,
      fileCount: filesData.length,
      projectName,
      language,
      useCache,
      maxAbs,
      documentationMode,
      customApiKey,
      llmProvider,
      llmModel,
      llmBaseUrl,
    } as const;
  }

  async exec(prepRes: ReturnType<this["prep"]>): Promise<Abstraction[]> {
    const {
      context,
      fileListing,
      fileCount,
      projectName,
      language,
      useCache,
      maxAbs,
      documentationMode,
      customApiKey,
      llmProvider,
      llmModel,
      llmBaseUrl,
    } = await prepRes;
    
    // Get progress callback from shared
    const onProgress = this._shared?._onProgress;
    
    const isArchitectureMode = documentationMode === 'architecture';
    
    if (onProgress) {
      await onProgress({
        stage: 'abstractions',
        message: isArchitectureMode 
          ? 'Analyzing architecture and identifying major subsystems...'
          : 'Analyzing codebase and identifying key concepts...',
        progress: 15
      });
    }
    
    console.log(`Identifying abstractions using LLM (${documentationMode} mode)...`);

    // Determine language-specific instructions and hints
    const langCap =
      language.toLowerCase() !== "english"
        ? language.charAt(0).toUpperCase() + language.slice(1)
        : "";
    const languageInstruction = langCap
      ? `IMPORTANT: Generate the \`name\` and \`description\` for each abstraction in **${langCap}** language. Do NOT use English for these fields.\n\n`
      : "";
    const nameLangHint = langCap ? ` (value in ${langCap})` : "";
    const descLangHint = langCap ? ` (value in ${langCap})` : "";

    // Construct the prompt for the LLM
    // Build prompt based on documentation mode
    let prompt: string;
    
    if (isArchitectureMode) {
      // Architecture mode: Focus on high-level structure and system understanding
      prompt = `
For the project \`${projectName}\`:

Codebase Structure (signatures and interfaces):
${context}

${languageInstruction}Analyze this codebase to understand its **architecture and purpose**.

Identify the top 3-${maxAbs} major **subsystems or architectural components** that define what this project does.

For each subsystem, provide:
1. A concise \`name\` that describes the subsystem${nameLangHint}.
2. A high-level \`description\` explaining:
   - What this subsystem's PURPOSE is (what problem it solves)
   - How it fits into the overall architecture
   - Key responsibilities (in around 80-100 words)${descLangHint}
3. A list of relevant \`file_indices\` (integers) using the format \`idx # path/comment\`.

Focus on:
- Entry points (pages, routes, main files)
- Core business logic flows
- Data models and state management
- External integrations (APIs, databases)

List of file indices and paths present in the context:
${fileListing}

Format the output as a YAML list of dictionaries:

\`\`\`yaml
- name: |
    User Interface Layer${nameLangHint}
  description: |
    Handles user interactions through React pages and components.
    This is the entry point for users, rendering forms and displaying data.${descLangHint}
  file_indices:
    - 0 # src/app/page.tsx
    - 3 # src/components/Form.tsx
- name: |
    Data Processing Pipeline${nameLangHint}
  description: |
    Core business logic that transforms and processes data.
    Acts as the brain of the application, orchestrating workflows.${descLangHint}
  file_indices:
    - 5 # src/lib/processor.ts
# ... up to ${maxAbs} subsystems
\`\`\``;
    } else {
      // Tutorial mode: Focus on learning concepts step by step
      prompt = `
For the project \`${projectName}\`:

Codebase Context:
${context}

${languageInstruction}Analyze the codebase context.
Identify the top 5-${maxAbs} core most important abstractions to help those new to the codebase.

For each abstraction, provide:
1. A concise \`name\`${nameLangHint}.
2. A beginner-friendly \`description\` explaining what it is with a simple analogy, in around 100 words${descLangHint}.
3. A list of relevant \`file_indices\` (integers) using the format \`idx # path/comment\`.

List of file indices and paths present in the context:
${fileListing}

Format the output as a YAML list of dictionaries:

\`\`\`yaml
- name: |
    Query Processing${nameLangHint}
  description: |
    Explains what the abstraction does.
    It's like a central dispatcher routing requests.${descLangHint}
  file_indices:
    - 0 # path/to/file1.py
    - 3 # path/to/related.py
- name: |
    Query Optimization${nameLangHint}
  description: |
    Another core concept, similar to a blueprint for objects.${descLangHint}
  file_indices:
    - 5 # path/to/another.js
# ... up to ${maxAbs} abstractions
\`\`\``;
    }

    // Call the LLM with cache context and custom API key
    const response = await callLLM({ 
      prompt, 
      useCache,
      customApiKey,
      provider: llmProvider,
      model: llmModel,
      customBaseUrl: llmBaseUrl,
    });

    // Extract YAML block from the response
    const yamlMatch = response.trim().match(/```yaml\s*([\s\S]*?)\s*```/);
    const yamlStr = yamlMatch?.[1]?.trim();

    if (!yamlStr) {
      console.error("LLM Response:", response);
      throw new Error(
        "LLM did not return a valid fenced YAML block for abstractions."
      );
    }

    let parsedAbstractions: any;
    try {
      // Parse the YAML string
      parsedAbstractions = yaml.load(yamlStr);
    } catch (e: any) {
      console.error("YAML Parsing Error:", e);
      console.error("Invalid YAML String:", yamlStr);
      throw new Error(`Failed to parse YAML for abstractions: ${e.message}`);
    }

    // Validate the parsed YAML structure
    if (!Array.isArray(parsedAbstractions)) {
      console.error("Parsed YAML is not an array:", parsedAbstractions);
      throw new Error("LLM output (parsed YAML) is not a list.");
    }

    // Validate each abstraction item
    const validatedAbstractions = parsedAbstractions.map(
      (item: any, index: number) => {
        if (
          !item ||
          typeof item !== "object" ||
          typeof item.name !== "string" ||
          typeof item.description !== "string" ||
          !Array.isArray(item.file_indices)
        ) {
          throw new Error(
            `Malformed abstraction item at index ${index}: ${JSON.stringify(
              item
            )}`
          );
        }

        // Validate and normalize file indices
        const files = [
          ...new Set<number>(
            item.file_indices.map((entry: any) => {
              let idx: number;
              if (typeof entry === "number") {
                idx = entry;
              } else if (typeof entry === "string") {
                // Extract number before '#' or parse the whole string if no '#'
                const match = entry.match(/^\s*(\d+)/);
                if (match) {
                  idx = parseInt(match[1], 10);
                } else {
                  throw new Error(
                    `Could not parse index from string entry: "${entry}" in item "${item.name}"`
                  );
                }
              } else {
                idx = parseInt(String(entry), 10); // Attempt conversion
              }

              if (isNaN(idx) || idx < 0 || idx >= fileCount) {
                throw new Error(
                  `Invalid or out-of-bounds file index ${idx} (parsed from "${entry}") in item "${
                    item.name
                  }". Max index is ${fileCount - 1}.`
                );
              }
              return idx;
            })
          ),
        ].sort((a, b) => a - b); // Remove duplicates and sort

        return {
          name: item.name.trim(),
          description: item.description.trim(),
          files: files as number[],
        } as Abstraction;
      }
    );

    console.log(`Identified ${validatedAbstractions.length} abstractions.`);
    return validatedAbstractions;
  }

  async post(
    shared: SharedData,
    _prepRes: any,
    execRes: Abstraction[]
  ): Promise<string | undefined> {
    // Store the validated abstractions in shared data
    shared.abstractions = execRes;
    return undefined;
  }
}

/* -------------------------------------------------------------------------
 * AnalyzeRelationships
 * ------------------------------------------------------------------------- */
export class AnalyzeRelationships extends Node<SharedData> {
  private _shared?: SharedData;
  
  async prep(shared: SharedData) {
    // Store shared reference for progress callback access
    this._shared = shared;
    
    const abstractions = shared.abstractions;
    const filesData = shared.files;
    const projectName = shared.project_name;
    const language = shared.language ?? "english";
    const useCache = shared.use_cache ?? true;
    const maxLinesPerFile = shared.max_lines_per_file ?? 150;
    const customApiKey = shared.llm_api_key || shared.openai_api_key;
    const llmProvider = shared.llm_provider || PROVIDER_IDS.OPENAI;
    const llmModel = shared.llm_model;
    const llmBaseUrl = shared.llm_base_url;

    if (!abstractions || abstractions.length === 0) {
      throw new Error(
        "No abstractions found in shared state for AnalyzeRelationships."
      );
    }
    if (!filesData) {
      throw new Error("No files data found in shared state.");
    }
    if (!projectName) {
      throw new Error("Project name not found in shared state.");
    }

    let context = "Identified Abstractions:\n";
    const abstractionPromptInfo: string[] = [];
    const allRelevantIndices = new Set<number>();

    // Build context string with abstraction details
    abstractions.forEach((abs, index) => {
      const fileIndicesStr = abs.files.join(", ");
      context += `- Index ${index}: ${abs.name} (Relevant file indices: [${fileIndicesStr}])\n  Description: ${abs.description}\n`;
      abstractionPromptInfo.push(`${index} # ${abs.name}`);
      abs.files.forEach((idx) => allRelevantIndices.add(idx));
    });

    context += "\nRelevant File Snippets (Referenced by Index and Path):\n";

    // Get content for all relevant files with truncation applied
    const relevantFilesContentMap = getContentForIndicesTruncated(
      filesData,
      [...allRelevantIndices].sort((a, b) => a - b),
      maxLinesPerFile
    );

    // Add file snippets to the context
    context += Object.entries(relevantFilesContentMap)
      .map(([idxPath, content]) => `--- File: ${idxPath} ---\n${content}`)
      .join("\n\n");

    return {
      context,
      abstractionListing: abstractionPromptInfo.join("\n"),
      numAbstractions: abstractions.length,
      projectName,
      language,
      useCache,
      customApiKey,
      llmProvider,
      llmModel,
      llmBaseUrl,
    } as const;
  }

  async exec(prepRes: ReturnType<this["prep"]>): Promise<RelationshipData> {
    const {
      context,
      abstractionListing,
      numAbstractions,
      projectName,
      language,
      useCache,
      customApiKey,
      llmProvider,
      llmModel,
      llmBaseUrl,
    } = await prepRes;
    
    // Get progress callback from shared
    const onProgress = this._shared?._onProgress;
    
    if (onProgress) {
      await onProgress({
        stage: 'relationships',
        message: 'Analyzing relationships between concepts...',
        progress: 22
      });
    }
    
    console.log("Analyzing relationships using LLM...");

    // Determine language-specific instructions and hints
    const langCap =
      language.toLowerCase() !== "english"
        ? language.charAt(0).toUpperCase() + language.slice(1)
        : "";
    const langInstr = langCap
      ? `IMPORTANT: Generate the \`summary\` and relationship \`label\` fields in **${langCap}** language. Do NOT use English for these fields.\n\n`
      : "";
    const langHint = langCap ? ` (in ${langCap})` : "";
    const listLangNote = langCap ? ` (Names might be in ${langCap})` : "";

    // Construct the prompt for the LLM
    const prompt = `
Based on the following abstractions and relevant code snippets from the project \`${projectName}\`:

List of Abstraction Indices and Names${listLangNote}:
${abstractionListing}

Context (Abstractions, Descriptions, Code):
${context}

${langInstr}Please provide:
1. A high-level \`summary\` of the project's main purpose and functionality in a few beginner-friendly sentences${langHint}. Use markdown formatting with **bold** and *italic* text to highlight important concepts.
2. A list (\`relationships\`) describing the key interactions between these abstractions. For each relationship, specify:
    - \`from_abstraction\`: Index of the source abstraction (e.g., \`0 # AbstractionName1\`)
    - \`to_abstraction\`: Index of the target abstraction (e.g., \`1 # AbstractionName2\`)
    - \`label\`: A brief label for the interaction **in just a few words**${langHint} (e.g., "Manages", "Inherits", "Uses").
    Ideally the relationship should be backed by one abstraction calling or passing parameters to another.
    Simplify the relationship and exclude those non-important ones.

IMPORTANT: Make sure EVERY abstraction is involved in at least ONE relationship (either as source or target). Each abstraction index must appear at least once across all relationships.

Format the output as YAML:

\`\`\`yaml
summary: |
  A brief, simple explanation of the project${langHint}.
  Can span multiple lines with **bold** and *italic* for emphasis.
relationships:
  - from_abstraction: 0 # AbstractionName1
    to_abstraction: 1 # AbstractionName2
    label: "Manages"${langHint}
  - from_abstraction: 2 # AbstractionName3
    to_abstraction: 0 # AbstractionName1
    label: "Provides config"${langHint}
  # ... other relationships


Now, provide the YAML output:
\`\`\``;

    // Call the LLM with cache context and custom API key
    const response = await callLLM({ 
      prompt, 
      useCache,
      customApiKey,
      provider: llmProvider,
      model: llmModel,
      customBaseUrl: llmBaseUrl,
    });

    // Extract YAML block
    const yamlMatch = response.trim().match(/```yaml\s*([\s\S]*?)\s*```/);
    const yamlStr = yamlMatch?.[1]?.trim();

    if (!yamlStr) {
      console.error("LLM Response:", response);
      throw new Error(
        "LLM did not return a valid fenced YAML block for relationships."
      );
    }

    let parsedData: any;
    try {
      // Parse the YAML string
      parsedData = yaml.load(yamlStr);
    } catch (e: any) {
      console.error("YAML Parsing Error:", e);
      console.error("Invalid YAML String:", yamlStr);
      throw new Error(`Failed to parse YAML for relationships: ${e.message}`);
    }

    // Validate the overall structure
    if (
      !parsedData ||
      typeof parsedData !== "object" ||
      typeof parsedData.summary !== "string" ||
      !Array.isArray(parsedData.relationships)
    ) {
      console.error("Parsed YAML structure invalid:", parsedData);
      throw new Error(
        "Bad YAML structure from LLM for relationships (expected 'summary' string and 'relationships' list)."
      );
    }

    // Validate each relationship item
    const validatedRelationships: Relationship[] = parsedData.relationships.map(
      (rel: any, index: number) => {
        if (
          !rel ||
          typeof rel !== "object" ||
          typeof rel.from_abstraction === "undefined" || // Check presence, allow number 0
          typeof rel.to_abstraction === "undefined" || // Check presence, allow number 0
          typeof rel.label !== "string"
        ) {
          throw new Error(
            `Malformed relationship item at index ${index}: ${JSON.stringify(
              rel
            )}`
          );
        }

        // Parse and validate 'from' index
        const fromStr = String(rel.from_abstraction);
        const fromMatch = fromStr.match(/^\s*(\d+)/);
        const fromIdx = fromMatch ? parseInt(fromMatch[1], 10) : NaN;

        // Parse and validate 'to' index
        const toStr = String(rel.to_abstraction);
        const toMatch = toStr.match(/^\s*(\d+)/);
        const toIdx = toMatch ? parseInt(toMatch[1], 10) : NaN;

        if (
          isNaN(fromIdx) ||
          isNaN(toIdx) ||
          fromIdx < 0 ||
          toIdx < 0 ||
          fromIdx >= numAbstractions ||
          toIdx >= numAbstractions
        ) {
          throw new Error(
            `Invalid or out-of-bounds index in relationship at index ${index}: from="${
              rel.from_abstraction
            }" (parsed ${fromIdx}), to="${
              rel.to_abstraction
            }" (parsed ${toIdx}). Max index is ${numAbstractions - 1}.`
          );
        }

        return {
          from: fromIdx,
          to: toIdx,
          label: rel.label.trim(),
        };
      }
    );

    // Optional: Check if all abstractions are involved in at least one relationship
    const involvedIndices = new Set<number>();
    validatedRelationships.forEach((rel) => {
      involvedIndices.add(rel.from);
      involvedIndices.add(rel.to);
    });
    if (involvedIndices.size < numAbstractions) {
      const missing = [...Array(numAbstractions).keys()].filter(
        (i) => !involvedIndices.has(i)
      );
      console.warn(
        `Warning: Not all abstractions are involved in relationships. Missing indices: ${missing.join(
          ", "
        )}`
      );
      // Depending on strictness, you might throw an error here instead.
    }

    console.log("Generated project summary and relationship details.");
    return {
      summary: parsedData.summary.trim(),
      details: validatedRelationships,
    };
  }

  async post(
    shared: SharedData,
    _prepRes: any,
    execRes: RelationshipData
  ): Promise<string | undefined> {
    // Store the validated relationship data in shared state
    shared.relationships = execRes;
    return undefined;
  }
}

/* -------------------------------------------------------------------------
 * OrderChapters
 * ------------------------------------------------------------------------- */
export class OrderChapters extends Node<SharedData> {
  private _shared?: SharedData;
  
  async prep(shared: SharedData) {
    // Store shared reference for progress callback access
    this._shared = shared;
    
    const abstractions = shared.abstractions;
    const relationships = shared.relationships;
    const projectName = shared.project_name;
    const language = shared.language ?? "english";
    const useCache = shared.use_cache ?? true;
    const customApiKey = shared.llm_api_key || shared.openai_api_key;
    const llmProvider = shared.llm_provider || PROVIDER_IDS.OPENAI;
    const llmModel = shared.llm_model;
    const llmBaseUrl = shared.llm_base_url;

    if (!abstractions || abstractions.length === 0) {
      throw new Error(
        "No abstractions found in shared state for OrderChapters."
      );
    }
    if (!relationships) {
      throw new Error("No relationships data found in shared state.");
    }
    if (!projectName) {
      throw new Error("Project name not found in shared state.");
    }

    // Create a listing of abstractions for the prompt
    const abstractionListing = abstractions
      .map((abs, index) => `- ${index} # ${abs.name}`) // Use potentially translated name
      .join("\n");

    // Note if the summary might be translated
    const summaryNote =
      language.toLowerCase() === "english"
        ? ""
        : ` (Note: Project Summary might be in ${
            language.charAt(0).toUpperCase() + language.slice(1)
          })`;

    // Build context string including summary and relationship details
    let context = `Project Summary${summaryNote}:\n${relationships.summary}\n\n`;
    context += "Relationships (Indices refer to abstractions above):\n";
    relationships.details.forEach((rel) => {
      // Ensure indices are valid before accessing abstractions
      if (
        rel.from < 0 ||
        rel.from >= abstractions.length ||
        rel.to < 0 ||
        rel.to >= abstractions.length
      ) {
        console.error(
          `Invalid index in relationship: from=${rel.from}, to=${rel.to}`
        );
        // Skip this relationship or throw error depending on desired strictness
        return;
      }
      const fromName = abstractions[rel.from].name; // Potentially translated
      const toName = abstractions[rel.to].name; // Potentially translated
      context += `- From ${rel.from} (${fromName}) to ${rel.to} (${toName}): ${rel.label}\n`; // Label potentially translated
    });

    // Note if the abstraction names in the list might be translated
    const listLangNote =
      language.toLowerCase() === "english"
        ? ""
        : ` (Names might be in ${
            language.charAt(0).toUpperCase() + language.slice(1)
          })`;

    return {
      abstractionListing,
      context,
      numAbstractions: abstractions.length,
      projectName,
      listLangNote,
      useCache,
      customApiKey,
      llmProvider,
      llmModel,
      llmBaseUrl,
    } as const;
  }

  async exec(prepRes: ReturnType<this["prep"]>): Promise<number[]> {
    const {
      abstractionListing,
      context,
      numAbstractions,
      projectName,
      listLangNote,
      useCache,
      customApiKey,
      llmProvider,
      llmModel,
      llmBaseUrl,
    } = await prepRes;
    
    // Get progress callback from shared
    const onProgress = this._shared?._onProgress;
    
    if (onProgress) {
      await onProgress({
        stage: 'ordering',
        message: 'Determining optimal chapter order...',
        progress: 28
      });
    }
    
    console.log("Determining chapter order using LLM...");

    // Construct the prompt for the LLM
    const prompt = `
Given the following project abstractions and their relationships for the project \`\`\` ${projectName} \`\`\`:

Abstractions (Index # Name)${listLangNote}:
${abstractionListing}

Context about relationships and project summary:
${context}

If you are going to make a tutorial for \`\`\` ${projectName} \`\`\`, what is the best order to explain these abstractions, from first to last?
Ideally, first explain those that are the most important or foundational, perhaps user-facing concepts or entry points. Then move to more detailed, lower-level implementation details or supporting concepts.

Output the ordered list of abstraction indices, including the name in a comment for clarity. Use the format \`idx # AbstractionName\`.

\`\`\`yaml
- 2 # FoundationalConcept
- 0 # CoreClassA
- 1 # CoreClassB (uses CoreClassA)
- ...
\`\`\`

Now, provide the YAML output:`;


    // Call the LLM with cache context and custom API key
    const response = await callLLM({ 
      prompt, 
      useCache,
      customApiKey,
      provider: llmProvider,
      model: llmModel,
      customBaseUrl: llmBaseUrl,
    });

    // Extract YAML block
    const yamlMatch = response.trim().match(/```yaml\s*([\s\S]*?)\s*```/);
    const yamlStr = yamlMatch?.[1]?.trim();

    if (!yamlStr) {
      console.error("LLM Response:", response);
      throw new Error(
        "LLM did not return a valid fenced YAML block for chapter order."
      );
    }

    let parsedOrder: any;
    try {
      // Parse the YAML string
      parsedOrder = yaml.load(yamlStr);
    } catch (e: any) {
      console.error("YAML Parsing Error:", e);
      console.error("Invalid YAML String:", yamlStr);
      throw new Error(`Failed to parse YAML for chapter order: ${e.message}`);
    }

    // Validate the structure (should be a list)
    if (!Array.isArray(parsedOrder)) {
      console.error("Parsed YAML is not an array:", parsedOrder);
      throw new Error(
        "LLM output (parsed YAML) for chapter order is not a list."
      );
    }

    const orderedIndices: number[] = [];
    const seenIndices = new Set<number>();

    // Validate each entry in the ordered list
    parsedOrder.forEach((entry: any, listIndex: number) => {
      let idx: number;
      if (typeof entry === "number") {
        idx = entry;
      } else if (typeof entry === "string") {
        // Extract number before '#' or parse the whole string if no '#'
        const match = entry.match(/^\s*(\d+)/);
        if (match) {
          idx = parseInt(match[1], 10);
        } else {
          throw new Error(
            `Could not parse index from ordered list entry: "${entry}" at list index ${listIndex}`
          );
        }
      } else {
        idx = parseInt(String(entry), 10); // Attempt conversion
      }

      if (isNaN(idx) || idx < 0 || idx >= numAbstractions) {
        throw new Error(
          `Invalid or out-of-bounds index ${idx} (parsed from "${entry}") found in ordered list at index ${listIndex}. Max index is ${
            numAbstractions - 1
          }.`
        );
      }
      if (seenIndices.has(idx)) {
        throw new Error(`Duplicate index ${idx} found in ordered list.`);
      }
      orderedIndices.push(idx);
      seenIndices.add(idx);
    });

    // Check if all abstractions are included in the order
    if (orderedIndices.length !== numAbstractions) {
      const missing = [...Array(numAbstractions).keys()].filter(
        (i) => !seenIndices.has(i)
      );
      throw new Error(
        `Ordered list length (${
          orderedIndices.length
        }) does not match number of abstractions (${numAbstractions}). Missing indices: ${missing.join(
          ", "
        )}`
      );
    }

    console.log(
      `Determined chapter order (indices): ${orderedIndices.join(", ")}`
    );
    return orderedIndices;
  }

  async post(
    shared: SharedData,
    _prepRes: any,
    execRes: number[]
  ): Promise<string | undefined> {
    // Store the ordered list of indices in shared data
    shared.chapter_order = execRes;
    return undefined;
  }
}

/* -------------------------------------------------------------------------
 * WriteChapters (BatchNode)
 * Supports partial regeneration - uses cached chapters when available
 * Supports both .md and .mdx output formats
 * ------------------------------------------------------------------------- */
interface WriteChapterItem {
  chapterNum: number;
  abstractionIndex: number;
  abstractionDetails: Abstraction; // Has potentially translated name/desc
  relatedFilesContentMap: Record<string, string>;
  chapterSlug: string;  // Unique identifier for caching
  useCachedContent: boolean;  // Whether to use cached content instead of generating
  cachedContent?: string;  // Cached chapter content if available
  projectName: string;
  fullChapterListing: string; // Uses potentially translated names
  chapterFilenames: Record<number, ChapterFilenameInfo>; // index -> info (uses potentially translated names)
  prevChapter: ChapterFilenameInfo | null; // Uses potentially translated name
  nextChapter: ChapterFilenameInfo | null; // Uses potentially translated name
  language: string;
  useCache: boolean;
  customApiKey?: string;
  llmProvider?: string;
  llmModel?: string;
  llmBaseUrl?: string;
  [key: string]: unknown; // Add index signature to satisfy NonIterableObject constraint
}

export class WriteChapters extends BatchNode<SharedData, WriteChapterItem> {
  // Temporary storage for context across exec calls within a single run
  private chaptersWrittenSoFar: string[] = [];
  private totalChapters: number = 0;
  private onProgress?: (update: any) => Promise<void> | void;

  async prep(shared: SharedData): Promise<WriteChapterItem[]> {
    const chapterOrder = shared.chapter_order;
    const abstractions = shared.abstractions;
    const filesData = shared.files;
    const projectName = shared.project_name;
    const language = shared.language ?? "english";
    const useCache = shared.use_cache ?? true;
    const maxLinesPerFile = shared.max_lines_per_file ?? 150;
    const customApiKey = shared.llm_api_key || shared.openai_api_key;
    const llmProvider = shared.llm_provider || PROVIDER_IDS.OPENAI;
    const llmModel = shared.llm_model;
    const llmBaseUrl = shared.llm_base_url;
    
    // Progress callback from shared
    this.onProgress = shared._onProgress;
    
    // Partial regeneration support
    const regenerationMode = shared.regeneration_mode ?? 'full';
    const chaptersToRegenerate = shared.chapters_to_regenerate ?? [];
    const cachedChapters = shared.cached_chapters ?? {};
    const outputFormat = shared.output_format ?? 'md';

    if (!chapterOrder)
      throw new Error("Chapter order not found in shared state.");
    if (!abstractions)
      throw new Error("Abstractions not found in shared state.");
    if (!filesData) throw new Error("Files data not found in shared state.");
    if (!projectName)
      throw new Error("Project name not found in shared state.");

    // Reset temporary storage at the beginning of prep
    this.chaptersWrittenSoFar = [];

    const allChaptersList: string[] = [];
    const chapterFilenamesMap: Record<number, ChapterFilenameInfo> = {}; // Map index -> info
    const fileExt = getFileExtension();

    // First pass: Generate filenames and the full chapter list string
    chapterOrder.forEach((abstractionIndex, i) => {
      if (abstractionIndex < 0 || abstractionIndex >= abstractions.length) {
        console.warn(
          `Invalid abstraction index ${abstractionIndex} at order position ${i}. Skipping.`
        );
        return;
      }
      const chapterNum = i + 1;
      const chapterName = abstractions[abstractionIndex].name; // Potentially translated
      const filename = createSafeFilename(chapterName, chapterNum);

      const chapterInfo: ChapterFilenameInfo = {
        num: chapterNum,
        name: chapterName,
        filename,
      };
      chapterFilenamesMap[abstractionIndex] = chapterInfo;
      allChaptersList.push(`${chapterNum}. [${chapterName}](${filename})`); // Use potentially translated name
    });

    const fullChapterListing = allChaptersList.join("\n");
    
    // Log regeneration mode
    if (regenerationMode === 'partial') {
      const cachedCount = Object.keys(cachedChapters).length;
      const toRegenerateCount = chaptersToRegenerate.length;
      cacheLog.info(`Partial regeneration mode: ${cachedCount} cached, ${toRegenerateCount} to regenerate`);
    } else if (regenerationMode === 'skip') {
      cacheLog.info(`Skip mode: Using all cached chapters`);
    } else {
      cacheLog.info(`Full regeneration mode: Generating all chapters fresh`);
    }
    cacheLog.info(`Output format: md`);
    const itemsToProcess: WriteChapterItem[] = [];

    // Second pass: Prepare items for each chapter
    chapterOrder.forEach((abstractionIndex, i) => {
      // Check again in case it was skipped in the first pass
      if (!(abstractionIndex in chapterFilenamesMap)) {
        return; // Skip if invalid index encountered before
      }

      const abstractionDetails = abstractions[abstractionIndex];
      const relatedFileIndices = abstractionDetails.files ?? [];
      const relatedFilesContentMap = getContentForIndicesTruncated(
        filesData,
        relatedFileIndices,
        maxLinesPerFile
      );

      const prevChapterIndex = i > 0 ? chapterOrder[i - 1] : -1;
      const nextChapterIndex =
        i < chapterOrder.length - 1 ? chapterOrder[i + 1] : -1;

      const prevChapter =
        prevChapterIndex !== -1 ? chapterFilenamesMap[prevChapterIndex] : null;
      const nextChapter =
        nextChapterIndex !== -1 ? chapterFilenamesMap[nextChapterIndex] : null;
        
      // Generate chapter slug for cache lookup (strip extension)
      const chapterSlug = createSafeFilename(abstractionDetails.name, i + 1)
        .replace('.md', '');
      
      // Determine if we should use cached content
      let useCachedContent = false;
      let cachedContent: string | undefined;
      
      if (regenerationMode === 'skip') {
        // Skip mode: use cache for everything if available
        if (cachedChapters[chapterSlug]) {
          useCachedContent = true;
          cachedContent = cachedChapters[chapterSlug];
          cacheLog.skip(`Using cached chapter: ${chapterSlug}`);
        }
      } else if (regenerationMode === 'partial') {
        // Partial mode: use cache unless chapter is marked for regeneration
        if (!chaptersToRegenerate.includes(chapterSlug) && cachedChapters[chapterSlug]) {
          useCachedContent = true;
          cachedContent = cachedChapters[chapterSlug];
          cacheLog.skip(`Using cached chapter: ${chapterSlug}`);
        } else if (chaptersToRegenerate.includes(chapterSlug)) {
          cacheLog.info(`Regenerating chapter: ${chapterSlug}`);
        }
      }
      // In 'full' or 'partial_reidentify' mode, always regenerate

      itemsToProcess.push({
        chapterNum: i + 1,
        abstractionIndex: abstractionIndex,
        abstractionDetails: abstractionDetails,
        relatedFilesContentMap: relatedFilesContentMap,
        chapterSlug: chapterSlug,
        useCachedContent: useCachedContent,
        cachedContent: cachedContent,
        projectName: projectName,
        fullChapterListing: fullChapterListing,
        chapterFilenames: chapterFilenamesMap, // Pass the full map
        prevChapter: prevChapter,
        nextChapter: nextChapter,
        language: language,
        useCache: useCache,
        customApiKey: customApiKey,
        llmProvider: llmProvider,
        llmModel: llmModel,
        llmBaseUrl: llmBaseUrl,
      });
    });

    // Log stats
    const cachedCount = itemsToProcess.filter(item => item.useCachedContent).length;
    const toGenerateCount = itemsToProcess.length - cachedCount;
    console.log(`Preparing to write ${itemsToProcess.length} chapters (${cachedCount} from cache, ${toGenerateCount} to generate)...`);
    
    // Store total for progress tracking
    this.totalChapters = itemsToProcess.length;
    
    // Send initial chapters progress
    if (this.onProgress) {
      await this.onProgress({
        stage: 'writing_chapters',
        message: `Writing ${itemsToProcess.length} chapters...`,
        progress: 30,
        currentChapter: 0,
        totalChapters: itemsToProcess.length,
      });
    }
    
    return itemsToProcess; // Return the list of items for BatchNode processing
  }

  async exec(item: WriteChapterItem): Promise<string> {
    // This method runs for each item generated by prep
    const {
      chapterNum,
      abstractionDetails,
      relatedFilesContentMap,
      projectName,
      fullChapterListing,
      // chapterFilenames, // Not directly needed in prompt, but used in prep
      prevChapter,
      nextChapter,
      language,
      useCache,
      customApiKey,
      llmProvider,
      llmModel,
      llmBaseUrl,
      useCachedContent,
      cachedContent,
    } = item;

    const abstractionName = abstractionDetails.name; // Potentially translated
    const abstractionDescription = abstractionDetails.description; // Potentially translated

    // If using cached content, return it directly without calling LLM
    if (useCachedContent && cachedContent) {
      console.log(`Chapter ${chapterNum}: Using cached content for ${abstractionName}`);
      // Still add to chaptersWrittenSoFar for context
      this.chaptersWrittenSoFar.push(cachedContent);
      
      // Emit progress for cached chapter
      if (this.onProgress) {
        const progress = 30 + Math.round((chapterNum / this.totalChapters) * 60);
        await this.onProgress({
          stage: 'writing_chapters',
          message: `Chapter ${chapterNum}/${this.totalChapters}: ${abstractionName} (cached)`,
          progress,
          currentChapter: chapterNum,
          totalChapters: this.totalChapters,
          chapterName: abstractionName,
        });
      }
      
      return cachedContent;
    }

    console.log(
      `Writing chapter ${chapterNum} for: ${abstractionName} using LLM...`
    );
    
    // Emit progress for chapter being written
    if (this.onProgress) {
      const progress = 30 + Math.round(((chapterNum - 1) / this.totalChapters) * 60);
      await this.onProgress({
        stage: 'writing_chapters',
        message: `Writing chapter ${chapterNum}/${this.totalChapters}: ${abstractionName}...`,
        progress,
        currentChapter: chapterNum,
        totalChapters: this.totalChapters,
        chapterName: abstractionName,
      });
    }

    // Prepare file context string
    const fileContextStr =
      Object.entries(relatedFilesContentMap)
        .map(
          ([idxPath, content]) =>
            `--- File: ${idxPath.split("# ")[1] ?? idxPath} ---\n${content}`
        )
        .join("\n\n") ||
      "No specific code snippets provided for this abstraction.";

    // Get summary of chapters written *before* this one using the instance variable
    const previousChaptersSummary =
      this.chaptersWrittenSoFar.join("\n---\n") || "This is the first chapter.";

    // --- Language Specific Prompts ---
    let languageInstruction = "";
    let conceptDetailsNote = "";
    let structureNote = "";
    let prevSummaryNote = "";
    let instructionLangNote = "";
    let mermaidLangNote = "";
    let codeCommentNote = "";
    let linkLangNote = "";
    let toneNote = "";

    if (language.toLowerCase() !== "english") {
      const langCap = language.charAt(0).toUpperCase() + language.slice(1);
      languageInstruction = `IMPORTANT: Write this ENTIRE tutorial chapter in **${langCap}**. Some input context (like concept name, description, chapter list, previous summary) might already be in ${langCap}, but you MUST translate ALL other generated content including explanations, examples, technical terms, and potentially code comments into ${langCap}. DO NOT use English anywhere except in code syntax, required proper nouns, or when specified. The entire output MUST be in ${langCap}.\n\n`;
      conceptDetailsNote = ` (Note: Provided in ${langCap})`;
      structureNote = ` (Note: Chapter names might be in ${langCap})`;
      prevSummaryNote = ` (Note: This summary might be in ${langCap})`;
      instructionLangNote = ` (in ${langCap})`;
      mermaidLangNote = ` (Use ${langCap} for labels/text if appropriate)`;
      codeCommentNote = ` (Translate to ${langCap} if possible, otherwise keep minimal English for clarity)`;
      linkLangNote = ` (Use the ${langCap} chapter title from the structure above)`;
      toneNote = ` (appropriate for ${langCap} readers)`;
    }
    // --- End Language Specific Prompts ---

    // Always generate Markdown
    const prompt = `
${languageInstruction}Write a very beginner-friendly tutorial chapter (in Markdown format) for the project \`${projectName}\` about the concept: "${abstractionName}". This is Chapter ${chapterNum}.

Concept Details${conceptDetailsNote}:
- Name: ${abstractionName}
- Description:
${abstractionDescription}

Complete Tutorial Structure${structureNote}:
${fullChapterListing}

Context from previous chapters${prevSummaryNote}:
${previousChaptersSummary}

Relevant Code Snippets (Code itself remains unchanged):
${fileContextStr}

Instructions for the chapter (Generate content in ${
        language.toLowerCase() === "english" ? "English" : language.capitalize()
      } unless specified otherwise):
- Start with a clear heading (e.g., \`# Chapter ${chapterNum}: ${abstractionName}\`). Use the provided concept name.
${
  prevChapter
    ? `- If this is not the first chapter, begin with a brief transition from the previous chapter${instructionLangNote}, referencing it with a proper Markdown link like: [${prevChapter.name}](${prevChapter.filename})${linkLangNote}.\n`
    : ""
}
- Begin with a high-level motivation explaining what problem this abstraction solves${instructionLangNote}. Start with a central use case as a concrete example. The whole chapter should guide the reader to understand how to solve this use case. Make it very minimal and friendly to beginners.
- If the abstraction is complex, break it down into key concepts. Explain each concept one-by-one in a very beginner-friendly way${instructionLangNote}.
- Explain how to use this abstraction to solve the use case${instructionLangNote}. Give example inputs and outputs for code snippets (if the output isn't values, describe at a high level what will happen${instructionLangNote}).
- Each code block should be BELOW 10 lines! If longer code blocks are needed, break them down into smaller pieces and walk through them one-by-one. Aggresively simplify the code to make it minimal. Use comments${codeCommentNote} to skip non-important implementation details. Each code block should have a beginner friendly explanation right after it${instructionLangNote}.
- Describe the internal implementation to help understand what's under the hood${instructionLangNote}. First provide a non-code or code-light walkthrough on what happens step-by-step when the abstraction is called${instructionLangNote}. It's recommended to use a simple sequenceDiagram with a dummy example - keep it minimal with at most 5 participants to ensure clarity. If participant name has space, use: \`participant QP as Query Processing\`. ${mermaidLangNote}.
- Then dive deeper into code for the internal implementation with references to files. Provide example code blocks, but make them similarly simple and beginner-friendly. Explain${instructionLangNote}.
- IMPORTANT: When you need to refer to other core abstractions covered in other chapters, ALWAYS use proper Markdown links like this: [Chapter Title](filename.md). Use the Complete Tutorial Structure above to find the correct filename and the chapter title${linkLangNote}. Translate the surrounding text.
- Use mermaid diagrams to illustrate complex concepts (\`\`\`mermaid\`\`\` format). ${mermaidLangNote}.
- Heavily use analogies and examples throughout${instructionLangNote} to help beginners understand.
${
  nextChapter
    ? `- End the chapter with a brief conclusion that summarizes what was learned${instructionLangNote} and provides a transition to the next chapter${instructionLangNote}. Use a proper Markdown link: [${nextChapter.name}](${nextChapter.filename})${linkLangNote}.\n`
    : `- End the chapter with a brief conclusion that summarizes what was learned${instructionLangNote}.\n`
}
- Ensure the tone is welcoming and easy for a newcomer to understand${toneNote}.
- Output *only* the Markdown content for this chapter.

Now, directly provide a super beginner-friendly Markdown output (DON'T need \`\`\`markdown\`\`\` tags):`;

    // Call the LLM with custom API key
    let chapterContent = await callLLM({
      prompt,
      useCache,
      customApiKey,
      provider: llmProvider,
      model: llmModel,
      customBaseUrl: llmBaseUrl,
    });

    // --- Basic Validation/Cleanup ---
    // Ensure the heading is present and correct
    const expectedHeading = `# Chapter ${chapterNum}: ${abstractionName}`; // Use potentially translated name
    chapterContent = chapterContent.trim(); // Trim whitespace

    // Check if it starts with the correct heading (allowing for minor variations like ##)
    if (
      !chapterContent.match(
        new RegExp(
          `^#+\\s*Chapter\\s+${chapterNum}:\\s*${abstractionName.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          )}`,
          "i"
        )
      )
    ) {
      console.warn(
        `Chapter ${chapterNum} content missing or incorrect heading. Prepending expected heading.`
      );
      // Prepend the correct heading if missing or wrong
      chapterContent = `${expectedHeading}\n\n${chapterContent}`;
    }
    // --- End Validation ---

    // Add the generated content to the instance variable for the next iteration's context
    this.chaptersWrittenSoFar.push(chapterContent);
    
    // Emit progress after chapter completion
    if (this.onProgress) {
      const progress = 30 + Math.round((chapterNum / this.totalChapters) * 60);
      await this.onProgress({
        stage: 'writing_chapters',
        message: `Completed chapter ${chapterNum}/${this.totalChapters}: ${abstractionName}`,
        progress,
        currentChapter: chapterNum,
        totalChapters: this.totalChapters,
        chapterName: abstractionName,
      });
    }

    return chapterContent; // Return the generated Markdown string
  }

  async post(
    shared: SharedData,
    _prepRes: unknown,
    execRes: unknown
  ): Promise<string | undefined> {
    // execRes contains the Markdown content for each chapter, in order
    const execResList = execRes as string[];
    shared.chapters = execResList;
    // Clean up the temporary instance variable after the batch run is complete
    this.chaptersWrittenSoFar = [];
    console.log(`Finished writing ${execResList.length} chapters.`);
    return undefined;
  }
}

/* -------------------------------------------------------------------------
 * CombineTutorial
 * ------------------------------------------------------------------------- */
export class CombineTutorial extends Node<SharedData> {
  private _shared?: SharedData;
  
  async prep(shared: SharedData) {
    // Store shared reference for progress callback access
    this._shared = shared;
    
    // Send progress update
    const onProgress = shared._onProgress;
    if (onProgress) {
      await onProgress({
        stage: 'combining',
        message: 'Combining chapters into final tutorial...',
        progress: 92
      });
    }
    
    const projectName = shared.project_name;
    const outputBaseDir = shared.output_dir ?? "output"; // Default to 'output'
    const repoUrl = shared.repo_url; // Optional, for linking in index.md
    const relationshipsData = shared.relationships;
    const chapterOrder = shared.chapter_order;
    const abstractions = shared.abstractions;
    const chaptersContent = shared.chapters; // List of Markdown strings
    const documentationMode = shared.documentation_mode ?? 'tutorial';
    const fileExt = '.md';

    if (!projectName)
      throw new Error("Project name not found in shared state.");
    if (!relationshipsData)
      throw new Error("Relationships data not found in shared state.");
    if (!chapterOrder)
      throw new Error("Chapter order not found in shared state.");
    if (!abstractions)
      throw new Error("Abstractions not found in shared state.");
    if (!chaptersContent)
      throw new Error("Chapters content not found in shared state.");
    if (chapterOrder.length !== chaptersContent.length) {
      console.warn(
        `Mismatch: ${chapterOrder.length} chapters in order, but ${chaptersContent.length} content strings found.`
      );
      // Decide how to handle: error or proceed with minimum length? For now, proceed cautiously.
    }

    const outputPath = path.join(outputBaseDir, projectName);
    const isArchitectureMode = documentationMode === 'architecture';

    // --- Generate Mermaid Diagram ---
    let mermaidDiagram: string;
    
    if (isArchitectureMode) {
      // Architecture mode: Generate a more comprehensive system diagram
      const mermaidLines: string[] = ["flowchart TB"];
      const nodeMap: Record<number, string> = {};
      
      // Add subgraph groupings based on file paths
      const subsystems = new Map<string, number[]>();
      abstractions.forEach((abs, index) => {
        // Group by common path prefix
        const files = abs.files || [];
        let category = 'Core';
        if (files.length > 0) {
          const firstFile = shared.files?.[files[0]]?.[0] || '';
          if (firstFile.includes('/app/')) category = 'UI Layer';
          else if (firstFile.includes('/api/')) category = 'API Layer';
          else if (firstFile.includes('/lib/')) category = 'Core Logic';
          else if (firstFile.includes('/components/')) category = 'Components';
        }
        if (!subsystems.has(category)) subsystems.set(category, []);
        subsystems.get(category)!.push(index);
      });
      
      // Add nodes with styling
      abstractions.forEach((abs, index) => {
        const nodeId = `A${index}`;
        nodeMap[index] = nodeId;
        const sanitizedName = abs.name.replace(/"/g, "").replace(/\n/g, " ");
        mermaidLines.push(`    ${nodeId}["🔹 ${sanitizedName}"]`);
      });
      
      // Add edges with relationship types
      relationshipsData.details.forEach((rel) => {
        const fromNodeId = nodeMap[rel.from];
        const toNodeId = nodeMap[rel.to];
        if (!fromNodeId || !toNodeId) return;
        
        let edgeLabel = rel.label.replace(/"/g, "").replace(/\n/g, " ");
        const maxLabelLen = 25;
        if (edgeLabel.length > maxLabelLen) {
          edgeLabel = edgeLabel.substring(0, maxLabelLen - 3) + "...";
        }
        
        // Use different arrow styles based on relationship type
        const edgeStyle = edgeLabel.toLowerCase().includes('uses') ? '-->' 
          : edgeLabel.toLowerCase().includes('extends') ? '-.->|extends|'
          : edgeLabel.toLowerCase().includes('implements') ? '-.->|impl|'
          : `-->|${edgeLabel}|`;
          
        if (edgeStyle.includes('|')) {
          mermaidLines.push(`    ${fromNodeId} ${edgeStyle} ${toNodeId}`);
        } else {
          mermaidLines.push(`    ${fromNodeId} -- "${edgeLabel}" --> ${toNodeId}`);
        }
      });
      
      // Add styling
      mermaidLines.push('');
      mermaidLines.push('    %% Styling');
      mermaidLines.push('    classDef default fill:#f9f9f9,stroke:#333,stroke-width:1px');
      
      mermaidDiagram = mermaidLines.join("\n");
    } else {
      // Tutorial mode: Simple flowchart
      const mermaidLines: string[] = ["flowchart TD"];
      const nodeMap: Record<number, string> = {};

      // Add nodes
      abstractions.forEach((abs, index) => {
        const nodeId = `A${index}`;
        nodeMap[index] = nodeId;
        const sanitizedName = abs.name.replace(/"/g, "");
        mermaidLines.push(`    ${nodeId}["${sanitizedName}"]`);
      });

      // Add edges
      relationshipsData.details.forEach((rel) => {
        const fromNodeId = nodeMap[rel.from];
        const toNodeId = nodeMap[rel.to];
        if (!fromNodeId || !toNodeId) {
          console.warn(
            `Skipping Mermaid edge due to missing node for relationship: ${rel.from} -> ${rel.to}`
          );
          return;
        }
        let edgeLabel = rel.label.replace(/"/g, "").replace(/\n/g, " ");
        const maxLabelLen = 30;
        if (edgeLabel.length > maxLabelLen) {
          edgeLabel = edgeLabel.substring(0, maxLabelLen - 3) + "...";
        }
        mermaidLines.push(`    ${fromNodeId} -- "${edgeLabel}" --> ${toNodeId}`);
      });

      mermaidDiagram = mermaidLines.join("\n");
    }
    // --- End Mermaid ---

    // --- Prepare index content ---
    const indexFilename = `index${fileExt}`;
    let indexContent = '';
    
    if (isArchitectureMode) {
      // Architecture mode: Create a high-level overview document
      indexContent = `# ${projectName} - Architecture Overview\n\n`;
      indexContent += `> High-level documentation of the project's architecture and design.\n\n`;
      
      // Add source repo link
      if (repoUrl) {
        indexContent += `**📦 Repository:** [${repoUrl}](${repoUrl})\n\n`;
      }
      
      indexContent += `## 🎯 Project Purpose\n\n`;
      indexContent += `${relationshipsData.summary}\n\n`;
      
      indexContent += `## 🏗️ System Architecture\n\n`;
      indexContent += `The following diagram shows the major subsystems and their relationships:\n\n`;
      indexContent += "```mermaid\n";
      indexContent += mermaidDiagram + "\n";
      indexContent += "```\n\n";
      
      indexContent += `## 📚 Subsystem Details\n\n`;
      indexContent += `Click on each subsystem below for detailed documentation:\n\n`;
    } else {
      // Tutorial mode: Standard tutorial index
      indexContent = `# Tutorial: ${projectName}\n\n`;
      indexContent += `${relationshipsData.summary}\n\n`;

      if (repoUrl) {
        indexContent += `**Source Repository:** [${repoUrl}](${repoUrl})\n\n`;
      }

      indexContent += "```mermaid\n";
      indexContent += mermaidDiagram + "\n";
      indexContent += "```\n\n";
      indexContent += `## Chapters\n\n`;
    }

    const chapterFilesData: { filename: string; title: string; content: string }[] = [];
    const numChaptersToProcess = Math.min(
      chapterOrder.length,
      chaptersContent.length
    );

    // Generate chapter links and prepare chapter file data
    for (let i = 0; i < numChaptersToProcess; i++) {
      const abstractionIndex = chapterOrder[i];
      if (abstractionIndex < 0 || abstractionIndex >= abstractions.length) {
        console.warn(
          `Invalid abstraction index ${abstractionIndex} at order position ${i} during CombineTutorial. Skipping.`
        );
        continue;
      }

      const abstractionName = abstractions[abstractionIndex].name;
      const chapterNum = i + 1;
      const filename = createSafeFilename(abstractionName, chapterNum);

      // Add link to index (uses potentially translated name)
      indexContent += `${chapterNum}. [${abstractionName}](${filename})\n`;

      // Prepare chapter content with attribution (fixed English string)
      let chapterContent = chaptersContent[i]; // Potentially translated content
      if (!chapterContent.endsWith("\n\n")) {
        chapterContent += "\n\n";
      }
      // Add fixed English attribution
      chapterContent += `\n\n---\n\nGenerated by [Code Detail's AI Project Tutorial Builder](https://codedetails.io) - Code Details\n\n---\n\n`;

      chapterFilesData.push({ 
        filename: filename, 
        title: `Chapter ${chapterNum}: ${abstractionName}`,
        content: chapterContent 
      });
    }

    // Add attribution to index (fixed English string)
    indexContent += `\n\n---\n\nGenerated by [Code Detail's AI Project Tutorial Builder](https://codedetails.io) - Code Details\n\n---\n\n`;

    return {
      outputPath,
      indexContent,
      indexFilename,
      chapterFiles: chapterFilesData, // List of {filename, title, content}
    } as const;
  }

  async exec(prepRes: ReturnType<this["prep"]>): Promise<{ outputPath: string; chapters: { filename: string; title: string; content: string }[]; indexContent: string }> {
    const { outputPath, indexContent, indexFilename, chapterFiles } = await prepRes;

    console.log(`Combining tutorial into directory: ${outputPath}`);

    try {
      // Create the output directory recursively, ignoring errors if it already exists
      await fs.mkdir(outputPath, { recursive: true });

      // Write index file with correct extension
      const indexFilepath = path.join(outputPath, indexFilename);
      await fs.writeFile(indexFilepath, indexContent, { encoding: "utf-8" });
      console.log(`  - Wrote ${indexFilepath}`);

      // Write chapter files concurrently
      await Promise.all(
        chapterFiles.map(async (chapterInfo) => {
          const chapterFilepath = path.join(outputPath, chapterInfo.filename);
          try {
            await fs.writeFile(chapterFilepath, chapterInfo.content, {
              encoding: "utf-8",
            });
            console.log(`  - Wrote ${chapterFilepath}`);
          } catch (writeError: any) {
            console.error(
              `Failed to write chapter file ${chapterFilepath}: ${writeError.message}`
            );
            // Decide if one failed write should stop the whole process or just log
          }
        })
      );
    } catch (error: any) {
      console.error(
        `Error during file writing process in CombineTutorial: ${error.message}`
      );
      // Re-throw the error to indicate failure of this node
      throw error;
    }

    // Return data for the viewer
    return {
      outputPath,
      chapters: chapterFiles,
      indexContent,
    };
  }

  async post(
    shared: SharedData,
    prepRes: unknown,
    execRes: unknown
  ): Promise<string | undefined> {
    const result = execRes as { outputPath: string; chapters: { filename: string; title: string; content: string }[]; indexContent: string };
    
    // Store the final output directory path in shared data
    shared.final_output_dir = result.outputPath;
    
    // Store generated content for the viewer
    shared.generated_chapters = result.chapters;
    shared.generated_index = result.indexContent;
    
    console.log(`\nTutorial generation complete! Files are in: ${result.outputPath}`);
    return undefined;
  }
}

// Helper capitalize function for language hints
declare global {
  interface String {
    capitalize(): string;
  }
}

String.prototype.capitalize = function (): string {
  return this.charAt(0).toUpperCase() + this.slice(1);
};
