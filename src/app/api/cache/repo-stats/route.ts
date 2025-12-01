/**
 * Repository Cache Management API
 * Provides endpoints for managing repository-level cache
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getCacheStats as getRepoCacheStats, 
  cleanupCache, 
  cleanupOrphanedFiles,
  clearAllCache,
  type CleanupConfig
} from '@/lib/cacheCleanup';

/**
 * GET /api/cache/repo-stats
 * Get repository cache statistics
 */
export async function GET() {
  try {
    const stats = getRepoCacheStats();
    
    return NextResponse.json({
      success: true,
      stats: {
        totalRepos: stats.totalRepos,
        totalSizeMB: Math.round(stats.totalSizeMB * 100) / 100,
        oldestEntry: stats.oldestEntry,
        newestEntry: stats.newestEntry,
        repos: stats.repos.map(repo => ({
          repoId: repo.repoId,
          repoUrl: repo.repoUrl,
          sizeMB: Math.round(repo.sizeMB * 100) / 100,
          lastAccessed: repo.lastAccessed,
          ageInDays: repo.ageInDays,
          chapterCount: repo.chapterCount,
        })),
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Get repo cache stats error:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * POST /api/cache/repo-stats
 * Perform cache cleanup operations
 * 
 * Body options:
 * - { action: 'cleanup', config?: CleanupConfig }
 * - { action: 'cleanup-orphans', dryRun?: boolean }
 * - { action: 'clear-all' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, config, dryRun } = body;
    
    switch (action) {
      case 'cleanup': {
        const cleanupConfig: Partial<CleanupConfig> = config || {};
        const result = cleanupCache(cleanupConfig);
        
        return NextResponse.json({
          success: true,
          action: 'cleanup',
          result: {
            deletedRepos: result.deletedRepos.length,
            deletedFiles: result.deletedFiles.length,
            freedSpaceMB: Math.round(result.freedSpaceMB * 100) / 100,
            remainingRepos: result.remainingRepos,
            remainingSizeMB: Math.round(result.remainingSizeMB * 100) / 100,
            errors: result.errors,
          },
        });
      }
      
      case 'cleanup-orphans': {
        const orphanedFiles = cleanupOrphanedFiles(dryRun ?? false);
        
        return NextResponse.json({
          success: true,
          action: 'cleanup-orphans',
          dryRun: dryRun ?? false,
          orphanedFiles: orphanedFiles,
          count: orphanedFiles.length,
        });
      }
      
      case 'clear-all': {
        const result = clearAllCache();
        
        return NextResponse.json({
          success: true,
          action: 'clear-all',
          result: {
            deletedRepos: result.deletedRepos.length,
            deletedFiles: result.deletedFiles.length,
            freedSpaceMB: Math.round(result.freedSpaceMB * 100) / 100,
            errors: result.errors,
          },
        });
      }
      
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}. Valid actions: cleanup, cleanup-orphans, clear-all`,
        }, { status: 400 });
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Cache cleanup error:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Unknown error',
    }, { status: 500 });
  }
}
