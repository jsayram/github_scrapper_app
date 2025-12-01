/**
 * Change Analyzer
 * Detects file changes and determines which chapters need regeneration
 */

import { cacheLog, createScopedLogger } from './cacheLogger';
import {
  type RepoCache,
  type CachedFile,
  type CachedChapter,
  computeContentHash,
} from './repoCache';

const log = createScopedLogger('ChangeAnalyzer');

export interface FileChange {
  path: string;
  type: 'added' | 'modified' | 'deleted';
  oldHash?: string;
  newHash?: string;
}

export interface ChangeAnalysis {
  hasChanges: boolean;
  changedFiles: FileChange[];
  addedFiles: string[];
  modifiedFiles: string[];
  deletedFiles: string[];
  affectedAbstractions: string[];
  chaptersToRegenerate: string[];
  chaptersToKeep: string[];
  summary: string;
}

export interface CurrentFileData {
  path: string;
  content: string;
}

/**
 * Compare current files with cached files to detect changes
 */
export function detectFileChanges(
  currentFiles: CurrentFileData[],
  cachedFiles: CachedFile[]
): FileChange[] {
  const changes: FileChange[] = [];
  
  // Create lookup maps
  const cachedMap = new Map<string, CachedFile>();
  for (const file of cachedFiles) {
    cachedMap.set(file.path, file);
  }
  
  const currentPaths = new Set<string>();
  
  // Check each current file
  for (const file of currentFiles) {
    currentPaths.add(file.path);
    const currentHash = computeContentHash(file.content);
    const cached = cachedMap.get(file.path);
    
    if (!cached) {
      // New file
      changes.push({
        path: file.path,
        type: 'added',
        newHash: currentHash,
      });
      log.debug('File added', { path: file.path });
    } else if (cached.contentHash !== currentHash) {
      // Modified file
      changes.push({
        path: file.path,
        type: 'modified',
        oldHash: cached.contentHash,
        newHash: currentHash,
      });
      log.debug('File modified', { path: file.path, oldHash: cached.contentHash, newHash: currentHash });
    }
    // If hashes match, file is unchanged
  }
  
  // Check for deleted files
  for (const cached of cachedFiles) {
    if (!currentPaths.has(cached.path)) {
      changes.push({
        path: cached.path,
        type: 'deleted',
        oldHash: cached.contentHash,
      });
      log.debug('File deleted', { path: cached.path });
    }
  }
  
  return changes;
}

/**
 * Determine which abstractions are affected by file changes
 */
export function findAffectedAbstractions(
  changes: FileChange[],
  cache: RepoCache
): string[] {
  if (!cache.abstractions || cache.abstractions.length === 0) {
    return [];
  }
  
  // Build file index map (path -> index in original files array)
  const filePathToIndex = new Map<string, number>();
  cache.files.forEach((file, idx) => {
    filePathToIndex.set(file.path, idx);
  });
  
  // Get indices of changed files
  const changedFileIndices = new Set<number>();
  for (const change of changes) {
    const idx = filePathToIndex.get(change.path);
    if (idx !== undefined) {
      changedFileIndices.add(idx);
    }
  }
  
  // Find abstractions that reference changed files
  const affectedAbstractions: string[] = [];
  for (const abstraction of cache.abstractions) {
    const hasAffectedFile = abstraction.files.some(filePath => {
      const idx = filePathToIndex.get(filePath);
      return idx !== undefined && changedFileIndices.has(idx);
    });
    
    if (hasAffectedFile) {
      affectedAbstractions.push(abstraction.name);
    }
  }
  
  return affectedAbstractions;
}

/**
 * Determine which chapters need regeneration based on affected abstractions
 */
export function findChaptersToRegenerate(
  affectedAbstractions: string[],
  cache: RepoCache
): { toRegenerate: string[]; toKeep: string[] } {
  const affectedSet = new Set(affectedAbstractions.map(a => a.toLowerCase()));
  const toRegenerate: string[] = [];
  const toKeep: string[] = [];
  
  for (const [slug, chapter] of Object.entries(cache.chapters)) {
    // Check if any abstraction covered by this chapter is affected
    const isAffected = chapter.abstractionsCovered.some(
      abs => affectedSet.has(abs.toLowerCase())
    );
    
    if (isAffected) {
      toRegenerate.push(slug);
    } else {
      toKeep.push(slug);
    }
  }
  
  // Also add chapters that depend on chapters being regenerated
  const regenerateSet = new Set(toRegenerate);
  let changed = true;
  while (changed) {
    changed = false;
    for (const slug of [...toKeep]) {
      const chapter = cache.chapters[slug];
      if (chapter && chapter.dependencies.some(dep => regenerateSet.has(dep))) {
        toRegenerate.push(slug);
        regenerateSet.add(slug);
        toKeep.splice(toKeep.indexOf(slug), 1);
        changed = true;
      }
    }
  }
  
  return { toRegenerate, toKeep };
}

/**
 * Full change analysis for a repository
 */
