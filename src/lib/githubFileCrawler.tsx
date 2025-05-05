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

// TESTING FLAGS - Set to 'true' during development to avoid GitHub API calls
// Set this to true to use mock responses instead of real API calls
const USE_MOCK_GITHUB = process.env.USE_MOCK_GITHUB === 'true';

// Mock file content for testing - you can expand this as needed
const mockFiles: Record<string, string> = {
  'src/app/page.tsx': 'export default function Home() {\n  return (\n    <main className="flex min-h-screen flex-col items-center justify-between p-24">\n      <h1 className="text-4xl font-bold">Welcome to My Next.js App</h1>\n      <p>Get started by editing this page</p>\n    </main>\n  );\n}',
  'src/app/about/page.tsx': 'export default function About() {\n  return (\n    <div className="p-8">\n      <h1 className="text-2xl font-bold mb-4">About Us</h1>\n      <p>This is a simple Next.js application created for testing purposes.</p>\n    </div>\n  );\n}',
  'src/app/layout.tsx': 'import "./globals.css";\n\nexport const metadata = {\n  title: "Mock Next.js App",\n  description: "A simple Next.js application for testing",\n};\n\nexport default function RootLayout({ children }) {\n  return (\n    <html lang="en">\n      <body>\n        <nav className="bg-gray-800 text-white p-4">\n          <ul className="flex space-x-4">\n            <li><a href="/">Home</a></li>\n            <li><a href="/about">About</a></li>\n          </ul>\n        </nav>\n        {children}\n      </body>\n    </html>\n  );\n}',
  'src/app/globals.css': '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n:root {\n  --foreground-rgb: 0, 0, 0;\n  --background-rgb: 255, 255, 255;\n}\n\nbody {\n  color: rgb(var(--foreground-rgb));\n  background: rgb(var(--background-rgb));\n}',
  'src/components/Button.tsx': 'type ButtonProps = {\n  text: string;\n  onClick?: () => void;\n  variant?: "primary" | "secondary";\n};\n\nexport function Button({ text, onClick, variant = "primary" }: ButtonProps) {\n  const baseClasses = "px-4 py-2 rounded font-medium";\n  const variantClasses = variant === "primary"\n    ? "bg-blue-500 text-white hover:bg-blue-600"\n    : "bg-gray-200 text-gray-800 hover:bg-gray-300";\n    \n  return (\n    <button \n      className={`${baseClasses} ${variantClasses}`}\n      onClick={onClick}\n    >\n      {text}\n    </button>\n  );\n}',
  'src/components/Card.tsx': 'interface CardProps {\n  title: string;\n  description: string;\n  footer?: React.ReactNode;\n}\n\nexport function Card({ title, description, footer }: CardProps) {\n  return (\n    <div className="border rounded-lg overflow-hidden shadow-sm">\n      <div className="p-4">\n        <h3 className="text-lg font-medium">{title}</h3>\n        <p className="mt-2 text-gray-600">{description}</p>\n      </div>\n      {footer && <div className="border-t p-4 bg-gray-50">{footer}</div>}\n    </div>\n  );\n}',
  'src/lib/utils.ts': 'export function formatDate(date: Date) {\n  return new Intl.DateTimeFormat("en-US", {\n    year: "numeric",\n    month: "long",\n    day: "numeric",\n  }).format(date);\n}\n\nexport function classNames(...classes: (string | boolean | undefined)[]) {\n  return classes.filter(Boolean).join(" ");\n}\n\nexport function truncateText(text: string, maxLength: number) {\n  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;\n}',
  'src/hooks/useLocalStorage.ts': 'import { useState, useEffect } from "react";\n\nexport function useLocalStorage<T>(key: string, initialValue: T) {\n  const [storedValue, setStoredValue] = useState<T>(() => {\n    if (typeof window === "undefined") return initialValue;\n    \n    try {\n      const item = window.localStorage.getItem(key);\n      return item ? JSON.parse(item) : initialValue;\n    } catch (error) {\n      console.error(error);\n      return initialValue;\n    }\n  });\n\n  useEffect(() => {\n    if (typeof window === "undefined") return;\n    \n    try {\n      window.localStorage.setItem(key, JSON.stringify(storedValue));\n    } catch (error) {\n      console.error(error);\n    }\n  }, [key, storedValue]);\n\n  return [storedValue, setStoredValue] as const;\n}',
  'README.md': '# Mock Next.js Application\n\nThis is a simple Next.js application created for testing purposes.\n\n## Getting Started\n\nFirst, run the development server:\n\n```bash\nnpm run dev\n# or\nyarn dev\n```\n\nOpen [http://localhost:3000](http://localhost:3000) with your browser to see the result.\n\n## Features\n\n- Simple page routing\n- Basic components\n- Utility functions\n- Custom hooks',
  'package.json': '{\n  "name": "mock-nextjs-app",\n  "version": "0.1.0",\n  "private": true,\n  "scripts": {\n    "dev": "next dev",\n    "build": "next build",\n    "start": "next start",\n    "lint": "next lint"\n  },\n  "dependencies": {\n    "next": "14.0.0",\n    "react": "^18",\n    "react-dom": "^18"\n  },\n  "devDependencies": {\n    "@types/node": "^20",\n    "@types/react": "^18",\n    "@types/react-dom": "^18",\n    "autoprefixer": "^10",\n    "eslint": "^8",\n    "eslint-config-next": "14.0.0",\n    "postcss": "^8",\n    "tailwindcss": "^3",\n    "typescript": "^5"\n  }\n}',
  '.gitignore': 'node_modules\n.next\n.env\n.env.local\n.env.development.local\n.env.test.local\n.env.production.local\nnpm-debug.log*\nyarn-debug.log*\nyarn-error.log*\n.DS_Store\n*.pem\n.vercel\nbuild\ndist',
  'tailwind.config.js': '/** @type {import(\'tailwindcss\').Config} */\nmodule.exports = {\n  content: [\n    "./src/**/*.{js,ts,jsx,tsx}",\n  ],\n  theme: {\n    extend: {},\n  },\n  plugins: [],\n}',
  'tsconfig.json': '{\n  "compilerOptions": {\n    "target": "es5",\n    "lib": ["dom", "dom.iterable", "esnext"],\n    "allowJs": true,\n    "skipLibCheck": true,\n    "strict": true,\n    "forceConsistentCasingInFileNames": true,\n    "noEmit": true,\n    "esModuleInterop": true,\n    "module": "esnext",\n    "moduleResolution": "node",\n    "resolveJsonModule": true,\n    "isolatedModules": true,\n    "jsx": "preserve",\n    "incremental": true,\n    "paths": {\n      "@/*": ["./src/*"]\n    }\n  },\n  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],\n  "exclude": ["node_modules"]\n}',
  'next.config.js': '/** @type {import(\'next\').NextConfig} */\nconst nextConfig = {\n  reactStrictMode: true,\n}\n\nmodule.exports = nextConfig',
  'public/favicon.ico': '[BINARY CONTENT]',
  'public/vercel.svg': '<svg width="283" height="64" viewBox="0 0 283 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M141.04 16c-11.04 0-19 7.2-19 18s8.96 18 20 18c6.67 0 12.55-2.64 16.19-7.09l-7.65-4.42c-2.02 2.21-5.09 3.5-8.54 3.5-4.79 0-8.86-2.5-10.37-6.5h28.02c.22-1.12.35-2.28.35-3.5 0-10.79-7.96-17.99-19-17.99zm-9.46 14.5c1.25-3.99 4.67-6.5 9.45-6.5 4.79 0 8.21 2.51 9.45 6.5h-18.9zM248.72 16c-11.04 0-19 7.2-19 18s8.96 18 20 18c6.67 0 12.55-2.64 16.19-7.09l-7.65-4.42c-2.02 2.21-5.09 3.5-8.54 3.5-4.79 0-8.86-2.5-10.37-6.5h28.02c.22-1.12.35-2.28.35-3.5 0-10.79-7.96-17.99-19-17.99zm-9.45 14.5c1.25-3.99 4.67-6.5 9.45-6.5 4.79 0 8.21 2.51 9.45 6.5h-18.9zM77.38 16c-3.18 0-6.01.96-8.28 2.99-2.27-2.03-5.11-2.99-8.29-2.99-5.3 0-9.43 3.07-9.43 8.46v17.62h7.92V26.38c0-1.78.97-2.99 2.55-2.99 1.57 0 2.54 1.21 2.54 2.99v15.7h7.89v-15.7c0-1.78.97-2.99 2.54-2.99s2.55 1.21 2.55 2.99v15.7h7.92V24.46c0-5.39-4.13-8.46-9.42-8.46M198.66 8.4v29.67h7.92v-14.7c0-1.78.97-2.99 2.54-2.99s2.55 1.21 2.55 2.99v14.7h7.92v-16.62c0-5.39-4.13-8.46-9.42-8.46-3.18 0-6.01.96-8.28 2.99V8.4h-3.23M59.24 42.08V23.88h3.23V16h-3.23v-7.6h-7.89V16h-2.56v7.88h2.55v18.2h7.9zM32.34 34.93c-2.18 0-3.94-1.87-3.94-4.19 0-2.32 1.77-4.19 3.94-4.19 2.18 0 3.94 1.87 3.94 4.19 0 2.32-1.76 4.19-3.94 4.19zm0-16.08c-6.3 0-11.4 5.33-11.4 11.89 0 6.57 5.1 11.89 11.4 11.89 6.3 0 11.4-5.32 11.4-11.89 0-6.56-5.1-11.89-11.4-11.89zM0 34.91v7.17h7.92V30.72c0-1.78.97-2.99 2.54-2.99s2.55 1.21 2.55 2.99v11.36h7.89V29.72c0-5.39-4.13-8.46-9.42-8.46-2.95 0-5.57.81-7.69 2.44l-.8-.57-3 2.1.01 9.68zM285.38 16c-3.3 0-6.1.88-8.33 2.7-2.23-1.81-4.9-2.7-8.18-2.7-5.31 0-9.44 3.07-9.44 8.46v17.63h7.92V26.37c0-1.78.96-2.98 2.54-2.98s2.55 1.2 2.55 2.98v15.71h7.85V26.37c0-1.78.98-2.98 2.55-2.98s2.55 1.2 2.55 2.98v15.71h7.92V24.46c0-5.39-4.12-8.46-9.42-8.46M169.1 24.84c0-1.82 1.6-3.37 3.5-3.37 1.9 0 3.5 1.55 3.5 3.37 0 1.81-1.6 3.36-3.5 3.36-1.9 0-3.5-1.55-3.5-3.36m11.08 0c0-4.05-3.4-7.35-7.58-7.35-4.19 0-7.58 3.3-7.58 7.35 0 4.06 3.4 7.35 7.58 7.35 4.19 0 7.58-3.3 7.58-7.35m-21.05-8.32v.71c-1.4-1.11-3.05-1.8-4.82-1.8-4.8 0-8.7 3.96-8.7 8.84 0 4.88 3.9 8.84 8.7 8.84 1.77 0 3.42-.69 4.82-1.81v.72h2.85V16.52h-2.85zm-4.5 13.57c-3.16 0-5.73-2.63-5.73-5.85 0-3.23 2.57-5.85 5.74-5.85 3.16 0 5.73 2.62 5.73 5.85 0 3.22-2.57 5.85-5.73 5.85"/></svg>',
  'jest.config.js': 'module.exports = {\n  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],\n  setupFilesAfterEnv: ["<rootDir>/setupTests.js"],\n  transform: {\n    "^.+\\\\.(js|jsx|ts|tsx)$": "<rootDir>/node_modules/babel-jest",\n  },\n  moduleNameMapper: {\n    "^@/(.*)$": "<rootDir>/src/$1",\n  },\n}',
  'src/app/api/hello/route.ts': 'import { NextResponse } from "next/server";\n\nexport async function GET() {\n  return NextResponse.json({ message: "Hello World!" });\n}'
};

