/**
 * Cache Cleanup System
 * Automatically cleans up old cache entries based on age, size, and usage
 */

import * as fs from 'fs';
import * as path from 'path';
import { cacheLog, createScopedLogger } from './cacheLogger';
import {
  loadRepoIndex,
  saveRepoIndex,
  type RepoIndex,
  type RepoCache,
} from './repoCache';

const log = createScopedLogger('CacheCleanup');

// Cache directory path
const CACHE_DIR = path.join(process.cwd(), 'cache');

export interface CleanupConfig {
  // Maximum age for cache entries in days
  maxAgeDays: number;
  // Maximum total cache size in MB
  maxSizeMB: number;
  // Maximum number of repositories to keep
  maxRepos: number;
  // Minimum number of repos to keep regardless of age
  minReposToKeep: number;
  // Dry run mode - don't actually delete anything
  dryRun: boolean;
}

export interface CleanupResult {
  deletedRepos: string[];
  deletedFiles: string[];
  freedSpaceMB: number;
  remainingRepos: number;
  remainingSizeMB: number;
  errors: string[];
}

export interface CacheStats {
  totalRepos: number;
  totalSizeMB: number;
  oldestEntry: string | null;
  newestEntry: string | null;
  repos: Array<{
    repoId: string;
    repoUrl: string;
    sizeMB: number;
    lastAccessed: string;
    ageInDays: number;
    chapterCount: number;
  }>;
}

const DEFAULT_CONFIG: CleanupConfig = {
  maxAgeDays: 30,
  maxSizeMB: 500,
  maxRepos: 50,
  minReposToKeep: 5,
  dryRun: false,
};

/**
 * Get the size of a file in bytes
 */
