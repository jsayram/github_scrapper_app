import { Flow } from "pocketflow";
import path from 'path';

// Re-export or alias node classes from your local implementation
import {
  FetchRepo,
  IdentifyAbstractions,
  AnalyzeRelationships,
  OrderChapters,
  WriteChapters,
  CombineTutorial,
} from "@/lib/nodes";

// Import cache and change analysis utilities
import { loadRepoCache, saveRepoCache, computeContentHash } from "@/lib/repoCache";
import { analyzeChanges, getChangeSummary, type CurrentFileData } from "@/lib/changeAnalyzer";
import { cacheLog } from "@/lib/cacheLogger";

/**
 * Progress callback type for streaming updates
 */
export type ProgressCallback = (update: {
  stage: string;
  message: string;
  progress: number;
  currentChapter?: number;
  totalChapters?: number;
  chapterName?: string;
}) => Promise<void> | void;

/**
 * Creates a Pocket Flow that pulls a GitHub repo and turns it into a multi-chapter tutorial.
 *
 * Equivalent to the original Python example:
 *
 * ```python
 * fetch_repo >> identify_abstractions >> analyze_relationships >> order_chapters >> write_chapters >> combine_tutorial
 * ```
 */
export function createTutorialFlow(skipFetchRepo = false): Flow {
  // 1️⃣  Instantiate nodes
  const fetchRepo = new FetchRepo(5, 20);
  const identifyAbstractions = new IdentifyAbstractions(5, 20);
  const analyzeRelationships = new AnalyzeRelationships(5, 20);
  const orderChapters = new OrderChapters(5, 20);
  const writeChapters = new WriteChapters(5, 20); // BatchNode
  const combineTutorial = new CombineTutorial(3, 20);

  // 2️⃣  Wire up the DAG using the fluent `.next()` helper provided by Pocket Flow
  // If skipFetchRepo is true, start the flow from identifyAbstractions
  if (skipFetchRepo) {
    // When skipping FetchRepo, start the flow from identifyAbstractions
    identifyAbstractions
      .next(analyzeRelationships)
      .next(orderChapters)
      .next(writeChapters)
      .next(combineTutorial);
    
    // Return a flow instance starting at identifyAbstractions
    return new Flow(identifyAbstractions);
  } else {
    // Normal flow including fetchRepo
    fetchRepo
      .next(identifyAbstractions)
      .next(analyzeRelationships)
      .next(orderChapters)
      .next(writeChapters)
      .next(combineTutorial);
      
    // Return a flow instance starting at fetchRepo
    return new Flow(fetchRepo);
  }
}

/**
 * Creates a partial regeneration flow that skips abstraction identification
 * and relationship analysis, only regenerating chapters.
 */
export function createPartialRegenerationFlow(): Flow {
  const orderChapters = new OrderChapters(5, 20);
  const writeChapters = new WriteChapters(5, 20);
  const combineTutorial = new CombineTutorial(3, 20);

  // For partial regeneration, we might not need to re-order
  // but we'll keep it for consistency
  orderChapters
    .next(writeChapters)
    .next(combineTutorial);

  return new Flow(orderChapters);
}

/**
 * Executes the tutorial flow with the provided shared data.
 * Includes intelligent caching and partial regeneration support.
 * 
 * This function creates a flow instance and runs it, similar to:
 * 
 * ```python
 * # Create the flow instance
 * tutorial_flow = create_tutorial_flow()
 * # Run the flow
 * tutorial_flow.run(shared)
 * ```
 */
