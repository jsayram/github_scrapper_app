import { NextResponse } from 'next/server';
import { getRequiredExcludedPatterns } from '@/lib/excludedPatterns';
import { getAllIncludedPatterns } from '@/lib/includedPatterns';

// ============================================================================
// RATE LIMIT TRACKING (Global across all requests)
// ============================================================================
interface RateLimitState {
  remaining: number;
  limit: number;
  resetTime: number; // Unix timestamp in ms
  lastUpdated: number;
}

const globalRateLimit: RateLimitState = {
  remaining: 5000, // GitHub default for authenticated
  limit: 5000,
  resetTime: 0,
  lastUpdated: 0,
};

// ETag cache for conditional requests (memory cache)
const etagCache = new Map<string, { etag: string; data: unknown; timestamp: number }>();
const ETAG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Pre-compiled regex cache
const regexCache = new Map<string, RegExp>();

// Simple sleep utility
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function updateRateLimitFromHeaders(headers: Headers) {
  const remaining = headers.get('x-ratelimit-remaining');
  const limit = headers.get('x-ratelimit-limit');
  const reset = headers.get('x-ratelimit-reset');
  
  if (remaining) globalRateLimit.remaining = parseInt(remaining, 10);
  if (limit) globalRateLimit.limit = parseInt(limit, 10);
  if (reset) globalRateLimit.resetTime = parseInt(reset, 10) * 1000;
  globalRateLimit.lastUpdated = Date.now();
}

function shouldPauseForRateLimit(): { shouldPause: boolean; waitMs: number } {
  // If we're low on quota, pause proactively
  if (globalRateLimit.remaining < 10) {
    const now = Date.now();
    if (globalRateLimit.resetTime > now) {
      return { shouldPause: true, waitMs: globalRateLimit.resetTime - now + 1000 };
    }
  }
  return { shouldPause: false, waitMs: 0 };
}

// Check rate limit budget and return wait time if needed
async function checkRateLimitBudget(): Promise<number> {
  const check = shouldPauseForRateLimit();
  return check.shouldPause ? Math.min(check.waitMs, 60000) : 0;
}