/**
 * Generates mock GitHub crawler results for testing
 * @param options Configuration options for the crawler
 * @returns Promise that resolves to mock CrawlerResult
 */
async function getMockGithubCrawlerResult(options: CrawlerOptions): Promise<CrawlerResult> {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Apply include/exclude patterns in a simplified way
  const matchedFiles: Record<string, string> = {};
  const skippedFiles: [string, number][] = [];
  
  // Simple pattern matcher (very basic implementation for testing)
  const matchesIncludePattern = (path: string, patterns: string[]): boolean => {
    if (patterns.length === 0) return true;
    return patterns.some(pattern => {
      // Convert glob pattern to regex
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*');
      return new RegExp(regexPattern).test(path);
    });
  };
  
  const matchesExcludePattern = (path: string, patterns: string[]): boolean => {
    return patterns.some(pattern => {
      // Convert glob pattern to regex
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*');
      return new RegExp(regexPattern).test(path);
    });
  };
  
  // Process mock files
  Object.entries(mockFiles).forEach(([path, content]) => {
    if (matchesIncludePattern(path, options.includePatterns)) {
      if (matchesExcludePattern(path, options.excludePatterns)) {
        skippedFiles.push([path, 1]); // 1 = excluded by pattern
      } else {
        matchedFiles[path] = content;
      }
    } else {
      skippedFiles.push([path, 2]); // 2 = didn't match include pattern
    }
  });
  
  return {
    files: matchedFiles,
    stats: {
      downloaded_count: Object.keys(matchedFiles).length,
      skipped_count: skippedFiles.length,
      skipped_files: skippedFiles,
      base_path: options.useRelativePaths ? 'mock-repo-base-path' : null,
      include_patterns: options.includePatterns,
      exclude_patterns: options.excludePatterns,
      api_requests: 1,
      method: 'mock_api'
    }
  };
}

/**
 * Crawls a GitHub repository to fetch files based on specified patterns
 * @param options Configuration options for the crawler
 * @returns Promise that resolves to CrawlerResult containing files and statistics
 */
export async function githubFileCrawler(options: CrawlerOptions): Promise<CrawlerResult> {
  const { repoUrl, token, useRelativePaths, includePatterns, excludePatterns, maxFileSize, useMock = USE_MOCK_GITHUB } = options;
  
  // Use mock data if in test mode or explicitly requested
  if (useMock) {
    return getMockGithubCrawlerResult(options);
  }
  
  try {
    console.log(`[GitHub Crawler] Processing repository: ${repoUrl}`);
    const response = await fetch("/api/github-crawler", {
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