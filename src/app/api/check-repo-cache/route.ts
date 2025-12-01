/**
 * Check Repo Cache API
 * Checks if a repository has cached data and analyzes potential regeneration
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  loadRepoCache, 
  analyzeFileChanges, 
  determineRegenerationPlan,
  getCacheStats,
  clearRepoCache,
  type RegenerationPlan
} from '@/lib/repoCache';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repoUrl, files } = body;
    
    if (!repoUrl) {
      return NextResponse.json({
        error: 'Repository URL is required',
      }, { status: 400 });
    }
    
    // Load existing cache
    const cache = loadRepoCache(repoUrl);
    
    if (!cache) {
      return NextResponse.json({
        cached: false,
        message: 'No cache found for this repository',
        regenerationPlan: {
          mode: 'full',
          reason: 'No existing cache - full generation required',
          chaptersToRegenerate: [],
          rerunAbstractionIdentification: true,
          estimatedSavings: 0
        } as RegenerationPlan
      });
    }
    
    // If files provided, analyze changes
    if (files && Array.isArray(files)) {
      const changeAnalysis = analyzeFileChanges(cache.files, files);
      const regenerationPlan = determineRegenerationPlan(cache, changeAnalysis);
      
      return NextResponse.json({
        cached: true,
        lastCrawlTime: cache.lastCrawlTime,
        cachedFiles: cache.files.length,
        cachedChapters: Object.keys(cache.chapters).length,
        changeAnalysis: {
          added: changeAnalysis.addedFiles.length,
          removed: changeAnalysis.removedFiles.length,
          modified: changeAnalysis.modifiedFiles.length,
          unchanged: changeAnalysis.unchangedFiles.length,
          changePercentage: changeAnalysis.changePercentage,
        },
        regenerationPlan,
        abstractions: cache.abstractions?.map(a => a.name) || [],
        chapterOrder: cache.chapterOrder || [],
      });
    }
    
    // Just return cache status without analysis
    return NextResponse.json({
      cached: true,
      lastCrawlTime: cache.lastCrawlTime,
      cachedFiles: cache.files.length,
      cachedChapters: Object.keys(cache.chapters).length,
      abstractions: cache.abstractions?.map(a => a.name) || [],
      chapterOrder: cache.chapterOrder || [],
      metadata: cache.metadata,
    });
    
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Check repo cache error:', err);
    return NextResponse.json({
      error: err.message || 'Unknown error',
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const stats = getCacheStats();
    return NextResponse.json(stats);
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({
      error: err.message || 'Unknown error',
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const repoUrl = searchParams.get('repoUrl');
    
    if (!repoUrl) {
      return NextResponse.json({
        error: 'Repository URL is required',
      }, { status: 400 });
    }
    
    const success = clearRepoCache(repoUrl);
    
    return NextResponse.json({
      success,
      message: success ? 'Cache cleared' : 'No cache found for this repository',
    });
    
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({
      error: err.message || 'Unknown error',
    }, { status: 500 });
  }
}
