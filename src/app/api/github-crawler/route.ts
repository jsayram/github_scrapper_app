import { NextResponse } from 'next/server';

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
    
    // Fetch files recursively
    const result = await crawlGitHubFiles({
      owner,
      repo,
      ref,
      path,
      token,
      useRelativePaths,
      includePatterns,
      excludePatterns,
      maxFileSize: maxFileSize || 500000
    });

    return NextResponse.json(result);
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

// Function to crawl GitHub files - implementation of the Python code in TypeScript
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
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${await response.text()}`);
    }
    
    const contents = await response.json();
    const contentsList = Array.isArray(contents) ? contents : [contents];
    
    for (const item of contentsList) {
      const itemPath = item.path;
      
      // Calculate relative path if requested
      let relPath = itemPath;
      if (useRelativePaths && path && itemPath.startsWith(path)) {
        relPath = itemPath.substring(path.length).replace(/^\//, '');
      }
      
      if (item.type === 'file') {
        // Check if file should be included based on patterns
        if (!shouldIncludeFile(relPath, item.name, includePatterns, excludePatterns)) {
          continue;
        }
        
        // Check file size
        const fileSize = item.size || 0;
        if (fileSize > maxFileSize) {
          skippedFiles.push([itemPath, fileSize]);
          continue;
        }
        
        // Get file content
        if (item.download_url) {
          const fileResponse = await fetch(item.download_url);
          if (fileResponse.ok) {
            files[relPath] = await fileResponse.text();
          }
        } else {
          // Alternative method using content API
          const contentResponse = await fetch(item.url, { headers });
          if (contentResponse.ok) {
            const contentData = await contentResponse.json();
            if (contentData.encoding === 'base64' && contentData.content) {
              const decodedContent = atob(contentData.content);
              files[relPath] = decodedContent;
            }
          }
        }
      } else if (item.type === 'dir') {
        // Recursively process directories
        await fetchContents(itemPath);
      }
    }
  }
  
  await fetchContents(path);
  
  return {
    files,
    stats: {
      downloaded_count: Object.keys(files).length,
      skipped_count: skippedFiles.length,
      skipped_files: skippedFiles,
      base_path: path || null,
      include_patterns: includePatterns,
      exclude_patterns: excludePatterns
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

  // If no include patterns specified, include all files
  if (!includePatterns || includePatterns.length === 0) {
    return true;
  }
  
  // Check if file matches any include pattern
  const shouldInclude = includePatterns.some(pattern => 
    matchesPattern(fileName, pattern) || matchesPattern(filePath, pattern)
  );
  
  // If file should be included but exclude patterns exist, check those
  if (shouldInclude && excludePatterns && excludePatterns.length > 0) {
    const shouldExclude = excludePatterns.some(pattern => 
      matchesPattern(filePath, pattern)
    );
    return !shouldExclude;
  }
  
  return shouldInclude;
}