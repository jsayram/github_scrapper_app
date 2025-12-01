/**
 * Repository-level Cache System
 * Manages per-repo cache files with commit tracking and change detection
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { cacheLog } from './cacheLogger';

// Cache directory path
const CACHE_DIR = path.join(process.cwd(), 'cache');
const REPO_INDEX_FILE = path.join(CACHE_DIR, 'repo_index.json');

export interface CachedFile {
  path: string;
  contentHash: string;
  lastModified: string;
}

export interface CachedAbstraction {
  name: string;
  description: string;
  files: string[];
}

export interface CachedChapter {
  title: string;
  slug: string;
  content: string;
  abstractionsCovered: string[];
  dependencies: string[];  // Chapter slugs this chapter depends on
  generatedAt: string;
  promptHash: string;
}

export interface RepoCache {
  repoUrl: string;
  repoId: string;  // Normalized repo identifier
  lastCommit?: string;
  lastCrawlTime: string;
  files: CachedFile[];
  abstractions?: CachedAbstraction[];
  relationships?: Record<string, string[]>;
  chapterOrder?: string[];
  chapters: Record<string, CachedChapter>;  // slug -> chapter
  metadata: {
    totalTokensUsed?: number;
    totalCost?: number;
    llmProvider?: string;
    llmModel?: string;
  };
}

export interface RepoIndex {
  repos: Record<string, {
    cacheFile: string;
    lastAccessed: string;
    repoUrl: string;
  }>;
  version: string;
}

/**
 * Normalize a repo URL to a consistent identifier
 */
