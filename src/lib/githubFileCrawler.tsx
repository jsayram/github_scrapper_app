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
            `\n\nTip: Add a GitHub personal access token to increase your rate limit from 60 to 5,000 requests per hour.`
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
          `\n\nTip: Add a GitHub personal access token to increase your rate limit from 60 to 5,000 requests per hour.`
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