export async function runTutorialFlow(shared: any): Promise<any> {
  console.log(`[TutorialFlow] Creating tutorial flow instance`);
  
  // Check if we should skip the fetch repo step
  // skip_fetch_repo is true when files are already provided
  const skipFetchRepo = shared.skip_fetch_repo === true;
  const repoUrl = shared.repo_url;
  
  if (skipFetchRepo) {
    console.log(`[TutorialFlow] Skipping FetchRepo step as files are already provided`);
  }
  
  // Convert files to CurrentFileData format for change analysis
  const currentFiles: CurrentFileData[] = (shared.files || []).map((f: [string, string]) => ({
    path: f[0],
    content: f[1],
  }));
  
  // Try to load existing cache for this repo
  let cache = null;
  if (repoUrl && shared.use_cache !== false) {
    try {
      cache = loadRepoCache(repoUrl);
      if (cache) {
        cacheLog.load(`Found cache for ${repoUrl}`, { 
          chapters: Object.keys(cache.chapters).length,
          files: cache.files.length
        });
      }
    } catch (error) {
      cacheLog.warn(`Failed to load cache for ${repoUrl}`, { error });
    }
  }
  
  // Analyze changes if we have a cache
  const analysis = analyzeChanges(currentFiles, cache);
  const changeSummary = getChangeSummary(analysis);
  
  cacheLog.info(`Change analysis: ${changeSummary.title}`, { 
    action: changeSummary.action,
    description: changeSummary.description 
  });
  
  // Determine regeneration mode based on analysis and user preference
  let regenerationMode: 'full' | 'partial' | 'partial_reidentify' | 'skip' = 'full';
  
  if (shared.force_full_regeneration) {
    regenerationMode = 'full';
  } else if (changeSummary.action === 'none' && cache) {
    regenerationMode = 'skip';
  } else if (changeSummary.action === 'partial' && cache) {
    regenerationMode = 'partial';
  } else if (changeSummary.action === 'reidentify' && cache) {
    regenerationMode = 'partial_reidentify';
  }
  
  // Update shared with regeneration info
  shared.regeneration_mode = regenerationMode;
  shared.chapters_to_regenerate = analysis.chaptersToRegenerate;
  
  // If we have cached data, add it to shared
  if (cache && regenerationMode !== 'full') {
    // Convert cached chapters to the format expected by WriteChapters
    const cachedChaptersMap: Record<string, string> = {};
    for (const [slug, chapter] of Object.entries(cache.chapters)) {
      cachedChaptersMap[slug] = chapter.content;
    }
    shared.cached_chapters = cachedChaptersMap;
    
    // Use cached abstractions and relationships for partial modes
    if (regenerationMode !== 'partial_reidentify' && cache.abstractions) {
      shared.cached_abstractions = cache.abstractions;
      shared.cached_relationships = cache.relationships;
    }
  }
  
  // Log the decision
  console.log(`[TutorialFlow] Regeneration mode: ${regenerationMode}`);
  console.log(`[TutorialFlow] Running flow with ${shared.files?.length || 0} files`);
  console.log(`[TutorialFlow] Project: ${shared.project_name}`);
  
  try {
    // Create and run the appropriate flow
    const flow = createTutorialFlow(skipFetchRepo);
    const result = await flow.run(shared);
    
    // Save updated cache after successful run
    if (repoUrl && shared.use_cache !== false) {
      try {
        await saveUpdatedCache(repoUrl, shared, currentFiles);
        cacheLog.save(`Cache saved for ${repoUrl}`);
      } catch (error) {
        cacheLog.warn(`Failed to save cache for ${repoUrl}`, { error });
      }
    }
    
    console.log(`[TutorialFlow] Flow execution completed successfully`);
    return result;
  } catch (error) {
    console.error(`[TutorialFlow] Flow execution failed:`, error);
    throw error;
  }
}

/**
 * Save updated cache after tutorial generation
 */
