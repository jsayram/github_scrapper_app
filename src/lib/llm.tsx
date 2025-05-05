import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';

// Environmental variables
const LOG_DIR = process.env.LOG_DIR || 'logs';
const CACHE_FILE = process.env.LLM_CACHE_FILE || 'llm_cache.json';
const OPEN_AI_MODEL = process.env.OPEN_AI_MODEL || 'gpt-3.5-turbo';

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
}: CallLLMOptions): Promise<string> {
  // Log the prompt
  await log(`PROMPT: ${prompt}`);

  // Check cache if enabled
  if (useCache) {
    try {
      const cachePath = path.join(process.cwd(), CACHE_FILE);
      let cache: Record<string, string> = {};
      
      try {
        const data = await fs.readFile(cachePath, 'utf8');
        cache = JSON.parse(data);
        
        if (prompt in cache) {
          await log('CACHE HIT');
          return cache[prompt];
        }
      } catch (error) {
        // Cache miss or file not found, continue with API call
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
        
        try {
          const data = await fs.readFile(cachePath, 'utf8');
          cache = JSON.parse(data);
        } catch (error) {
          // File doesn't exist yet or other error, use empty cache
        }
        
        cache[prompt] = result;
        await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));
      } catch (error) {
        console.error('Error updating cache:', error);
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
}