function getFileSize(filePath: string): number {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

/**
 * Calculate total size of cache directory
 */
export function getCacheSize(): number {
  if (!fs.existsSync(CACHE_DIR)) {
    return 0;
  }

  let totalSize = 0;
  const files = fs.readdirSync(CACHE_DIR);
  
  for (const file of files) {
    const filePath = path.join(CACHE_DIR, file);
    totalSize += getFileSize(filePath);
  }
  
  return totalSize;
}

/**
 * Get statistics about the cache
 */
export function getCacheStats(): CacheStats {
  const index = loadRepoIndex();
  const repos: CacheStats['repos'] = [];
  let oldestDate: Date | null = null;
  let newestDate: Date | null = null;
  let totalSize = 0;
  
  for (const [repoId, entry] of Object.entries(index.repos)) {
    const cacheFilePath = path.join(CACHE_DIR, entry.cacheFile);
    const sizeBytes = getFileSize(cacheFilePath);
    const sizeMB = sizeBytes / (1024 * 1024);
    totalSize += sizeBytes;
    
    const lastAccessed = new Date(entry.lastAccessed);
    const now = new Date();
    const ageInDays = Math.floor((now.getTime() - lastAccessed.getTime()) / (1000 * 60 * 60 * 24));
    
    // Track oldest/newest
    if (!oldestDate || lastAccessed < oldestDate) {
      oldestDate = lastAccessed;
    }
    if (!newestDate || lastAccessed > newestDate) {
      newestDate = lastAccessed;
    }
    
    // Get chapter count from cache file
    let chapterCount = 0;
    try {
      if (fs.existsSync(cacheFilePath)) {
        const content = fs.readFileSync(cacheFilePath, 'utf-8');
        const cache: RepoCache = JSON.parse(content);
        chapterCount = Object.keys(cache.chapters || {}).length;
      }
    } catch {
      // Ignore errors reading cache files
    }
    
    repos.push({
      repoId,
      repoUrl: entry.repoUrl,
      sizeMB,
      lastAccessed: entry.lastAccessed,
      ageInDays,
      chapterCount,
    });
  }
  
  // Sort by last accessed (oldest first)
  repos.sort((a, b) => new Date(a.lastAccessed).getTime() - new Date(b.lastAccessed).getTime());
  
  return {
    totalRepos: repos.length,
    totalSizeMB: totalSize / (1024 * 1024),
    oldestEntry: oldestDate?.toISOString() || null,
    newestEntry: newestDate?.toISOString() || null,
    repos,
  };
}

/**
 * Run cache cleanup based on configuration
 */
export function cleanupCache(config: Partial<CleanupConfig> = {}): CleanupResult {
  const cfg: CleanupConfig = { ...DEFAULT_CONFIG, ...config };
  const result: CleanupResult = {
    deletedRepos: [],
    deletedFiles: [],
    freedSpaceMB: 0,
    remainingRepos: 0,
    remainingSizeMB: 0,
    errors: [],
  };
  
  log.info('Starting cache cleanup', { config: cfg });
  
  const stats = getCacheStats();
  const index = loadRepoIndex();
  const now = new Date();
  
  // Determine which repos to delete
  const reposToDelete: string[] = [];
  
  // 1. Delete repos older than maxAgeDays (but keep minReposToKeep)
  const sortedByAge = [...stats.repos].sort((a, b) => b.ageInDays - a.ageInDays);
  let keptCount = stats.totalRepos;
  
  for (const repo of sortedByAge) {
    if (repo.ageInDays > cfg.maxAgeDays && keptCount > cfg.minReposToKeep) {
      reposToDelete.push(repo.repoId);
      keptCount--;
      log.debug('Marking for deletion (age)', { repoId: repo.repoId, ageInDays: repo.ageInDays });
    }
  }
  
  // 2. If we still have too many repos, delete oldest
  const remaining = stats.repos.filter(r => !reposToDelete.includes(r.repoId));
  if (remaining.length > cfg.maxRepos) {
    const sortedRemaining = [...remaining].sort(
      (a, b) => new Date(a.lastAccessed).getTime() - new Date(b.lastAccessed).getTime()
    );
    
    const toDelete = sortedRemaining.slice(0, remaining.length - cfg.maxRepos);
    for (const repo of toDelete) {
      if (!reposToDelete.includes(repo.repoId)) {
        reposToDelete.push(repo.repoId);
        log.debug('Marking for deletion (count)', { repoId: repo.repoId });
      }
    }
  }
  
  // 3. If total size exceeds maxSizeMB, delete oldest until under limit
  let currentSize = stats.totalSizeMB;
  const stillRemaining = stats.repos.filter(r => !reposToDelete.includes(r.repoId));
  const sortedByAccessTime = [...stillRemaining].sort(
    (a, b) => new Date(a.lastAccessed).getTime() - new Date(b.lastAccessed).getTime()
  );
  
  for (const repo of sortedByAccessTime) {
    if (currentSize <= cfg.maxSizeMB) break;
    if (stillRemaining.length - reposToDelete.length <= cfg.minReposToKeep) break;
    
    if (!reposToDelete.includes(repo.repoId)) {
      reposToDelete.push(repo.repoId);
      currentSize -= repo.sizeMB;
      log.debug('Marking for deletion (size)', { repoId: repo.repoId, sizeMB: repo.sizeMB });
    }
  }
  
  // Perform deletions
  if (cfg.dryRun) {
    log.info('Dry run mode - no files deleted', { wouldDelete: reposToDelete.length });
    result.deletedRepos = reposToDelete.map(id => `[DRY RUN] ${id}`);
  } else {
    for (const repoId of reposToDelete) {
      try {
        const entry = index.repos[repoId];
        if (entry) {
          const cacheFilePath = path.join(CACHE_DIR, entry.cacheFile);
          const fileSize = getFileSize(cacheFilePath);
          
          if (fs.existsSync(cacheFilePath)) {
            fs.unlinkSync(cacheFilePath);
            result.freedSpaceMB += fileSize / (1024 * 1024);
            result.deletedFiles.push(entry.cacheFile);
          }
          
          delete index.repos[repoId];
          result.deletedRepos.push(repoId);
          
          cacheLog.info(`Deleted cache for ${repoId}`, { 
            sizeMB: (fileSize / (1024 * 1024)).toFixed(2) 
          });
        }
      } catch (error) {
        const err = error as Error;
        result.errors.push(`Failed to delete ${repoId}: ${err.message}`);
        log.error('Failed to delete cache', { repoId, error: err.message });
      }
    }
    
    // Save updated index
    saveRepoIndex(index);
  }
  
  // Calculate remaining stats
  const finalStats = cfg.dryRun ? stats : getCacheStats();
  result.remainingRepos = cfg.dryRun 
    ? stats.totalRepos - reposToDelete.length 
    : finalStats.totalRepos;
  result.remainingSizeMB = cfg.dryRun 
    ? stats.totalSizeMB - result.freedSpaceMB 
    : finalStats.totalSizeMB;
  
  log.info('Cache cleanup complete', {
    deleted: result.deletedRepos.length,
    freedMB: result.freedSpaceMB.toFixed(2),
    remaining: result.remainingRepos,
    remainingSizeMB: result.remainingSizeMB.toFixed(2),
  });
  
  return result;
}

/**
 * Clean up orphaned cache files (not in index)
 */
export function cleanupOrphanedFiles(dryRun = false): string[] {
  const orphanedFiles: string[] = [];
  
  if (!fs.existsSync(CACHE_DIR)) {
    return orphanedFiles;
  }
  
  const index = loadRepoIndex();
  const indexedFiles = new Set(Object.values(index.repos).map(r => r.cacheFile));
  indexedFiles.add('repo_index.json'); // Don't delete the index
  
  const files = fs.readdirSync(CACHE_DIR);
  
  for (const file of files) {
    if (!indexedFiles.has(file)) {
      orphanedFiles.push(file);
      
      if (!dryRun) {
        const filePath = path.join(CACHE_DIR, file);
        try {
          fs.unlinkSync(filePath);
          log.info('Deleted orphaned file', { file });
        } catch (error) {
          const err = error as Error;
          log.error('Failed to delete orphaned file', { file, error: err.message });
        }
      }
    }
  }
  
  return orphanedFiles;
}

/**
 * Clear entire cache
 */
export function clearAllCache(): CleanupResult {
  log.warn('Clearing all cache');
  
  const stats = getCacheStats();
  const result: CleanupResult = {
    deletedRepos: [],
    deletedFiles: [],
    freedSpaceMB: 0,
    remainingRepos: 0,
    remainingSizeMB: 0,
    errors: [],
  };
  
  if (!fs.existsSync(CACHE_DIR)) {
    return result;
  }
  
  const files = fs.readdirSync(CACHE_DIR);
  
  for (const file of files) {
    const filePath = path.join(CACHE_DIR, file);
    try {
      const fileSize = getFileSize(filePath);
      fs.unlinkSync(filePath);
      result.deletedFiles.push(file);
      result.freedSpaceMB += fileSize / (1024 * 1024);
    } catch (error) {
      const err = error as Error;
      result.errors.push(`Failed to delete ${file}: ${err.message}`);
    }
  }
  
  result.deletedRepos = stats.repos.map(r => r.repoId);
  
  cacheLog.warn('All cache cleared', { 
    files: result.deletedFiles.length,
    freedMB: result.freedSpaceMB.toFixed(2)
  });
  
  return result;
}

/**
 * Schedule automatic cleanup (call this at app startup)
 */
let cleanupInterval: NodeJS.Timeout | null = null;

export function scheduleAutomaticCleanup(intervalHours = 24): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
  
  // Run cleanup on startup
  setTimeout(() => {
    try {
      cleanupCache();
      cleanupOrphanedFiles();
    } catch (error) {
      log.error('Automatic cleanup failed', { error });
    }
  }, 60000); // 1 minute after startup
  
  // Schedule regular cleanup
  cleanupInterval = setInterval(() => {
    try {
      cleanupCache();
      cleanupOrphanedFiles();
    } catch (error) {
      log.error('Automatic cleanup failed', { error });
    }
  }, intervalHours * 60 * 60 * 1000);
  
  log.info('Automatic cleanup scheduled', { intervalHours });
}

export function stopAutomaticCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    log.info('Automatic cleanup stopped');
  }
}

export default {
  getCacheSize,
  getCacheStats,
  cleanupCache,
  cleanupOrphanedFiles,
  clearAllCache,
  scheduleAutomaticCleanup,
  stopAutomaticCleanup,
};