async function saveUpdatedCache(
  repoUrl: string, 
  shared: any,
  currentFiles: CurrentFileData[]
): Promise<void> {
  const chapters: Record<string, any> = {};
  
  // Convert generated chapters to cache format
  const chapterOrder = shared.chapter_order || [];
  const chaptersContent = shared.chapters || [];
  const abstractions = shared.abstractions || [];
  
  chapterOrder.forEach((abstractionIndex: number, i: number) => {
    if (abstractionIndex >= 0 && abstractionIndex < abstractions.length && chaptersContent[i]) {
      const abs = abstractions[abstractionIndex];
      const slug = abs.name.replace(/[^a-zA-Z0-9_.-]/g, '_').toLowerCase();
      
      chapters[slug] = {
        title: abs.name,
        slug: slug,
        content: chaptersContent[i],
        abstractionsCovered: [abs.name],
        dependencies: [], // TODO: Extract from chapter content or relationships
        generatedAt: new Date().toISOString(),
        promptHash: computeContentHash(chaptersContent[i]),
      };
    }
  });
  
  // Build cache object
  const cacheData = {
    repoUrl,
    repoId: repoUrl.replace(/^https?:\/\//, '').replace(/^github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '').toLowerCase(),
    lastCrawlTime: new Date().toISOString(),
    files: currentFiles.map(f => ({
      path: f.path,
      contentHash: computeContentHash(f.content),
      lastModified: new Date().toISOString(),
    })),
    abstractions: shared.abstractions,
    relationships: shared.relationships,
    chapterOrder: shared.chapter_order,
    chapters,
    metadata: {
      llmProvider: shared.llm_provider,
      llmModel: shared.llm_model,
    },
  };
  
  saveRepoCache(cacheData as any);
}

/**
 * Executes the tutorial flow with progress callbacks for streaming updates.
 * This version provides real-time progress updates for UI display.
 */
export async function runTutorialFlowWithProgress(
  shared: any, 
  onProgress: ProgressCallback
): Promise<any> {
  console.log(`[TutorialFlow] Creating tutorial flow instance with progress tracking`);
  
  const skipFetchRepo = shared.skip_fetch_repo === true;
  const repoUrl = shared.repo_url;
  
  // Convert files to CurrentFileData format
  const currentFiles: CurrentFileData[] = (shared.files || []).map((f: [string, string]) => ({
    path: f[0],
    content: f[1],
  }));
  
  // Stage 1: Analyzing cache
  await onProgress({
    stage: 'analyzing',
    message: 'Analyzing existing cache...',
    progress: 5
  });
  
  // Load cache
  let cache = null;
  if (repoUrl && shared.use_cache !== false) {
    try {
      cache = loadRepoCache(repoUrl);
      if (cache) {
        cacheLog.load(`Found cache for ${repoUrl}`, { 
          chapters: Object.keys(cache.chapters).length,
          files: cache.files.length
        });
      }
    } catch (error) {
      cacheLog.warn(`Failed to load cache for ${repoUrl}`, { error });
    }
  }
  
  // Analyze changes
  const analysis = analyzeChanges(currentFiles, cache);
  const changeSummary = getChangeSummary(analysis);
  
  // Determine regeneration mode
  let regenerationMode: 'full' | 'partial' | 'partial_reidentify' | 'skip' = 'full';
  if (shared.force_full_regeneration) {
    regenerationMode = 'full';
  } else if (changeSummary.action === 'none' && cache) {
    regenerationMode = 'skip';
  } else if (changeSummary.action === 'partial' && cache) {
    regenerationMode = 'partial';
  } else if (changeSummary.action === 'reidentify' && cache) {
    regenerationMode = 'partial_reidentify';
  }
  
  shared.regeneration_mode = regenerationMode;
  shared.chapters_to_regenerate = analysis.chaptersToRegenerate;
  
  // Add cached data if available
  if (cache && regenerationMode !== 'full') {
    const cachedChaptersMap: Record<string, string> = {};
    for (const [slug, chapter] of Object.entries(cache.chapters)) {
      cachedChaptersMap[slug] = chapter.content;
    }
    shared.cached_chapters = cachedChaptersMap;
    
    if (regenerationMode !== 'partial_reidentify' && cache.abstractions) {
      shared.cached_abstractions = cache.abstractions;
      shared.cached_relationships = cache.relationships;
    }
  }
  
  // Stage 2: Identifying abstractions
  await onProgress({
    stage: 'abstractions',
    message: 'Identifying key concepts...',
    progress: 10
  });
  
  // Add progress callback to shared for nodes to use
  shared._onProgress = onProgress;
  
  try {
    const flow = createTutorialFlow(skipFetchRepo);
    const result = await flow.run(shared);
    
    // Save cache
    if (repoUrl && shared.use_cache !== false) {
      try {
        await saveUpdatedCache(repoUrl, shared, currentFiles);
        cacheLog.save(`Cache saved for ${repoUrl}`);
      } catch (error) {
        cacheLog.warn(`Failed to save cache for ${repoUrl}`, { error });
      }
    }
    
    await onProgress({
      stage: 'complete',
      message: 'Tutorial generation complete!',
      progress: 100
    });
    
    return result;
  } catch (error) {
    console.error(`[TutorialFlow] Flow execution failed:`, error);
    throw error;
  }
}