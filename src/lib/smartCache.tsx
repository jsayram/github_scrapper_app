/**
 * Smart Cache System
 * Prompt-level caching with fuzzy matching and intelligent invalidation
 */

import * as crypto from 'crypto';
import { cacheLog, createScopedLogger } from './cacheLogger';

const log = createScopedLogger('SmartCache');

export interface CacheEntry {
  promptHash: string;
  normalizedPrompt: string;
  response: string;
  timestamp: string;
  provider: string;
  model: string;
  tokenUsage?: {
    input: number;
    output: number;
  };
  cost?: number;
}

export interface SmartCacheStore {
  entries: Record<string, CacheEntry>;
  stats: {
    totalHits: number;
    totalMisses: number;
    totalSaved: number;
    lastCleanup: string;
  };
}

/**
 * Normalize a prompt for better cache matching
 * Removes insignificant variations while preserving semantic meaning
 */
export function normalizePrompt(prompt: string): string {
  return prompt
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove leading/trailing whitespace
    .trim()
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    // Remove multiple consecutive newlines
    .replace(/\n{3,}/g, '\n\n')
    // Normalize common variations
    .replace(/[''""`]/g, "'")
    // Remove trailing punctuation variations
    .replace(/\.{2,}/g, '.')
    // Lowercase for comparison (but we'll store original)
    .toLowerCase();
}

/**
 * Generate hash for a normalized prompt
 */
export function hashPrompt(prompt: string): string {
  const normalized = normalizePrompt(prompt);
  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 32);
}

/**
 * Calculate similarity between two strings (Jaccard similarity on words)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(str2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  
  if (words1.size === 0 && words2.size === 0) return 1;
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Find a matching cache entry with fuzzy matching
 */
export function findMatchingEntry(
  store: SmartCacheStore,
  prompt: string,
  options: {
    provider?: string;
    model?: string;
    similarityThreshold?: number;
  } = {}
): CacheEntry | null {
  const { provider, model, similarityThreshold = 0.95 } = options;
  const promptHash = hashPrompt(prompt);
  const normalizedPrompt = normalizePrompt(prompt);
  
  // First try exact hash match
  const exactMatch = store.entries[promptHash];
  if (exactMatch) {
    // Check provider/model if specified
    if (provider && exactMatch.provider !== provider) {
      log.debug('Exact hash match but provider mismatch', { 
        cachedProvider: exactMatch.provider, 
        requestedProvider: provider 
      });
    } else if (model && exactMatch.model !== model) {
      log.debug('Exact hash match but model mismatch', { 
        cachedModel: exactMatch.model, 
        requestedModel: model 
      });
    } else {
      log.hit('Exact prompt match', { promptHash: promptHash.substring(0, 8) });
      return exactMatch;
    }
  }
  
  // Try fuzzy matching if no exact match
  let bestMatch: CacheEntry | null = null;
  let bestSimilarity = 0;
  
  for (const entry of Object.values(store.entries)) {
    // Skip if provider/model don't match (when specified)
    if (provider && entry.provider !== provider) continue;
    if (model && entry.model !== model) continue;
    
    const similarity = calculateSimilarity(normalizedPrompt, entry.normalizedPrompt);
    
    if (similarity >= similarityThreshold && similarity > bestSimilarity) {
      bestMatch = entry;
      bestSimilarity = similarity;
    }
  }
  
  if (bestMatch) {
    log.hit('Fuzzy prompt match', { 
      similarity: (bestSimilarity * 100).toFixed(1) + '%',
      threshold: (similarityThreshold * 100).toFixed(1) + '%'
    });
    return bestMatch;
  }
  
  log.miss('No matching cache entry', { promptHash: promptHash.substring(0, 8) });
  return null;
}

/**
 * Add entry to cache
 */
export function addCacheEntry(
  store: SmartCacheStore,
  prompt: string,
  response: string,
  options: {
    provider: string;
    model: string;
    tokenUsage?: { input: number; output: number };
    cost?: number;
  }
): void {
  const promptHash = hashPrompt(prompt);
  
  store.entries[promptHash] = {
    promptHash,
    normalizedPrompt: normalizePrompt(prompt),
    response,
    timestamp: new Date().toISOString(),
    provider: options.provider,
    model: options.model,
    tokenUsage: options.tokenUsage,
    cost: options.cost
  };
  
  store.stats.totalSaved++;
  
  log.save('Added cache entry', { 
    promptHash: promptHash.substring(0, 8),
    provider: options.provider,
    model: options.model
  });
}

/**
 * Create an empty cache store
 */
export function createCacheStore(): SmartCacheStore {
  return {
    entries: {},
    stats: {
      totalHits: 0,
      totalMisses: 0,
      totalSaved: 0,
      lastCleanup: new Date().toISOString()
    }
  };
}

/**
 * Merge two cache stores
 */
export function mergeCacheStores(
  primary: SmartCacheStore,
  secondary: SmartCacheStore
): SmartCacheStore {
  return {
    entries: { ...secondary.entries, ...primary.entries },
    stats: {
      totalHits: primary.stats.totalHits + secondary.stats.totalHits,
      totalMisses: primary.stats.totalMisses + secondary.stats.totalMisses,
      totalSaved: primary.stats.totalSaved + secondary.stats.totalSaved,
      lastCleanup: primary.stats.lastCleanup
    }
  };
}

/**
 * Cleanup old cache entries
 */
export function cleanupOldEntries(
  store: SmartCacheStore,
  maxAgeDays: number = 30
): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxAgeDays);
  const cutoffTime = cutoff.toISOString();
  
  let removed = 0;
  
  for (const [hash, entry] of Object.entries(store.entries)) {
    if (entry.timestamp < cutoffTime) {
      delete store.entries[hash];
      removed++;
    }
  }
  
  store.stats.lastCleanup = new Date().toISOString();
  
  if (removed > 0) {
    log.info('Cleaned up old cache entries', { removed, maxAgeDays });
  }
  
  return removed;
}

/**
 * Get cache statistics
 */
export function getCacheStatistics(store: SmartCacheStore): {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  estimatedCostSaved: number;
  providers: Record<string, number>;
  models: Record<string, number>;
} {
  const providers: Record<string, number> = {};
  const models: Record<string, number> = {};
  let estimatedCostSaved = 0;
  
  for (const entry of Object.values(store.entries)) {
    providers[entry.provider] = (providers[entry.provider] || 0) + 1;
    models[entry.model] = (models[entry.model] || 0) + 1;
    if (entry.cost) {
      estimatedCostSaved += entry.cost;
    }
  }
  
  const totalRequests = store.stats.totalHits + store.stats.totalMisses;
  const hitRate = totalRequests > 0 ? store.stats.totalHits / totalRequests : 0;
  
  return {
    totalEntries: Object.keys(store.entries).length,
    totalHits: store.stats.totalHits,
    totalMisses: store.stats.totalMisses,
    hitRate,
    estimatedCostSaved: estimatedCostSaved * store.stats.totalHits, // Multiply by hits
    providers,
    models
  };
}

/**
 * Extract key information from prompt for smarter matching
 */
export function extractPromptKey(prompt: string): {
  type: 'abstraction' | 'relationship' | 'chapter' | 'order' | 'unknown';
  identifier?: string;
} {
  // Try to identify prompt type
  if (prompt.includes('identify') && prompt.includes('abstraction')) {
    return { type: 'abstraction' };
  }
  if (prompt.includes('relationship') || prompt.includes('dependencies')) {
    return { type: 'relationship' };
  }
  if (prompt.includes('order') && prompt.includes('chapter')) {
    return { type: 'order' };
  }
  if (prompt.includes('write') && prompt.includes('chapter')) {
    // Try to extract chapter name
    const match = prompt.match(/chapter[:\s]+["']?([^"'\n]+)["']?/i);
    return { type: 'chapter', identifier: match?.[1]?.trim() };
  }
  
  return { type: 'unknown' };
}