export function analyzeChanges(
  currentFiles: CurrentFileData[],
  cache: RepoCache | null
): ChangeAnalysis {
  // No cache = full generation needed
  if (!cache) {
    log.info('No cache found, full generation required');
    return {
      hasChanges: true,
      changedFiles: currentFiles.map(f => ({
        path: f.path,
        type: 'added' as const,
        newHash: computeContentHash(f.content),
      })),
      addedFiles: currentFiles.map(f => f.path),
      modifiedFiles: [],
      deletedFiles: [],
      affectedAbstractions: [],
      chaptersToRegenerate: [],
      chaptersToKeep: [],
      summary: `No cache found. Will generate all ${currentFiles.length} files fresh.`,
    };
  }
  
  // Detect file changes
  const changes = detectFileChanges(currentFiles, cache.files);
  
  if (changes.length === 0) {
    log.info('No changes detected');
    return {
      hasChanges: false,
      changedFiles: [],
      addedFiles: [],
      modifiedFiles: [],
      deletedFiles: [],
      affectedAbstractions: [],
      chaptersToRegenerate: [],
      chaptersToKeep: Object.keys(cache.chapters),
      summary: 'No changes detected. All chapters can be served from cache.',
    };
  }
  
  // Categorize changes
  const addedFiles = changes.filter(c => c.type === 'added').map(c => c.path);
  const modifiedFiles = changes.filter(c => c.type === 'modified').map(c => c.path);
  const deletedFiles = changes.filter(c => c.type === 'deleted').map(c => c.path);
  
  // Find affected abstractions
  const affectedAbstractions = findAffectedAbstractions(changes, cache);
  
  // Determine chapters to regenerate
  const { toRegenerate, toKeep } = findChaptersToRegenerate(affectedAbstractions, cache);
  
  // If significant structural changes, suggest full regeneration
  const majorChange = 
    addedFiles.length > cache.files.length * 0.3 ||
    deletedFiles.length > cache.files.length * 0.3 ||
    modifiedFiles.length > cache.files.length * 0.5;
  
  let summary: string;
  if (majorChange) {
    summary = `Major changes detected (${addedFiles.length} added, ${modifiedFiles.length} modified, ${deletedFiles.length} deleted). Consider full regeneration.`;
  } else if (toRegenerate.length === 0 && changes.length > 0) {
    summary = `${changes.length} file(s) changed but no chapters affected. May want to re-identify abstractions.`;
  } else {
    summary = `${toRegenerate.length} chapter(s) need regeneration, ${toKeep.length} can be kept from cache.`;
  }
  
  log.info('Change analysis complete', {
    added: addedFiles.length,
    modified: modifiedFiles.length,
    deleted: deletedFiles.length,
    affectedAbstractions: affectedAbstractions.length,
    toRegenerate: toRegenerate.length,
    toKeep: toKeep.length,
  });
  
  cacheLog.info(summary);
  
  return {
    hasChanges: true,
    changedFiles: changes,
    addedFiles,
    modifiedFiles,
    deletedFiles,
    affectedAbstractions,
    chaptersToRegenerate: toRegenerate,
    chaptersToKeep: toKeep,
    summary,
  };
}

/**
 * Quick check if repo has any changes (cheaper than full analysis)
 */
export function hasRepoChanges(
  currentFiles: CurrentFileData[],
  cache: RepoCache | null
): boolean {
  if (!cache) return true;
  if (currentFiles.length !== cache.files.length) return true;
  
  // Create quick lookup
  const cachedHashes = new Map<string, string>();
  for (const file of cache.files) {
    cachedHashes.set(file.path, file.contentHash);
  }
  
  // Check if any file is different
  for (const file of currentFiles) {
    const cachedHash = cachedHashes.get(file.path);
    if (!cachedHash) return true; // File doesn't exist in cache
    
    const currentHash = computeContentHash(file.content);
    if (currentHash !== cachedHash) return true;
  }
  
  return false;
}

/**
 * Get a summary of changes suitable for display to user
 */
export function getChangeSummary(analysis: ChangeAnalysis): {
  icon: string;
  title: string;
  description: string;
  action: 'none' | 'partial' | 'full' | 'reidentify';
} {
  if (!analysis.hasChanges) {
    return {
      icon: '✅',
      title: 'No Changes',
      description: 'Repository is unchanged. Tutorial can be loaded from cache.',
      action: 'none',
    };
  }
  
  const totalChanges = analysis.changedFiles.length;
  
  if (analysis.chaptersToRegenerate.length === 0 && totalChanges > 0) {
    return {
      icon: '🔍',
      title: 'Possible New Content',
      description: `${totalChanges} file(s) changed but no existing chapters affected. Consider re-identifying abstractions.`,
      action: 'reidentify',
    };
  }
  
  const keepPercent = Math.round(
    (analysis.chaptersToKeep.length / 
      (analysis.chaptersToKeep.length + analysis.chaptersToRegenerate.length)) * 100
  );
  
  if (keepPercent >= 70) {
    return {
      icon: '🔄',
      title: 'Partial Update',
      description: `${analysis.chaptersToRegenerate.length} chapter(s) need regeneration. ${keepPercent}% can be reused from cache.`,
      action: 'partial',
    };
  }
  
  return {
    icon: '🔨',
    title: 'Full Regeneration Recommended',
    description: `Major changes detected. Only ${keepPercent}% of chapters can be reused.`,
    action: 'full',
  };
}

export default {
  detectFileChanges,
  findAffectedAbstractions,
  findChaptersToRegenerate,
  analyzeChanges,
  hasRepoChanges,
  getChangeSummary,
};
