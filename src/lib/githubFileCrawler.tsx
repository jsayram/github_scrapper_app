export interface FileStats {
  downloaded_count: number;
  skipped_count: number;
  skipped_files: [string, number][];
  excluded_count?: number; // Count of files that matched include patterns but were excluded
  excluded_files?: string[]; // List of files that were excluded despite matching include patterns
  base_path: string | null;
  include_patterns: string[] | null;
  exclude_patterns: string[] | null;
  api_requests?: number;
  method?: string;
}

export interface CrawlerResult {
  files: Record<string, string>;
  stats: FileStats;
}

interface CrawlerOptions {
  repoUrl: string;
  token?: string;
  useRelativePaths: boolean;
  includePatterns: string[];
  excludePatterns: string[];
  maxFileSize: number;
  useMock?: boolean; // Added option to use mock data
}

/**
 * Crawls a GitHub repository to fetch files based on specified patterns
 * @param options Configuration options for the crawler
 * @returns Promise that resolves to CrawlerResult containing files and statistics
 */
export async function githubFileCrawler(options: CrawlerOptions): Promise<CrawlerResult> {
  const { repoUrl, token, useRelativePaths, includePatterns, excludePatterns, maxFileSize} = options;
  
  try {
    console.log(`[GitHub Crawler] Processing repository: ${repoUrl}`);
    
    // Use absolute URL to ensure it works in all contexts
    const apiUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/api/github-crawler`
      : 'http://localhost:3000/api/github-crawler'; // Default for server-side
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        repoUrl,
        token,
        useRelativePaths,
        includePatterns,
        excludePatterns,
        maxFileSize,
      }),
    });

    // Extract rate limit information from response headers if present
    const rateLimit = response.headers.get("x-ratelimit-limit");
    const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");
    const rateLimitReset = response.headers.get("x-ratelimit-reset");

    if (!response.ok) {
      const errorText = await response.text();
      
      // Special handling for bad credentials (401) errors
      if (response.status === 401 || errorText.includes("Bad credentials") || errorText.includes("401")) {
        throw new Error(
          `GitHub authentication failed - Invalid or expired token.` +
            `\n\n🔑 Your GitHub token appears to be invalid or has expired.\n\n` +
            `How to fix this:\n\n` +
            `Option 1: Generate a new token\n` +
            `  1. Go to https://github.com/settings/tokens\n` +
            `  2. Delete the old token if it exists\n` +
            `  3. Click "Generate new token" → "Generate new token (classic)"\n` +
            `  4. Give it a name (e.g., "Tutorial Generator")\n` +
            `  5. Select scopes: "repo" (for private repos) or "public_repo" (for public only)\n` +
            `  6. Click "Generate token" and copy it\n\n` +
            `Option 2: Check your existing token\n` +
            `  • Make sure you copied the entire token (starts with "ghp_" or "github_pat_")\n` +
            `  • Check if the token has expired in GitHub Settings\n` +
            `  • Verify the token has the required permissions\n\n` +
            `Option 3: Update your .env.local file\n` +
            `  • If using GITHUB_TOKEN in .env.local, replace it with the new token\n` +
            `  • Restart the development server after updating`
        );
      }
      
      // Special handling for rate limit errors
      if (response.status === 403 && errorText.includes("rate limit")) {
        let resetTime = "";
        if (rateLimitReset) {
          const resetDate = new Date(parseInt(rateLimitReset) * 1000);
          resetTime = resetDate.toLocaleTimeString();
        }

        throw new Error(
          `GitHub API rate limit exceeded. ` +
            `${rateLimit ? `Limit: ${rateLimit} requests per hour. ` : ""}` +
            `${rateLimitRemaining ? `Remaining: ${rateLimitRemaining} ` : ""}` +
            `${resetTime ? `Rate limit will reset at: ${resetTime}` : ""}` +
            `\n\n🔑 To increase your rate limit from 60 to 5,000 requests per hour:\n\n` +
            `Option 1: Add token in the UI\n` +
            `  • Enter your GitHub token in the "GitHub Token" field above\n\n` +
            `Option 2: Add to .env.local file\n` +
            `  • Create a .env.local file in your project root\n` +
            `  • Add: GITHUB_TOKEN=your_token_here\n\n` +
            `📋 How to get a GitHub Personal Access Token:\n` +
            `  1. Go to https://github.com/settings/tokens\n` +
            `  2. Click "Generate new token" → "Generate new token (classic)"\n` +
            `  3. Give it a name (e.g., "Tutorial Generator")\n` +
            `  4. Select scopes: "repo" (for private repos) or "public_repo" (for public only)\n` +
            `  5. Click "Generate token" and copy it`
        );
      }
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    const result: CrawlerResult = await response.json();
    return {
      files: result.files,
      stats: result.stats
    };
  } catch (err) {
    throw err instanceof Error ? err : new Error("An unknown error occurred");
  }
}

/**
 * Simulates different error conditions for testing purposes
 * @param errorType The type of error to simulate
 * @returns Promise that rejects with a simulated error
 */
export async function simulateError(errorType: string): Promise<never> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 800));

  switch (errorType) {
    case "rate-limit":
      // Simulate a rate limit error
      const resetTime = new Date();
      resetTime.setMinutes(resetTime.getMinutes() + 30); // Reset in 30 minutes

      throw new Error(
        `GitHub API rate limit exceeded. ` +
          `Limit: 60 requests per hour. ` +
          `Remaining: 0 ` +
          `Rate limit will reset at: ${resetTime.toLocaleTimeString()}` +
          `\n\n🔑 To increase your rate limit from 60 to 5,000 requests per hour:\n\n` +
          `Option 1: Add token in the UI\n` +
          `  • Enter your GitHub token in the "GitHub Token" field above\n\n` +
          `Option 2: Add to .env.local file\n` +
          `  • Create a .env.local file in your project root\n` +
          `  • Add: GITHUB_TOKEN=your_token_here\n\n` +
          `📋 How to get a GitHub Personal Access Token:\n` +
          `  1. Go to https://github.com/settings/tokens\n` +
          `  2. Click "Generate new token" → "Generate new token (classic)"\n` +
          `  3. Give it a name (e.g., "Tutorial Generator")\n` +
          `  4. Select scopes: "repo" (for private repos) or "public_repo" (for public only)\n` +
          `  5. Click "Generate token" and copy it`
      );

    case "404":
      // Simulate repository not found
      throw new Error(
        "Error 404: Not Found - The repository does not exist or requires authentication"
      );

    case "401":
      // Simulate unauthorized access
      throw new Error(
        "Error 401: Unauthorized - Authentication is required for this repository"
      );

    case "500":
      // Simulate server error
      throw new Error(
        "Error 500: Internal Server Error - GitHub is experiencing issues"
      );

    case "timeout":
      // Simulate timeout
      await new Promise((resolve) => setTimeout(resolve, 5000));
      throw new Error(
        "Request timed out - The GitHub API is taking too long to respond"
      );

    case "network":
      // Simulate network error
      throw new Error("Network error - Unable to connect to GitHub API");

    case "parse":
      // Simulate JSON parse error
      throw new Error(
        "Failed to parse response from GitHub - Invalid JSON received"
      );

    default:
      // Default error
      throw new Error(`Test error: ${errorType || "unspecified error"}`);
  }
}