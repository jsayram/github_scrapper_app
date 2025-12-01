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
 * @param customKey Optional custom API key to use instead of environment variable
 */
export function getApiKey(customKey?: string): string {
  // If a custom key is provided, use it
  if (customKey && customKey.trim()) {
    return customKey.trim();
  }
  
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

  throw new Error('No OpenAI API key found. Please provide an API key in the UI or set OPENAI_API_KEY in your .env.local file.');
}

export interface CallLLMOptions {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  useCache?: boolean;
  onCacheStatus?: (hit: boolean) => void;
  customApiKey?: string; // Custom API key from frontend
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
  customApiKey,
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
    // Initialize OpenAI client with custom or environment API key
    const apiKey = getApiKey(customApiKey);
    
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('OpenAI API key is not configured. Please provide an API key in the UI or set OPENAI_API_KEY in your .env.local file.');
    }
    
    const client = new OpenAI({ apiKey });
    
    console.log(`[LLM] Calling OpenAI API with model: ${model}, using ${customApiKey ? 'custom' : 'environment'} API key`);
    
    // Call OpenAI API
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens,
    });
    
    const result = response.choices[0]?.message?.content || '';
    
    if (!result) {
      throw new Error('OpenAI API returned an empty response');
    }
    
    console.log(`[LLM] Received response (${result.length} chars)`);
    
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
    
  } catch (error: any) {
    console.error('Error calling OpenAI API:', error);
    
    // Provide more helpful error messages
    if (error.code === 'invalid_api_key') {
      throw new Error('Invalid OpenAI API key. Please check your OPENAI_API_KEY in .env.local');
    } else if (error.code === 'insufficient_quota') {
      throw new Error('OpenAI API quota exceeded. Please check your billing at platform.openai.com');
    } else if (error.status === 429) {
      throw new Error('OpenAI API rate limit exceeded. Please wait and try again.');
    } else if (error.message?.includes('<!DOCTYPE')) {
      throw new Error('Received HTML instead of JSON from API. This usually means the API endpoint is not reachable.');
    }
    
    throw error;
  }
}