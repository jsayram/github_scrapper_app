import fs from 'fs/promises';
import path from 'path';
import { OpenAI } from 'openai';

// Environmental variables and constants
const LOG_DIR = process.env.LOG_DIR || 'logs';
const CACHE_FILE = process.env.LLM_CACHE_FILE || 'llm_cache.json';
const OPEN_AI_MODEL = process.env.OPEN_AI_MODEL || 'gpt-3.5-turbo';

// Ensure logs directory exists
async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    // Ignore if directory already exists
  }
}

// Simple logging
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
  // Log the prompt
  await log(`PROMPT: ${prompt.substring(0, 100)}...`);
  
  // Check cache if enabled
  if (useCache) {
    try {
      const cachePath = path.join(process.cwd(), CACHE_FILE);
      let cache: Record<string, string> = {};
      
      if (await fs.access(cachePath).then(() => true).catch(() => false)) {
        try {
          const data = await fs.readFile(cachePath, 'utf8');
          cache = JSON.parse(data);
          
          if (prompt in cache) {
            console.log('[CACHE HIT] Using cached response');
            await log('CACHE HIT');
            if (onCacheStatus) onCacheStatus(true);
            return cache[prompt];
          }
        } catch (error) {
          console.warn('Failed to load cache:', error);
          await log(`Failed to load cache: ${error}`);
        }
      }
    } catch (error) {
      console.error('Error accessing cache:', error);
    }
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
      try {
        const cachePath = path.join(process.cwd(), CACHE_FILE);
        let cache: Record<string, string> = {};
        
        // Try to read existing cache
        try {
          if (await fs.access(cachePath).then(() => true).catch(() => false)) {
            const data = await fs.readFile(cachePath, 'utf8');
            cache = JSON.parse(data);
          }
        } catch (error) {
          console.warn('Failed to load existing cache:', error);
        }
        
        // Add new entry to cache
        cache[prompt] = result;
        
        // Write updated cache back to file
        await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));
        console.log('[CACHE UPDATE] Cached new response');
        
      } catch (error) {
        console.error('Error updating cache:', error);
        await log(`Failed to save cache: ${error}`);
      }
    }
    
    if (onCacheStatus) onCacheStatus(false);
    return result;
    
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
}