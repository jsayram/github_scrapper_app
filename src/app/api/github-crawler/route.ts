import { NextResponse } from 'next/server';
import { getAllExcludedPatterns, getRequiredExcludedPatterns } from '@/lib/excludedPatterns';
import { getAllIncludedPatterns } from '@/lib/includedPatterns';

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
        token,
        useRelativePaths,
        includePatterns: finalIncludePatterns,
        excludePatterns: finalExcludePatterns,
        maxFileSize: maxFileSize || 500000
      });
      
      return NextResponse.json(result);
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
          } catch (e) {
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
function parseGitHubUrl(url: string) {
  const parsedUrl = new URL(url);
  const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
  
  const owner = pathParts[0];
  const repo = pathParts[1];
  
  let ref = '';
  let path = '';
  
  if (pathParts.length > 2 && pathParts[2] === 'tree') {
    ref = pathParts[3];
    path = pathParts.slice(4).join('/');
  }
  
  return { owner, repo, ref, path };
}

// HYBRID APPROACH: Function to crawl GitHub files - tries Tree API first, falls back to directory crawling
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
}: any) {
  const files: Record<string, string> = {};
  const skippedFiles: [string, number][] = [];
  const excludedFiles: string[] = []; // Track files excluded by patterns
  let requestCount = 0;
  let method = 'unknown';
  
  // Function to check if a file would match include patterns (ignoring exclusions)
  function wouldBeIncluded(filePath: string, fileName: string, includePatterns?: string[]) {
    if (!includePatterns || includePatterns.length === 0) return true;
    
    function matchesPattern(path: string, pattern: string) {
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '__GLOBSTAR__')
        .replace(/\*/g, '[^/]*')
        .replace(/__GLOBSTAR__/g, '.*');
      
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(path);
    }
    
    return includePatterns.some(pattern => 
      matchesPattern(fileName, pattern) || matchesPattern(filePath, pattern)
    );
  }
  
  // First try the tree API approach for efficiency
  try {
    // Get default branch if ref is not specified
    if (!ref) {
      const repoUrl = `https://api.github.com/repos/${owner}/${repo}`;
      const headers: HeadersInit = token ? { 'Authorization': `token ${token}` } : {};
      const repoResponse = await fetch(repoUrl, { headers });
      requestCount++;
      
      // Check for rate limit headers
      const rateLimitHeaders: Record<string, string> = {};
      ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset'].forEach(header => {
        const value = repoResponse.headers.get(header);
        if (value) rateLimitHeaders[header] = value;
      });
      
      if (!repoResponse.ok) {
        const errorText = await repoResponse.text();
        
        // Special handling for rate limit errors
        if (repoResponse.status === 403 && errorText.includes('rate limit')) {
          throw {
            rateLimitInfo: {
              status: 403,
              message: errorText,
              headers: rateLimitHeaders
            }
          };
        }
        
        // If we can't get repo info, fall back to master as common default
        ref = 'master';
      } else {
        const repoInfo = await repoResponse.json();
        ref = repoInfo.default_branch;
      }
    }
    
    // Get the repository tree recursively to maximize efficiency
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`;
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json'
    };
    
    if (token) {
      headers['Authorization'] = `token ${token}`;
    }
    
    const treeResponse = await fetch(treeUrl, { headers });
    requestCount++;
    
    // Track rate limit
    const rateLimitHeaders: Record<string, string> = {};
    ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset'].forEach(header => {
      const value = treeResponse.headers.get(header);
      if (value) rateLimitHeaders[header] = value;
    });
    
    // Handle errors
    if (!treeResponse.ok) {
      const errorText = await treeResponse.text();
      if (treeResponse.status === 403 && errorText.includes('rate limit')) {
        throw {
          rateLimitInfo: {
            status: 403,
            message: errorText,
            headers: rateLimitHeaders
          }
        };
      }
      
      // Handle abuse detection mechanism errors (HTTP 429)
      if (treeResponse.status === 429) {
        throw {
          abuseDetection: true,
          message: errorText
        };
      }
      
      // For other errors, we'll fall back to the directory crawl approach
      throw new Error(`Tree API error: ${treeResponse.status}`);
    }
    
    const tree = await treeResponse.json();
    
    // Check if the tree was truncated (too many files)
    if (tree.truncated) {
      console.log('Tree API response was truncated. Falling back to directory crawl.');
      throw new Error('Tree API response was truncated');
    }
    
    method = 'tree_api';
    
    // Check for excluded files that would have been included
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
      .filter((item: any) => {
        // Only process files
        if (item.type !== 'blob') return false;
        
        // Handle path filtering
        let itemPath = item.path;
        if (path && !itemPath.startsWith(path)) return false;
        
        // Calculate relative path if requested
        let relPath = itemPath;
        if (useRelativePaths && path && itemPath.startsWith(path)) {
          relPath = itemPath.substring(path.length).replace(/^\//, '');
        }
        
        // Apply include/exclude patterns
        return shouldIncludeFile(relPath, relPath.split('/').pop() || '', includePatterns, excludePatterns);
      })
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
    
    console.log(`Found ${filesToFetch.length} files to fetch via Tree API`);
    
    // Batch process files to be nice to API limits
    const batchSize = 10;
    
    for (let i = 0; i < filesToFetch.length; i += batchSize) {
      const batch = filesToFetch.slice(i, i + batchSize);
      
      // Use Promise.all to fetch files in parallel within each batch
      await Promise.all(batch.map(async (item: any) => {
        try {
          // Use the blob API to get file content
          const blobUrl = `https://api.github.com/repos/${owner}/${repo}/git/blobs/${item.sha}`;
          const blobResponse = await fetch(blobUrl, { headers });
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
                const decodedContent = atob(blobData.content.replace(/\n/g, ''));
                files[item.relPath] = decodedContent;
              } catch (e) {
                console.error(`Failed to decode content for ${item.path}`, e);
              }
            }
          }
        } catch (error) {
          console.error(`Error fetching ${item.path}:`, error);
        }
      }));
      
      // Optional: Add a small delay between batches to be gentle on the API
      if (i + batchSize < filesToFetch.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  } catch (error) {
    // Fall back to directory-by-directory approach if tree approach fails
    console.log('Falling back to directory crawl approach:', error);
    
    // Reset counters for the fallback method
    requestCount = 0;
    method = 'contents_api';
    
    // Fallback directory crawler implementation
    async function fetchContents(contentPath: string) {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${contentPath}`;
      const headers: HeadersInit = {
        'Accept': 'application/vnd.github.v3+json'
      };
      
      if (token) {
        headers['Authorization'] = `token ${token}`;
      }
      
      const params = ref ? `?ref=${ref}` : '';
      const response = await fetch(`${url}${params}`, { headers });
      requestCount++;
      
      // Check for rate limit headers that we want to capture
      const rateLimitHeaders: Record<string, string> = {};
      ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset'].forEach(header => {
        const value = response.headers.get(header);
        if (value) rateLimitHeaders[header] = value;
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        
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
      
      // Process in batches to be gentle on API
      const batchSize = 5;
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
            
            // Get file content
            try {
              if (item.download_url) {
                const fileResponse = await fetch(item.download_url);
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
                const contentResponse = await fetch(item.url, { headers });
                requestCount++;
                
                if (contentResponse.ok) {
                  const contentData = await contentResponse.json();
                  if (contentData.encoding === 'base64' && contentData.content) {
                    const decodedContent = atob(contentData.content);
                    files[relPath] = decodedContent;
                  }
                } else if (contentResponse.status === 429) {
                  throw {
                    abuseDetection: true,
                    message: await contentResponse.text()
                  };
                }
              }
            } catch (error: any) {
              if (error.abuseDetection) {
                throw error; // Re-throw to be caught at the higher level
              }
              console.error(`Error fetching content for ${itemPath}:`, error);
            }
          } else if (item.type === 'dir') {
            // Recursively process directories
            await fetchContents(itemPath);
          }
        });
        
        // Wait for all promises in the batch to resolve
        await Promise.all(batchPromises);
        
        // Add a small delay between batches
        if (i + batchSize < contentsList.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    }
    
    // Start the directory crawl from the specified path or root
    await fetchContents(path || '');
  }
  
  console.log(`Fetched ${Object.keys(files).length} files with ${requestCount} API requests using ${method} method.`);
  
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
function shouldIncludeFile(
  filePath: string, 
  fileName: string, 
  includePatterns?: string[], 
  excludePatterns?: string[]
) {
  // Function to check if a path matches a pattern
  function matchesPattern(path: string, pattern: string) {
    // Simple pattern matching implementation
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '__GLOBSTAR__')
      .replace(/\*/g, '[^/]*')
      .replace(/__GLOBSTAR__/g, '.*');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  // Check exclude patterns first - always prioritize exclusions
  if (excludePatterns && excludePatterns.length > 0) {
    const shouldExclude = excludePatterns.some(pattern => 
      matchesPattern(filePath, pattern) || matchesPattern(fileName, pattern)
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
    matchesPattern(fileName, pattern) || matchesPattern(filePath, pattern)
  );
  
  return shouldInclude;
}