// ============================================================================
// FETCH WITH RETRY AND EXPONENTIAL BACKOFF
// ============================================================================
async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Check rate limit before making request
    const rateLimitCheck = shouldPauseForRateLimit();
    if (rateLimitCheck.shouldPause) {
      console.log(`[GitHub] Rate limit low (${globalRateLimit.remaining} remaining). Waiting ${Math.round(rateLimitCheck.waitMs / 1000)}s...`);
      await new Promise(resolve => setTimeout(resolve, Math.min(rateLimitCheck.waitMs, 60000)));
    }
    
    try {
      const response = await fetch(url, options);
      
      // Update global rate limit tracking
      updateRateLimitFromHeaders(response.headers);
      
      // Success or client error (don't retry 4xx except rate limits)
      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429 && response.status !== 403)) {
        return response;
      }
      
      // Rate limit or abuse detection - wait and retry
      if (response.status === 429 || (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0')) {
        const retryAfter = response.headers.get('Retry-After');
        const waitMs = retryAfter 
          ? parseInt(retryAfter, 10) * 1000 
          : Math.pow(2, attempt + 1) * 1000; // Exponential backoff: 2s, 4s, 8s
        
        console.log(`[GitHub] Rate limited (attempt ${attempt + 1}/${maxRetries}). Waiting ${waitMs / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }
      
      // Server error - retry with backoff
      if (response.status >= 500) {
        const waitMs = Math.pow(2, attempt) * 1000;
        console.log(`[GitHub] Server error ${response.status} (attempt ${attempt + 1}/${maxRetries}). Waiting ${waitMs / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      const waitMs = Math.pow(2, attempt) * 1000;
      console.log(`[GitHub] Network error (attempt ${attempt + 1}/${maxRetries}): ${lastError.message}. Waiting ${waitMs / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

// ============================================================================
// PATTERN MATCHING WITH PRE-COMPILED REGEXES
// ============================================================================
function getCompiledRegex(pattern: string): RegExp {
  let regex = regexCache.get(pattern);
  if (!regex) {
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '__GLOBSTAR__')
      .replace(/\*/g, '[^/]*')
      .replace(/__GLOBSTAR__/g, '.*');
    regex = new RegExp(`^${regexPattern}$`);
    regexCache.set(pattern, regex);
  }
  return regex;
}

function matchesPatternFast(path: string, pattern: string): boolean {
  return getCompiledRegex(pattern).test(path);
}

// Pre-compile all patterns once at start
function preCompilePatterns(patterns: string[]): void {
  patterns.forEach(p => getCompiledRegex(p));
}

export async function POST(request: Request) {
  try {
    const { 
      repoUrl, 
      token, 
      useRelativePaths, 
      includePatterns, 
      excludePatterns, 
      maxFileSize 
    } = await request.json();

    // Use token from request, or fallback to environment variable
    const githubToken = token || process.env.GITHUB_TOKEN || process.env.GITHUB_ACCESS_TOKEN || process.env.GH_TOKEN;

    // Validate required inputs
    if (!repoUrl) {
      return NextResponse.json({ error: "Repository URL is required" }, { status: 400 });
    }

    // For security reasons, check if the URL is a valid GitHub URL
    const githubUrlPattern = /^https:\/\/github\.com\/[^/]+\/[^/]+/;
    if (!githubUrlPattern.test(repoUrl)) {
      return NextResponse.json({ error: "Invalid GitHub URL" }, { status: 400 });
    }

    // Make request to GitHub API to get repository contents
    const { owner, repo, path, ref } = parseGitHubUrl(repoUrl);
    
    // Handle include patterns - respect empty array from frontend
    // Only use default patterns if includePatterns is undefined or null
    const finalIncludePatterns = Array.isArray(includePatterns) ? includePatterns : getAllIncludedPatterns();
    
    // Handle exclude patterns
    const finalExcludePatterns = excludePatterns?.length ? excludePatterns : getRequiredExcludedPatterns();
    
    // Fetch files recursively
    try {
      const result = await crawlGitHubFiles({
        owner,
        repo,
        ref,
        path,
        token: githubToken,
        useRelativePaths,
        includePatterns: finalIncludePatterns,
        excludePatterns: finalExcludePatterns,
        maxFileSize: maxFileSize || 500000
      });
      
      return NextResponse.json(result);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // Check if we have a GitHub API rate limit error
      if (error.rateLimitInfo) {
        const { status, message, headers } = error.rateLimitInfo;
        
        // Create a response with the error message
        const response = NextResponse.json(
          { error: message }, 
          { status }
        );
        
        // Forward GitHub's rate limit headers
        if (headers['x-ratelimit-limit']) 
          response.headers.set('x-ratelimit-limit', headers['x-ratelimit-limit']);
        if (headers['x-ratelimit-remaining']) 
          response.headers.set('x-ratelimit-remaining', headers['x-ratelimit-remaining']);
        if (headers['x-ratelimit-reset']) 
          response.headers.set('x-ratelimit-reset', headers['x-ratelimit-reset']);
        
        return response;
      }
      
      // Handle abuse detection mechanism errors (HTTP 429)
      if (error.abuseDetection) {
        return NextResponse.json(
          { 
            error: "GitHub API abuse detection triggered. Please wait a few minutes before trying again or reduce your request frequency.",
            details: error.message 
          }, 
          { status: 429 }
        );
      }
      
      // For any other errors, clean up the error message
      let errorMessage = error.message || 'Failed to crawl repository';
      
      // Clean up error messages with newlines and JSON formatting
      if (typeof errorMessage === 'string') {
        // Remove newlines and clean up JSON strings in error message
        errorMessage = errorMessage
          .replace(/\\n/g, ' ')
          .replace(/\n/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        // Try to extract cleaner message from GitHub API errors
        const githubApiErrorMatch = errorMessage.match(/GitHub API error: \d+ (.+)/);
        if (githubApiErrorMatch) {
          try {
            // Try to parse the JSON part if present
            const jsonStr = githubApiErrorMatch[1];
            if (jsonStr.includes('{"message":')) {
              const parsedError = JSON.parse(jsonStr);
              if (parsedError.message) {
                errorMessage = `GitHub API error: ${parsedError.message}`;
              }
            }
          } catch {
            // If parsing fails, keep the cleaned string version
          }
        }
      }
      
      return NextResponse.json(
        { error: errorMessage }, 
        { status: error.status || 500 }
      );
    }
  } catch (error) {
    console.error('Error processing GitHub crawler request:', error);
    return NextResponse.json({ error: 'Failed to crawl repository' }, { status: 500 });
  }
}

// Helper function to parse GitHub URLs
// Note: Branch names with slashes (e.g., feature/branch) are tricky to parse from URLs
// because we can't distinguish between branch parts and path parts.
// We'll use 'HEAD' for tree URLs to let GitHub resolve the default branch,
// unless the URL explicitly contains a branch reference.
function parseGitHubUrl(url: string) {
  const parsedUrl = new URL(url);
  const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
  
  const owner = pathParts[0];
  const repo = pathParts[1];
  
  let ref = '';
  let path = '';
  
  // Handle different URL formats:
  // 1. https://github.com/owner/repo - no tree/blob, use default branch
  // 2. https://github.com/owner/repo/tree/branch - with explicit branch
  // 3. https://github.com/owner/repo/tree/branch/path/to/dir - branch + path
  // 4. https://github.com/owner/repo/blob/branch/path/to/file - file URL
  
  if (pathParts.length > 2) {
    const type = pathParts[2]; // 'tree' or 'blob'
    
    if (type === 'tree' || type === 'blob') {
      // The remaining parts could be branch + path, but branches can have slashes
      // We can't reliably distinguish, so we'll use a smarter approach:
      // For now, join everything after 'tree' as the ref (branch name)
      // and rely on GitHub to resolve it. If the tree API fails, we'll try HEAD.
      const remainingParts = pathParts.slice(3);
      
      if (remainingParts.length > 0) {
        // Set the full remaining path as ref initially
        // The Tree API will handle this, or we'll fallback to HEAD
        ref = remainingParts.join('/');
      }
    }
  }
  
  // If ref contains known branch prefixes, we should use it
  // Otherwise, return empty ref to use HEAD/default branch
  // Common patterns: main, master, develop, feature/*, bugfix/*, release/*
  const looksLikeBranch = ref && (
    ref === 'main' || 
    ref === 'master' || 
    ref === 'develop' ||
    ref.startsWith('feature/') ||
    ref.startsWith('bugfix/') ||
    ref.startsWith('hotfix/') ||
    ref.startsWith('release/') ||
    /^v?\d+(\.\d+)*$/.test(ref) // version tags like v1.0.0
  );
  
  // If it doesn't look like a branch, it might be a path in the default branch
  if (!looksLikeBranch && ref) {
    path = ref;
    ref = ''; // Let it use HEAD
  }
  
  return { owner, repo, ref, path };
}

// Replace browser-only atob() with Node.js compatible approach
function decodeBase64(base64String: string): string {
  // Remove any newlines that might be in the base64 string
  const cleanBase64 = base64String.replace(/\n/g, '');
  // Use Buffer for Node.js environments
  return Buffer.from(cleanBase64, 'base64').toString('utf-8');
}

// HYBRID APPROACH: Function to crawl GitHub files - tries Tree API first, falls back to directory crawling
interface CrawlOptions {
  owner: string;
  repo: string;
  ref: string;
  path: string;
  token: string;
  useRelativePaths: boolean;
  includePatterns: string[];
  excludePatterns: string[];
  maxFileSize: number;
}

async function crawlGitHubFiles({ 
  owner, 
  repo, 
  ref, 
  path, 
  token, 
  useRelativePaths,
  includePatterns, 
  excludePatterns,
  maxFileSize 
}: CrawlOptions) {
  const files: Record<string, string> = {};
  const skippedFiles: [string, number][] = [];
  const excludedFiles: string[] = []; // Track files excluded by patterns
  let requestCount = 0;
  let method = 'unknown';
  let cacheHit = false;
  
  // Common headers for all GitHub API requests
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json'
  };
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }
  
  // Pre-compile all patterns for faster matching
  if (includePatterns) preCompilePatterns(includePatterns);
  if (excludePatterns) preCompilePatterns(excludePatterns);
  
  // Function to check if a file would match include patterns (ignoring exclusions)
  function wouldBeIncluded(filePath: string, fileName: string, includePatterns?: string[]) {
    if (!includePatterns || includePatterns.length === 0) return true;
    return includePatterns.some(pattern => 
      matchesPatternFast(fileName, pattern) || matchesPatternFast(filePath, pattern)
    );
  }
  
  // Adaptive batch size based on rate limit
  function getAdaptiveBatchSize(): number {
    if (globalRateLimit.remaining > 1000) return 50;
    if (globalRateLimit.remaining > 500) return 25;
    if (globalRateLimit.remaining > 100) return 10;
    return 5;
  }
  
  // Adaptive delay based on rate limit
  function getAdaptiveDelay(): number {
    if (globalRateLimit.remaining > 1000) return 50;
    if (globalRateLimit.remaining > 500) return 100;
    if (globalRateLimit.remaining > 100) return 200;
    return 500;
  }
  
  // Helper function to fetch tree with retry on ref failure
  async function fetchTree(targetRef: string): Promise<{ tree: unknown; cacheHit: boolean; requestsMade: number }> {
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${targetRef}?recursive=1`;
    
    // Create a copy of headers for this request (to add ETag if cached)
    const requestHeaders: HeadersInit = { ...headers };
    
    // Check ETag cache for conditional request
    const cacheKey = `tree:${owner}/${repo}:${targetRef}`;
    const cached = etagCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < ETAG_CACHE_TTL) {
      requestHeaders['If-None-Match'] = cached.etag;
    }
    
    const treeResponse = await fetchWithRetry(treeUrl, { headers: requestHeaders });
    
    // Handle 304 Not Modified - use cached data
    if (treeResponse.status === 304 && cached) {
      console.log(`[GitHub] Cache hit for ${owner}/${repo} - using cached tree`);
      return { tree: cached.data, cacheHit: true, requestsMade: 1 };
    }
    
    if (!treeResponse.ok) {
      const errorText = await treeResponse.text();
      
      // Track rate limit headers
      const rateLimitHeaders: Record<string, string> = {};
      ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset'].forEach(header => {
        const value = treeResponse.headers.get(header);
        if (value) rateLimitHeaders[header] = value;
      });
      
      if (treeResponse.status === 403 && errorText.includes('rate limit')) {
        throw {
          rateLimitInfo: {
            status: 403,
            message: errorText,
            headers: rateLimitHeaders
          }
        };
      }
      
      if (treeResponse.status === 429) {
        throw {
          abuseDetection: true,
          message: errorText
        };
      }
      
      // Check for "No commit found" error - this means the ref is invalid
      if (treeResponse.status === 404 || errorText.includes('No commit found')) {
        throw new Error(`REF_NOT_FOUND:${errorText}`);
      }
      
      throw new Error(`Tree API error: ${treeResponse.status} - ${errorText}`);
    }
    
    const treeData = await treeResponse.json();
    
    // Cache the response with ETag
    const etag = treeResponse.headers.get('etag');
    if (etag) {
      etagCache.set(cacheKey, { etag, data: treeData, timestamp: Date.now() });
    }
    
    return { tree: treeData, cacheHit: false, requestsMade: 1 };
  }
  
  // First try the tree API approach for efficiency
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let tree: any;
    let treeRequestCount = 0;
    
    // Try with the provided ref first, fallback to HEAD if ref fails
    const targetRef = ref || 'HEAD';
    
    try {
      const result = await fetchTree(targetRef);
      tree = result.tree;
      cacheHit = result.cacheHit;
      treeRequestCount = result.requestsMade;
    } catch (refError: unknown) {
      // If the ref wasn't found and we have a specific ref, try HEAD instead
      const errorMessage = refError instanceof Error ? refError.message : String(refError);
      if (errorMessage.startsWith('REF_NOT_FOUND:') && ref) {
        console.log(`[GitHub] Ref '${ref}' not found, falling back to HEAD (default branch)`);
        const result = await fetchTree('HEAD');
        tree = result.tree;
        cacheHit = result.cacheHit;
        treeRequestCount = result.requestsMade + 1; // Account for the failed request
      } else {
        throw refError;
      }
    }
    
    requestCount += treeRequestCount;
    
    // Check if the tree was truncated (too many files)
    if (tree.truncated) {
      console.log('[GitHub] Tree API response was truncated. Falling back to directory crawl.');
      throw new Error('Tree API response was truncated');
    }
    
    method = cacheHit ? 'tree_api_cached' : 'tree_api';
    
    // Check for excluded files that would have been included
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tree.tree.forEach((item: any) => {
      if (item.type !== 'blob') return;
      
      // Calculate relative path if requested
      let relPath = item.path;
      if (useRelativePaths && path && item.path.startsWith(path)) {
        relPath = item.path.substring(path.length).replace(/^\//, '');
      }
      
      const fileName = relPath.split('/').pop() || '';
      
      // Check if file would match include patterns but is excluded
      if (wouldBeIncluded(relPath, fileName, includePatterns) && 
          !shouldIncludeFile(relPath, fileName, includePatterns, excludePatterns)) {
        excludedFiles.push(relPath);
      }
    });
    
    // Filter for the files we want
    const filesToFetch = tree.tree
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((item: any) => {
        // Only process files
        if (item.type !== 'blob') return false;
        
        // Handle path filtering
        const itemPath = item.path;
        if (path && !itemPath.startsWith(path)) return false;
        
        // Calculate relative path if requested
        let relPath = itemPath;
        if (useRelativePaths && path && itemPath.startsWith(path)) {
          relPath = itemPath.substring(path.length).replace(/^\//, '');
        }
        
        // Apply include/exclude patterns
        return shouldIncludeFile(relPath, relPath.split('/').pop() || '', includePatterns, excludePatterns);
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => {
        // Calculate relative path
        let relPath = item.path;
        if (useRelativePaths && path && item.path.startsWith(path)) {
          relPath = item.path.substring(path.length).replace(/^\//, '');
        }
        return {
          ...item,
          relPath
        };
      });
    
    console.log(`[GitHub] Found ${filesToFetch.length} files to fetch via Tree API`);
    console.log(`[GitHub] Rate limit: ${globalRateLimit.remaining}/${globalRateLimit.limit} remaining`);
    
    // Adaptive batch processing based on rate limit
    let processedCount = 0;
    
    while (processedCount < filesToFetch.length) {
      // Check rate limit budget before each batch
      const waitTime = await checkRateLimitBudget();
      if (waitTime > 0) {
        console.log(`[GitHub] Rate limit low, waiting ${waitTime}ms before continuing...`);
        await sleep(waitTime);
      }
      
      // Get adaptive batch size based on remaining quota
      const batchSize = getAdaptiveBatchSize();
      const delay = getAdaptiveDelay();
      
      const batch = filesToFetch.slice(processedCount, processedCount + batchSize);
      
      // Use Promise.all to fetch files in parallel within each batch
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await Promise.all(batch.map(async (item: any) => {
        try {
          // Use the blob API to get file content
          const blobUrl = `https://api.github.com/repos/${owner}/${repo}/git/blobs/${item.sha}`;
          const blobResponse = await fetchWithRetry(blobUrl, { headers });
          requestCount++;
          
          if (blobResponse.ok) {
            const blobData = await blobResponse.json();
            
            // Check file size
            if (blobData.size > maxFileSize) {
              skippedFiles.push([item.path, blobData.size]);
              return;
            }
            
            if (blobData.encoding === 'base64' && blobData.content) {
              try {
                const decodedContent = decodeBase64(blobData.content);
                files[item.relPath] = decodedContent;
              } catch (decodeErr) {
                console.error(`[GitHub] Failed to decode content for ${item.path}`, decodeErr);
              }
            }
          }
        } catch (error) {
          console.error(`[GitHub] Error fetching ${item.path}:`, error);
        }
      }));
      
      processedCount += batch.length;
      
      // Adaptive delay between batches based on rate limit
      if (processedCount < filesToFetch.length) {
        await sleep(delay);
      }
      
      // Log progress every 100 files
      if (processedCount % 100 === 0 || processedCount === filesToFetch.length) {
        console.log(`[GitHub] Progress: ${processedCount}/${filesToFetch.length} files (${globalRateLimit.remaining} API calls remaining)`);
      }
    }
  } catch (error) {
    // Fall back to directory-by-directory approach if tree approach fails
    console.log('[GitHub] Falling back to directory crawl approach:', error);
    
    // Reset counters for the fallback method
    requestCount = 0;
    method = 'contents_api';
    
    // Fallback directory crawler implementation
    async function fetchContents(contentPath: string) {
      // Check rate limit budget
      const waitTime = await checkRateLimitBudget();
      if (waitTime > 0) {
        console.log(`[GitHub] Rate limit low, waiting ${waitTime}ms...`);
        await sleep(waitTime);
      }
      
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${contentPath}`;
      const headers: HeadersInit = {
        'Accept': 'application/vnd.github.v3+json'
      };
      
      if (token) {
        headers['Authorization'] = `token ${token}`;
      }
      
      const params = ref ? `?ref=${ref}` : '';
      const response = await fetchWithRetry(`${url}${params}`, { headers });
      requestCount++;
      
      if (!response.ok) {
        const errorText = await response.text();
        
        // Track rate limit headers
        const rateLimitHeaders: Record<string, string> = {};
        ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset'].forEach(header => {
          const value = response.headers.get(header);
          if (value) rateLimitHeaders[header] = value;
        });
        
        // Special handling for rate limit errors
        if (response.status === 403 && errorText.includes('rate limit')) {
          throw {
            rateLimitInfo: {
              status: 403,
              message: errorText,
              headers: rateLimitHeaders
            }
          };
        }
        
        // Handle abuse detection mechanism errors (HTTP 429)
        if (response.status === 429) {
          throw {
            abuseDetection: true,
            message: errorText
          };
        }
        
        throw new Error(`GitHub API error: ${response.status} ${errorText}`);
      }
      
      const contents = await response.json();
      const contentsList = Array.isArray(contents) ? contents : [contents];
      
      // Process in adaptive batches
      const batchSize = getAdaptiveBatchSize();
      const delay = getAdaptiveDelay();
      
      for (let i = 0; i < contentsList.length; i += batchSize) {
        const batch = contentsList.slice(i, i + batchSize);
        
        // Create an array of promises for the batch
        const batchPromises = batch.map(async (item) => {
          const itemPath = item.path;
          
          // Calculate relative path if requested
          let relPath = itemPath;
          if (useRelativePaths && path && itemPath.startsWith(path)) {
            relPath = itemPath.substring(path.length).replace(/^\//, '');
          }
          
          if (item.type === 'file') {
            const fileName = item.name || relPath.split('/').pop() || '';
            
            // Check if file would match include patterns but is excluded
            if (wouldBeIncluded(relPath, fileName, includePatterns) && 
                !shouldIncludeFile(relPath, fileName, includePatterns, excludePatterns)) {
              excludedFiles.push(relPath);
              return;
            }
            
            // Check if file should be included based on patterns
            if (!shouldIncludeFile(relPath, fileName, includePatterns, excludePatterns)) {
              return;
            }
            
            // Check file size
            const fileSize = item.size || 0;
            if (fileSize > maxFileSize) {
              skippedFiles.push([itemPath, fileSize]);
              return;
            }
            
            // Get file content with retry
            try {
              if (item.download_url) {
                const fileResponse = await fetchWithRetry(item.download_url, {});
                requestCount++;
                
                if (fileResponse.ok) {
                  files[relPath] = await fileResponse.text();
                } else if (fileResponse.status === 429) {
                  throw {
                    abuseDetection: true,
                    message: await fileResponse.text()
                  };
                }
              } else {
                // Alternative method using content API
                const contentResponse = await fetchWithRetry(item.url, { headers });
                requestCount++;
                
                if (contentResponse.ok) {
                  const contentData = await contentResponse.json();
                  if (contentData.encoding === 'base64' && contentData.content) {
                    const decodedContent = decodeBase64(contentData.content);
                    files[relPath] = decodedContent;
                  }
                } else if (contentResponse.status === 429) {
                  throw {
                    abuseDetection: true,
                    message: await contentResponse.text()
                  };
                }
              }
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
              if (error.abuseDetection) {
                throw error; // Re-throw to be caught at the higher level
              }
              console.error(`[GitHub] Error fetching content for ${itemPath}:`, error);
            }
          } else if (item.type === 'dir') {
            // Recursively process directories
            await fetchContents(itemPath);
          }
        });
        
        // Wait for all promises in the batch to resolve
        await Promise.all(batchPromises);
        
        // Adaptive delay between batches
        if (i + batchSize < contentsList.length) {
          await sleep(delay);
        }
      }
    }
    
    // Start the directory crawl from the specified path or root
    await fetchContents(path || '');
  }
  
  console.log(`[GitHub] Fetched ${Object.keys(files).length} files with ${requestCount} API requests using ${method} method.`);
  console.log(`[GitHub] Final rate limit: ${globalRateLimit.remaining}/${globalRateLimit.limit}`);
  
  // Limit the number of excluded files to report to avoid excessively large responses
  const excludedFilesToReport = excludedFiles.length > 100 ? 
    [...excludedFiles.slice(0, 100), `... and ${excludedFiles.length - 100} more files`] : 
    excludedFiles;
  
  return {
    files,
    stats: {
      downloaded_count: Object.keys(files).length,
      skipped_count: skippedFiles.length,
      skipped_files: skippedFiles,
      excluded_count: excludedFiles.length,
      excluded_files: excludedFilesToReport,
      base_path: path || null,
      include_patterns: includePatterns,
      exclude_patterns: excludePatterns,
      api_requests: requestCount,
      method: method
    }
  };
}

// Helper to check if a file should be included based on patterns
// Uses pre-compiled regex patterns for better performance
function shouldIncludeFile(
  filePath: string, 
  fileName: string, 
  includePatterns?: string[], 
  excludePatterns?: string[]
) {
  // Check exclude patterns first - always prioritize exclusions
  if (excludePatterns && excludePatterns.length > 0) {
    const shouldExclude = excludePatterns.some(pattern => 
      matchesPatternFast(filePath, pattern) || matchesPatternFast(fileName, pattern)
    );
    
    // If file should be excluded, return false regardless of include patterns
    if (shouldExclude) {
      return false;
    }
  }

  // If no include patterns specified, don't include any files
  // This prevents downloading files when no file types are selected
  if (!includePatterns || includePatterns.length === 0) {
    return false;
  }
  
  // Check if file matches any include pattern
  const shouldInclude = includePatterns.some(pattern => 
    matchesPatternFast(fileName, pattern) || matchesPatternFast(filePath, pattern)
  );
  
  return shouldInclude;
}