export function normalizeRepoUrl(url: string): string {
  // Remove protocol, trailing slashes, .git suffix
  let normalized = url
    .replace(/^https?:\/\//, '')
    .replace(/^github\.com\//, '')
    .replace(/\.git$/, '')
    .replace(/\/$/, '')
    .toLowerCase();
  
  return normalized;
}

/**
 * Generate a safe filename from repo URL
 */
export function repoUrlToFilename(url: string): string {
  const normalized = normalizeRepoUrl(url);
  // Replace slashes with underscores, remove special chars
  const safe = normalized
    .replace(/\//g, '_')
    .replace(/[^a-z0-9_-]/g, '');
  return `${safe}.json`;
}

/**
 * Compute hash of file content for change detection
 */
export function computeContentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * Ensure cache directory exists
 */
export function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    cacheLog.info('Created cache directory', { path: CACHE_DIR });
  }
}

/**
 * Load the repo index
 */
export function loadRepoIndex(): RepoIndex {
  ensureCacheDir();
  
  if (fs.existsSync(REPO_INDEX_FILE)) {
    try {
      const content = fs.readFileSync(REPO_INDEX_FILE, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      cacheLog.warn('Failed to load repo index, creating new one', { error });
    }
  }
  
  return { repos: {}, version: '1.0' };
}

/**
 * Save the repo index
 */
export function saveRepoIndex(index: RepoIndex): void {
  ensureCacheDir();
  fs.writeFileSync(REPO_INDEX_FILE, JSON.stringify(index, null, 2));
}

/**
 * Load cache for a specific repository
 */
export function loadRepoCache(repoUrl: string): RepoCache | null {
  const repoId = normalizeRepoUrl(repoUrl);
  const index = loadRepoIndex();
  
  const entry = index.repos[repoId];
  if (!entry) {
    cacheLog.info('No cache entry found for repo', { repoId });
    return null;
  }
  
  const cacheFilePath = path.join(CACHE_DIR, entry.cacheFile);
  if (!fs.existsSync(cacheFilePath)) {
    cacheLog.warn('Cache file missing for repo', { repoId, cacheFile: entry.cacheFile });
    return null;
  }
  
  try {
    const content = fs.readFileSync(cacheFilePath, 'utf-8');
    const cache = JSON.parse(content) as RepoCache;
    
    // Update last accessed time
    index.repos[repoId].lastAccessed = new Date().toISOString();
    saveRepoIndex(index);
    
    cacheLog.hit('Loaded repo cache', { 
      repoId, 
      files: cache.files.length,
      chapters: Object.keys(cache.chapters).length 
    });
    
    return cache;
  } catch (error) {
    cacheLog.error('Failed to load repo cache', { repoId, error });
    return null;
  }
}

/**
 * Save cache for a specific repository
 */
export function saveRepoCache(cache: RepoCache): void {
  ensureCacheDir();
  
  const repoId = normalizeRepoUrl(cache.repoUrl);
  const cacheFileName = repoUrlToFilename(cache.repoUrl);
  const cacheFilePath = path.join(CACHE_DIR, cacheFileName);
  
  // Update repo index
  const index = loadRepoIndex();
  index.repos[repoId] = {
    cacheFile: cacheFileName,
    lastAccessed: new Date().toISOString(),
    repoUrl: cache.repoUrl
  };
  saveRepoIndex(index);
  
  // Save cache file
  cache.repoId = repoId;
  fs.writeFileSync(cacheFilePath, JSON.stringify(cache, null, 2));
  
  cacheLog.info('Saved repo cache', { 
    repoId, 
    files: cache.files.length,
    chapters: Object.keys(cache.chapters).length 
  });
}

/**
 * Create a new empty cache for a repository
 */
export function createRepoCache(repoUrl: string): RepoCache {
  return {
    repoUrl,
    repoId: normalizeRepoUrl(repoUrl),
    lastCrawlTime: new Date().toISOString(),
    files: [],
    chapters: {},
    metadata: {}
  };
}

export interface FileChangeAnalysis {
  addedFiles: string[];
  removedFiles: string[];
  modifiedFiles: string[];
  unchangedFiles: string[];
  changePercentage: number;
  totalFiles: number;
}

/**
 * Analyze changes between cached files and new files
 */
export function analyzeFileChanges(
  cachedFiles: CachedFile[],
  newFiles: Array<{ path: string; content: string }>
): FileChangeAnalysis {
  const cachedMap = new Map(cachedFiles.map(f => [f.path, f.contentHash]));
  const newMap = new Map(newFiles.map(f => [f.path, computeContentHash(f.content)]));
  
  const addedFiles: string[] = [];
  const removedFiles: string[] = [];
  const modifiedFiles: string[] = [];
  const unchangedFiles: string[] = [];
  
  // Check for added and modified files
  for (const [path, newHash] of newMap) {
    const cachedHash = cachedMap.get(path);
    if (!cachedHash) {
      addedFiles.push(path);
    } else if (cachedHash !== newHash) {
      modifiedFiles.push(path);
    } else {
      unchangedFiles.push(path);
    }
  }
  
  // Check for removed files
  for (const path of cachedMap.keys()) {
    if (!newMap.has(path)) {
      removedFiles.push(path);
    }
  }
  
  const totalFiles = newMap.size;
  const changedCount = addedFiles.length + removedFiles.length + modifiedFiles.length;
  const changePercentage = totalFiles > 0 ? (changedCount / totalFiles) * 100 : 0;
  
  cacheLog.info('File change analysis', {
    added: addedFiles.length,
    removed: removedFiles.length,
    modified: modifiedFiles.length,
    unchanged: unchangedFiles.length,
    changePercentage: changePercentage.toFixed(1) + '%'
  });
  
  return {
    addedFiles,
    removedFiles,
    modifiedFiles,
    unchangedFiles,
    changePercentage,
    totalFiles
  };
}

export type RegenerationMode = 'full' | 'partial' | 'partial_reidentify' | 'skip';

export interface RegenerationPlan {
  mode: RegenerationMode;
  reason: string;
  chaptersToRegenerate: string[];  // Chapter slugs
  rerunAbstractionIdentification: boolean;
  estimatedSavings: number;  // Percentage of work saved
}

/**
 * Determine regeneration strategy based on file changes
 */
export function determineRegenerationPlan(
  cache: RepoCache,
  changeAnalysis: FileChangeAnalysis
): RegenerationPlan {
  const { changePercentage, addedFiles, modifiedFiles, removedFiles } = changeAnalysis;
  
  // No changes - skip regeneration
  if (changePercentage === 0) {
    cacheLog.info('No changes detected, skipping regeneration');
    return {
      mode: 'skip',
      reason: 'No file changes detected since last generation',
      chaptersToRegenerate: [],
      rerunAbstractionIdentification: false,
      estimatedSavings: 100
    };
  }
  
  // Minor changes (<30%) - partial regeneration
  if (changePercentage < 30) {
    const affectedChapters = findAffectedChapters(
      cache,
      [...addedFiles, ...modifiedFiles, ...removedFiles]
    );
    
    cacheLog.info('Minor changes, partial regeneration', { 
      changePercentage: changePercentage.toFixed(1) + '%',
      affectedChapters 
    });
    
    return {
      mode: 'partial',
      reason: `${changePercentage.toFixed(1)}% of files changed - regenerating affected chapters only`,
      chaptersToRegenerate: affectedChapters,
      rerunAbstractionIdentification: false,
      estimatedSavings: Math.round(100 - (affectedChapters.length / Math.max(Object.keys(cache.chapters).length, 1)) * 100)
    };
  }
  
  // Moderate changes (30-60%) - partial with re-identification
  if (changePercentage < 60) {
    cacheLog.info('Moderate changes, partial with re-identification', {
      changePercentage: changePercentage.toFixed(1) + '%'
    });
    
    return {
      mode: 'partial_reidentify',
      reason: `${changePercentage.toFixed(1)}% of files changed - re-identifying abstractions and regenerating affected chapters`,
      chaptersToRegenerate: [], // Will be determined after re-identification
      rerunAbstractionIdentification: true,
      estimatedSavings: 30 // Some savings from cached file content
    };
  }
  
  // Major changes (>60%) - suggest full regeneration
  cacheLog.info('Major changes, recommending full regeneration', {
    changePercentage: changePercentage.toFixed(1) + '%'
  });
  
  return {
    mode: 'full',
    reason: `${changePercentage.toFixed(1)}% of files changed - full regeneration recommended`,
    chaptersToRegenerate: Object.keys(cache.chapters),
    rerunAbstractionIdentification: true,
    estimatedSavings: 0
  };
}

/**
 * Find chapters affected by file changes
 */
export function findAffectedChapters(
  cache: RepoCache,
  changedFiles: string[]
): string[] {
  if (!cache.abstractions || Object.keys(cache.chapters).length === 0) {
    return [];
  }
  
  const changedSet = new Set(changedFiles);
  const affectedAbstractions = new Set<string>();
  
  // Find abstractions that include changed files
  for (const abstraction of cache.abstractions) {
    for (const file of abstraction.files) {
      if (changedSet.has(file)) {
        affectedAbstractions.add(abstraction.name);
        break;
      }
    }
  }
  
  // Find chapters that cover affected abstractions
  const affectedChapters = new Set<string>();
  
  for (const [slug, chapter] of Object.entries(cache.chapters)) {
    for (const abstractionName of chapter.abstractionsCovered) {
      if (affectedAbstractions.has(abstractionName)) {
        affectedChapters.add(slug);
        break;
      }
    }
  }
  
  // Also include dependent chapters (chapters that depend on affected chapters)
  const addDependentChapters = (chapterSlug: string) => {
    for (const [slug, chapter] of Object.entries(cache.chapters)) {
      if (chapter.dependencies.includes(chapterSlug) && !affectedChapters.has(slug)) {
        affectedChapters.add(slug);
        addDependentChapters(slug); // Recursive for chain dependencies
      }
    }
  };
  
  for (const slug of [...affectedChapters]) {
    addDependentChapters(slug);
  }
  
  return [...affectedChapters];
}

/**
 * Update files in cache
 */
export function updateCacheFiles(
  cache: RepoCache,
  newFiles: Array<{ path: string; content: string }>
): void {
  cache.files = newFiles.map(f => ({
    path: f.path,
    contentHash: computeContentHash(f.content),
    lastModified: new Date().toISOString()
  }));
  cache.lastCrawlTime = new Date().toISOString();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  totalRepos: number;
  totalSize: number;
  repos: Array<{
    repoId: string;
    repoUrl: string;
    lastAccessed: string;
    chaptersCount: number;
  }>;
} {
  const index = loadRepoIndex();
  const repos: Array<{
    repoId: string;
    repoUrl: string;
    lastAccessed: string;
    chaptersCount: number;
  }> = [];
  
  let totalSize = 0;
  
  for (const [repoId, entry] of Object.entries(index.repos)) {
    const cacheFilePath = path.join(CACHE_DIR, entry.cacheFile);
    let chaptersCount = 0;
    
    if (fs.existsSync(cacheFilePath)) {
      const stats = fs.statSync(cacheFilePath);
      totalSize += stats.size;
      
      try {
        const cache = JSON.parse(fs.readFileSync(cacheFilePath, 'utf-8')) as RepoCache;
        chaptersCount = Object.keys(cache.chapters).length;
      } catch {
        // Ignore parse errors
      }
    }
    
    repos.push({
      repoId,
      repoUrl: entry.repoUrl,
      lastAccessed: entry.lastAccessed,
      chaptersCount
    });
  }
  
  return {
    totalRepos: repos.length,
    totalSize,
    repos
  };
}

/**
 * Clear cache for a specific repository
 */
export function clearRepoCache(repoUrl: string): boolean {
  const repoId = normalizeRepoUrl(repoUrl);
  const index = loadRepoIndex();
  
  const entry = index.repos[repoId];
  if (!entry) {
    return false;
  }
  
  // Delete cache file
  const cacheFilePath = path.join(CACHE_DIR, entry.cacheFile);
  if (fs.existsSync(cacheFilePath)) {
    fs.unlinkSync(cacheFilePath);
  }
  
  // Remove from index
  delete index.repos[repoId];
  saveRepoIndex(index);
  
  cacheLog.info('Cleared repo cache', { repoId });
  return true;
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  if (fs.existsSync(CACHE_DIR)) {
    const files = fs.readdirSync(CACHE_DIR);
    for (const file of files) {
      fs.unlinkSync(path.join(CACHE_DIR, file));
    }
  }
  cacheLog.info('Cleared all caches');
}
