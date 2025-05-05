import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import crypto from 'crypto';

// Environmental variables
const LOG_DIR = process.env.LOG_DIR || 'logs';
const CACHE_FILE = process.env.LLM_CACHE_FILE || 'llm_cache.json';
const OPEN_AI_MODEL = process.env.OPEN_AI_MODEL || 'gpt-3.5-turbo';

// TESTING FLAGS - Set to 'true' during development to avoid API calls
// Set this to true to use mock responses instead of real API calls
const USE_MOCK_LLM = process.env.USE_MOCK_LLM === 'true';
// Set this to true to get detailed cache logs in console
const DEBUG_CACHE = process.env.DEBUG_CACHE === 'true';

// Mock responses for testing - add more as needed
const mockResponses: Record<string, string> = {
  // You can add predefined responses for specific prompts here
  "github_repo_summary": "```yaml\n- name: |\n    Repository Crawler\n  description: |\n    A web application that fetches files from GitHub repositories based on patterns.\n  file_indices:\n    - 0 # src/app/page.tsx\n    - 3 # src/lib/githubFileCrawler.tsx\n```",
  "test_pattern_match": "This is a test response for pattern matching"
};

/**
 * Ensures a directory exists
 */
async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    // Ignore if directory already exists
  }
}

/**
 * Logs a message to a daily log file
 */
async function log(message: string): Promise<void> {
  try {
    await ensureDir(LOG_DIR);
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const logFile = path.join(LOG_DIR, `llm_calls_${today}.log`);
    await fs.appendFile(logFile, `${new Date().toISOString()} - ${message}\n`);
  } catch (error) {
    console.error('Error writing to log:', error);
  }
}

/**
 * Gets a hash of the prompt for cache key and log display
 */
function getPromptHash(prompt: string): string {
  return crypto.createHash('md5').update(prompt).digest('hex').substring(0, 8);
}

/**
 * Ensures an OpenAI API key is available
 */
export function getApiKey(): string {
  const candidates = [
    'OPENAI_API_KEY',
    'OPEN_AI_API_KEY',
    'OPENAI_KEY',
    'OPENROUTER_API_KEY',
  ];

  for (const key of candidates) {
    const value = process.env[key];
    if (value) {
      return value;
    }
  }

  throw new Error('No OpenAI API key found in environment variables');
}

export interface CallLLMOptions {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  useCache?: boolean;
  onCacheStatus?: (hit: boolean) => void;
}

/**
 * Mock LLM response generator for testing
 * @param prompt The prompt to generate a response for
 * @returns A mock response based on pattern matching
 */
async function getMockResponse(prompt: string): Promise<string> {
  // Log the mock call
  console.log(`[MOCK LLM] Called with prompt hash: ${getPromptHash(prompt)}`);
  
  // Try to find an exact match in our mock responses
  for (const [key, value] of Object.entries(mockResponses)) {
    if (prompt.includes(key)) {
      console.log(`[MOCK LLM] Found exact match for: ${key}`);
      return value;
    }
  }
  
  // Pattern matching for repo summaries
  if (prompt.includes('analyze the codebase') || prompt.includes('identify abstractions')) {
    return mockResponses.github_repo_summary;
  }
  
  // Default fallback response
  return `This is a mock response for testing. Prompt hash: ${getPromptHash(prompt)}`;
}

/**
 * Calls the OpenAI API with caching support
 * This function should only be used in server components or API routes
 */
export async function callLLM({
  prompt,
  model = OPEN_AI_MODEL,
  temperature = 0.2,
  maxTokens = 4096,
  useCache = true,
  onCacheStatus
}: CallLLMOptions): Promise<string> {
  const promptHash = getPromptHash(prompt);
  
  // Log the prompt
  await log(`PROMPT (${promptHash}): ${prompt.substring(0, 100)}...`);

  // Check cache if enabled
  if (useCache) {
    try {
      const cachePath = path.join(process.cwd(), CACHE_FILE);
      let cache: Record<string, string> = {};
      
      try {
        const data = await fs.readFile(cachePath, 'utf8');
        cache = JSON.parse(data);
        
        if (prompt in cache) {
          await log(`CACHE HIT (${promptHash})`);
          if (DEBUG_CACHE) console.log(`[CACHE HIT] Prompt hash: ${promptHash}`);
          if (onCacheStatus) onCacheStatus(true);
          return cache[prompt];
        }
      } catch (error) {
        // Cache miss or file not found, continue with API call
      }
    } catch (error) {
      console.error('Error accessing cache:', error);
    }
  }

  if (DEBUG_CACHE) console.log(`[CACHE MISS] Prompt hash: ${promptHash}`);
  if (onCacheStatus) onCacheStatus(false);

  // Use mock response if in test mode
  if (USE_MOCK_LLM) {
    const mockResult = await getMockResponse(prompt);
    
    // Update cache if enabled
    if (useCache) {
      await updateCache(prompt, mockResult);
    }
    
    return mockResult;
  }

  try {
    // Initialize OpenAI client
    const apiKey = getApiKey();
    const client = new OpenAI({ apiKey });
    
    // Call OpenAI API
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens,
    });
    
    const result = response.choices[0]?.message?.content || '';
    
    // Update cache if enabled
    if (useCache) {
      await updateCache(prompt, result);
    }
    
    return result;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
}

/**
 * Helper function to update the LLM response cache
 */
async function updateCache(prompt: string, result: string): Promise<void> {
  try {
    const cachePath = path.join(process.cwd(), CACHE_FILE);
    let cache: Record<string, string> = {};
    
    try {
      const data = await fs.readFile(cachePath, 'utf8');
      cache = JSON.parse(data);
    } catch (error) {
      // File doesn't exist yet or other error, use empty cache
    }
    
    cache[prompt] = result;
    await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));
    
    if (DEBUG_CACHE) {
      console.log(`[CACHE UPDATE] Saved response for prompt hash: ${getPromptHash(prompt)}`);
    }
  } catch (error) {
    console.error('Error updating cache:', error);
  }
}